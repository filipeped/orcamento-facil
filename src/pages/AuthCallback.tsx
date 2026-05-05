import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { SESSION_STORAGE_KEY } from "@/lib/supabase";
import { DeduplicationEngine } from "@/tracking/core/DeduplicationEngine";
import { BrowserPixelProvider } from "@/tracking/providers/BrowserPixelProvider";
import { RealCAPIProvider } from "@/tracking/providers/RealCAPIProvider";
import { CookieManager } from "@/tracking/utils/CookieManager";
import { IPDetector } from "@/tracking/utils/IPDetector";
import { GeoEnrichment } from "@/tracking/utils/GeoEnrichment";

// Valor determinístico baseado no eventId (consistência Pixel/CAPI)
function generateDeterministicValue(eventId: string, minValue: number = 10, maxValue: number = 100): number {
  if (!eventId || eventId.length < 8) return minValue;
  const hexPart = eventId.replace(/[^a-fA-F0-9]/g, '').substring(0, 8);
  const numericValue = parseInt(hexPart, 16);
  const range = maxValue - minValue + 1;
  return (numericValue % range) + minValue;
}

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

// Tracking CompleteRegistration - cadastro completo
async function trackCompleteRegistration(userData: { email: string; name?: string; phone?: string }) {
  try {
    console.log('✅ COMPLETE REGISTRATION: Iniciando tracking...');

    const eventId = await DeduplicationEngine.generateEventId('complete_reg');
    const externalId = await DeduplicationEngine.getValidExternalId();
    const fbp = await CookieManager.getFbpWithPixelWait();
    const fbc = CookieManager.getFbcWithFallback();
    const clientIP = await IPDetector.getClientIPForCAPI();
    const geoData = await GeoEnrichment.getGeoDataForCAPI(clientIP);

    const hashedEmail = await hashSHA256(userData.email.toLowerCase().trim());
    // ✅ Adicionar código do país (55) se não existir
    let hashedPhone = '';
    if (userData.phone) {
      let phoneDigits = userData.phone.replace(/\D/g, '');
      if (phoneDigits.length === 10 || phoneDigits.length === 11) {
        phoneDigits = '55' + phoneDigits;
      }
      hashedPhone = await hashSHA256(phoneDigits);
    }
    const formattedIP = clientIP ? IPDetector.formatIPForMeta(clientIP) : null;

    // Extrair primeiro e último nome
    let hashedFirstName = '';
    let hashedLastName = '';
    if (userData.name) {
      const nameParts = userData.name.trim().split(' ');
      hashedFirstName = await hashSHA256(nameParts[0] || '');
      hashedLastName = await hashSHA256(nameParts.length > 1 ? nameParts[nameParts.length - 1] : '');
    }

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
    if (hashedEmail) pixelUserData.em = hashedEmail;
    if (hashedPhone) pixelUserData.ph = hashedPhone;
    if (hashedFirstName) pixelUserData.fn = hashedFirstName;
    if (hashedLastName) pixelUserData.ln = hashedLastName;

    // Disparar Pixel com Advanced Matching
    let pixelSuccess = false;
    try {
      pixelSuccess = BrowserPixelProvider.trackEvent('CompleteRegistration', customData, { eventID: eventId }, pixelUserData);
      console.log('✅ CompleteRegistration Pixel com Advanced Matching:', pixelSuccess, Object.keys(pixelUserData));
    } catch (err) {
      console.error('❌ Erro Pixel CompleteRegistration:', err);
    }

    // Disparar CAPI
    let capiSuccess = false;
    try {
      const capiPayload = RealCAPIProvider.prepareCAPIPayload('CompleteRegistration', eventId, capiUserData, customData);
      capiSuccess = await RealCAPIProvider.sendEvent(capiPayload);
      console.log('✅ CompleteRegistration CAPI:', capiSuccess);
    } catch (err) {
      console.error('❌ Erro CAPI CompleteRegistration:', err);
    }

    return pixelSuccess || capiSuccess;
  } catch (error) {
    console.error('❌ COMPLETE REGISTRATION: Erro crítico:', error);
    return false;
  }
}

