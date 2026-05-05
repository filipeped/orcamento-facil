// LeadTracker - Coordenador principal do tracking do evento Lead
import { BrowserPixelProvider } from '../providers/BrowserPixelProvider';
import { RealCAPIProvider } from '../providers/RealCAPIProvider';
import { DeduplicationEngine } from '../core/DeduplicationEngine';
import { CookieManager } from '../utils/CookieManager';
import { IPDetector } from '../utils/IPDetector';
import { GeoEnrichment } from '../utils/GeoEnrichment';

// ✅ Hash SHA256 para PII do usuário logado
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

// ✅ Obter dados do usuário logado para melhorar EMQ do Lead
async function getLoggedUserDataForLead(): Promise<{ em?: string; fn?: string; ln?: string; ph?: string } | null> {
  try {
    const sessionData = localStorage.getItem('sb-nnqctrjvtacswjvdgred-auth-token');
    if (!sessionData) return null;
    const session = JSON.parse(sessionData);
    const user = session?.user;
    if (!user) return null;

    const userData: { em?: string; fn?: string; ln?: string; ph?: string } = {};

    // Cache do profile (dados reais da tabela profiles)
    let profilePhone = '', profileName = '';
    try {
      const cache = localStorage.getItem('fechaaqui_profile_tracking');
      if (cache) {
        const p = JSON.parse(cache);
        profilePhone = p.phone || '';
        profileName = p.full_name || '';
      }
    } catch { /* ignore */ }

    if (user.email) userData.em = await hashSHA256(user.email.toLowerCase().trim());

    const fullName = profileName || user.user_metadata?.name || user.user_metadata?.full_name;
    if (fullName) {
      const parts = fullName.trim().split(' ');
      if (parts[0]) userData.fn = await hashSHA256(parts[0].toLowerCase());
      if (parts.length > 1) userData.ln = await hashSHA256(parts[parts.length - 1].toLowerCase());
    }

    const phone = profilePhone || user.user_metadata?.phone || user.phone;
    if (phone) {
      let digits = phone.replace(/\D/g, '');
      if (digits.length === 10 || digits.length === 11) digits = '55' + digits;
      if (digits.length >= 10) userData.ph = await hashSHA256(digits);
    }

    return Object.keys(userData).length > 0 ? userData : null;
  } catch {
    return null;
  }
}

interface LeadTrackingOptions {
  eventId: string;
  value: number;
  currency: string;
  customData: any;
  source: string;
  geoData?: any; // 🌍 Dados de geolocalização opcionais
}

