import { useState, useEffect, useRef, useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { IMaskInput } from "react-imask";
import {
  Eye,
  EyeOff,
  Loader2,
  Lock,
  User,
  Mail,
  Phone,
  FileText,
  ShieldCheck,
  ArrowRight,
  Crown,
  Check,
  Users,
  Zap,
  CreditCard,
  Sparkles,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { trackPageView, trackInitiateCheckout } from "@/services/metaPixel";

// Configuração dos planos (sincronizado com /api/create-payment.js)
const PLAN_CONFIG = {
  pro: {
    key: "pro",
    period: "annual",
    name: "Anual",
    price: "R$ 19",
    priceNote: "/mês",
    totalNote: "Cobrado R$ 228/ano · economia de R$ 120",
    features: [
      "Tudo do Mensal sem limites",
      "Propostas e clientes ilimitados",
      "Suporte prioritário no WhatsApp",
    ],
    badge: "Mais Escolhido",
  },
  essential: {
    key: "essential",
    period: "monthly",
    name: "Mensal",
    price: "R$ 29",
    priceNote: "/mês",
    totalNote: "Cancele quando quiser",
    features: [
      "Propostas profissionais com sua marca",
      "Cliente aprova pelo celular",
      "Notificação quando cliente abrir",
      "30 propostas por mês",
    ],
    badge: null,
  },
} as const;

// Formatadores
function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 10) {
    return digits.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").replace(/-$/, "");
  }
  return digits.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3").replace(/-$/, "");
}

function formatCpfCnpj(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 11) {
    return digits
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  return digits
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

// Validação real de CPF com dígitos verificadores
function isValidCPF(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return false;
  if (/^(\d)\1+$/.test(digits)) return false; // 111.111.111-11 etc
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(digits[i]) * (10 - i);
  let d1 = 11 - (sum % 11);
  if (d1 >= 10) d1 = 0;
  if (d1 !== parseInt(digits[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i]) * (11 - i);
  let d2 = 11 - (sum % 11);
  if (d2 >= 10) d2 = 0;
  return d2 === parseInt(digits[10]);
}

// Validação real de CNPJ com dígitos verificadores
function isValidCNPJ(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, "");
  if (digits.length !== 14) return false;
  if (/^(\d)\1+$/.test(digits)) return false;
  const calc = (base: string, weights: number[]) => {
    let sum = 0;
    for (let i = 0; i < weights.length; i++) sum += parseInt(base[i]) * weights[i];
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const d1 = calc(digits.slice(0, 12), w1);
  if (d1 !== parseInt(digits[12])) return false;
  const d2 = calc(digits.slice(0, 13), w2);
  return d2 === parseInt(digits[13]);
}

function isValidCpfOrCnpj(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 11) return isValidCPF(digits);
  if (digits.length === 14) return isValidCNPJ(digits);
  return false;
}

// Fetch com retry + timeout (robustez no pagamento)
async function fetchWithRetry(
  url: string,
  options: RequestInit & { timeoutMs?: number } = {},
  maxAttempts = 3
): Promise<Response> {
  const { timeoutMs = 30000, ...rest } = options;
  let lastError: Error = new Error("Falha desconhecida");
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...rest, signal: controller.signal });
      clearTimeout(timer);
      // Retry em 5xx ou network error — 4xx é erro de validação, não retry
      if (res.status >= 500 && attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 800 * attempt));
        continue;
      }
      return res;
    } catch (err) {
      clearTimeout(timer);
      lastError = err as Error;
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 800 * attempt));
      }
    }
  }
  throw lastError;
}

// Mapeia erros conhecidos do Asaas / backend para mensagens amigáveis
function humanizeError(raw: string | undefined): string {
  if (!raw) return "Algo deu errado. Tente novamente em alguns segundos.";
  const msg = raw.toLowerCase();
  if (msg.includes("cpf") || msg.includes("cnpj")) {
    return "CPF ou CNPJ inválido. Confere os números e tenta de novo.";
  }
  if (msg.includes("email")) return "E-mail inválido ou já cadastrado. Tenta entrar ou usar outro.";
  if (msg.includes("senha") || msg.includes("password")) return "Senha fraca. Use pelo menos 8 caracteres.";
  if (msg.includes("network") || msg.includes("failed to fetch") || msg.includes("aborted")) {
    return "Sem conexão. Verifica sua internet e tenta de novo.";
  }
  if (msg.includes("timeout")) return "Conexão lenta. Tenta de novo em alguns segundos.";
  return raw;
}

const DRAFT_KEY = "fechaaqui_checkout_draft";

