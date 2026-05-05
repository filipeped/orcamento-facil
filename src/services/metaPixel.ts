// ===== TRACKING COMPLETO DO EVENTO LEAD =====

// ✅ 1. IMPORTS NECESSÁRIOS
import { LeadTracker } from '../tracking/events/LeadTracker';
import { DeduplicationEngine } from '../tracking/core/DeduplicationEngine';
import { CookieManager } from '../tracking/utils/CookieManager';
import { IPDetector } from '../tracking/utils/IPDetector';
import { RealCAPIProvider } from '../tracking/providers/RealCAPIProvider';
import { GeoEnrichment } from '../tracking/utils/GeoEnrichment';
import { BrowserPixelProvider } from '../tracking/providers/BrowserPixelProvider';

// ✅ OTIMIZAÇÃO: Removidas funções duplicadas - usando IPDetector centralizado

// ✅ FUNÇÃO PARA HASH SHA256
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

// ✅ OBTER DADOS DO USUÁRIO LOGADO (para melhorar qualidade dos eventos)
// Usa 2 fontes: (1) cache do profile (phone/name reais) + (2) auth metadata (fallback)
async function getLoggedUserData(): Promise<{
  em?: string;
  fn?: string;
  ln?: string;
  ph?: string;
} | null> {
  try {
    // Verificar se há sessão do Supabase
    const sessionData = localStorage.getItem('sb-nnqctrjvtacswjvdgred-auth-token');
    if (!sessionData) return null;

    const session = JSON.parse(sessionData);
    const user = session?.user;
    if (!user) return null;

    const userData: { em?: string; fn?: string; ln?: string; ph?: string } = {};

    // ✅ FONTE 1: Cache do profile (dados reais da tabela profiles - salvo pelo AuthContext)
    let profilePhone = '';
    let profileName = '';
    try {
      const profileCache = localStorage.getItem('fechaqui_profile_tracking');
      if (profileCache) {
        const profile = JSON.parse(profileCache);
        profilePhone = profile.phone || '';
        profileName = profile.full_name || '';
      }
    } catch { /* ignore */ }

    // Email (sempre presente se logado)
    if (user.email) {
      userData.em = await hashSHA256(user.email.toLowerCase().trim());
    }

    // Nome: profile > auth metadata
    const fullName = profileName || user.user_metadata?.name || user.user_metadata?.full_name;
    if (fullName) {
      const nameParts = fullName.trim().split(' ');
      const firstName = (nameParts[0] || '').toLowerCase().trim();
      const lastName = (nameParts.length > 1 ? nameParts[nameParts.length - 1] : '').toLowerCase().trim();

      if (firstName) userData.fn = await hashSHA256(firstName);
      if (lastName) userData.ln = await hashSHA256(lastName);
    }

    // Telefone: profile > auth metadata
    const phone = profilePhone || user.user_metadata?.phone || user.phone;
    if (phone) {
      let phoneDigits = phone.replace(/\D/g, '');
      if (phoneDigits.length === 10 || phoneDigits.length === 11) {
        phoneDigits = '55' + phoneDigits;
      }
      if (phoneDigits.length >= 10) {
        userData.ph = await hashSHA256(phoneDigits);
      }
    }

    if (Object.keys(userData).length > 0) {
      console.log('👤 Dados do usuário logado encontrados:', Object.keys(userData));
      return userData;
    }

    return null;
  } catch (error) {
    console.warn('⚠️ Erro ao obter dados do usuário logado:', error);
    return null;
  }
}

// ✅ 2. CONFIGURAÇÃO DO PIXEL
const PIXEL_CONFIG = {
  PIXEL_ID: "888149620416465",
  // ✅ SEGURANÇA: Token removido - o CAPI proxy já tem o token configurado via env vars
  EVENT_SOURCE_URL: "https://www.fechaqui.com",
  PROXY_URL: "https://cap.jardinei.com/api/events" // proxy compartilhado — preservado
};

// ✅ VALOR DETERMINÍSTICO: Garante consistência Pixel/CAPI
function generateDeterministicValue(eventId: string, minValue: number = 10, maxValue: number = 100): number {
  if (!eventId || eventId.length < 8) return minValue;
  // Usa os primeiros 8 caracteres hexadecimais do eventId
  const hexPart = eventId.replace(/[^a-fA-F0-9]/g, '').substring(0, 8);
  const numericValue = parseInt(hexPart, 16);
  const range = maxValue - minValue + 1;
  return (numericValue % range) + minValue;
}