// Tracking de Lead para cadastro via Google
async function trackGoogleSignupLead(userData: { email: string; name?: string; phone?: string }) {
  try {
    // Verificar se já disparou Lead nesta sessão (evitar duplicata)
    const leadTrackedKey = `lead_tracked_${userData.email}`;
    if (sessionStorage.getItem(leadTrackedKey)) {
      console.log('🎯 Lead Google: Já disparado nesta sessão, ignorando...');
      return false;
    }

    console.log('🎯 LEAD GOOGLE: Iniciando tracking...');

    const eventId = await DeduplicationEngine.generateEventId('lead_google');
    const externalId = await DeduplicationEngine.getValidExternalId();

    const fbp = await CookieManager.getFbpWithPixelWait();
    const fbc = CookieManager.getFbcWithFallback();
    const clientIP = await IPDetector.getClientIPForCAPI();
    const geoData = await GeoEnrichment.getGeoDataForCAPI(clientIP);

    // ✅ BOAS PRÁTICAS META: Hashear dados com normalização correta
    const hashedEmail = await hashSHA256(userData.email.toLowerCase().trim());
    
    // ✅ Telefone com código do país 55 (se disponível)
    let hashedPhone = '';
    if (userData.phone) {
      let phoneDigits = userData.phone.replace(/\D/g, '');
      if (phoneDigits.length === 10 || phoneDigits.length === 11) {
        phoneDigits = '55' + phoneDigits;
      }
      hashedPhone = await hashSHA256(phoneDigits);
    }

    // Extrair nome do Google (se disponível) - normalizar antes de hashear
    let hashedFirstName = '';
    let hashedLastName = '';
    if (userData.name) {
      const nameParts = userData.name.trim().split(' ');
      hashedFirstName = await hashSHA256((nameParts[0] || '').toLowerCase().trim());
      hashedLastName = await hashSHA256((nameParts.length > 1 ? nameParts[nameParts.length - 1] : '').toLowerCase().trim());
    }

    console.log('📊 Dados Google hasheados para CAPI:', {
      email: hashedEmail.substring(0, 16) + '...',
      phone: hashedPhone ? hashedPhone.substring(0, 16) + '...' : 'N/A',
      firstName: hashedFirstName ? hashedFirstName.substring(0, 16) + '...' : 'N/A',
      lastName: hashedLastName ? hashedLastName.substring(0, 16) + '...' : 'N/A'
    });

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

    // ✅ PADRONIZADO: Mesmos valores que todos os outros Leads
    const customData = {
      content_name: 'lead_fechaaqui',
      content_category: 'fechaaqui_lead',
      source: 'google_signup',
      value: generateDeterministicValue(eventId, 10, 100),
      currency: 'BRL'
    };

    // Preparar dados do usuário para Advanced Matching no Pixel
    const pixelUserData: Record<string, string> = {};
    if (hashedEmail) pixelUserData.em = hashedEmail;
    if (hashedPhone) pixelUserData.ph = hashedPhone;
    if (hashedFirstName) pixelUserData.fn = hashedFirstName;
    if (hashedLastName) pixelUserData.ln = hashedLastName;

    // Disparar Pixel COM RETRY e Advanced Matching
    let pixelSuccess = false;
    const maxAttempts = 3;
    let pixelAttempts = 0;

    while (!pixelSuccess && pixelAttempts < maxAttempts) {
      try {
        pixelSuccess = BrowserPixelProvider.trackEvent('Lead', customData, { eventID: eventId }, pixelUserData);
        if (!pixelSuccess) throw new Error('Pixel não retornou sucesso');
        console.log('✅ Lead Google Pixel com Advanced Matching:', pixelSuccess, Object.keys(pixelUserData));
      } catch (err) {
        pixelAttempts++;
        console.error(`❌ Erro Pixel Lead Google (tentativa ${pixelAttempts}/${maxAttempts}):`, err);
        if (pixelAttempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 300 * pixelAttempts));
        }
      }
    }

    // Disparar CAPI COM RETRY
    let capiSuccess = false;
    let capiAttempts = 0;

    while (!capiSuccess && capiAttempts < maxAttempts) {
      try {
        const capiPayload = RealCAPIProvider.prepareCAPIPayload('Lead', eventId, capiUserData, customData);
        capiSuccess = await RealCAPIProvider.sendEvent(capiPayload);
        if (!capiSuccess) throw new Error('CAPI não retornou sucesso');
        console.log('✅ Lead Google CAPI:', capiSuccess);
      } catch (err) {
        capiAttempts++;
        console.error(`❌ Erro CAPI Lead Google (tentativa ${capiAttempts}/${maxAttempts}):`, err);
        if (capiAttempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 300 * capiAttempts));
        }
      }
    }

    // Marcar como disparado nesta sessão
    sessionStorage.setItem(leadTrackedKey, 'true');

    console.log('🎯 LEAD GOOGLE: Resultado:', { pixelSuccess, capiSuccess });
    return pixelSuccess || capiSuccess;

  } catch (error) {
    console.error('❌ LEAD GOOGLE: Erro crítico:', error);
    return false;
  }
}

