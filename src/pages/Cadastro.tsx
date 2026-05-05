import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Lock, User, Phone, Loader2, Mail } from "lucide-react";
import { trackPageView, trackViewContent } from "@/services/metaPixel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { DeduplicationEngine } from "@/tracking/core/DeduplicationEngine";
import { BrowserPixelProvider } from "@/tracking/providers/BrowserPixelProvider";
import { RealCAPIProvider } from "@/tracking/providers/RealCAPIProvider";
import { CookieManager } from "@/tracking/utils/CookieManager";
import { IPDetector } from "@/tracking/utils/IPDetector";
import { GeoEnrichment } from "@/tracking/utils/GeoEnrichment";

interface FormErrors {
  name?: string;
  email?: string;
  phone?: string;
  password?: string;
  confirmPassword?: string;
  acceptTerms?: string;
}

// Função para hash SHA256 (para enviar dados hasheados ao Meta)
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

// Valor determinístico baseado no eventId (consistência Pixel/CAPI)
function generateDeterministicValue(eventId: string, minValue: number = 10, maxValue: number = 100): number {
  if (!eventId || eventId.length < 8) return minValue;
  const hexPart = eventId.replace(/[^a-fA-F0-9]/g, '').substring(0, 8);
  const numericValue = parseInt(hexPart, 16);
  const range = maxValue - minValue + 1;
  return (numericValue % range) + minValue;
}

// Função para tracking de Lead com dados do usuário
async function trackLeadWithUserData(userData: { name: string; phone?: string; email: string }) {
  try {
    console.log('🎯 LEAD CADASTRO: Iniciando tracking com dados do usuário...');

    const eventId = await DeduplicationEngine.generateEventId('lead');
    const externalId = await DeduplicationEngine.getValidExternalId();
    const fbp = await CookieManager.getFbpWithPixelWait();
    const fbc = CookieManager.getFbcWithFallback();
    const clientIP = await IPDetector.getClientIPForCAPI();
    const geoData = await GeoEnrichment.getGeoDataForCAPI(clientIP);

    // Hashear dados do usuário (Meta exige SHA256)
    // Email é obrigatório (identificador principal)
    const hashedEmail = await hashSHA256(userData.email.toLowerCase().trim());

    // Telefone é opcional (melhora matching se fornecido)
    let hashedPhone = '';
    if (userData.phone) {
      let phoneDigits = userData.phone.replace(/\D/g, '');
      if (phoneDigits.length === 10 || phoneDigits.length === 11) {
        phoneDigits = '55' + phoneDigits; // Adicionar código do Brasil
      }
      hashedPhone = await hashSHA256(phoneDigits);
    }

    // ✅ BOAS PRÁTICAS META: Extrair e normalizar primeiro e último nome
    const nameParts = userData.name.trim().split(' ');
    const firstName = (nameParts[0] || '').toLowerCase().trim();
    const lastName = (nameParts.length > 1 ? nameParts[nameParts.length - 1] : '').toLowerCase().trim();
    const hashedFirstName = await hashSHA256(firstName);
    const hashedLastName = await hashSHA256(lastName);

    console.log('📊 Dados hasheados para CAPI:', {
      phone: hashedPhone.substring(0, 16) + '...',
      firstName: hashedFirstName.substring(0, 16) + '...',
      lastName: hashedLastName.substring(0, 16) + '...'
    });

    const formattedIP = clientIP ? IPDetector.formatIPForMeta(clientIP) : null;
    const capiUserData: Record<string, any> = {
      external_id: externalId,
      client_user_agent: navigator.userAgent,
      ...(fbp && { fbp }),
      ...(fbc && { fbc }),
      ...(formattedIP && { client_ip_address: formattedIP }),
      ...(hashedPhone && { ph: hashedPhone }),
      ...(hashedEmail && { em: hashedEmail }),
      ...(hashedFirstName && { fn: hashedFirstName }),
      ...(hashedLastName && { ln: hashedLastName }),
      ...(geoData?.ct && { ct: geoData.ct }),
      ...(geoData?.st && { st: geoData.st }),
      ...(geoData?.zp && { zp: geoData.zp }),
      ...(geoData?.country && { country: geoData.country }),
    };

    // ✅ PADRONIZADO: Mesmos valores em todos os locais de tracking Lead
    const customData = {
      content_name: 'lead_fechaaqui',
      content_category: 'fechaaqui_lead',
      source: 'form_submit',
      value: generateDeterministicValue(eventId, 10, 100),
      currency: 'BRL'
    };

    // Preparar dados do usuário para Advanced Matching no Pixel
    const pixelUserData: Record<string, string> = {};
    if (hashedPhone) pixelUserData.ph = hashedPhone;
    if (hashedEmail) pixelUserData.em = hashedEmail;
    if (hashedFirstName) pixelUserData.fn = hashedFirstName;
    if (hashedLastName) pixelUserData.ln = hashedLastName;

    // Disparar via Pixel com Advanced Matching
    let pixelSuccess = false;
    try {
      pixelSuccess = BrowserPixelProvider.trackEvent('Lead', customData, { eventID: eventId }, pixelUserData);
      console.log('✅ Lead Pixel com Advanced Matching:', pixelSuccess, Object.keys(pixelUserData));
    } catch (err) {
      console.error('❌ Erro Pixel Lead:', err);
    }

    // Disparar via CAPI
    let capiSuccess = false;
    try {
      const capiPayload = RealCAPIProvider.prepareCAPIPayload('Lead', eventId, capiUserData, customData);
      capiSuccess = await RealCAPIProvider.sendEvent(capiPayload);
      console.log('✅ Lead CAPI:', capiSuccess);
    } catch (err) {
      console.error('❌ Erro CAPI Lead:', err);
    }

    console.log('🎯 LEAD CADASTRO: Resultado final:', { pixelSuccess, capiSuccess });
    return pixelSuccess || capiSuccess;

  } catch (error) {
    console.error('❌ LEAD CADASTRO: Erro crítico:', error);
    return false;
  }
}