// ✅ 3. FUNÇÃO PRINCIPAL DE TRACKING
async function trackLeadEvent() {
  console.log('🎯 TRACKING LEAD: ===== INICIANDO TRACKING SEM PII =====');

  try {
    // ✅ 3.1 GERAR DADOS ÚNICOS COM NOVA IMPLEMENTAÇÃO SHA256
    const eventId = await DeduplicationEngine.generateEventId('lead');
    const externalId = await DeduplicationEngine.getValidExternalId(); // ✅ Usar versão com refresh automático
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    // ✅ 3.1.1 OBTER DADOS DE GEOLOCALIZAÇÃO PARA LEAD
    const clientIP = await IPDetector.getClientIPForCAPI();
    const geoData = await GeoEnrichment.getGeoDataForCAPI(clientIP);
    const hasGeoData = geoData && (geoData.ct || geoData.st || geoData.zp || geoData.country); // ✅ CORREÇÃO: Incluir country

    // ✅ Log de debug do external_id
    const externalIdInfo = DeduplicationEngine.getExternalIdInfo();
    console.log('🆔 External ID Info:', {
      hasId: !!externalIdInfo.id,
      age: `${externalIdInfo.age.toFixed(1)}h`,
      needsRefresh: externalIdInfo.needsRefresh,
      format: externalIdInfo.id ? 'SHA256' : 'none'
    });

    console.log('📊 Dados únicos gerados:', {
      eventId: eventId.substring(0, 20) + '...',
      externalId: externalId.substring(0, 20) + '...',
      isMobile: isMobile,
      hasGeoData: hasGeoData
    });

    // 🌍 Log dos dados de geolocalização hasheados para Lead
    if (hasGeoData) {
      console.log('🌍 GEO: Dados de localização (já hasheados) adicionados ao Lead:', {
        ct: geoData.ct ? geoData.ct.substring(0, 16) + '...' : 'N/A',
        st: geoData.st ? geoData.st.substring(0, 16) + '...' : 'N/A',
        zp: geoData.zp ? geoData.zp.substring(0, 16) + '...' : 'N/A',
        country: geoData.country ? geoData.country.substring(0, 16) + '...' : 'N/A',
        eventId: eventId.substring(0, 20) + '...',
        note: 'Dados geográficos recebidos já com hash SHA256 (campos corretos Meta CAPI)'
      });
    }

    // ✅ 3.2 PREPARAR CUSTOM_DATA
    // ✅ VALOR DETERMINÍSTICO: Garante consistência Pixel/CAPI (range 10-100)
    const dynamicLeadValue = generateDeterministicValue(eventId, 10, 100);

    const customData = {
      content_name: "lead_fechaqui",
      content_category: "fechaqui_lead",
      source: "form_submit",
      value: dynamicLeadValue,
      currency: "BRL"
    };

    // ✅ 3.3 ENVIAR VIA LEADTRACKER (DUAL TRACKING) COM GEO-ENRICHMENT
    const success = await LeadTracker.execute({
      eventId: eventId,
      value: dynamicLeadValue,
      currency: "BRL",
      customData: customData,
      source: "form_submit_no_pii",
      geoData: geoData // 🌍 Adicionar dados de geolocalização
    });

    console.log('🎯 TRACKING LEAD: ===== RESULTADO FINAL =====');
    console.log('📊 Resultado:', {
      success: success,
      eventId: eventId,
      externalId: externalId.substring(0, 20) + '...',
      isMobile: isMobile
    });

    return success;

  } catch (error) {
    console.error('❌ TRACKING LEAD: Erro crítico:', error);
    return false;
  }
}