export class LeadTracker {
  // Executar tracking completo do Lead
  static async execute(options: LeadTrackingOptions): Promise<boolean> {
    console.log('🎯 TRACKING LEAD: ===== INICIANDO TRACKING SEM PII =====');

    try {
      // ✅ 1. VALIDAÇÃO INICIAL
      if (!options.eventId || !options.value || !options.currency) {
        console.error('❌ Dados obrigatórios faltando:', { eventId: !!options.eventId, value: !!options.value, currency: !!options.currency });
        return false;
      }

      // ✅ 2. GERAR DADOS ÚNICOS
      const eventId = options.eventId;
      const externalId = await DeduplicationEngine.getValidExternalId(); // ✅ Usar versão com cache e validação
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const eventTime = Math.floor(Date.now() / 1000); // ✅ EVENT TIME
      const eventSourceUrl = window.location.href; // ✅ EVENT SOURCE URL

      console.log('📊 Dados únicos gerados:', {
        eventId: eventId.substring(0, 20) + '...',
        externalId: externalId.substring(0, 20) + '...',
        eventTime: eventTime,
        eventSourceUrl: eventSourceUrl,
        isMobile: isMobile
      });

      // ✅ 3. OBTER COOKIES E DADOS DO CLIENTE COM VALIDAÇÃO (com fallback fbclid)
      const fbp = await CookieManager.getFbpWithPixelWait();
      const fbc = CookieManager.getFbcWithFallback(); // ✅ Agora com fallback para fbclid da URL
      const clientIP = await IPDetector.getClientIPForCAPI();

      // ✅ 3.1. GEO-ENRICHMENT: Usar dados passados ou buscar automaticamente
      const geoData = options.geoData || await GeoEnrichment.getGeoDataForCAPI(clientIP);

      // ✅ VALIDAÇÃO DE DADOS
      const hasValidFbp = fbp && fbp.length > 20;
      const hasValidFbc = fbc && fbc.length > 20;
      const hasValidIP = clientIP && IPDetector.isValidIP(clientIP);
      const hasGeoData = geoData && (geoData.ct || geoData.st || geoData.zp || geoData.country); // ✅ CORREÇÃO: Incluir country

      console.log('🍪 Cookies e dados obtidos:', {
        fbp: hasValidFbp ? fbp.substring(0, 20) + '...' : 'N/A',
        fbc: hasValidFbc ? fbc.substring(0, 20) + '...' : 'N/A',
        clientIP: hasValidIP ? clientIP.substring(0, 15) + '...' : 'N/A',
        geoData: hasGeoData ? `${geoData.ct?.substring(0, 8)}.../${geoData.st?.substring(0, 8)}.../${geoData.zp?.substring(0, 8)}.../${geoData.country?.substring(0, 8)}...` : 'N/A',
        dataQuality: {
          fbp: hasValidFbp ? 'valid' : 'missing',
          fbc: hasValidFbc ? 'valid' : 'missing',
          ip: hasValidIP ? 'valid' : 'missing',
          geo: hasGeoData ? 'valid' : 'missing'
        }
      });

      // ✅ 4. PREPARAR USER_DATA COM PII + GEO-ENRICHMENT (melhora EMQ do Lead)
      const formattedIP = hasValidIP ? IPDetector.formatIPForMeta(clientIP) : null;

      // ✅ Obter dados do usuário logado para melhorar match quality
      const loggedUserData = await getLoggedUserDataForLead();

      const userData = {
        external_id: externalId,
        client_user_agent: navigator.userAgent,
        ...(hasValidFbp && { fbp: fbp }),
        ...(hasValidFbc && { fbc: fbc }),
        ...(hasValidIP && { client_ip_address: formattedIP }),
        ...(hasGeoData && {
          ct: geoData.ct,
          st: geoData.st,
          zp: geoData.zp,
          country: geoData.country
        }),
        // 👤 Dados do usuário logado (em/fn/ln/ph hasheados)
        ...(loggedUserData?.em && { em: loggedUserData.em }),
        ...(loggedUserData?.fn && { fn: loggedUserData.fn }),
        ...(loggedUserData?.ln && { ln: loggedUserData.ln }),
        ...(loggedUserData?.ph && { ph: loggedUserData.ph })
      };

      // ✅ 5. PREPARAR CUSTOM_DATA COM PARÂMETROS OFICIAIS
      const customData = {
        ...options.customData
      };

      // ✅ 6. DUAL TRACKING (PIXEL + CAPI)
      let pixelSuccess = false;
      let capiSuccess = false;

      // Pixel: chamada única (síncrona, sem necessidade de retry)
      try {
        pixelSuccess = BrowserPixelProvider.trackEvent('Lead', {
          content_name: 'lead_fechaaqui',
          content_category: 'fechaaqui_lead',
          source: 'form_submit',
          value: options.value,
          currency: options.currency
        }, {
          eventID: eventId
        });
      } catch (error) {
        console.error('❌ Erro no Pixel Lead:', error);
      }

      // CAPI: chamada única (RealCAPIProvider já tem retry interno com backoff 1s/2s/4s)
      try {
        const capiPayload = RealCAPIProvider.prepareCAPIPayload('Lead', eventId, userData, customData);
        capiSuccess = await RealCAPIProvider.sendEvent(capiPayload);
      } catch (error) {
        console.error('❌ Erro no CAPI Lead:', error);
      }

      // ✅ 7. RESULTADO FINAL COM QUALIDADE
      const overallSuccess = pixelSuccess || capiSuccess;
      const dataQuality = this.calculateDataQualityScore(hasValidFbp, hasValidFbc, hasValidIP, hasGeoData);

      console.log('🎯 TRACKING LEAD: ===== RESULTADO FINAL =====');
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
        geoLocation: hasGeoData ? `${geoData.ct.substring(0, 8)}.../${geoData.st.substring(0, 8)}.../${geoData.zp.substring(0, 8)}.../${geoData.country.substring(0, 8)}... (já hasheado)` : 'N/A',
        isMobile: isMobile
      });

      return overallSuccess;

    } catch (error) {
      console.error('❌ TRACKING LEAD: Erro crítico:', error);
      return false;
    }
  }

  // ✅ CALCULAR SCORE DE QUALIDADE DOS DADOS (incluindo geo-data)
  private static calculateDataQualityScore(hasFbp: boolean, hasFbc: boolean, hasIP: boolean, hasGeoData: boolean): number {
    let score = 0;
    if (hasFbp) score += 25;  // Reduzido para acomodar geo
    if (hasFbc) score += 25;  // Reduzido para acomodar geo
    if (hasIP) score += 30;   // Reduzido para acomodar geo
    if (hasGeoData) score += 20;  // Novo: dados de geolocalização
    return score;
  }
}
