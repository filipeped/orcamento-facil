// EventOrchestrator.ts
// Orquestrador interno para garantir envio confiável de eventos Pixel e CAPI (Meta)

import { RealCAPIProvider } from '../providers/RealCAPIProvider';
import { BrowserPixelProvider } from '../providers/BrowserPixelProvider';
import { CookieManager } from '../utils/CookieManager';
import { GeoEnrichment } from '../utils/GeoEnrichment';
import { DeduplicationEngine } from './DeduplicationEngine';

// ✅ A função hashSHA256 foi removida para centralizar a lógica em GeoEnrichment e DeduplicationEngine

export type OrchestratorEventType = string;

export interface OrchestratorEvent {
  type: OrchestratorEventType;
  pixelData: any;
  capiData: any;
  eventId?: string;
}

export class EventOrchestrator {
  static metrics = {
    enviados: 0,
    falhas: 0,
    reenvios: 0,
    bloqueados: 0
  };
  static eventIds: Set<string> = new Set();

  static async send(event: OrchestratorEvent): Promise<boolean> {
    // Log inicial para rastreamento
    console.log(`🚀 EventOrchestrator.send iniciado para evento: ${event.type}`);

    // Deduplicação de eventId
    const capi = event.capiData?.data?.[0];
    if (!capi) {
      this.log(event, 'erro_validacao', 'Dados CAPI ausentes ou mal formatados');
      return false;
    }

    if (!capi.event_id) {
      // ✅ CORRIGIDO: Usar generateEventId() assíncrono para SHA256 real
      capi.event_id = await DeduplicationEngine.generateEventId(event.type);
      console.log(`🆔 Gerado event_id determinístico (SHA256): ${capi.event_id}`);
    }

    if (this.eventIds.has(capi.event_id)) {
      this.metrics.bloqueados++;
      this.log(event, 'bloqueado_deduplicacao', 'eventId já utilizado');
      return false;
    }

    this.eventIds.add(capi.event_id);
    console.log(`✅ Event ID registrado: ${capi.event_id}`);

    // Normalização de campos string
    this.normalizeAllFields(event.capiData);
    this.normalizeAllFields(event.pixelData);

    // Validação rigorosa de todos os campos
    if (!this.validateAllFields(event.capiData) || !this.validateAllFields(event.pixelData)) {
      this.metrics.bloqueados++;
      this.log(event, 'erro_valor_invalido', 'Campo preenchido manualmente ou valor inválido detectado');
      return false;
    }

    // Validação avançada de campos obrigatórios
    if (!event.type || !event.pixelData || !event.capiData) {
      EventOrchestrator.log(event, 'erro_validacao', 'Dados obrigatórios ausentes');
      return false;
    }

    // Checagem de campos obrigatórios no CAPI (baseado no tipo de evento)
    const userData = capi?.user_data || {};
    const customData = capi?.custom_data || {};

    // Campos obrigatórios básicos para todos os eventos
    const obrigatoriosBasicos = [
      { campo: 'event_id', valor: capi?.event_id },
      { campo: 'event_time', valor: capi?.event_time }
    ];

    // Campos obrigatórios específicos para eventos de Lead
    const obrigatoriosLead = [
      { campo: 'currency', valor: customData.currency },
      { campo: 'value', valor: customData.value }
    ];

    // Verificar campos básicos
    const faltandoBasicos = obrigatoriosBasicos.filter(f => !f.valor);
    if (faltandoBasicos.length > 0) {
      EventOrchestrator.log(event, 'erro_validacao', `Campos básicos obrigatórios ausentes: ${faltandoBasicos.map(f=>f.campo).join(', ')}`);
      return false;
    }

    // Verificar campos específicos apenas para eventos Lead
    if (event.type === 'Lead') {
      const faltandoLead = obrigatoriosLead.filter(f => !f.valor);
      if (faltandoLead.length > 0) {
        EventOrchestrator.log(event, 'erro_validacao', `Campos Lead obrigatórios ausentes: ${faltandoLead.map(f=>f.campo).join(', ')}`);
        return false;
      }

      // Validação simples de formatos para Lead
      if (customData.currency && typeof customData.currency !== 'string') {
        EventOrchestrator.log(event, 'erro_validacao', 'Currency deve ser string');
        return false;
      }

      if (customData.value && isNaN(Number(customData.value))) {
        EventOrchestrator.log(event, 'erro_validacao', 'Value deve ser numérico');
        return false;
      }
    }

    // Gerenciamento automático de _fbp e _fbc
    const fbp = CookieManager.getFbpCookie();
    const fbc = CookieManager.getFbcWithFallback();

    // 🌍 GEO-ENRICHMENT AUTOMÁTICO: Enriquecer com dados de localização
    const clientIP = event.capiData?.data?.[0]?.user_data?.client_ip_address;
    const geoData = await GeoEnrichment.getGeoDataForCAPI(clientIP);

    if (event.capiData && event.capiData.data && event.capiData.data[0] && event.capiData.data[0].user_data) {
      if (fbp) event.capiData.data[0].user_data.fbp = fbp;
      // ✅ V9.4: Só definir fbc se NÃO existir no evento (não sobrescrever valor do caller)
      if (fbc && !event.capiData.data[0].user_data.fbc) event.capiData.data[0].user_data.fbc = fbc;

      // 🌍 Adicionar dados de geolocalização já hasheados (sem sobrescrever)
      if (geoData) {
        const userData = event.capiData.data[0].user_data;

        // Adicionar apenas se não existir valor anterior (evitar sobrescrita e re-hashing) - usando campos corretos Meta CAPI
        if (geoData.ct && !userData.ct) userData.ct = geoData.ct;
        if (geoData.st && !userData.st) userData.st = geoData.st;
        if (geoData.zp && !userData.zp) userData.zp = geoData.zp;
        if (geoData.country && !userData.country) userData.country = geoData.country;

        console.log('🌍 GEO: Dados de localização (já hasheados) adicionados ao evento:', {
          ct: geoData.ct ? geoData.ct.substring(0, 16) + '...' : 'N/A',
          st: geoData.st ? geoData.st.substring(0, 16) + '...' : 'N/A',
          zp: geoData.zp ? geoData.zp.substring(0, 16) + '...' : 'N/A',
          country: geoData.country ? geoData.country.substring(0, 16) + '...' : 'N/A',
          event_type: event.type,
          event_id: capi.event_id,
          overwrite_protection: 'enabled',
          note: 'Dados geográficos recebidos já com hash SHA256 (campos corretos Meta CAPI)'
        });
      }
    }

    if (!fbp || !fbc) {
      this.log(event, 'alerta_fbp_fbc_ausente', { fbp, fbc });
    }

    if (!geoData) {
      this.log(event, 'alerta_geo_ausente', 'Dados de geolocalização não disponíveis');
    }

    let pixelSuccess = false;
    let capiSuccess = false;
    let capiError: any = null;

    // Envio Pixel (browser)
    try {
      console.log(`🔄 Tentando enviar evento ${event.type} via Pixel...`);
      pixelSuccess = BrowserPixelProvider.trackEvent(event.type, event.pixelData, { eventID: capi.event_id });
      if (pixelSuccess) {
        console.log(`✅ Evento ${event.type} enviado com sucesso via Pixel`);
      } else {
        console.warn(`⚠️ Falha ao enviar evento ${event.type} via Pixel`);
      }
    } catch (err) {
      EventOrchestrator.metrics.falhas++;
      EventOrchestrator.log(event, 'erro_pixel', err);
    }

    // Envio CAPI (server) - chamada única, retry é feito internamente pelo RealCAPIProvider
    try {
      console.log(`🔄 Enviando evento ${event.type} via CAPI...`);
      capiSuccess = await RealCAPIProvider.sendEvent(event.capiData);
      if (capiSuccess) {
        console.log(`✅ Evento ${event.type} enviado com sucesso via CAPI`);
      }
    } catch (err) {
      capiError = err;
      console.warn(`⚠️ Falha ao enviar evento ${event.type} via CAPI:`, err);
    }

    // Logging detalhado e métricas
    if (pixelSuccess && capiSuccess) {
      this.metrics.enviados++;
      EventOrchestrator.log(event, 'sucesso', 'Pixel e CAPI enviados com sucesso');
      return true;
    } else {
      this.metrics.falhas++;
      EventOrchestrator.log(event, 'falha', {
        pixelSuccess,
        capiSuccess,
        capiError
      });
      return false;
    }
  }