// ✅ 4. FUNÇÃO DE CHAMADA SIMPLIFICADA
function handleLeadSubmit() {
  console.log('🎯 Iniciando tracking do Lead...');

  // ✅ EXECUTAR TRACKING SEM BLOQUEAR A INTERFACE
  trackLeadEvent().then(async success => {
    if (success) {
      console.log('✅ Lead tracking executado com sucesso!');
      // Delay de 500ms para garantir contabilização do evento
      await new Promise(resolve => setTimeout(resolve, 500));
      // Aqui você pode adicionar redirecionamento ou outras ações
    } else {
      console.warn('⚠️ Lead tracking falhou, mas continuando...');
    }
  }).catch(error => {
    console.error('❌ Erro no tracking:', error);
  });
}

// ✅ Interface para dados opcionais do cliente (melhora qualidade do evento)
interface PageViewClientData {
  name?: string;
  email?: string;
  phone?: string;
}

// ✅ 5. FUNÇÕES LEGACY (para compatibilidade)
export const trackPageView = async (clientData?: PageViewClientData) => {
  console.log('📄 PageView disparado', clientData ? '(com dados do cliente)' : '');

  try {
    // ✅ CORREÇÃO COBERTURA: Verificar se PageView inicial já foi disparado pelo HTML
    // Evita duplicação quando a página React carrega logo após o HTML
    const initialFired = (window as any).__initialPageViewFired;
    const initialEventId = (window as any).__initialPageViewEventId;
    const timeSinceLoad = performance.now();

    if (initialFired && timeSinceLoad < 5000) {
      // Se PageView foi disparado há menos de 3 segundos, reutilizar o eventId
      console.log('📄 PageView: Reutilizando eventId do HTML (evita duplicação)');
      (window as any).__initialPageViewFired = false; // Resetar para permitir próximos PageViews
      return true; // Já foi enviado pelo HTML
    }

    // ✅ PRIORIDADE 1: Aguardar FBP (timing otimizado)
    const fbp = await CookieManager.getFbpWithPixelWait(); // 5s timeout

    // ✅ PRIORIDADE 2: Gerar dados únicos em paralelo (não bloquear FBP)
    const [eventId, externalId] = await Promise.all([
      DeduplicationEngine.generateEventId('pageview'),
      DeduplicationEngine.getValidExternalId() // Executar em paralelo
    ]);

    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const eventTime = Math.floor(Date.now() / 1000); // ✅ EVENT TIME
    const eventSourceUrl = window.location.href; // ✅ EVENT SOURCE URL

    // ✅ Log de debug do external_id
    const externalIdInfo = DeduplicationEngine.getExternalIdInfo();
    console.log('🆔 PageView External ID Info:', {
      hasId: !!externalIdInfo.id,
      age: `${externalIdInfo.age.toFixed(1)}h`,
      needsRefresh: externalIdInfo.needsRefresh,
      format: externalIdInfo.id ? 'SHA256' : 'none'
    });

    console.log('📊 PageView - Dados únicos gerados:', {
      eventId: eventId.substring(0, 20) + '...',
      externalId: externalId.substring(0, 20) + '...',
      timing: 'fbp_prioritizado',
      eventTime: eventTime,
      eventSourceUrl: eventSourceUrl,
      isMobile: isMobile
    });

    // ✅ OBTER DADOS DO CLIENTE COM VALIDAÇÃO (com fallback robusto)
    const fbc = CookieManager.getFbcWithFallback(); // ✅ Agora com fallback para fbclid da URL
    const clientIP = await IPDetector.getClientIPForCAPI();

    // 🌍 GEO-ENRICHMENT AUTOMÁTICO: Obter dados de localização
    const geoData = await GeoEnrichment.getGeoDataForCAPI(clientIP);

    // ✅ VALIDAÇÃO DE DADOS
    const hasValidFbp = !!(fbp && fbp.length > 20);
    const hasValidFbc = !!(fbc && fbc.length > 20);
    const hasValidIP = !!(clientIP && IPDetector.isValidIP(clientIP));
    const hasGeoData = !!(geoData && (geoData.ct || geoData.st || geoData.zp || geoData.country)); // ✅ CORREÇÃO: Incluir country

    // ✅ PREPARAR CUSTOM_DATA PARA PAGEVIEW COM PARÂMETROS OFICIAIS
    const customData = {
      content_name: 'pagina_fechaqui',
      content_category: 'fechaqui_app',
      source: 'direct_traffic'
    };

    // ✅ DUAL TRACKING (PIXEL + CAPI)
    let pixelSuccess = false;
    let capiSuccess = false;

    // ✅ 1. DISPARAR VIA PIXEL USANDO BROWSERPIXELPROVIDER (padronizado)
    try {
      pixelSuccess = BrowserPixelProvider.trackEvent('PageView', {
        content_name: 'pagina_fechaqui',
        content_category: 'fechaqui_app',
        source: 'direct_traffic'
      }, {
        eventID: eventId
      });
      console.log('✅ PageView Pixel:', pixelSuccess);
    } catch (err) {
      console.error('❌ Erro Pixel PageView:', err);
    }

    // ✅ 2. DISPARAR VIA CAPI COM VALIDAÇÃO
    try {
      // ✅ PREPARAR USER_DATA COM VALIDAÇÃO E GEO-ENRICHMENT
      // 🌐 Formatar IP para Meta CAPI (IPv6 preferido) - usando IPDetector otimizado
      const formattedIP = hasValidIP ? IPDetector.formatIPForMeta(clientIP) : null;

      // 👤 MELHORIA QUALIDADE: Obter dados do usuário logado (se disponível)
      const loggedUserData = await getLoggedUserData();

      // 👤 MELHORIA QUALIDADE: Processar dados do cliente passados (ex: PropostaPublica)
      let clientUserData: { em?: string; fn?: string; ln?: string; ph?: string } = {};
      if (clientData) {
        if (clientData.email) {
          clientUserData.em = await hashSHA256(clientData.email.toLowerCase().trim());
        }
        if (clientData.name) {
          const nameParts = clientData.name.trim().split(' ');
          const firstName = (nameParts[0] || '').toLowerCase().trim();
          const lastName = (nameParts.length > 1 ? nameParts[nameParts.length - 1] : '').toLowerCase().trim();
          if (firstName) clientUserData.fn = await hashSHA256(firstName);
          if (lastName) clientUserData.ln = await hashSHA256(lastName);
        }
        if (clientData.phone) {
          let phoneDigits = clientData.phone.replace(/\D/g, '');
          if (phoneDigits.length === 10 || phoneDigits.length === 11) {
            phoneDigits = '55' + phoneDigits;
          }
          clientUserData.ph = await hashSHA256(phoneDigits);
        }
        console.log('👤 PageView: Dados do cliente (proposta) processados:', Object.keys(clientUserData));
      }

      // 👤 Combinar dados: cliente passado > usuário logado
      const hasClientData = Object.keys(clientUserData).length > 0;

      const userData = {
        external_id: externalId,
        client_user_agent: navigator.userAgent,
        ...(hasValidFbp && { fbp: fbp }),
        ...(hasValidFbc && { fbc: fbc }),
        ...(hasValidIP && { client_ip_address: formattedIP }),
        // 🌍 Adicionar dados de geolocalização já hasheados (campos corretos Meta CAPI)
        ...(geoData?.ct && { ct: geoData.ct }),
        ...(geoData?.st && { st: geoData.st }),
        ...(geoData?.zp && { zp: geoData.zp }),
        ...(geoData?.country && { country: geoData.country }),
        // 👤 Prioridade: dados do cliente passados > dados do usuário logado
        ...(clientUserData.em || loggedUserData?.em ? { em: clientUserData.em || loggedUserData?.em } : {}),
        ...(clientUserData.fn || loggedUserData?.fn ? { fn: clientUserData.fn || loggedUserData?.fn } : {}),
        ...(clientUserData.ln || loggedUserData?.ln ? { ln: clientUserData.ln || loggedUserData?.ln } : {}),
        ...(clientUserData.ph || loggedUserData?.ph ? { ph: clientUserData.ph || loggedUserData?.ph } : {})
      };

      // 🌍 Log dos dados de geolocalização hasheados
      if (hasGeoData || hasClientData) {
        console.log('🌍 GEO: Dados de localização (já hasheados) adicionados ao PageView:', {
          ct: geoData.ct ? geoData.ct.substring(0, 16) + '...' : 'N/A',
          st: geoData.st ? geoData.st.substring(0, 16) + '...' : 'N/A',
          zp: geoData.zp ? geoData.zp.substring(0, 16) + '...' : 'N/A',
          country: geoData.country ? geoData.country.substring(0, 16) + '...' : 'N/A',
          eventId: eventId.substring(0, 20) + '...',
          hasLoggedUser: !!loggedUserData,
          hasClientData: hasClientData,
          note: 'Dados geográficos recebidos já com hash SHA256 (campos corretos Meta CAPI)'
        });
      }

      // Enviar via CAPI
      const capiPayload = RealCAPIProvider.prepareCAPIPayload('PageView', eventId, userData, customData);
      capiSuccess = await RealCAPIProvider.sendEvent(capiPayload);

    } catch (error) {
      console.error('❌ Erro no CAPI PageView:', error);
    }

    // ✅ RESULTADO FINAL COM QUALIDADE (incluindo geo-data)
    const overallSuccess = pixelSuccess || capiSuccess;
    const dataQuality = calculateDataQualityScore(hasValidFbp, hasValidFbc, hasValidIP, hasGeoData);

    console.log('📄 PAGEVIEW: ===== RESULTADO FINAL =====');
    console.log('📊 Resultado:', {
      pixelSuccess,
      capiSuccess,
      overallSuccess,
      eventId: eventId,
      externalId: externalId.substring(0, 20) + '...',
      eventTime: eventTime,
      eventSourceUrl: eventSourceUrl,
      dataQuality: dataQuality,
      hasValidFbp,
      hasValidFbc,
      hasValidIP,
      hasGeoData,
      geoData: hasGeoData ? { ct: geoData.ct, st: geoData.st, zp: geoData.zp, country: geoData.country } : null, // ✅ CORREÇÃO: Incluir country
      isMobile: isMobile
    });

    console.log('✅ PageView disparado com sucesso!');
    return overallSuccess;

  } catch (error) {
    console.error('❌ Erro crítico no PageView:', error);
    return false;
  }
};