// Tracking CompleteRegistration
async function trackCompleteRegistration(userData: { name: string; phone?: string; email: string }) {
  try {
    console.log('✅ COMPLETE REGISTRATION: Iniciando tracking...');

    const eventId = await DeduplicationEngine.generateEventId('complete_reg');
    const externalId = await DeduplicationEngine.getValidExternalId();
    const fbp = await CookieManager.getFbpWithPixelWait();
    const fbc = CookieManager.getFbcWithFallback();
    const clientIP = await IPDetector.getClientIPForCAPI();
    const geoData = await GeoEnrichment.getGeoDataForCAPI(clientIP);

    // Email é obrigatório (identificador principal)
    const hashedEmail = await hashSHA256(userData.email.toLowerCase().trim());
    const formattedIP = clientIP ? IPDetector.formatIPForMeta(clientIP) : null;

    // Telefone é opcional (melhora matching se fornecido)
    let hashedPhone = '';
    if (userData.phone) {
      let phoneDigits = userData.phone.replace(/\D/g, '');
      if (phoneDigits.length === 10 || phoneDigits.length === 11) {
        phoneDigits = '55' + phoneDigits;
      }
      hashedPhone = await hashSHA256(phoneDigits);
    }

    // ✅ BOAS PRÁTICAS META: Normalizar nomes antes de hashear
    const nameParts = userData.name.trim().split(' ');
    const firstName = (nameParts[0] || '').toLowerCase().trim();
    const lastName = (nameParts.length > 1 ? nameParts[nameParts.length - 1] : '').toLowerCase().trim();
    const hashedFirstName = await hashSHA256(firstName);
    const hashedLastName = await hashSHA256(lastName);

    const capiUserData: Record<string, any> = {
      external_id: externalId,
      client_user_agent: navigator.userAgent,
      ...(fbp && { fbp }),
      ...(fbc && { fbc }),
      ...(formattedIP && { client_ip_address: formattedIP }),
      ...(hashedPhone && { ph: hashedPhone }),
      ...(hashedEmail && { em: hashedEmail }),
      ...(hashedFirstName && { fn: hashedFirstName }),
      ...(hashedLastName && { ln: hashedLastName }),
      ...(geoData?.ct && { ct: geoData.ct }),
      ...(geoData?.st && { st: geoData.st }),
      ...(geoData?.zp && { zp: geoData.zp }),
      ...(geoData?.country && { country: geoData.country }),
    };

    // ✅ CORREÇÃO META V10: Valor dinâmico com range maior (1-100) para evitar erro "mesmo preço"
    // Usa mais caracteres do eventId para maior variação
    const hashNum = parseInt(eventId.replace(/\D/g, '').substring(0, 8) || '12345678', 10);
    const dynamicValue = 1 + (hashNum % 100); // Range 1-100 (100 valores possíveis)
    console.log('💰 CompleteRegistration value:', dynamicValue, 'from eventId:', eventId.substring(0, 12));
    
    // ✅ PADRONIZADO: CompleteRegistration com content_category
    const customData = {
      content_name: 'cadastro_completo_fechaaqui',
      content_category: 'fechaaqui_registration',
      status: 'registered',
      value: dynamicValue,
      currency: 'BRL'
    };

    // Preparar dados do usuário para Advanced Matching no Pixel
    const pixelUserData: Record<string, string> = {};
    if (hashedPhone) pixelUserData.ph = hashedPhone;
    if (hashedEmail) pixelUserData.em = hashedEmail;
    if (hashedFirstName) pixelUserData.fn = hashedFirstName;
    if (hashedLastName) pixelUserData.ln = hashedLastName;

    let pixelSuccess = false;
    try {
      pixelSuccess = BrowserPixelProvider.trackEvent('CompleteRegistration', customData, { eventID: eventId }, pixelUserData);
    } catch (err) {
      console.error('❌ Erro Pixel CompleteRegistration:', err);
    }

    let capiSuccess = false;
    try {
      const capiPayload = RealCAPIProvider.prepareCAPIPayload('CompleteRegistration', eventId, capiUserData, customData);
      capiSuccess = await RealCAPIProvider.sendEvent(capiPayload);
    } catch (err) {
      console.error('❌ Erro CAPI CompleteRegistration:', err);
    }

    console.log('✅ COMPLETE REGISTRATION: Resultado:', { pixelSuccess, capiSuccess });
    return pixelSuccess || capiSuccess;
  } catch (error) {
    console.error('❌ COMPLETE REGISTRATION: Erro crítico:', error);
    return false;
  }
}