export default function Checkout() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { register, login, isAuthenticated, user } = useAuth();

  // Plano a partir da URL (default: pro)
  const planParam = (searchParams.get("plan") || "pro") as keyof typeof PLAN_CONFIG;
  const plan = PLAN_CONFIG[planParam] || PLAN_CONFIG.pro;

  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<string>("");

  const [formData, setFormData] = useState(() => {
    // Auto-recover rascunho do localStorage (form crash / refresh).
    // So restaura valores COMPLETOS — senao ficava "(3" no phone, "a"
    // no nome, etc. parados entre sessoes.
    const empty = { name: "", email: "", phone: "", cpfCnpj: "", password: "", acceptTerms: false };
    if (typeof window === "undefined") return empty;
    try {
      const draft = localStorage.getItem(DRAFT_KEY);
      if (!draft) return empty;
      const parsed = JSON.parse(draft);
      const name = typeof parsed.name === "string" && parsed.name.trim().length >= 5 ? parsed.name : "";
      const email = typeof parsed.email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parsed.email.trim()) ? parsed.email : "";
      const phoneDigits = typeof parsed.phone === "string" ? parsed.phone.replace(/\D/g, "") : "";
      const phone = phoneDigits.length >= 10 ? parsed.phone : "";
      const cpfDigits = typeof parsed.cpfCnpj === "string" ? parsed.cpfCnpj.replace(/\D/g, "") : "";
      const cpfCnpj = cpfDigits.length === 11 || cpfDigits.length === 14 ? parsed.cpfCnpj : "";
      return { name, email, phone, cpfCnpj, password: "", acceptTerms: false };
    } catch {
      return empty;
    }
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [emailAlreadyExists, setEmailAlreadyExists] = useState(false);
  const hasTracked = useRef(false);
  const submitLockRef = useRef(false); // previne double-submit

  // Auto-save rascunho — so salva valores COMPLETOS, evita "(3" no phone,
  // "a" no nome etc. parados entre sessoes.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const timer = setTimeout(() => {
      try {
        const nameOk = formData.name.trim().length >= 5;
        const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim());
        const phoneOk = formData.phone.replace(/\D/g, "").length >= 10;
        const cpfDigits = formData.cpfCnpj.replace(/\D/g, "").length;
        const cpfOk = cpfDigits === 11 || cpfDigits === 14;
        const safe = {
          name: nameOk ? formData.name : "",
          email: emailOk ? formData.email : "",
          phone: phoneOk ? formData.phone : "",
          cpfCnpj: cpfOk ? formData.cpfCnpj : "",
        };
        if (safe.name || safe.email || safe.phone || safe.cpfCnpj) {
          localStorage.setItem(DRAFT_KEY, JSON.stringify(safe));
        } else {
          // tudo incompleto → limpa draft antigo pra nao reaparecer
          localStorage.removeItem(DRAFT_KEY);
        }
      } catch { /* ignore */ }
    }, 400);
    return () => clearTimeout(timer);
  }, [formData.name, formData.email, formData.phone, formData.cpfCnpj]);

  // Tracking PageView + InitiateCheckout
  useEffect(() => {
    if (!hasTracked.current) {
      hasTracked.current = true;
      trackPageView();
      // InitiateCheckout com dados do plano selecionado
      const planValue = plan.key === "pro" ? 228 : 29;
      trackInitiateCheckout({
        planId: plan.key,
        planName: plan.name,
        value: planValue,
        currency: "BRL",
      });
    }
  }, [plan.key, plan.name]);

  // Se usuario ja esta LOGADO: puxa dados do profile e tenta pagar DIRETO
  // (sem mandar pro /upgrade). Se falta CPF, so preenche o form.
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;

    let cancelled = false;
    (async () => {
      setIsLoading(true);
      setLoadingStep("Preparando pagamento...");

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, phone, cnpj")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled) return;

      const nameFromProfile = profile?.full_name || user.name || "";
      const phoneFromProfile = profile?.phone || "";
      const cpfFromProfile = profile?.cnpj || "";

      // Pre-preenche o form com o que tiver
      setFormData((f) => ({
        ...f,
        name: nameFromProfile,
        email: user.email || "",
        phone: phoneFromProfile ? formatPhone(phoneFromProfile) : f.phone,
        cpfCnpj: cpfFromProfile ? formatCpfCnpj(cpfFromProfile) : f.cpfCnpj,
      }));

      // Se tem CPF → pagamento direto (AUTOPAY)
      if (cpfFromProfile && isValidCpfOrCnpj(cpfFromProfile)) {
        setLoadingStep("Gerando link de pagamento...");
        try {
          const res = await fetchWithRetry("/api/create-payment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              plan: plan.key,
              period: plan.period,
              userId: user.id,
              customerEmail: user.email,
              customerName: nameFromProfile,
              cpfCnpj: cpfFromProfile,
              brand: "fechaaqui",
            }),
            timeoutMs: 30000,
          }, 3);
          const data = await res.json();
          if (cancelled) return;
          if (res.ok && data.success && data.paymentUrl) {
            setLoadingStep("Redirecionando para o pagamento...");
            try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
            window.location.href = data.paymentUrl;
            return;
          }
          toast.error(humanizeError(data?.error || "Erro ao gerar pagamento"));
        } catch (e) {
          if (!cancelled) toast.error("Sem conexao. Tenta de novo.");
        }
      }

      // Sem CPF ou falhou autopay — mostra form (ja pre-preenchido)
      setIsLoading(false);
      setLoadingStep("");
    })();

    return () => { cancelled = true; };
  }, [isAuthenticated, user?.id, plan.key, plan.period]);

  // Validações em tempo real
  const isNameValid = formData.name.trim().split(/\s+/).length >= 2 && formData.name.trim().length >= 5;
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(formData.email.trim());
  const isPhoneValid = formData.phone.replace(/\D/g, "").length >= 10;
  const isCpfCnpjValid = isValidCpfOrCnpj(formData.cpfCnpj); // ✅ validação real com dígitos verificadores
  const isPasswordValid = formData.password.length >= 8;

  // Auto-detect CPF vs CNPJ pra UI dinâmica
  const cpfCnpjDigitCount = formData.cpfCnpj.replace(/\D/g, "").length;
  const cpfCnpjType: "cpf" | "cnpj" | "none" =
    cpfCnpjDigitCount === 0 ? "none" : cpfCnpjDigitCount > 11 ? "cnpj" : "cpf";

  // Força da senha: 0 (vazia) → 1 (fraca) → 2 (boa) → 3 (forte)
  const passwordStrength = (() => {
    const p = formData.password;
    if (!p) return 0;
    let score = 0;
    if (p.length >= 8) score++;
    if (/[A-Z]/.test(p) && /[a-z]/.test(p)) score++;
    if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) score++;
    return Math.max(1, score);
  })();

  const isFormValid =
    isNameValid && isEmailValid && isPhoneValid && isCpfCnpjValid && isPasswordValid && formData.acceptTerms;

  function validateForm(): boolean {
    const newErrors: Record<string, string> = {};

    if (!isNameValid) {
      newErrors.name = "Informe seu nome e sobrenome";
    }
    if (!isEmailValid) {
      newErrors.email = "E-mail inválido — verifica se tá certo";
    }
    if (!isPhoneValid) {
      newErrors.phone = "Telefone inválido (com DDD)";
    }
    const digits = formData.cpfCnpj.replace(/\D/g, "");
    if (digits.length === 0) {
      newErrors.cpfCnpj = "Informe seu CPF ou CNPJ";
    } else if (digits.length !== 11 && digits.length !== 14) {
      newErrors.cpfCnpj = "CPF tem 11 dígitos, CNPJ tem 14";
    } else if (!isCpfCnpjValid) {
      newErrors.cpfCnpj = digits.length === 11 ? "CPF inválido — confere os números" : "CNPJ inválido — confere os números";
    }
    if (!isPasswordValid) {
      newErrors.password = "Senha precisa ter no mínimo 8 caracteres";
    }
    if (!formData.acceptTerms) {
      newErrors.acceptTerms = "Aceite os termos pra continuar";
    }

    setErrors(newErrors);

    // Marca todos campos com erro como touched (mostra mensagens inline)
    if (Object.keys(newErrors).length > 0) {
      setTouched((t) => ({ ...t, ...Object.fromEntries(Object.keys(newErrors).map((k) => [k, true])) }));

      // Auto-scroll pro primeiro erro (com delay maior pra iOS)
      const firstErrorId = Object.keys(newErrors)[0];
      setTimeout(() => {
        const el = document.getElementById(firstErrorId);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          // Foca depois do scroll terminar (iOS Safari tem problema com focus durante scroll)
          setTimeout(() => el.focus({ preventScroll: true }), 400);
        }
      }, 150);
    }

    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitLockRef.current) return;
    if (!validateForm()) return;

    submitLockRef.current = true;
    setIsLoading(true);
    try {
      const email = formData.email.trim().toLowerCase();
      const phoneDigits = formData.phone.replace(/\D/g, "");
      const cpfCnpjDigits = formData.cpfCnpj.replace(/\D/g, "");

      // Captura dados de tracking do browser (fbp/fbc/IP/UA) pra CAPI
      let trackingData: any = {
        userAgent: navigator.userAgent,
        sourceUrl: window.location.href,
      };
      try {
        const [fbpMod, cmMod, ipMod] = await Promise.all([
          import("@/tracking/utils/CookieManager").then((m) => m.CookieManager.getFbpWithPixelWait()),
          import("@/tracking/utils/CookieManager").then((m) => m.CookieManager.getFbcWithFallback()),
          import("@/tracking/utils/IPDetector").then((m) => m.IPDetector.getClientIPForCAPI()),
        ]);
        trackingData.fbp = fbpMod || undefined;
        trackingData.fbc = cmMod || undefined;
        trackingData.clientIP = ipMod || undefined;
      } catch (e) {
        console.warn("tracking data capture failed:", e);
      }

      // Cria conta + pagamento num unico endpoint (create-payment aceita registro
      // inline quando nao vem userId) — SEM login automatico no browser.
      // Cliente so acessa apos pagar e fazer login manualmente em /login.
      setLoadingStep("Criando sua conta...");
      let resp: Response;
      try {
        resp = await fetchWithRetry("/api/create-payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            // userId intencionalmente omitido → triggers register-and-pay path
            plan: plan.key,
            period: plan.period,
            customerEmail: email,
            customerName: formData.name.trim(),
            cpfCnpj: cpfCnpjDigits,
            password: formData.password,
            phone: phoneDigits,
            trackingData,
            brand: "fechaaqui",
          }),
          timeoutMs: 30000,
        }, 3);
      } catch (netErr) {
        console.error("Erro de rede:", netErr);
        toast.error("Conexao instavel. Verifica sua internet e tenta de novo.");
        submitLockRef.current = false;
        setIsLoading(false);
        return;
      }

      let data: any;
      try {
        data = await resp.json();
      } catch {
        toast.error("Resposta inesperada do servidor.");
        submitLockRef.current = false;
        setIsLoading(false);
        return;
      }

      if (resp.status === 409 || data.alreadyExists) {
        setErrors({
          email: "Este e-mail já tem cadastro no FechaAqui.",
        });
        setTouched((t) => ({ ...t, email: true }));
        setEmailAlreadyExists(true);
        submitLockRef.current = false;
        setIsLoading(false);
        // Scroll pro campo de email pro usuário ver a mensagem
        setTimeout(() => {
          document.getElementById("email")?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 150);
        return;
      }

      if (!resp.ok || !data.success || !data.paymentUrl) {
        const msg = data?.error || "Erro ao processar cadastro";
        toast.error(humanizeError(msg));
        submitLockRef.current = false;
        setIsLoading(false);
        return;
      }

      setLoadingStep("Redirecionando para o pagamento...");
      try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
      window.location.href = data.paymentUrl;
    } catch (error) {
      console.error("Erro no checkout:", error);
      toast.error(humanizeError((error as Error)?.message));
      submitLockRef.current = false;
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-jd-bg font-body text-jd-ink">
      {/* Loading overlay — redirecionamento pro pagamento, visual editorial */}
      {isLoading && (() => {
        const progressPct =
          loadingStep === "Criando sua conta..." ? 25 :
          loadingStep === "Preparando pagamento..." ? 55 :
          loadingStep === "Gerando link de pagamento..." ? 80 :
          loadingStep === "Redirecionando para o pagamento..." ? 100 : 10;

        return (
          <div className="fixed inset-0 z-[100] bg-jd-bg flex items-center justify-center p-6">
            <div className="max-w-md w-full">
              {/* Logo/marca sutil no topo */}
              <div className="flex justify-center mb-10">
                <Logo size="sm" />
              </div>

              {/* Titulo serifado editorial */}
              <h3 className="font-display text-[28px] md:text-[34px] text-jd-ink text-center leading-[1.15] tracking-[-0.015em] font-medium mb-3">
                {loadingStep === "Redirecionando para o pagamento..." ? (
                  <>Pronto! <em className="italic text-jd-accent font-normal">Indo pro pagamento...</em></>
                ) : (
                  <>Preparando seu <em className="italic text-jd-accent font-normal">acesso.</em></>
                )}
              </h3>

              {/* Subtitle discreto */}
              <p className="text-center text-jd-muted text-[15px] mb-10 leading-relaxed italic font-display">
                {loadingStep === "Redirecionando para o pagamento..."
                  ? "Você será levado pro pagamento seguro em instantes."
                  : "Um minutinho enquanto a gente monta tudo pra você."}
              </p>

              {/* Barra de progresso editorial */}
              <div className="mb-10">
                <div className="h-0.5 bg-jd-border rounded-full overflow-hidden">
                  <div
                    className="h-full bg-jd-accent transition-all duration-700 ease-out"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] uppercase tracking-[0.22em] text-jd-muted mt-3 font-medium">
                  <span className={progressPct >= 25 ? "text-jd-accent" : ""}>Conta</span>
                  <span className={progressPct >= 55 ? "text-jd-accent" : ""}>Preparando</span>
                  <span className={progressPct >= 80 ? "text-jd-accent" : ""}>Link</span>
                  <span className={progressPct >= 100 ? "text-jd-accent" : ""}>Asaas</span>
                </div>
              </div>

              {/* Lista vertical discreta (sem caixa) */}
              <div className="space-y-3.5">
                <LoadingStep label="Criando sua conta" done={progressPct > 25} active={progressPct === 25 || (progressPct > 10 && progressPct < 25)} />
                <LoadingStep label="Preparando pagamento" done={progressPct > 55} active={progressPct === 55} />
                <LoadingStep label="Gerando link seguro" done={progressPct > 80} active={progressPct === 80} />
                <LoadingStep label="Redirecionando pro Asaas" done={false} active={progressPct === 100} />
              </div>

              {/* Trust reminder editorial */}
              <div className="flex items-center justify-center gap-2 mt-10 pt-6 border-t border-jd-border">
                <Lock size={13} className="text-jd-accent" strokeWidth={1.5} />
                <p className="text-xs text-jd-muted italic font-display">
                  Pagamento 100% seguro · não feche esta página
                </p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Header com trust bar — paleta terra/natureza */}
      <header className="bg-jd-surface border-b border-jd-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/">
            <Logo />
          </Link>
          <div className="hidden md:flex items-center gap-5 text-xs text-jd-muted">
            <div className="flex items-center gap-1.5">
              <Lock size={13} className="text-jd-accent" strokeWidth={1.5} />
              <span>Conexão segura SSL</span>
            </div>
            <div className="flex items-center gap-1.5">
              <ShieldCheck size={13} className="text-jd-accent" strokeWidth={1.5} />
              <span>Garantia de 7 dias</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Users size={13} className="text-jd-accent" strokeWidth={1.5} />
              <span>+500 prestadores já usam</span>
            </div>
          </div>
          <div className="md:hidden flex items-center gap-1.5 text-xs text-jd-muted">
            <Lock size={13} className="text-jd-accent" strokeWidth={1.5} />
            <span>Checkout seguro</span>
          </div>
        </div>
        {/* Barra de progresso sóbria */}
        <div className="bg-jd-bg border-t border-jd-border">
          <div className="container mx-auto px-4 py-2.5 flex items-center justify-center gap-2 text-xs font-medium">
            <div className="flex items-center gap-1.5 text-jd-ink">
              <div className="w-5 h-5 rounded-full bg-jd-accent text-white flex items-center justify-center text-[10px] font-medium">1</div>
              <span>Seus dados</span>
            </div>
            <div className="w-6 h-px bg-jd-border" />
            <div className="flex items-center gap-1.5 text-jd-muted">
              <div className="w-5 h-5 rounded-full bg-jd-surface border border-jd-border flex items-center justify-center text-[10px] font-medium">2</div>
              <span>Pagamento</span>
            </div>
            <div className="w-6 h-px bg-jd-border" />
            <div className="flex items-center gap-1.5 text-jd-muted/70">
              <div className="w-5 h-5 rounded-full bg-jd-surface border border-jd-border flex items-center justify-center text-[10px] font-medium">3</div>
              <span>Acesso</span>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 md:py-12">
        <div className="max-w-5xl mx-auto grid md:grid-cols-[1fr,400px] gap-8 items-start">
          {/* Formulário */}
          <div className="order-2 md:order-1">
            <div className="bg-jd-surface rounded-xl border border-jd-border p-5 md:p-8 animate-card-in">
              <p className="text-xs font-semibold text-jd-accent uppercase tracking-[0.18em] mb-3">
                Passo 1 de 3 · leva 1 minuto
              </p>
              <h1 className="font-display text-[26px] md:text-4xl text-jd-ink tracking-[-0.015em] leading-[1.1] font-medium mb-2">
                Cria sua conta e <em className="italic text-jd-accent font-normal">começa hoje.</em>
              </h1>
              <p className="text-[15px] md:text-base text-jd-muted mb-6 md:mb-8 leading-relaxed">
                Acesso liberado na hora depois do pagamento. Primeira proposta em 3 minutos.
              </p>

              <form
                onSubmit={handleSubmit}
                className="space-y-4 md:space-y-5"
                onFocus={(e) => {
                  // Mobile: centraliza campo ativo pra teclado nao cobrir.
                  // Delay 300ms deixa o teclado terminar de subir antes de scrollar.
                  const target = e.target;
                  if (window.innerWidth < 768 && (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
                    setTimeout(() => {
                      target.scrollIntoView({ behavior: "smooth", block: "center" });
                    }, 300);
                  }
                }}
              >
                {/* Nome */}
                <div className="space-y-1">
                  <label htmlFor="name" className="text-sm font-medium text-jd-ink">Nome completo</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-jd-muted w-4 h-4" />
                    <Input
                      id="name"
                      type="text"
                      placeholder="João da Silva"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      onBlur={() => setTouched((t) => ({ ...t, name: true }))}
                      className={`pl-10 h-12 rounded-xl border-jd-border text-base focus-visible:ring-0 focus-visible:border-jd-accent focus-visible:outline-none ${isNameValid ? "pr-10 border-jd-accent/40" : ""} ${touched.name && errors.name ? "border-red-500" : ""}`}
                      autoComplete="name"
                      autoCapitalize="words"
                      autoCorrect="off"
                      spellCheck={false}
                      enterKeyHint="next"
                      aria-invalid={touched.name && !!errors.name}
                      aria-describedby={touched.name && errors.name ? "name-error" : undefined}
                      disabled={isLoading}
                    />
                    {isNameValid && (
                      <Check className="absolute right-3 top-1/2 -translate-y-1/2 text-jd-accent w-4 h-4" strokeWidth={2} />
                    )}
                  </div>
                  {touched.name && errors.name && <p id="name-error" role="alert" className="text-xs text-red-500">{errors.name}</p>}
                </div>

                {/* Email */}
                <div className="space-y-1">
                  <label htmlFor="email" className="text-sm font-medium text-jd-ink">E-mail</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-jd-muted w-4 h-4" />
                    <Input
                      id="email"
                      type="email"
                      inputMode="email"
                      placeholder="voce@exemplo.com"
                      value={formData.email}
                      onChange={(e) => {
                        setFormData({ ...formData, email: e.target.value });
                        if (emailAlreadyExists) setEmailAlreadyExists(false);
                      }}
                      onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                      className={`pl-10 h-12 rounded-xl border-jd-border text-base focus-visible:ring-0 focus-visible:border-jd-accent focus-visible:outline-none ${isEmailValid && !emailAlreadyExists ? "pr-10 border-jd-accent/40" : ""} ${(touched.email && errors.email) || emailAlreadyExists ? "border-red-500" : ""}`}
                      autoComplete="email"
                      autoCapitalize="none"
                      autoCorrect="off"
                      enterKeyHint="next"
                      spellCheck={false}
                      aria-invalid={(touched.email && !!errors.email) || emailAlreadyExists}
                      aria-describedby={(touched.email && errors.email) || emailAlreadyExists ? "email-error" : undefined}
                      disabled={isLoading}
                    />
                    {isEmailValid && (
                      <Check className="absolute right-3 top-1/2 -translate-y-1/2 text-jd-accent w-4 h-4" strokeWidth={2} />
                    )}
                  </div>
                  {emailAlreadyExists ? (
                    <div id="email-error" role="alert" className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-sm font-semibold text-amber-900 mb-1.5">E-mail já cadastrado no FechaAqui</p>
                      <p className="text-xs text-amber-800 leading-relaxed mb-2.5">
                        Já existe uma conta com esse e-mail. Você pode entrar com sua senha ou usar outro e-mail pra criar nova conta.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Link
                          to="/login"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-950 hover:bg-neutral-800 text-white text-xs font-semibold rounded-full transition-colors"
                        >
                          Entrar na minha conta
                          <ArrowRight size={12} strokeWidth={2.5} />
                        </Link>
                        <button
                          type="button"
                          onClick={() => {
                            setEmailAlreadyExists(false);
                            setFormData({ ...formData, email: "" });
                            setTimeout(() => document.getElementById("email")?.focus(), 100);
                          }}
                          className="inline-flex items-center px-3 py-1.5 bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 text-xs font-semibold rounded-full transition-colors"
                        >
                          Usar outro e-mail
                        </button>
                      </div>
                    </div>
                  ) : (
                    touched.email && errors.email && <p id="email-error" role="alert" className="text-xs text-red-500">{errors.email}</p>
                  )}
                </div>

                {/* Telefone + CPF/CNPJ lado a lado */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label htmlFor="phone" className="text-sm font-medium text-jd-ink">Telefone / WhatsApp</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-jd-muted w-4 h-4" />
                      <IMaskInput
                        id="phone"
                        mask={[
                          { mask: "(00) 0000-0000" },
                          { mask: "(00) 00000-0000" },
                        ]}
                        type="tel"
                        inputMode="tel"
                        placeholder="(11) 99999-9999"
                        value={formData.phone}
                        onAccept={(value) => setFormData({ ...formData, phone: value as string })}
                        onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
                        className={`flex h-12 w-full rounded-xl border bg-background pl-10 pr-3 py-2 text-base border-jd-border ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0 focus-visible:border-jd-accent disabled:cursor-not-allowed disabled:opacity-50 ${isPhoneValid ? "pr-10 border-jd-accent/40" : ""} ${touched.phone && errors.phone ? "border-red-500" : ""}`}
                        autoComplete="tel-national"
                        enterKeyHint="next"
                        aria-invalid={touched.phone && !!errors.phone}
                        aria-describedby={touched.phone && errors.phone ? "phone-error" : undefined}
                        disabled={isLoading}
                      />
                      {isPhoneValid && (
                        <Check className="absolute right-3 top-1/2 -translate-y-1/2 text-jd-accent w-4 h-4" strokeWidth={2} />
                      )}
                    </div>
                    {touched.phone && errors.phone && <p id="phone-error" role="alert" className="text-xs text-red-500">{errors.phone}</p>}
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <label htmlFor="cpfCnpj" className="text-sm font-medium text-jd-ink">CPF ou CNPJ</label>
                      {cpfCnpjType !== "none" && (
                        <span className={`text-[9px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded ${
                          isCpfCnpjValid
                            ? "bg-jd-accent/10 text-jd-accent"
                            : "bg-jd-bg text-jd-muted"
                        }`}>
                          {cpfCnpjType === "cpf" ? "CPF" : "CNPJ"}
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <FileText className="absolute left-3 top-1/2 -translate-y-1/2 text-jd-muted w-4 h-4" />
                      <IMaskInput
                        id="cpfCnpj"
                        mask={[
                          { mask: "000.000.000-00" },
                          { mask: "00.000.000/0000-00" },
                        ]}
                        dispatch={(appended, dynamicMasked) => {
                          const num = (dynamicMasked.value + appended).replace(/\D/g, "");
                          return dynamicMasked.compiledMasks[num.length > 11 ? 1 : 0];
                        }}
                        type="text"
                        inputMode="numeric"
                        placeholder={cpfCnpjType === "cnpj" ? "00.000.000/0000-00" : "000.000.000-00"}
                        value={formData.cpfCnpj}
                        onAccept={(value) => setFormData({ ...formData, cpfCnpj: value as string })}
                        onBlur={() => setTouched((t) => ({ ...t, cpfCnpj: true }))}
                        className={`flex h-12 w-full rounded-xl border bg-background pl-10 pr-3 py-2 text-base border-jd-border ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0 focus-visible:border-jd-accent disabled:cursor-not-allowed disabled:opacity-50 ${isCpfCnpjValid ? "pr-10 border-jd-accent/40" : ""} ${touched.cpfCnpj && errors.cpfCnpj ? "border-red-500" : ""}`}
                        // @ts-ignore — enterKeyHint propaga pro input interno
                        enterKeyHint="next"
                        autoComplete="off"
                        aria-invalid={touched.cpfCnpj && !!errors.cpfCnpj}
                        aria-describedby={touched.cpfCnpj && errors.cpfCnpj ? "cpf-error" : undefined}
                        disabled={isLoading}
                      />
                      {isCpfCnpjValid && (
                        <Check className="absolute right-3 top-1/2 -translate-y-1/2 text-jd-accent w-4 h-4 animate-in fade-in zoom-in duration-200" strokeWidth={2} />
                      )}
                    </div>
                    {touched.cpfCnpj && errors.cpfCnpj && <p id="cpf-error" role="alert" className="text-xs text-red-500">{errors.cpfCnpj}</p>}
                  </div>
                </div>

                {/* Senha */}
                <div className="space-y-1">
                  <label htmlFor="password" className="text-sm font-medium text-jd-ink">Senha (mínimo 8 caracteres)</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-jd-muted w-4 h-4" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="********"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                      className={`pl-10 pr-12 h-12 rounded-xl border-jd-border text-base focus-visible:ring-0 focus-visible:border-jd-accent focus-visible:outline-none ${touched.password && errors.password ? "border-red-500" : ""}`}
                      autoComplete="new-password"
                      autoCapitalize="none"
                      autoCorrect="off"
                      enterKeyHint="done"
                      spellCheck={false}
                      aria-invalid={touched.password && !!errors.password}
                      aria-describedby={touched.password && errors.password ? "password-error" : undefined}
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                      aria-pressed={showPassword}
                      className="absolute right-1 top-1/2 -translate-y-1/2 p-2.5 text-jd-muted hover:text-jd-ink rounded-lg transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {formData.password.length > 0 && (
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <div className="flex-1 flex gap-1">
                        {[1, 2, 3].map((i) => (
                          <div
                            key={i}
                            className={`h-1 flex-1 rounded-full transition-colors ${
                              i <= passwordStrength
                                ? passwordStrength === 1
                                  ? "bg-red-400"
                                  : passwordStrength === 2
                                  ? "bg-amber-400"
                                  : "bg-jd-accent"
                                : "bg-jd-border"
                            }`}
                          />
                        ))}
                      </div>
                      <span className={`text-[10px] font-medium uppercase tracking-wider ${
                        passwordStrength === 1 ? "text-red-500" :
                        passwordStrength === 2 ? "text-amber-600" :
                        passwordStrength === 3 ? "text-jd-accent" : "text-jd-muted"
                      }`}>
                        {passwordStrength === 1 ? "Fraca" : passwordStrength === 2 ? "Boa" : passwordStrength === 3 ? "Forte" : ""}
                      </span>
                    </div>
                  )}
                  {touched.password && errors.password && <p id="password-error" role="alert" className="text-xs text-red-500">{errors.password}</p>}
                </div>

                {/* Termos */}
                <div className="flex items-start gap-2 pt-1">
                  <Checkbox
                    id="acceptTerms"
                    checked={formData.acceptTerms}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, acceptTerms: checked === true })
                    }
                    disabled={isLoading}
                    className="mt-0.5"
                  />
                  <label htmlFor="acceptTerms" className="text-[13px] text-jd-muted leading-relaxed cursor-pointer">
                    Concordo com os{" "}
                    <Link to="/termos" target="_blank" className="text-primary font-medium hover:text-primary/80">
                      Termos de Uso
                    </Link>{" "}
                    e{" "}
                    <Link to="/privacidade" target="_blank" className="text-primary font-medium hover:text-primary/80">
                      Política de Privacidade
                    </Link>
                    . Sei que tenho garantia de 7 dias com reembolso total.
                  </label>
                </div>
                {errors.acceptTerms && <p className="text-xs text-red-500">{errors.acceptTerms}</p>}

                {/* Botão — sticky em mobile pra nunca sumir atrás do teclado */}
                <div className="sticky bottom-0 -mx-6 md:mx-0 md:static px-6 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] md:p-0 bg-jd-surface md:bg-transparent border-t md:border-0 border-jd-border z-10">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3.5 bg-jd-accent hover:opacity-90 active:scale-[0.99] disabled:bg-jd-muted disabled:opacity-50 text-white rounded-full text-sm font-medium transition-opacity flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {loadingStep || "Processando..."}
                      </>
                    ) : (
                      <>Pagar {plan.price}{plan.priceNote} e começar</>
                    )}
                  </button>
                </div>

                {/* Acesso imediato + formas de pagamento */}
                <div className="bg-jd-bg border border-jd-border rounded-xl p-3.5 mt-2">
                  <div className="flex items-center gap-2 mb-3">
                    <Zap size={13} className="text-jd-accent flex-shrink-0" strokeWidth={1.5} />
                    <p className="text-xs font-medium text-jd-ink">Acesso liberado na hora do pagamento</p>
                  </div>

                  <div className="flex items-center justify-center gap-1.5 flex-wrap">
                    <div className="flex items-center gap-1 bg-jd-surface border border-jd-border rounded-md px-2 py-1">
                      <svg viewBox="0 0 24 24" className="w-3 h-3" aria-label="Pix"><path fill="#4BB8A9" d="M5.3 18.7L1.9 15.4a4 4 0 0 1 0-5.7l3.4-3.3a4 4 0 0 1 2.8-1.2h2.5L6.4 10.3a2 2 0 0 0 0 2.9l4.1 4.1H7.9a4 4 0 0 1-2.6-1zm11.3-10.5a4 4 0 0 1 2.6 1.1l3.4 3.3a4 4 0 0 1 0 5.7l-3.4 3.3a4 4 0 0 1-2.8 1.1H14l4.2-4a2 2 0 0 0 0-3L14 11h2.6zM12 3l3.3 3.3a2 2 0 0 1-2.9 0L12 5.8l-.3.5a2 2 0 0 1-2.9 0L12 3zm0 18l3.3-3.3a2 2 0 0 0-2.9 0L12 18.2l-.3-.5a2 2 0 0 0-2.9 0L12 21z"/></svg>
                      <span className="text-[10px] font-medium text-jd-ink">Pix</span>
                    </div>
                    <div className="flex items-center bg-jd-surface border border-jd-border rounded-md px-2 py-1">
                      <span className="text-[10px] font-black italic text-[#1A1F71] tracking-tight">VISA</span>
                    </div>
                    <div className="flex items-center bg-jd-surface border border-jd-border rounded-md px-1.5 py-1">
                      <svg viewBox="0 0 32 20" className="h-3" aria-label="Mastercard">
                        <circle cx="12" cy="10" r="7" fill="#EB001B"/>
                        <circle cx="20" cy="10" r="7" fill="#F79E1B"/>
                        <path d="M16 4.5a7 7 0 0 0 0 11 7 7 0 0 0 0-11z" fill="#FF5F00"/>
                      </svg>
                    </div>
                    <div className="flex items-center bg-jd-surface border border-jd-border rounded-md px-2 py-1">
                      <span className="text-[10px] font-medium text-jd-ink">elo</span>
                    </div>
                    <div className="flex items-center gap-1 bg-jd-surface border border-jd-border rounded-md px-2 py-1">
                      <FileText size={11} className="text-jd-ink" />
                      <span className="text-[10px] font-medium text-jd-ink">Boleto</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-1.5 text-[10px] text-jd-muted mt-3 pt-3 border-t border-jd-border">
                    <Lock size={10} className="text-jd-accent" />
                    <span>Pagamento 100% seguro</span>
                  </div>
                </div>

                {/* Link pra login */}
                <p className="text-center text-xs text-jd-muted pt-4 border-t border-jd-border">
                  Já tem conta?{" "}
                  <Link to="/login" className="text-jd-accent font-medium hover:text-jd-ink transition-colors">
                    Entrar
                  </Link>
                </p>
              </form>
            </div>
          </div>

          {/* Resumo do pedido */}
          <div className="order-1 md:order-2">
            {/* Mobile: resumo compacto colapsável */}
            <details className="md:hidden bg-jd-surface rounded-xl border border-jd-border mb-4 overflow-hidden group">
              <summary className="px-4 py-3 flex items-center justify-between cursor-pointer list-none">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-medium text-jd-ink truncate">FechaAqui {plan.name}</span>
                  {plan.key === "pro" && (
                    <span className="text-[10px] uppercase tracking-[0.2em] text-jd-accent italic font-display">destacado</span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="font-display text-base font-medium text-jd-ink tabular-nums">{plan.price}<span className="text-xs text-jd-muted font-body ml-0.5">{plan.priceNote}</span></span>
                  <ChevronDown size={15} className="text-jd-muted transition-transform group-open:rotate-180" />
                </div>
              </summary>
              <div className="px-4 pb-4 pt-0 border-t border-jd-border">
                {plan.key === "pro" && (
                  <div className="flex items-center justify-between py-2.5 text-sm">
                    <span className="text-jd-muted">Total hoje</span>
                    <span className="font-medium text-jd-ink tabular-nums">R$ 228,00</span>
                  </div>
                )}
                <p className="text-sm text-jd-accent italic font-display mb-4">{plan.totalNote}</p>
                <ul className="space-y-2.5 mb-4">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-jd-ink leading-relaxed">
                      <Check size={14} className="text-jd-accent flex-shrink-0 mt-0.5" strokeWidth={2} />
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="flex items-start gap-2 pt-4 border-t border-jd-border">
                  <ShieldCheck size={14} className="text-jd-accent flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                  <span className="text-xs text-jd-muted leading-relaxed">Garantia de 7 dias — 100% devolvido no Pix</span>
                </div>
                <Link
                  to={`/checkout?plan=${plan.key === "pro" ? "essential" : "pro"}`}
                  className="block text-center text-sm text-jd-muted hover:text-jd-accent transition-colors mt-4"
                >
                  Mudar para plano {plan.key === "pro" ? "Mensal" : "Anual"} →
                </Link>
              </div>
            </details>

            {/* Desktop: resumo completo */}
            <div className="hidden md:block md:sticky md:top-4 space-y-3">
              <div className={`rounded-xl p-6 md:p-7 border ${
                plan.key === "pro"
                  ? "border-jd-accent/40 bg-jd-surface shadow-jd-lift"
                  : "border-jd-border bg-jd-surface"
              }`}>
                {plan.badge && (
                  <div className="inline-flex items-center gap-1.5 bg-jd-accent text-white text-[10px] uppercase tracking-[0.2em] px-3 py-1 rounded-full mb-4 font-medium">
                    {plan.badge}
                  </div>
                )}

                <p className="text-[11px] font-medium text-jd-accent uppercase tracking-[0.22em] mb-1.5">
                  Seu plano
                </p>
                <h2 className="font-display text-2xl md:text-3xl font-medium text-jd-ink mb-5 tracking-tight">FechaAqui {plan.name}</h2>

                {/* Breakdown de preço */}
                <div className="border border-jd-border rounded-lg p-4 mb-5">
                  <div className="flex items-baseline gap-1 mb-1">
                    <span className="font-display text-4xl font-medium text-jd-ink tabular-nums tracking-[-0.02em]">{plan.price}</span>
                    <span className="text-base text-jd-muted">{plan.priceNote}</span>
                  </div>
                  {plan.key === "pro" && (
                    <div className="flex items-center justify-between border-t border-jd-border pt-2.5 mt-2.5">
                      <span className="text-xs text-jd-muted">Total cobrado hoje</span>
                      <span className="text-sm font-medium text-jd-ink tabular-nums">R$ 228,00</span>
                    </div>
                  )}
                  <p className="text-xs text-jd-accent font-medium mt-2 italic font-display">
                    {plan.totalNote}
                  </p>
                </div>

                <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-jd-muted mb-3">
                  O que tá incluído
                </p>
                <ul className="space-y-2.5 mb-5">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-jd-ink">
                      <Check size={14} className="text-jd-accent flex-shrink-0 mt-0.5" strokeWidth={2} />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                {/* Selo garantia — editorial sem card duplo */}
                <div className="border-t border-jd-border pt-4 flex items-start gap-3">
                  <ShieldCheck className="text-jd-accent flex-shrink-0 mt-0.5" size={18} strokeWidth={1.5} />
                  <div>
                    <p className="text-sm font-medium text-jd-ink mb-0.5">
                      Garantia de 7 dias
                    </p>
                    <p className="text-xs text-jd-muted leading-relaxed">
                      Não gostou? Devolvemos 100% no Pix em 24h.
                    </p>
                  </div>
                </div>

                {/* Trocar plano */}
                <div className="mt-5 pt-4 border-t border-jd-border text-center">
                  <Link
                    to={`/checkout?plan=${plan.key === "pro" ? "essential" : "pro"}`}
                    className="text-xs text-jd-muted hover:text-jd-accent transition-colors"
                  >
                    Mudar para plano {plan.key === "pro" ? "Mensal" : "Anual"} →
                  </Link>
                </div>
              </div>

              {/* Social proof — editorial, sem card */}
              <div className="hidden md:block bg-jd-surface border border-jd-border rounded-xl p-5">
                {/* Estrelas */}
                <div className="flex items-center gap-0.5 mb-3">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor" style={{ color: 'hsl(var(--jd-accent))' }}>
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                  ))}
                  <span className="text-[11px] text-jd-muted ml-1.5">4.9/5</span>
                </div>

                {/* Depoimento em destaque — serif */}
                <blockquote className="font-display text-[15px] text-jd-ink leading-relaxed mb-4">
                  "Fechei 11 projetos mês passado usando o FechaAqui. Melhor investimento que fiz."
                </blockquote>

                {/* Autor */}
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-jd-accent/10 border border-jd-accent/20 text-jd-accent flex items-center justify-center font-display text-xs font-medium flex-shrink-0">
                    JM
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-jd-ink leading-tight">João Mendes</p>
                    <p className="text-[10px] text-jd-muted mt-0.5">Floricultura · Belo Horizonte</p>
                  </div>
                </div>

                {/* Rodapé */}
                <div className="mt-4 pt-3 border-t border-jd-border flex items-center justify-center gap-1.5">
                  <Users size={11} className="text-jd-muted" strokeWidth={1.5} />
                  <p className="text-[10px] font-medium text-jd-muted">+500 prestadores já assinaram</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function LoadingStep({ label, done, active }: { label: string; done: boolean; active: boolean }) {
  return (
    <div className="flex items-center gap-2.5 text-sm">
      <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
        done ? "bg-jd-accent" : active ? "bg-jd-accent/10 border border-jd-accent/30" : "bg-jd-border"
      }`}>
        {done ? (
          <Check size={12} className="text-white" strokeWidth={2} />
        ) : active ? (
          <Loader2 size={12} className="text-jd-accent animate-spin" />
        ) : (
          <div className="w-1.5 h-1.5 rounded-full bg-jd-muted" />
        )}
      </div>
      <span className={`${done ? "text-jd-ink font-medium" : active ? "text-jd-accent font-medium" : "text-jd-muted"}`}>
        {label}
      </span>
    </div>
  );
}
