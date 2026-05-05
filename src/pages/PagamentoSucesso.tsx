import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle, Sparkles, ArrowRight } from "lucide-react";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/contexts/AuthContext";
import { getSupabase } from "@/lib/supabase";
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

// Tracking Purchase + Subscribe - pagamento confirmado
// Usa event_id determinístico baseado no payment_id do Asaas para deduplicação com webhook
async function trackPurchaseAndSubscribe(purchaseData: {
  value: number;
  plan: string;
  planName: string;
  paymentId?: string;
  userEmail?: string;
  userName?: string;
  userPhone?: string;
}) {
  try {
    // Verificar se já disparou nesta sessão (evitar duplicata local)
    const purchaseKey = `purchase_tracked_${purchaseData.paymentId || purchaseData.plan}`;
    if (sessionStorage.getItem(purchaseKey)) {
      console.log('💰 Purchase/Subscribe: Já disparado nesta sessão, ignorando...');
      return false;
    }

    console.log('💰 PURCHASE + SUBSCRIBE: Iniciando tracking...');

    // Event ID determinístico para deduplicação com webhook-asaas.js
    // Formato: purchase_asaas_{payment_id} - mesmo usado no webhook
    const eventId = purchaseData.paymentId
      ? `purchase_asaas_${purchaseData.paymentId}`
      : await DeduplicationEngine.generateEventId(`purchase_${Date.now()}`);
    const externalId = await DeduplicationEngine.getValidExternalId();
    const fbp = await CookieManager.getFbpWithPixelWait();
    const fbc = CookieManager.getFbcWithFallback();
    const clientIP = await IPDetector.getClientIPForCAPI();
    const geoData = await GeoEnrichment.getGeoDataForCAPI(clientIP);

    const hashedEmail = purchaseData.userEmail ? await hashSHA256(purchaseData.userEmail) : '';
    let phoneDigits = purchaseData.userPhone ? purchaseData.userPhone.replace(/\D/g, '') : '';
    if (phoneDigits && (phoneDigits.length === 10 || phoneDigits.length === 11)) phoneDigits = '55' + phoneDigits;
    const hashedPhone = phoneDigits.length >= 10 ? await hashSHA256(phoneDigits) : '';
    const formattedIP = clientIP ? IPDetector.formatIPForMeta(clientIP) : null;

    // Extrair primeiro e último nome
    let hashedFirstName = '';
    let hashedLastName = '';
    if (purchaseData.userName) {
      const nameParts = purchaseData.userName.trim().split(' ');
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

    const customData = {
      content_name: purchaseData.planName,
      content_category: 'subscription',
      content_type: 'product',
      content_ids: [purchaseData.plan],
      value: purchaseData.value,
      currency: 'BRL',
      num_items: 1,
      order_id: purchaseData.paymentId,
    };

    // Disparar Pixel
    let pixelSuccess = false;
    let pixelAttempts = 0;
    const maxAttempts = 3;

    while (!pixelSuccess && pixelAttempts < maxAttempts) {
      try {
        pixelSuccess = BrowserPixelProvider.trackEvent('Purchase', customData, { eventID: eventId });
        if (!pixelSuccess) throw new Error('Pixel não retornou sucesso');
        console.log('✅ Purchase Pixel:', pixelSuccess);
      } catch (err) {
        pixelAttempts++;
        console.error(`❌ Erro Pixel Purchase (tentativa ${pixelAttempts}/${maxAttempts}):`, err);
        if (pixelAttempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 300 * pixelAttempts));
        }
      }
    }

    // Disparar CAPI
    let capiSuccess = false;
    let capiAttempts = 0;

    while (!capiSuccess && capiAttempts < maxAttempts) {
      try {
        const capiPayload = RealCAPIProvider.prepareCAPIPayload('Purchase', eventId, capiUserData, customData);
        capiSuccess = await RealCAPIProvider.sendEvent(capiPayload);
        if (!capiSuccess) throw new Error('CAPI não retornou sucesso');
        console.log('✅ Purchase CAPI:', capiSuccess);
      } catch (err) {
        capiAttempts++;
        console.error(`❌ Erro CAPI Purchase (tentativa ${capiAttempts}/${maxAttempts}):`, err);
        if (capiAttempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 300 * capiAttempts));
        }
      }
    }

    // Também disparar Subscribe (assinatura)
    // Event ID determinístico para Subscribe também
    const subscribeEventId = purchaseData.paymentId
      ? `subscribe_asaas_${purchaseData.paymentId}`
      : await DeduplicationEngine.generateEventId(`subscribe_${Date.now()}`);

    // Subscribe Pixel
    try {
      BrowserPixelProvider.trackEvent('Subscribe', {
        ...customData,
        predicted_ltv: purchaseData.value * 12, // LTV estimado de 1 ano
      }, { eventID: subscribeEventId });
      console.log('✅ Subscribe Pixel: true');
    } catch (err) {
      console.error('❌ Erro Pixel Subscribe:', err);
    }

    // Subscribe CAPI
    try {
      const subscribePayload = RealCAPIProvider.prepareCAPIPayload('Subscribe', subscribeEventId, capiUserData, {
        ...customData,
        predicted_ltv: purchaseData.value * 12,
      });
      await RealCAPIProvider.sendEvent(subscribePayload);
      console.log('✅ Subscribe CAPI: true');
    } catch (err) {
      console.error('❌ Erro CAPI Subscribe:', err);
    }

    // Marcar como disparado
    sessionStorage.setItem(purchaseKey, 'true');

    console.log('💰 PURCHASE + SUBSCRIBE: Resultado:', { pixelSuccess, capiSuccess, value: purchaseData.value, plan: purchaseData.plan });
    return pixelSuccess || capiSuccess;

  } catch (error) {
    console.error('❌ PURCHASE: Erro crítico:', error);
    return false;
  }
}