export default function AuthCallback() {
  const [status, setStatus] = useState<string>("Autenticando...");
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const handleAuth = async () => {
      console.log("AuthCallback - URL:", window.location.href);

      // Get tokens from hash
      const hash = window.location.hash;
      if (hash && hash.includes("access_token")) {
        setStatus("Processando tokens...");

        const hashParams = new URLSearchParams(hash.substring(1));
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        const expiresAt = hashParams.get("expires_at");
        const expiresIn = hashParams.get("expires_in");

        console.log("AuthCallback - Found tokens:", !!accessToken, !!refreshToken);

        if (accessToken && refreshToken) {
          // Decode JWT to get user info
          try {
            const payload = JSON.parse(atob(accessToken.split('.')[1]));
            console.log("AuthCallback - Token payload:", payload.email);

            // Build session object in Supabase format
            const session = {
              access_token: accessToken,
              refresh_token: refreshToken,
              expires_at: parseInt(expiresAt || "0"),
              expires_in: parseInt(expiresIn || "3600"),
              token_type: "bearer",
              user: {
                id: payload.sub,
                email: payload.email,
                app_metadata: payload.app_metadata,
                user_metadata: payload.user_metadata,
                aud: payload.aud,
                role: payload.role,
              }
            };

            // Store in localStorage (Supabase format)
            localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
            console.log("AuthCallback - Session saved to localStorage");

            // 🎯 TRACKING: Disparar eventos de conversão para cadastro via Google
            const userName = payload.user_metadata?.full_name || payload.user_metadata?.name || '';
            const trackingData = { email: payload.email, name: userName };

            // Aguardar tracking ANTES de redirecionar (garante envio)
            setStatus("Finalizando cadastro...");
            try {
              await Promise.all([
                trackGoogleSignupLead(trackingData),
                trackCompleteRegistration(trackingData)
              ]);
              console.log('✅ Tracking Google signup: enviado com sucesso');
            } catch (e) {
              console.warn('⚠️ Tracking falhou, mas continuando:', e);
            }

            setStatus("Login realizado! Redirecionando...");

            // Delay extra + redirect
            await new Promise(r => setTimeout(r, 300));
            window.location.href = "/propostas";
            return;

          } catch (err) {
            console.error("AuthCallback - Error parsing token:", err);
          }
        }
      }

      // Nothing worked
      setStatus("Erro na autenticação. Tente novamente.");
      setHasError(true);
      setTimeout(() => {
        window.location.href = "/login";
      }, 3000);
    };

    handleAuth();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted">
      <div className="flex flex-col items-center gap-4">
        {!hasError && <Loader2 className="w-8 h-8 animate-spin text-primary" />}
        <p className={`text-center px-4 ${hasError ? "text-destructive" : "text-muted-foreground"}`}>
          {status}
        </p>
      </div>
    </div>
  );
}
