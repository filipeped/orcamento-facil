import { useState, useEffect, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Check, ArrowLeft, Zap, Crown, Rocket, ShieldCheck, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase, getSupabase } from "@/lib/supabase";
import { trackPageView, trackViewContent } from "@/services/metaPixel";
import { DeduplicationEngine } from "@/tracking/core/DeduplicationEngine";
import { BrowserPixelProvider } from "@/tracking/providers/BrowserPixelProvider";
import { RealCAPIProvider } from "@/tracking/providers/RealCAPIProvider";
import { CookieManager } from "@/tracking/utils/CookieManager";
import { IPDetector } from "@/tracking/utils/IPDetector";
import { GeoEnrichment } from "@/tracking/utils/GeoEnrichment";

// Função para hash SHA256
async function hashSHA256(value: string): Promise<string> {
  if (!value || typeof value !== 'string') return '';
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(value.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return '';
  }
}

// Tracking InitiateCheckout - quando usuário clica em um plano
async function trackInitiateCheckout(planData: { planId: string; planName: string; value: number; period: string; userEmail?: string; userName?: string; userPhone?: string }) {
  try {
    console.log('🛒 INITIATE CHECKOUT: Iniciando tracking...');

    const eventId = await DeduplicationEngine.generateEventId('checkout');
    const externalId = await DeduplicationEngine.getValidExternalId();
    const fbp = await CookieManager.getFbpWithPixelWait();
    const fbc = CookieManager.getFbcWithFallback();
    const clientIP = await IPDetector.getClientIPForCAPI();
    const geoData = await GeoEnrichment.getGeoDataForCAPI(clientIP);

    // Hashear dados do usuário
    const hashedEmail = planData.userEmail ? await hashSHA256(planData.userEmail) : '';
    let phoneDigits = planData.userPhone ? planData.userPhone.replace(/\D/g, '') : '';
    if (phoneDigits && (phoneDigits.length === 10 || phoneDigits.length === 11)) phoneDigits = '55' + phoneDigits;
    const hashedPhone = phoneDigits.length >= 10 ? await hashSHA256(phoneDigits) : '';

    // Extrair primeiro e último nome
    let hashedFirstName = '';
    let hashedLastName = '';
    if (planData.userName) {
      const nameParts = planData.userName.trim().split(' ');
      hashedFirstName = await hashSHA256(nameParts[0] || '');
      hashedLastName = await hashSHA256(nameParts.length > 1 ? nameParts[nameParts.length - 1] : '');
    }

    const formattedIP = clientIP ? IPDetector.formatIPForMeta(clientIP) : null;
    const capiUserData: Record<string, any> = {
      external_id: externalId,
      client_user_agent: navigator.userAgent,
      ...(fbp && { fbp }),
      ...(fbc && { fbc }),
      ...(formattedIP && { client_ip_address: formattedIP }),
      ...(hashedEmail && { em: hashedEmail }),
      ...(hashedPhone && { ph: hashedPhone }),
      ...(hashedFirstName && { fn: hashedFirstName }),
      ...(hashedLastName && { ln: hashedLastName }),
      ...(geoData?.ct && { ct: geoData.ct }),
      ...(geoData?.st && { st: geoData.st }),
      ...(geoData?.zp && { zp: geoData.zp }),
      ...(geoData?.country && { country: geoData.country }),
    };

    const customData = {
      content_name: planData.planName,
      content_category: 'subscription',
      content_type: 'product',
      content_ids: [planData.planId],
      value: planData.value,
      currency: 'BRL',
      num_items: 1,
    };

    // Disparar Pixel
    let pixelSuccess = false;
    try {
      pixelSuccess = BrowserPixelProvider.trackEvent('InitiateCheckout', customData, { eventID: eventId });
      console.log('✅ InitiateCheckout Pixel:', pixelSuccess);
    } catch (err) {
      console.error('❌ Erro Pixel InitiateCheckout:', err);
    }

    // Disparar CAPI
    let capiSuccess = false;
    try {
      const capiPayload = RealCAPIProvider.prepareCAPIPayload('InitiateCheckout', eventId, capiUserData, customData);
      capiSuccess = await RealCAPIProvider.sendEvent(capiPayload);
      console.log('✅ InitiateCheckout CAPI:', capiSuccess);
    } catch (err) {
      console.error('❌ Erro CAPI InitiateCheckout:', err);
    }

    console.log('🛒 INITIATE CHECKOUT: Resultado:', { pixelSuccess, capiSuccess, plan: planData.planName, value: planData.value });
    return pixelSuccess || capiSuccess;

  } catch (error) {
    console.error('❌ INITIATE CHECKOUT: Erro crítico:', error);
    return false;
  }
}