// ✅ Interface para dados opcionais do cliente (melhora qualidade do evento)
interface ViewContentClientData {
  name?: string;
  email?: string;
  phone?: string;
}

export const trackViewContent = async (clientData?: ViewContentClientData) => {
  console.log('👁️ ViewContent disparado', clientData ? '(com dados do cliente)' : '');

  try {
    // ✅ DEDUPLICAÇÃO: Verificar se ViewContent inicial já foi disparado pelo HTML
    // Janela de 8s porque index.html ViewContent dispara em ~3.5-5.5s (500ms + polling + 2s)
    const initialVCFired = (window as any).__initialViewContentFired;
    const timeSinceLoad = performance.now();

    if (initialVCFired && timeSinceLoad < 8000) {
      console.log('👁️ ViewContent: Já disparado pelo HTML (evita duplicação)');
      (window as any).__initialViewContentFired = false;
      return true;
    }

    // ✅ GERAR DADOS ÚNICOS COM NOVA IMPLEMENTAÇÃO SHA256
    const eventId = await DeduplicationEngine.generateEventId('viewcontent');
    const externalId = await DeduplicationEngine.getValidExternalId(); // ✅ Usar versão com refresh automático
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const eventTime = Math.floor(Date.now() / 1000); // ✅ EVENT TIME
    const eventSourceUrl = window.location.href; // ✅ EVENT SOURCE URL

    // ✅ Log de debug do external_id
    const externalIdInfo = DeduplicationEngine.getExternalIdInfo();
    console.log('🆔 ViewContent External ID Info:', {
      hasId: !!externalIdInfo.id,
      age: `${externalIdInfo.age.toFixed(1)}h`,
      needsRefresh: externalIdInfo.needsRefresh,
      format: externalIdInfo.id ? 'SHA256' : 'none'
    });

    console.log('📊 ViewContent - Dados únicos gerados:', {
      eventId: eventId.substring(0, 20) + '...',
      externalId: externalId.substring(0, 20) + '...',
      eventTime: eventTime,
      eventSourceUrl: eventSourceUrl,
      isMobile: isMobile
    });

    // ✅ OBTER DADOS DO CLIENTE COM VALIDAÇÃO (com fallback robusto)
    const fbp = await CookieManager.getFbpWithPixelWait();
    const fbc = CookieManager.getFbcWithFallback(); // ✅ Agora com fallback para fbclid da URL
    const clientIP = await IPDetector.getClientIPForCAPI();

    // 🌍 GEO-ENRICHMENT AUTOMÁTICO: Obter dados de localização
    const geoData = await GeoEnrichment.getGeoDataForCAPI(clientIP);

    // ✅ VALIDAÇÃO DE DADOS
    const hasValidFbp = !!(fbp && fbp.length > 20);
    const hasValidFbc = !!(fbc && fbc.length > 20);
    const hasValidIP = !!(clientIP && IPDetector.isValidIP(clientIP));
    const hasGeoData = !!(geoData && (geoData.ct || geoData.st || geoData.zp || geoData.country)); // ✅ CORREÇÃO: Incluir country

    // ✅ PREPARAR CUSTOM_DATA PARA VIEWCONTENT COM PARÂMETROS DETERMINÍSTICOS
    // ✅ VALOR DETERMINÍSTICO: Garante consistência Pixel/CAPI (range 1-10)
    const dynamicValue = generateDeterministicValue(eventId, 1, 10);

    // Definir moeda com validação ISO 4217
    const validCurrency = 'BRL'; // Código de 3 letras válido

    const customData = {
      content_name: 'conteudo_fechaqui',
      content_category: 'fechaqui_content',
      source: 'content_view',
      value: dynamicValue, // Valor dinâmico para evitar duplicação
      currency: validCurrency // Moeda com formato correto ISO 4217
    };

    // ✅ DUAL TRACKING (PIXEL + CAPI)
    let pixelSuccess = false;
    let capiSuccess = false;

    // ✅ 1. DISPARAR VIA PIXEL USANDO BROWSERPIXELPROVIDER (padronizado)
    try {
      pixelSuccess = BrowserPixelProvider.trackEvent('ViewContent', {
        content_name: 'conteudo_fechaqui',
        content_category: 'fechaqui_content',
        source: 'content_view',
        value: dynamicValue,
        currency: validCurrency
      }, {
        eventID: eventId
      });
      console.log('✅ ViewContent Pixel:', pixelSuccess);
    } catch (err) {
      console.error('❌ Erro Pixel ViewContent:', err);
    }

    // ✅ 2. DISPARAR VIA CAPI COM VALIDAÇÃO
    try {
      // ✅ PREPARAR USER_DATA COM VALIDAÇÃO E GEO-ENRICHMENT
      // 🌐 Formatar IP para Meta CAPI (IPv6 preferido) - usando IPDetector otimizado
      const formattedIP = hasValidIP ? IPDetector.formatIPForMeta(clientIP) : null;

      // 👤 MELHORIA QUALIDADE: Obter dados do usuário logado (se disponível)
      const loggedUserData = await getLoggedUserData();

      // 👤 MELHORIA QUALIDADE: Processar dados do cliente passados (ex: PropostaPublica)
      let clientUserData: { em?: string; fn?: string; ln?: string; ph?: string } = {};
      if (clientData) {
        if (clientData.email) {
          clientUserData.em = await hashSHA256(clientData.email.toLowerCase().trim());
        }
        if (clientData.name) {
          const nameParts = clientData.name.trim().split(' ');
          const firstName = (nameParts[0] || '').toLowerCase().trim();
          const lastName = (nameParts.length > 1 ? nameParts[nameParts.length - 1] : '').toLowerCase().trim();
          if (firstName) clientUserData.fn = await hashSHA256(firstName);
          if (lastName) clientUserData.ln = await hashSHA256(lastName);
        }
        if (clientData.phone) {
          let phoneDigits = clientData.phone.replace(/\D/g, '');
          if (phoneDigits.length === 10 || phoneDigits.length === 11) {
            phoneDigits = '55' + phoneDigits;
          }
          clientUserData.ph = await hashSHA256(phoneDigits);
        }
        console.log('👤 Dados do cliente (proposta) processados:', Object.keys(clientUserData));
      }

      // 👤 Combinar dados: cliente passado > usuário logado
      const hasClientData = Object.keys(clientUserData).length > 0;

      const userData = {
        external_id: externalId,
        client_user_agent: navigator.userAgent,
        ...(hasValidFbp && { fbp: fbp }),
        ...(hasValidFbc && { fbc: fbc }),
        ...(hasValidIP && { client_ip_address: formattedIP }),
        // 🌍 Adicionar dados de geolocalização já hasheados (campos corretos Meta CAPI)
        ...(geoData?.ct && { ct: geoData.ct }),
        ...(geoData?.st && { st: geoData.st }),
        ...(geoData?.zp && { zp: geoData.zp }),
        ...(geoData?.country && { country: geoData.country }),
        // 👤 Prioridade: dados do cliente passados > dados do usuário logado
        ...(clientUserData.em || loggedUserData?.em ? { em: clientUserData.em || loggedUserData?.em } : {}),
        ...(clientUserData.fn || loggedUserData?.fn ? { fn: clientUserData.fn || loggedUserData?.fn } : {}),
        ...(clientUserData.ln || loggedUserData?.ln ? { ln: clientUserData.ln || loggedUserData?.ln } : {}),
        ...(clientUserData.ph || loggedUserData?.ph ? { ph: clientUserData.ph || loggedUserData?.ph } : {})
      };

      // 🌍 Log dos dados de geolocalização hasheados
      if (hasGeoData || loggedUserData || hasClientData) {
        console.log('🌍 GEO + 👤 USER: Dados adicionados ao ViewContent:', {
          ct: geoData?.ct ? geoData.ct.substring(0, 16) + '...' : 'N/A',
          st: geoData?.st ? geoData.st.substring(0, 16) + '...' : 'N/A',
          zp: geoData?.zp ? geoData.zp.substring(0, 16) + '...' : 'N/A',
          country: geoData?.country ? geoData.country.substring(0, 16) + '...' : 'N/A',
          eventId: eventId.substring(0, 20) + '...',
          hasLoggedUser: !!loggedUserData,
          hasClientData: hasClientData,
          userFields: hasClientData ? Object.keys(clientUserData) : (loggedUserData ? Object.keys(loggedUserData) : []),
          note: 'Dados com hash SHA256'
        });
      }

      // Enviar via CAPI
      const capiPayload = RealCAPIProvider.prepareCAPIPayload('ViewContent', eventId, userData, customData);
      capiSuccess = await RealCAPIProvider.sendEvent(capiPayload);

    } catch (error) {
      console.error('❌ Erro no CAPI ViewContent:', error);
    }

    // ✅ RESULTADO FINAL COM QUALIDADE (incluindo geo-data e user data)
    const overallSuccess = pixelSuccess || capiSuccess;
    const dataQuality = calculateDataQualityScore(hasValidFbp, hasValidFbc, hasValidIP, hasGeoData);

    console.log('👁️ VIEWCONTENT: ===== RESULTADO FINAL =====');
    console.log('📊 Resultado:', {
      pixelSuccess,
      capiSuccess,
      overallSuccess,
      eventId: eventId,
      externalId: externalId.substring(0, 20) + '...',
      eventTime: eventTime,
      eventSourceUrl: eventSourceUrl,
      dataQuality: dataQuality,
      hasValidFbp,
      hasValidFbc,
      hasValidIP,
      hasGeoData,
      geoData: hasGeoData ? { ct: geoData.ct, st: geoData.st, zp: geoData.zp, country: geoData.country } : null, // ✅ CORREÇÃO: Incluir country
      isMobile: isMobile,
      metaCompliance: 'gold_standard'
    });

    console.log('✅ ViewContent disparado com sucesso!');
    return overallSuccess;

  } catch (error) {
    console.error('❌ Erro crítico no ViewContent:', error);
    return false;
  }
};