  private static log(event: OrchestratorEvent, status: string, info: any) {
    // Aqui pode ser expandido para log em arquivo, banco, etc.
    // Por enquanto, loga no console para uso interno
    console.log('[Orchestrator]', {
      timestamp: new Date().toISOString(),
      event_type: event.type,
      event_id: event.capiData?.data?.[0]?.event_id,
      status,
      info
    });
  }

  // Métodos removidos - agora usando CookieManager diretamente

  private static getCookie(name: string): string | null {
    if (typeof document === 'undefined') return null;
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
    return null;
  }

  private static isValidValue(value: any, field: string): boolean {
    if (typeof value === 'string') {
      const invalids = ['teste', 'manual', 'aaa', '123', '-', 'null', 'undefined', '', ' '];
      if (invalids.includes(value.trim().toLowerCase())) return false;
      if (/^a@a\.com|teste@teste\.com$/.test(value.trim().toLowerCase())) return false;
    }
    if (typeof value === 'number' && (value === 0 || value === -1 || value === 999999)) return false;
    return true;
  }

  private static validateAllFields(obj: any): boolean {
    if (!obj || typeof obj !== 'object') return true;
    for (const key in obj) {
      if (!this.isValidValue(obj[key], key)) return false;
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        if (!this.validateAllFields(obj[key])) return false;
      }
    }
    return true;
  }

  private static normalizeAllFields(obj: any) {
    if (!obj || typeof obj !== 'object') return;
    for (const key in obj) {
      // ✅ CRÍTICO: Não normalizar FBC/FBP para preservar fbclid original
      if (key === 'fbc' || key === 'fbp' || key === 'client_ip_address') {
        continue; // Pular normalização para preservar valores originais
      }

      if (typeof obj[key] === 'string') {
        obj[key] = obj[key].normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        this.normalizeAllFields(obj[key]);
      }
    }
  }
}