export default function Upgrade() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [showCpfModal, setShowCpfModal] = useState(false);
  const [pendingPlanId, setPendingPlanId] = useState<string | null>(null);
  const hasTracked = useRef(false);
  const [couponCode, setCouponCode] = useState("");
  const [couponDiscount, setCouponDiscount] = useState<number | null>(null);
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);
  const [couponError, setCouponError] = useState("");
  const [userPhone, setUserPhone] = useState<string | null>(null);

  // Buscar telefone do perfil para tracking
  useEffect(() => {
    if (user?.id) {
      getSupabase()
        .from("profiles")
        .select("phone")
        .eq("user_id", user.id)
        .single()
        .then(({ data }) => {
          if (data?.phone) {
            setUserPhone(data.phone);
          }
        });
    }
  }, [user?.id]);

  // Validar cupom da URL automaticamente
  useEffect(() => {
    const urlCoupon = searchParams.get("cupom") || searchParams.get("coupon");
    if (urlCoupon && !couponDiscount) {
      setCouponCode(urlCoupon.toUpperCase());
      validateCouponFromUrl(urlCoupon);
    }
  }, [searchParams]);

  const validateCouponFromUrl = async (code: string) => {
    if (!code.trim()) return;
    setIsValidatingCoupon(true);
    try {
      const response = await fetch("/api/manage-asaas?action=validate-coupon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await response.json();
      if (data.valid) {
        setCouponDiscount(data.discount_percent);
        setCouponCode(code.toUpperCase());
      }
    } catch (error) {
      console.error("Erro ao validar cupom:", error);
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  useEffect(() => {
    if (!hasTracked.current) {
      hasTracked.current = true;
      trackPageView();
      setTimeout(() => trackViewContent(), 1000);
    }
  }, []);

  const planNameToId: Record<string, string> = {
    "Grátis": "free",
    "Mensal": "essential",
    "Pro": "pro",
    "Anual": "pro",
    "Gratis": "free",
    "Iniciante": "free",
    "Plus": "essential",
    "Crescimento": "essential",
    "Essencial": "essential",
    "Empresarial": "pro",
    "Profissional": "pro",
  };

  const planOrder = ["free", "essential", "pro"];
  const currentPlanId = planNameToId[user?.plan || "Gratis"] || "free";
  const currentPlanIndex = planOrder.indexOf(currentPlanId);

  const formatCpfCnpj = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    if (numbers.length <= 11) {
      return numbers
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    } else {
      return numbers
        .replace(/(\d{2})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1/$2")
        .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
    }
  };

  const handleCpfCnpjChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCpfCnpj(e.target.value);
    setCpfCnpj(formatted.slice(0, 18));
  };

  // Validar cupom de desconto
  const validateCoupon = async () => {
    if (!couponCode.trim()) return;

    setIsValidatingCoupon(true);
    setCouponError("");
    setCouponDiscount(null);

    try {
      const response = await fetch("/api/manage-asaas?action=validate-coupon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: couponCode.trim(),
          plan: pendingPlanId,
        }),
      });

      const data = await response.json();

      if (data.valid) {
        setCouponDiscount(data.discount_percent);
        toast.success(`Cupom aplicado! ${data.discount_percent}% de desconto`);
      } else {
        setCouponError(data.error || "Cupom inválido");
        setCouponDiscount(null);
      }
    } catch (error) {
      setCouponError("Erro ao validar cupom");
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  const handleCpfSubmit = async () => {
    if (!user?.id || !cpfCnpj || !pendingPlanId) return;
    const numbers = cpfCnpj.replace(/\D/g, "");
    if (numbers.length !== 11 && numbers.length !== 14) {
      toast.error("CPF deve ter 11 dígitos ou CNPJ deve ter 14 dígitos");
      return;
    }

    setIsLoading(true);

    try {
      // Save CPF/CNPJ first
      const { error } = await supabase
        .from("profiles")
        .update({ cnpj: cpfCnpj })
        .eq("user_id", user.id);
      if (error) throw error;

      // 🎯 Capturar dados de tracking do browser para enriquecer o Purchase do webhook
      const fbp = await CookieManager.getFbpWithPixelWait();
      const fbc = CookieManager.getFbcWithFallback();
      const clientIP = await IPDetector.getClientIPForCAPI();

      // Now proceed with payment
      const response = await fetch("/api/create-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: pendingPlanId,
          period: pendingPlanId === "pro" ? "annual" : "monthly",
          userId: user.id,
          customerEmail: user.email,
          customerName: user.name || user.email,
          cpfCnpj: cpfCnpj,
          couponCode: couponDiscount ? couponCode : undefined,
          discountPercent: couponDiscount || undefined,
          trackingData: {
            fbp: fbp || undefined,
            fbc: fbc || undefined,
            clientIP: clientIP || undefined,
            userAgent: navigator.userAgent,
            sourceUrl: window.location.href,
          },
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.paymentUrl) {
        // Se erro de CPF/CNPJ, manter modal aberto para corrigir
        const errorMsg = data.error || "Erro ao criar pagamento";
        if (errorMsg.toLowerCase().includes("cpf") || errorMsg.toLowerCase().includes("cnpj")) {
          setCpfCnpj("");
          setIsLoading(false);
          toast.error(errorMsg);
          return;
        }
        throw new Error(errorMsg);
      }
      window.location.href = data.paymentUrl;
    } catch (error) {
      console.error("Erro:", error);
      const errorMessage = error instanceof Error ? error.message : "Erro ao processar. Tente novamente.";
      toast.error(errorMessage);
      setIsLoading(false);
    }
  };

  const plans = [
    {
      id: "free",
      name: "Gratis",
      description: "Voce esta perdendo clientes",
      monthlyPrice: 0,
      annualPrice: 0,
      icon: Zap,
      features: [
        "Nao pode criar propostas novas",
        "Historico limitado a 30 dias",
        "Propostas com marca d'agua FechaAqui",
      ],
      highlighted: false,
      badge: null,
      cta: "Plano atual",
    },
    {
      id: "essential",
      name: "Mensal",
      description: "Pra quem quer fechar mais",
      monthlyPrice: 29,
      annualPrice: 29,
      icon: Crown,
      features: [
        "Sua marca em cada orcamento",
        "Cliente aprova pelo celular",
        "Notificacao quando cliente abrir",
        "Parece uma empresa grande",
        "30 propostas por mes",
      ],
      highlighted: currentPlanId === "free",
      badge: null,
      cta: "Quero fechar mais servicos",
    },
    {
      id: "pro",
      name: "Anual",
      description: "Tudo do Mensal, sem limites",
      monthlyPrice: 19,
      annualPrice: 19,
      icon: Rocket,
      features: [
        "Tudo do Mensal sem nenhum limite",
        "Propostas e clientes ilimitados",
        "Suporte prioritario no WhatsApp",
        "Economize R$ 120 comparado ao Mensal",
      ],
      highlighted: currentPlanId === "free" || currentPlanId === "essential",
      badge: "Mais escolhido",
      cta: "Quero o melhor preco",
    },
  ].map(plan => ({
    ...plan,
    current: plan.id === currentPlanId,
    isUpgrade: planOrder.indexOf(plan.id) > currentPlanIndex,
    isDowngrade: planOrder.indexOf(plan.id) < currentPlanIndex,
  }));

  const handleSelectPlan = async (planId: string) => {
    if (planId === "free") {
      toast.info("Para fazer downgrade, entre em contato com o suporte.");
      return;
    }
    if (!user?.id || !user?.email) {
      toast.error("Erro: usuário não identificado. Faça login novamente.");
      return;
    }

    setIsLoading(true);
    setSelectedPlan(planId);

    // 🎯 TRACKING: InitiateCheckout quando usuário clica no plano
    const selectedPlanData = plans.find(p => p.id === planId);
    const planValue = selectedPlanData?.monthlyPrice || 0;
    trackInitiateCheckout({
      planId: planId,
      planName: selectedPlanData?.name || planId,
      value: planValue,
      period: planId === "pro" ? 'annual' : 'monthly',
      userEmail: user.email,
      userName: user.name,
      userPhone: userPhone || undefined,
    }).then(success => {
      console.log('🛒 InitiateCheckout tracked:', success);
    });

    try {
      // 🎯 Capturar dados de tracking do browser para enriquecer o Purchase do webhook
      const fbp = await CookieManager.getFbpWithPixelWait();
      const fbc = CookieManager.getFbcWithFallback();
      const clientIP = await IPDetector.getClientIPForCAPI();

      const response = await fetch("/api/create-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: planId,
          period: planId === "pro" ? "annual" : "monthly",
          userId: user.id,
          customerEmail: user.email,
          customerName: user.name || user.email,
          couponCode: couponDiscount ? couponCode : undefined,
          discountPercent: couponDiscount || undefined,
          trackingData: {
            fbp: fbp || undefined,
            fbc: fbc || undefined,
            clientIP: clientIP || undefined,
            userAgent: navigator.userAgent,
            sourceUrl: window.location.href,
          },
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.paymentUrl) {
        if (data.needsCpfCnpj) {
          setPendingPlanId(planId);
          setShowCpfModal(true);
          setCpfCnpj("");
          setIsLoading(false);
          setSelectedPlan(null);
          return;
        }
        // Se erro de CPF/CNPJ, reabrir modal para corrigir
        const errorMsg = data.error || "Erro ao criar pagamento";
        if (errorMsg.toLowerCase().includes("cpf") || errorMsg.toLowerCase().includes("cnpj")) {
          setPendingPlanId(planId);
          setShowCpfModal(true);
          setCpfCnpj("");
          setIsLoading(false);
          setSelectedPlan(null);
          toast.error(errorMsg);
          return;
        }
        throw new Error(errorMsg);
      }
      window.location.href = data.paymentUrl;
    } catch (error) {
      console.error("Erro ao criar pagamento:", error);
      const errorMessage = error instanceof Error ? error.message : "Erro ao processar pagamento. Tente novamente.";
      toast.error(errorMessage);
      setIsLoading(false);
      setSelectedPlan(null);
    }
  };

  return (
    <section className="min-h-screen bg-neutral-50 py-12 px-4">
      {/* Background decorations */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute top-0 -right-32 w-[400px] h-[400px] bg-emerald-100/30 rounded-full blur-3xl" />
        <div className="absolute bottom-0 -left-32 w-[300px] h-[300px] bg-blue-100/20 rounded-full blur-3xl" />
      </div>

      <div className="max-w-5xl mx-auto relative">
        {/* Banner pra quem caiu aqui sem ter plano ativo (cadastrou mas nao pagou) */}
        {currentPlanId === "free" && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
            <ShieldCheck className="text-amber-600 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="text-sm font-semibold text-amber-900 mb-0.5">
                Sua conta ainda nao esta ativa
              </p>
              <p className="text-xs text-amber-800 leading-snug">
                Pra acessar a plataforma voce precisa assinar um dos planos
                abaixo. Depois do pagamento confirmado, sua conta e liberada
                automaticamente.
              </p>
            </div>
          </div>
        )}

        {/* Back link */}
        <Link
          to="/propostas"
          className="inline-flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-900 mb-8 transition-colors"
        >
          <ArrowLeft size={16} />
          Voltar
        </Link>

        {/* Header */}
        <div className="text-center mb-8 md:mb-12">
          <div className="flex items-center justify-center mb-4 md:mb-6">
            <Logo size="lg" />
          </div>

          <h1 className="text-2xl md:text-4xl lg:text-5xl font-semibold tracking-tight text-neutral-900 mb-3 md:mb-4">
            {currentPlanId === "free"
              ? <>Quanto voce perde <span className="text-emerald-600">sem proposta profissional</span>?</>
              : currentPlanId === "pro"
              ? "Voce esta no plano completo!"
              : "Desbloqueie todo seu potencial"}
          </h1>

          <p className="text-base md:text-lg text-neutral-500 mb-4 md:mb-6 max-w-2xl mx-auto">
            {currentPlanId === "free"
              ? "Quem manda orcamento no WhatsApp comum perde cliente pra quem manda proposta bonita."
              : currentPlanId === "pro"
              ? "Voce tem acesso ilimitado a tudo. Aproveite!"
              : `Voce esta no ${user?.plan}. Veja o que esta perdendo.`}
          </p>

        </div>


        {/* Plans Grid - mobile: Anual primeiro via CSS order */}
        <div className="grid md:grid-cols-3 gap-3 md:gap-5 mb-8 md:mb-12">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={cn(
                "relative bg-white rounded-2xl p-5 md:p-8 transition-all duration-300 flex flex-col cursor-pointer",
                "hover:-translate-y-1 hover:shadow-xl active:scale-[0.98]",
                // Mobile: Anual primeiro, Mensal segundo, Grátis terceiro
                plan.id === "pro" ? "order-first md:order-last" : plan.id === "free" ? "order-last md:order-first" : "order-2 md:order-2",
                plan.current && plan.id !== "free"
                  ? "border-2 border-emerald-500 shadow-lg md:scale-[1.02] z-10 hover:shadow-emerald-200/50"
                  : plan.id === "pro" && plan.highlighted
                  ? "border-2 border-emerald-500 shadow-xl shadow-emerald-500/10 md:scale-[1.05] z-10 hover:shadow-emerald-200/50 bg-gradient-to-b from-emerald-50/50 to-white"
                  : "border border-neutral-200/80 hover:border-emerald-300",
                plan.isDowngrade && "opacity-50 hover:translate-y-0 hover:shadow-none cursor-not-allowed"
              )}
            >
              {/* Selecionado - só no Anual */}
              {plan.id === "pro" && !plan.current && (
                <div className="absolute top-4 right-4">
                  <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center shadow-sm">
                    <Check size={14} className="text-white" strokeWidth={3} />
                  </div>
                </div>
              )}

              {/* Badge */}
              {plan.current ? (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className={cn(
                    "inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full shadow",
                    plan.id === "free" ? "bg-neutral-400 text-white" : "bg-emerald-500 text-white"
                  )}>
                    <Check size={12} />
                    Seu plano
                  </span>
                </div>
              ) : plan.id === "pro" && plan.highlighted && plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1.5 bg-emerald-500 text-white text-xs font-medium px-3 py-1 rounded-full shadow">
                    {plan.id === "pro" ? <Rocket size={12} /> : <Crown size={12} />}
                    {plan.badge}
                  </span>
                </div>
              )}

              {/* Plan header */}
              <div className="text-center mb-4 md:mb-6">
                <div className={cn(
                  "w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center mx-auto mb-2 md:mb-3",
                  (plan.current && plan.id !== "free") || (plan.id === "pro" && plan.highlighted) ? "bg-emerald-50" : "bg-neutral-100"
                )}>
                  <plan.icon className={(plan.current && plan.id !== "free") || (plan.id === "pro" && plan.highlighted) ? "text-emerald-600" : "text-neutral-400"} size={20} />
                </div>
                <h3 className="text-lg font-semibold text-neutral-900 mb-1">{plan.name}</h3>
                <p className="text-sm text-neutral-500">{plan.description}</p>
              </div>

              {/* Price */}
              <div className="text-center mb-4 md:mb-6 pb-4 md:pb-6 border-b border-neutral-100">
                {(() => {
                  const basePrice = plan.monthlyPrice;
                  const finalPrice = couponDiscount && plan.monthlyPrice > 0
                    ? Math.round(basePrice * (1 - couponDiscount / 100))
                    : basePrice;
                  const hasDiscount = couponDiscount && plan.monthlyPrice > 0;

                  return (
                    <>
                      <div className="flex items-baseline justify-center gap-1">
                        {hasDiscount && (
                          <span className="text-lg text-neutral-400 line-through mr-1">
                            R$ {basePrice}
                          </span>
                        )}
                        {plan.id === "pro" && !hasDiscount && (
                          <span className="text-lg text-neutral-400 line-through mr-1">
                            R$ 29
                          </span>
                        )}
                        <span className={cn(
                          "text-3xl md:text-4xl font-semibold tracking-tight",
                          hasDiscount ? "text-emerald-600" : "text-neutral-900"
                        )}>
                          {plan.monthlyPrice === 0 ? "Grátis" : `R$ ${finalPrice}`}
                        </span>
                        {plan.monthlyPrice > 0 && <span className="text-neutral-500">/mês</span>}
                      </div>
                      {plan.id === "pro" && (
                        <p className="text-xs text-neutral-400 mt-1">
                          Cobrado R$ 228/ano
                        </p>
                      )}
                    </>
                  );
                })()}
                {plan.id === "essential" && (
                  <p className="text-xs text-emerald-600 mt-2 font-medium">
                    Menos que 1 hora de trabalho por mês
                  </p>
                )}
                {plan.id === "pro" && (
                  <p className="text-xs text-emerald-600 mt-2 font-medium">
                    1 proposta aprovada paga o ano
                  </p>
                )}
              </div>

              {/* Features */}
              <ul className="space-y-2 md:space-y-3 mb-5 md:mb-8 flex-1">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-3 text-sm">
                    <div className={cn(
                      "w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
                      (plan.current && plan.id !== "free") || (plan.id === "pro" && plan.highlighted) ? "bg-emerald-50" : "bg-neutral-100"
                    )}>
                      <Check className={(plan.current && plan.id !== "free") || (plan.id === "pro" && plan.highlighted) ? "text-emerald-600" : "text-neutral-400"} size={12} />
                    </div>
                    <span className="text-neutral-600">{feature}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <button
                onClick={() => !plan.current && !plan.isDowngrade && handleSelectPlan(plan.id)}
                disabled={plan.current || plan.isDowngrade || (isLoading && selectedPlan === plan.id)}
                className={cn(
                  "w-full py-3 rounded-full text-sm font-medium transition-all",
                  plan.current
                    ? "bg-neutral-100 text-neutral-400 cursor-default"
                    : plan.isDowngrade
                    ? "bg-neutral-100 text-neutral-400 cursor-not-allowed"
                    : plan.isUpgrade
                    ? "bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20"
                    : "bg-neutral-100 hover:bg-neutral-200 text-neutral-900"
                )}
              >
                {isLoading && selectedPlan === plan.id ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Processando...
                  </span>
                ) : plan.current ? (
                  <span className="flex items-center justify-center gap-2">
                    <Check size={16} />
                    Seu plano atual
                  </span>
                ) : plan.isDowngrade ? (
                  "—"
                ) : (
                  plan.cta
                )}
              </button>
            </div>
          ))}
        </div>

        {/* Campo de cupom */}
        <div className="text-center mb-6">
          {couponDiscount ? (
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-full text-sm font-medium">
              <Check size={16} />
              Desconto de {couponDiscount}% aplicado
            </div>
          ) : (
            <div className="inline-flex items-center gap-2">
              <input
                type="text"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                placeholder="Tem cupom?"
                className="w-28 px-3 py-1.5 text-sm text-center border border-neutral-200 rounded-full focus:outline-none focus:border-emerald-400 uppercase bg-white"
              />
              <button
                onClick={() => validateCouponFromUrl(couponCode)}
                disabled={!couponCode.trim() || isValidatingCoupon}
                className="px-3 py-1.5 text-sm font-medium text-neutral-500 hover:text-emerald-600 disabled:text-neutral-300"
              >
                {isValidatingCoupon ? "..." : "Aplicar"}
              </button>
            </div>
          )}
        </div>

        {/* Guarantee */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center gap-3 mb-3">
            <ShieldCheck className="text-emerald-500" size={24} />
            <span className="text-lg font-semibold text-neutral-900">Garantia de 7 dias</span>
          </div>
          <p className="text-neutral-600 max-w-md mx-auto">
            Teste sem risco. Se não sentir diferença nas suas propostas, devolvemos <strong className="text-neutral-900">100% do valor</strong>. Sem perguntas.
          </p>
        </div>

        {/* Help */}
        <div className="text-center">
          <p className="text-sm text-neutral-500 mb-3">Ainda tem dúvidas?</p>
          <a
            href="https://wa.me/5551992185607?text=Oi! Estou vendo os planos do FechaAqui e quero saber mais sobre como funciona."
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 border border-neutral-200 hover:bg-neutral-100 text-neutral-700 text-sm font-medium rounded-full transition-colors"
          >
            Falar no WhatsApp
          </a>
        </div>
      </div>

      {/* CPF/CNPJ Modal */}
      {showCpfModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => {
              setShowCpfModal(false);
              setPendingPlanId(null);
            }}
          />

          {/* Modal */}
          <div className="relative bg-white rounded-2xl p-6 md:p-8 w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            {/* Close button */}
            <button
              onClick={() => {
                setShowCpfModal(false);
                setPendingPlanId(null);
              }}
              className="absolute top-4 right-4 p-2 text-neutral-400 hover:text-neutral-600 transition-colors"
            >
              <X size={20} />
            </button>

            {/* Content */}
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <ShieldCheck className="text-emerald-500" size={32} />
              </div>
              <h2 className="text-xl font-semibold text-neutral-900 mb-2">
                Último passo antes do pagamento
              </h2>
              <p className="text-neutral-500 text-sm">
                Para gerar sua cobrança, precisamos do seu CPF ou CNPJ.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cpfCnpj" className="text-neutral-700">CPF ou CNPJ</Label>
                <Input
                  id="cpfCnpj"
                  value={cpfCnpj}
                  onChange={handleCpfCnpjChange}
                  placeholder="000.000.000-00"
                  autoFocus
                  className="h-12 text-center text-lg tracking-wider border-neutral-200 focus:border-emerald-500 focus:ring-emerald-500"
                />
              </div>

              {/* Mostrar cupom aplicado (se houver) */}
              {couponDiscount && (
                <div className="p-3 bg-emerald-50 rounded-lg text-center">
                  <p className="text-sm text-emerald-700 font-medium">✓ Cupom de {couponDiscount}% aplicado!</p>
                </div>
              )}

              <button
                onClick={handleCpfSubmit}
                disabled={isLoading || cpfCnpj.replace(/\D/g, "").length < 11}
                className={cn(
                  "w-full py-3 rounded-full text-sm font-medium transition-all",
                  "bg-emerald-500 hover:bg-emerald-600 text-white",
                  "disabled:bg-neutral-200 disabled:text-neutral-400 disabled:cursor-not-allowed"
                )}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Processando...
                  </span>
                ) : (
                  "Continuar para pagamento"
                )}
              </button>

              <p className="text-xs text-neutral-400 text-center">
                Seus dados estão seguros e protegidos.
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