export const trackLead = async () => {
  return await trackLeadEvent();
};

// ✅ Interface pra dados opcionais do InitiateCheckout
interface InitiateCheckoutData {
  planId: string;
  planName: string;
  value: number;
  currency?: string;
  userEmail?: string;
  userName?: string;
  userPhone?: string;
}

// ✅ InitiateCheckout — dispara quando usuário chega no checkout
export const trackInitiateCheckout = async (data: InitiateCheckoutData) => {
  console.log('🛒 InitiateCheckout disparado', data.planName);

  try {
    const eventId = await DeduplicationEngine.generateEventId('checkout');
    const externalId = await DeduplicationEngine.getValidExternalId();
    const fbp = await CookieManager.getFbpWithPixelWait();
    const fbc = CookieManager.getFbcWithFallback();
    const clientIP = await IPDetector.getClientIPForCAPI();
    const geoData = await GeoEnrichment.getGeoDataForCAPI(clientIP);

    // Hash dados do usuário (se disponíveis)
    const hashedEmail = data.userEmail ? await hashSHA256(data.userEmail.toLowerCase().trim()) : '';
    let phoneDigits = data.userPhone ? data.userPhone.replace(/\D/g, '') : '';
    if (phoneDigits && (phoneDigits.length === 10 || phoneDigits.length === 11)) phoneDigits = '55' + phoneDigits;
    const hashedPhone = phoneDigits.length >= 10 ? await hashSHA256(phoneDigits) : '';

    let hashedFirstName = '';
    let hashedLastName = '';
    if (data.userName) {
      const nameParts = data.userName.trim().split(' ');
      hashedFirstName = await hashSHA256(nameParts[0] || '');
      hashedLastName = await hashSHA256(nameParts.length > 1 ? nameParts[nameParts.length - 1] : '');
    }

    // Dados do usuário logado (fallback se não passado)
    const loggedUserData = await getLoggedUserData();

    const formattedIP = clientIP ? IPDetector.formatIPForMeta(clientIP) : null;
    const capiUserData: Record<string, any> = {
      external_id: externalId,
      client_user_agent: navigator.userAgent,
      ...(fbp && { fbp }),
      ...(fbc && { fbc }),
      ...(formattedIP && { client_ip_address: formattedIP }),
      ...((hashedEmail || loggedUserData?.em) && { em: hashedEmail || loggedUserData?.em }),
      ...((hashedPhone || loggedUserData?.ph) && { ph: hashedPhone || loggedUserData?.ph }),
      ...((hashedFirstName || loggedUserData?.fn) && { fn: hashedFirstName || loggedUserData?.fn }),
      ...((hashedLastName || loggedUserData?.ln) && { ln: hashedLastName || loggedUserData?.ln }),
      ...(geoData?.ct && { ct: geoData.ct }),
      ...(geoData?.st && { st: geoData.st }),
      ...(geoData?.zp && { zp: geoData.zp }),
      ...(geoData?.country && { country: geoData.country }),
    };

    const customData = {
      content_name: data.planName,
      content_category: 'subscription',
      content_type: 'product',
      content_ids: [data.planId],
      value: data.value,
      currency: data.currency || 'BRL',
      num_items: 1,
    };

    let pixelSuccess = false;
    try {
      pixelSuccess = BrowserPixelProvider.trackEvent('InitiateCheckout', customData, { eventID: eventId });
      console.log('✅ InitiateCheckout Pixel:', pixelSuccess);
    } catch (err) {
      console.error('❌ Erro Pixel InitiateCheckout:', err);
    }

    let capiSuccess = false;
    try {
      const capiPayload = RealCAPIProvider.prepareCAPIPayload('InitiateCheckout', eventId, capiUserData, customData);
      capiSuccess = await RealCAPIProvider.sendEvent(capiPayload);
      console.log('✅ InitiateCheckout CAPI:', capiSuccess);
    } catch (err) {
      console.error('❌ Erro CAPI InitiateCheckout:', err);
    }

    console.log('🛒 INITIATE CHECKOUT: Resultado:', {
      pixelSuccess,
      capiSuccess,
      plan: data.planName,
      value: data.value,
      eventId
    });
    return pixelSuccess || capiSuccess;

  } catch (error) {
    console.error('❌ INITIATE CHECKOUT: Erro crítico:', error);
    return false;
  }
};

// ✅ CALCULAR SCORE DE QUALIDADE DOS DADOS (incluindo geo-data)
function calculateDataQualityScore(hasFbp: boolean, hasFbc: boolean, hasIP: boolean, hasGeoData?: boolean): number {
  let score = 0;
  if (hasFbp) score += 25;
  if (hasFbc) score += 25;
  if (hasIP) score += 35;
  if (hasGeoData) score += 15; // 🌍 Bonus por dados de geolocalização
  return score;
}

// ✅ 6. EXPORTAR FUNÇÕES
export { trackLeadEvent, handleLeadSubmit };
