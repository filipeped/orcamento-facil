import { useState } from "react";
import { Phone, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";
import { getSupabase } from "@/lib/supabase";
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

// ✅ Tracking após verificação do telefone (para usuários Google OAuth)
async function trackPhoneVerified(userData: { phone: string; name?: string; userId: string }) {
  try {
    console.log('📱 PHONE VERIFIED: Iniciando tracking com telefone...');
    
    // Verificar se já disparou nesta sessão
    const trackKey = `phone_verified_tracked_${userData.userId}`;
    if (sessionStorage.getItem(trackKey)) {
      console.log('📱 Phone tracking: Já disparado nesta sessão');
      return false;
    }

    const eventId = await DeduplicationEngine.generateEventId('phone_verified');
    const externalId = await DeduplicationEngine.getValidExternalId();
    const fbp = await CookieManager.getFbpWithPixelWait();
    const fbc = CookieManager.getFbcWithFallback();
    const clientIP = await IPDetector.getClientIPForCAPI();
    const geoData = await GeoEnrichment.getGeoDataForCAPI(clientIP);

    // Telefone com código 55
    let phoneDigits = userData.phone.replace(/\D/g, '');
    if (phoneDigits.length === 10 || phoneDigits.length === 11) {
      phoneDigits = '55' + phoneDigits;
    }
    const hashedPhone = await hashSHA256(phoneDigits);

    // Nome (se disponível)
    let hashedFirstName = '';
    let hashedLastName = '';
    if (userData.name) {
      const nameParts = userData.name.trim().split(' ');
      hashedFirstName = await hashSHA256((nameParts[0] || '').toLowerCase().trim());
      hashedLastName = await hashSHA256((nameParts.length > 1 ? nameParts[nameParts.length - 1] : '').toLowerCase().trim());
    }

    const formattedIP = clientIP ? IPDetector.formatIPForMeta(clientIP) : null;
    const capiUserData: Record<string, any> = {
      external_id: externalId,
      client_user_agent: navigator.userAgent,
      ...(fbp && { fbp }),
      ...(fbc && { fbc }),
      ...(formattedIP && { client_ip_address: formattedIP }),
      ...(hashedPhone && { ph: hashedPhone }),
      ...(hashedFirstName && { fn: hashedFirstName }),
      ...(hashedLastName && { ln: hashedLastName }),
      ...(geoData?.ct && { ct: geoData.ct }),
      ...(geoData?.st && { st: geoData.st }),
      ...(geoData?.zp && { zp: geoData.zp }),
      ...(geoData?.country && { country: geoData.country }),
    };

    // ✅ PADRONIZADO: Lead com telefone verificado (mesmos valores base)
    const customData = {
      content_name: 'lead_fechaqui',
      content_category: 'fechaqui_lead',
      source: 'phone_verified',
      value: 50,
      currency: 'BRL'
    };

    // Pixel com Advanced Matching
    const pixelUserData: Record<string, string> = {};
    if (hashedPhone) pixelUserData.ph = hashedPhone;
    if (hashedFirstName) pixelUserData.fn = hashedFirstName;
    if (hashedLastName) pixelUserData.ln = hashedLastName;

    let pixelSuccess = false;
    try {
      pixelSuccess = BrowserPixelProvider.trackEvent('Lead', customData, { eventID: eventId }, pixelUserData);
    } catch (err) {
      console.error('❌ Erro Pixel Phone Verified:', err);
    }

    let capiSuccess = false;
    try {
      const capiPayload = RealCAPIProvider.prepareCAPIPayload('Lead', eventId, capiUserData, customData);
      capiSuccess = await RealCAPIProvider.sendEvent(capiPayload);
    } catch (err) {
      console.error('❌ Erro CAPI Phone Verified:', err);
    }

    // Marcar como disparado
    sessionStorage.setItem(trackKey, 'true');
    
    console.log('📱 PHONE VERIFIED: Resultado:', { pixelSuccess, capiSuccess });
    return pixelSuccess || capiSuccess;
  } catch (error) {
    console.error('❌ PHONE VERIFIED: Erro crítico:', error);
    return false;
  }
}

interface PhoneVerificationProps {
  userId: string;
  userName?: string;
  onComplete: () => void;
  allowSkip?: boolean; // Se false, não mostra botão "Pular" (importante para tracking)
}

export function PhoneVerification({ userId, userName, onComplete, allowSkip = true }: PhoneVerificationProps) {
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Formatar telefone
  const formatPhone = (value: string) => {
    let digits = value.replace(/\D/g, "");
    // Remover prefixo 55 se colou com +55
    if (digits.length > 11 && digits.startsWith("55")) {
      digits = digits.slice(2);
    }
    digits = digits.slice(0, 11);
    if (digits.length <= 2) return `(${digits}`;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  // Salvar telefone e continuar
  const handleSaveAndContinue = async () => {
    const phoneDigits = phone.replace(/\D/g, "");

    // Validar se preencheu
    if (!phoneDigits || phoneDigits.length < 10 || phoneDigits.length > 11) {
      setError("WhatsApp invalido");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      // Atualizar perfil com telefone
      await getSupabase()
        .from("profiles")
        .update({
          phone: phoneDigits,
          phone_verified: true,
        })
        .eq("user_id", userId);

      // ✅ TRACKING: Disparar Lead com telefone (melhora matching Meta)
      trackPhoneVerified({
        phone: phoneDigits,
        name: userName,
        userId: userId
      }).catch(() => {});

      toast.success("WhatsApp salvo!");
      onComplete();
    } catch {
      toast.error("Erro ao salvar. Tente novamente.");
    }

    setIsLoading(false);
  };

  // Pular e continuar depois
  const handleSkip = async () => {
    setIsLoading(true);

    try {
      // Marcar como verificado sem salvar telefone
      await getSupabase()
        .from("profiles")
        .update({
          phone_verified: true,
        })
        .eq("user_id", userId);

      onComplete();
    } catch {
      toast.error("Erro ao continuar. Tente novamente.");
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <a href="/">
            <Logo size="lg" />
          </a>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200/80 p-8 animate-card-in">
          <h2 className="text-2xl font-semibold tracking-tight text-neutral-900 text-center mb-2">
            {userName ? `Ola, ${userName.split(" ")[0]}!` : "Adicionar WhatsApp"}
          </h2>
          <p className="text-sm text-neutral-500 text-center mb-8">
            Adicione seu WhatsApp para melhorar o matching de anuncios (opcional)
          </p>

          <div className="space-y-5">
            <div className="space-y-1.5">
              <label htmlFor="phone" className="text-xs font-medium text-neutral-500">Seu WhatsApp (opcional)</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 w-4 h-4" />
                <Input
                  id="phone"
                  type="tel"
                  placeholder="(11) 99999-9999"
                  value={phone}
                  onChange={(e) => {
                    setPhone(formatPhone(e.target.value));
                    setError("");
                  }}
                  className={`pl-10 h-12 rounded-xl border-neutral-200 text-base ${error ? "border-red-500" : ""}`}
                  autoFocus
                />
              </div>
              {error && <p className="text-xs text-red-500">{error}</p>}
            </div>

            {/* Botão Salvar */}
            <button
              onClick={handleSaveAndContinue}
              disabled={isLoading || !phone}
              className="w-full py-3 bg-primary hover:bg-primary/90 active:bg-primary/80 active:scale-[0.98] disabled:bg-neutral-300 text-white rounded-full text-sm font-medium transition-all flex items-center justify-center touch-feedback"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar e Continuar"
              )}
            </button>

            {/* Botão Pular - só mostra se allowSkip=true */}
            {allowSkip && (
              <>
                <button
                  onClick={handleSkip}
                  disabled={isLoading}
                  className="w-full py-3 bg-neutral-100 hover:bg-neutral-200 active:bg-neutral-300 active:scale-[0.98] disabled:bg-neutral-300 text-neutral-700 rounded-full text-sm font-medium transition-all flex items-center justify-center touch-feedback"
                >
                  Pular e continuar depois
                </button>

                <p className="text-xs text-center text-neutral-400">
                  Voce pode adicionar seu WhatsApp depois nas configuracoes
                </p>
              </>
            )}

            {/* Mensagem quando não pode pular (Google login) */}
            {!allowSkip && (
              <p className="text-xs text-center text-neutral-500">
                O WhatsApp ajuda a melhorar o tracking de anuncios e encontrar seus clientes
              </p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