export default function Cadastro() {
  const navigate = useNavigate();
  const { register, login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    acceptTerms: false,
  });

  const hasTracked = useRef(false);

  // Verificar se formulário está válido para habilitar botão
  const isFormValid =
    formData.name.trim().length >= 3 &&
    formData.name.trim().split(/\s+/).length >= 2 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim()) &&
    formData.password.length >= 8 &&
    formData.password === formData.confirmPassword &&
    formData.acceptTerms;

  // Tracking: PageView + ViewContent
  useEffect(() => {
    if (!hasTracked.current) {
      hasTracked.current = true;
      trackPageView();
      const timer = setTimeout(() => trackViewContent(), 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  const formatPhone = (value: string) => {
    // Extrair apenas números
    let numbers = value.replace(/\D/g, "");

    // Se vazio, retorna vazio
    if (!numbers) return "";

    // Remover prefixo 55 se colou com +55
    if (numbers.length > 11 && numbers.startsWith("55")) {
      numbers = numbers.slice(2);
    }

    // Limitar a 11 dígitos
    numbers = numbers.slice(0, 11);

    // Aplicar máscara progressivamente
    if (numbers.length <= 2) {
      return `(${numbers}`;
    } else if (numbers.length <= 7) {
      return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    } else {
      return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
    }
  };

  const updateField = (field: keyof typeof formData, value: string | boolean) => {
    setFormData({ ...formData, [field]: value });
    if (errors[field as keyof FormErrors]) {
      setErrors({ ...errors, [field]: undefined });
    }
  };

  // ============================================
  // Criar conta
  // ============================================
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return; // Proteção contra duplo clique

    const newErrors: FormErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = "Nome é obrigatório";
    } else if (formData.name.trim().length < 3) {
      newErrors.name = "Nome deve ter pelo menos 3 caracteres";
    } else if (formData.name.trim().split(/\s+/).length < 2) {
      newErrors.name = "Informe seu nome e sobrenome";
    }

    if (!formData.email.trim()) {
      newErrors.email = "Email é obrigatório";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      newErrors.email = "Email inválido";
    }

    // Validar WhatsApp se foi preenchido
    if (formData.phone) {
      const phoneDigits = formData.phone.replace(/\D/g, "");
      if (phoneDigits.length < 10 || phoneDigits.length > 11) {
        newErrors.phone = "WhatsApp inválido";
      }
    }

    if (!formData.password) {
      newErrors.password = "Senha é obrigatória";
    } else if (formData.password.length < 8) {
      newErrors.password = "Senha deve ter pelo menos 8 caracteres";
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = "Confirme sua senha";
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "As senhas não coincidem";
    }

    if (!formData.acceptTerms) {
      newErrors.acceptTerms = "Você deve aceitar os termos";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);

    const phoneDigits = formData.phone ? formData.phone.replace(/\D/g, "") : undefined;
    const userEmail = formData.email.trim();

    const result = await register(formData.name, userEmail, formData.password, phoneDigits);
    console.log('📱 CADASTRO resultado:', result);

    if (result.success) {
      console.log('📱 CADASTRO needsConfirmation:', result.needsConfirmation);

      if (result.needsConfirmation) {
        console.log('📱 CADASTRO: Caminho COM confirmação - chamando confirm-user');
        let confirmSuccess = false;

        try {
          const confirmRes = await fetch('/api/verify-phone', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'confirm-user', email: userEmail, phone: phoneDigits }),
          });
          const confirmData = await confirmRes.json();
          console.log('📱 CADASTRO: Resultado confirm-user:', confirmData);
          confirmSuccess = confirmData.success;
        } catch (err) {
          console.warn('⚠️ Erro ao chamar confirm-user, tentando login direto:', err);
        }

        // Tentar login automático (mesmo se confirmação falhou - pode já estar confirmado)
        const loginResult = await login(userEmail, formData.password);

        if (loginResult.success) {
          // Tracking ANTES de navegar
          const trackingData = {
            name: formData.name,
            phone: phoneDigits,
            email: userEmail
          };
          try {
            await Promise.all([
              trackLeadWithUserData(trackingData),
              trackCompleteRegistration(trackingData)
            ]);
          } catch (e) {
            console.warn('⚠️ Tracking falhou, mas continuando:', e);
          }
          await new Promise(r => setTimeout(r, 300));
          toast.success("Conta criada! Escolha seu plano pra começar.");
          navigate("/upgrade");
          setIsLoading(false);
          return;
        }

        // Se login falhou, mostrar mensagem e redirecionar
        if (loginResult.error?.includes("Confirme seu email")) {
          toast.error("Verifique seu email para confirmar a conta.");
        } else {
          toast.error(loginResult.error || "Erro ao fazer login. Tente novamente.");
        }
        navigate("/login");
      } else {
        // Tracking ANTES de navegar
        const trackingData = {
          name: formData.name,
          phone: phoneDigits,
          email: userEmail
        };
        try {
          await Promise.all([
            trackLeadWithUserData(trackingData),
            trackCompleteRegistration(trackingData)
          ]);
        } catch (e) {
          console.warn('⚠️ Tracking falhou, mas continuando:', e);
        }
        await new Promise(r => setTimeout(r, 300));
        toast.success("Conta criada! Escolha seu plano pra começar.");
        navigate("/upgrade");
      }
    } else {
      toast.error(result.error || "Erro ao criar conta. Tente novamente.");
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Link to="/">
            <Logo size="lg" />
          </Link>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200/80 p-8 animate-card-in">
          <h2 className="text-2xl font-semibold tracking-tight text-neutral-900 text-center mb-2">
            Crie sua conta
          </h2>
          <p className="text-sm text-neutral-500 text-center mb-8">
            Preencha seus dados para comecar
          </p>

          <form onSubmit={handleCreateAccount} className="space-y-5">
            {/* Name */}
            <div className="space-y-1.5">
              <label htmlFor="name" className="text-xs font-medium text-neutral-500">Nome completo</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 w-4 h-4" />
                <Input
                  id="name"
                  type="text"
                  placeholder="Ex: João Silva"
                  value={formData.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  className={`pl-10 h-12 rounded-xl border-neutral-200 text-base ${errors.name ? "border-red-500" : ""}`}
                  disabled={isLoading}
                  autoFocus
                />
              </div>
              {errors.name && (
                <p className="text-xs text-red-500">{errors.name}</p>
              )}
              {!errors.name && formData.name.trim().length >= 3 && formData.name.trim().split(/\s+/).length < 2 && (
                <p className="text-xs text-amber-600">Adicione seu sobrenome para continuar</p>
              )}
            </div>

            {/* WhatsApp (opcional) */}
            <div className="space-y-1.5">
              <label htmlFor="phone" className="text-xs font-medium text-neutral-500">
                WhatsApp <span className="text-neutral-400">(opcional - melhora o matching de anuncios)</span>
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 w-4 h-4" />
                <Input
                  id="phone"
                  type="tel"
                  placeholder="(11) 99999-9999"
                  value={formData.phone}
                  onChange={(e) => updateField("phone", formatPhone(e.target.value))}
                  className={`pl-10 h-12 rounded-xl border-neutral-200 text-base ${errors.phone ? "border-red-500" : ""}`}
                  disabled={isLoading}
                />
              </div>
              {errors.phone && (
                <p className="text-xs text-red-500">{errors.phone}</p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs font-medium text-neutral-500">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 w-4 h-4" />
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={formData.email}
                  onChange={(e) => updateField("email", e.target.value)}
                  className={`pl-10 h-12 rounded-xl border-neutral-200 text-base ${errors.email ? "border-red-500" : ""}`}
                  disabled={isLoading}
                />
              </div>
              {errors.email && (
                <p className="text-xs text-red-500">{errors.email}</p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-xs font-medium text-neutral-500">Crie uma senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 w-4 h-4" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Minimo 8 caracteres"
                  value={formData.password}
                  onChange={(e) => updateField("password", e.target.value)}
                  className={`pl-10 pr-10 h-12 rounded-xl border-neutral-200 text-base ${errors.password ? "border-red-500" : ""}`}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-red-500">{errors.password}</p>
              )}
            </div>

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <label htmlFor="confirmPassword" className="text-xs font-medium text-neutral-500">Confirmar senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 w-4 h-4" />
                <Input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  placeholder="Repita a senha"
                  value={formData.confirmPassword}
                  onChange={(e) => updateField("confirmPassword", e.target.value)}
                  className={`pl-10 h-12 rounded-xl border-neutral-200 text-base ${errors.confirmPassword ? "border-red-500" : ""}`}
                  disabled={isLoading}
                />
              </div>
              {errors.confirmPassword && (
                <p className="text-xs text-red-500">{errors.confirmPassword}</p>
              )}
            </div>

            {/* Terms */}
            <div className="space-y-1.5">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="terms"
                  checked={formData.acceptTerms}
                  onCheckedChange={(checked) => updateField("acceptTerms", checked as boolean)}
                  className={`mt-0.5 ${errors.acceptTerms ? "border-red-500" : ""}`}
                  disabled={isLoading}
                />
                <label htmlFor="terms" className="text-xs text-neutral-500">
                  Li e aceito os{" "}
                  <Link to="/termos" className="text-primary hover:text-primary/80">
                    Termos de Uso
                  </Link>{" "}
                  e{" "}
                  <Link to="/privacidade" className="text-primary hover:text-primary/80">
                    Politica de Privacidade
                  </Link>
                </label>
              </div>
              {errors.acceptTerms && (
                <p className="text-xs text-red-500">{errors.acceptTerms}</p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || !isFormValid}
              className="w-full py-3 bg-primary hover:bg-primary/90 active:bg-primary/80 active:scale-[0.98] disabled:bg-neutral-300 disabled:cursor-not-allowed text-white rounded-full text-sm font-medium transition-all flex items-center justify-center touch-feedback"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Criando conta...
                </>
              ) : (
                "Criar minha conta"
              )}
            </button>
          </form>

          {/* Login link */}
          <p className="text-center text-xs text-neutral-500 mt-6">
            Ja tem conta?{" "}
            <Link to="/login" className="text-primary font-medium hover:text-primary/80">
              Entrar
            </Link>
          </p>
        </div>

        {/* Back to home */}
        <p className="text-center text-xs text-neutral-400 mt-6">
          <a href="/" className="hover:text-neutral-600">
            Voltar para o site
          </a>
        </p>
      </div>
    </div>
  );
}