export default function PagamentoSucesso() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const hasTracked = useRef(false);
  const [showConfetti, setShowConfetti] = useState(true);
  const [userPhone, setUserPhone] = useState<string | null>(null);
  const [planActivated, setPlanActivated] = useState<boolean | null>(null); // null=verificando, true=ativo, false=timeout

  // Pegar dados do pagamento da URL
  const plan = searchParams.get('plan') || 'pro';
  const value = parseFloat(searchParams.get('value') || '0');
  const paymentId = searchParams.get('payment_id') || '';

  // Polling do status do plano — garante que webhook processou antes de liberar UI
  useEffect(() => {
    // Sem user logado (cadastrou via /checkout sem login automatico): assume ativo
    // e mostra mensagem pra fazer login — nao tem como consultar sem auth.
    if (!user?.id) {
      setPlanActivated(true);
      return;
    }

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 15; // 30s total (2s por tentativa)

    const check = async () => {
      if (cancelled) return;
      try {
        const { data } = await getSupabase()
          .from("profiles")
          .select("plan, plan_status")
          .eq("user_id", user.id)
          .single();

        if (data?.plan && data.plan !== 'free' && data.plan_status === 'active') {
          setPlanActivated(true);
          return; // sucesso, para o polling
        }
      } catch (e) { /* ignore */ }

      attempts++;
      if (attempts >= maxAttempts) {
        setPlanActivated(false); // timeout — webhook pode ter falhado
        return;
      }
      setTimeout(check, 2000);
    };

    check();
    return () => { cancelled = true; };
  }, [user?.id]);

  const planNames: Record<string, string> = {
    essential: 'FechaAqui Mensal',
    pro: 'FechaAqui Anual',
  };

  // Tracking: PageView + ViewContent
  useEffect(() => {
    trackPageView();
    const timer = setTimeout(() => trackViewContent(), 2000);
    return () => clearTimeout(timer);
  }, []);

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

  useEffect(() => {
    if (!hasTracked.current && value > 0) {
      hasTracked.current = true;

      // 🎯 TRACKING: Purchase + Subscribe (Pixel + CAPI)
      trackPurchaseAndSubscribe({
        value: value,
        plan: plan,
        planName: planNames[plan] || `FechaAqui ${plan}`,
        paymentId: paymentId,
        userEmail: user?.email,
        userName: user?.name,
        userPhone: userPhone || undefined,
      }).then((success) => {
        console.log('💰 Purchase + Subscribe tracking:', success ? 'sucesso' : 'falhou');
      });
    }

    // Esconder confetti após 3 segundos
    const timer = setTimeout(() => setShowConfetti(false), 3000);
    return () => clearTimeout(timer);
  }, [value, plan, paymentId, user?.email, user?.name, userPhone]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex flex-col items-center justify-center p-4">
      {/* Confetti animation */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute animate-bounce"
              style={{
                left: `${Math.random() * 100}%`,
                top: `-${Math.random() * 20}%`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${2 + Math.random() * 2}s`,
              }}
            >
              <Sparkles className="text-gold-400" size={24} />
            </div>
          ))}
        </div>
      )}

      <div className="max-w-md w-full text-center">
        {/* Logo */}
        <div className="mb-8">
          <Logo size="lg" />
        </div>

        {/* Success Icon */}
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-in zoom-in duration-500">
          <CheckCircle className="w-12 h-12 text-green-500" />
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold text-neutral-900 mb-3">
          Pagamento Confirmado!
        </h1>

        {/* Subtitle */}
        <p className="text-lg text-neutral-600 mb-2">
          Bem-vindo ao <span className="font-semibold text-green-600">{planNames[plan] || 'FechaAqui'}</span>
        </p>

        {value > 0 && (
          <p className="text-neutral-500 mb-4">
            Valor: R$ {value.toFixed(2).replace('.', ',')}
          </p>
        )}

        {/* Status da ativação — feedback em tempo real */}
        {planActivated === null && (
          <div className="flex items-center justify-center gap-2 bg-amber-50 border border-amber-200 rounded-xl py-2.5 px-4 mb-6 max-w-sm mx-auto">
            <div className="w-4 h-4 rounded-full border-2 border-amber-500 border-t-transparent animate-spin flex-shrink-0" />
            <p className="text-xs text-amber-800 font-medium">Ativando seu plano…</p>
          </div>
        )}
        {planActivated === true && (
          <div className="flex items-center justify-center gap-2 bg-accent/10 border border-green-200 rounded-xl py-2.5 px-4 mb-6 max-w-sm mx-auto">
            <CheckCircle size={16} className="text-green-600 flex-shrink-0" />
            <p className="text-xs text-green-800 font-semibold">Plano ativo! Você já pode usar tudo.</p>
          </div>
        )}
        {planActivated === false && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl py-3 px-4 mb-6 max-w-md mx-auto text-left">
            <Sparkles size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-amber-900 font-semibold mb-0.5">Pagamento confirmado, plano sendo ativado</p>
              <p className="text-[11px] text-amber-800 leading-snug">
                Pode demorar até 1 min. Se não abrir,{" "}
                <a href="https://wa.me/5551992185607" target="_blank" rel="noopener" className="underline font-semibold">
                  fala com a gente no WhatsApp
                </a>{" "}
                que resolvemos na hora.
              </p>
            </div>
          </div>
        )}

        {/* Benefits */}
        <div className="bg-white rounded-2xl border border-neutral-200 p-6 mb-8 text-left">
          <h3 className="font-semibold text-neutral-900 mb-4">Agora você pode:</h3>
          <ul className="space-y-3">
            {plan === 'pro' ? (
              <>
                <li className="flex items-center gap-3 text-neutral-600">
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                  Propostas ilimitadas com sua marca
                </li>
                <li className="flex items-center gap-3 text-neutral-600">
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                  Catalogo completo de plantas
                </li>
                <li className="flex items-center gap-3 text-neutral-600">
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                  Suporte prioritario no WhatsApp
                </li>
              </>
            ) : (
              <>
                <li className="flex items-center gap-3 text-neutral-600">
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                  Propostas profissionais com sua marca
                </li>
                <li className="flex items-center gap-3 text-neutral-600">
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                  Saber quando o cliente abrir a proposta
                </li>
                <li className="flex items-center gap-3 text-neutral-600">
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                  Parecer uma empresa grande pro cliente
                </li>
              </>
            )}
          </ul>
        </div>

        {/* CTA — se logado, vai direto pro app. Se nao, manda pro login */}
        {user ? (
          <Link
            to="/propostas"
            className="inline-flex items-center justify-center gap-2 w-full py-4 bg-green-500 hover:bg-green-600 text-white font-medium rounded-full transition-colors"
          >
            Criar minha primeira proposta
            <ArrowRight size={20} />
          </Link>
        ) : (
          <>
            <div className="bg-accent/10 border border-green-200 rounded-xl p-4 mb-4 text-left">
              <p className="text-sm font-semibold text-green-900 mb-1">
                📧 Enviamos um email pra você
              </p>
              <p className="text-xs text-green-800 leading-snug">
                Confere sua caixa (e spam). Pra acessar a plataforma, faça login
                com o email e senha que você cadastrou.
              </p>
            </div>
            <Link
              to="/login"
              className="inline-flex items-center justify-center gap-2 w-full py-4 bg-green-500 hover:bg-green-600 text-white font-medium rounded-full transition-colors"
            >
              Fazer login
              <ArrowRight size={20} />
            </Link>
          </>
        )}

        <p className="text-sm text-neutral-400 mt-4">
          Qualquer dúvida, fale com a gente no WhatsApp
        </p>
      </div>
    </div>
  );
}
