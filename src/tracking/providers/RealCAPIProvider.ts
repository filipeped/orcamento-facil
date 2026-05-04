import type {
  MetaCAPIPayload,
  MetaCustomData,
  MetaUserData,
} from "@/types/meta";

// RealCAPIProvider - Gerenciamento do envio de eventos via CAPI
export class RealCAPIProvider {
  private static readonly CAPI_URL = "https://cap.jardinei.com/api/events";
  // ✅ SEGURANÇA: Token removido - o CAPI proxy já tem o token configurado via env vars

  // Configuração de retry
  private static readonly MAX_RETRIES = 3;
  private static readonly RETRY_DELAYS = [1000, 2000, 4000]; // Backoff exponencial

  // Queue de eventos pendentes para retry
  private static _pendingQueue: Array<{ eventData: MetaCAPIPayload; attempts: number }> = [];
  private static _isProcessingQueue = false;

  // Eventos que devem ir pro CAPI (dual tracking completo)
  private static readonly CONVERSION_EVENTS = [
    'PageView',          // Visualização de página
    'ViewContent',       // Visualização de conteúdo
    'Lead',              // Cadastro
    'CompleteRegistration', // Registro completo
    'Purchase',          // Compra/Pagamento
    'Subscribe',         // Assinatura
    'InitiateCheckout',  // Início de checkout
  ];

  // Enviar evento via CAPI com retry automático
  static async sendEvent(eventData: MetaCAPIPayload): Promise<boolean> {
    const eventName = eventData?.data?.[0]?.event_name;
    const eventId = eventData?.data?.[0]?.event_id;

    // Verificar domínios permitidos (produção, preview e dev)
    const currentDomain = window.location.hostname;
    const allowedDomains = [
      'jardinei.com',      // Produção
      'www.jardinei.com',  // Produção com www
      'localhost',         // Dev local
      '127.0.0.1',         // Dev local IP
      'vercel.app'         // Preview deploys
    ];

    const isAllowedDomain = allowedDomains.some(d => currentDomain.includes(d));
    if (!isAllowedDomain) {
      console.log('⏭️ CAPI ignorado - domínio não permitido:', currentDomain);
      return true;
    }

    // Filtrar: só eventos de conversão vão pro CAPI
    if (!this.CONVERSION_EVENTS.includes(eventName)) {
      console.log(`⏭️ CAPI ignorado - evento "${eventName}" não é conversão (só Pixel)`);
      return true;
    }

    // Verificar se os dados do evento estão completos
    if (!eventName) {
      console.error('❌ Dados do evento incompletos:', eventData);
      return false;
    }

    // Tentar enviar com retry
    return await this._sendWithRetry(eventData, 0);
  }

  // Envio com retry automático
  private static async _sendWithRetry(eventData: MetaCAPIPayload, attempt: number): Promise<boolean> {
    const eventName = eventData?.data?.[0]?.event_name;
    const eventId = eventData?.data?.[0]?.event_id;

    try {
      console.log(`🔄 CAPI: Enviando ${eventName} (tentativa ${attempt + 1}/${this.MAX_RETRIES})...`, {
        eventId: eventId?.substring(0, 20) + '...',
        timestamp: new Date().toISOString()
      });

      const response = await fetch(this.CAPI_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventData),
        keepalive: true
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      console.log(`✅ CAPI: ${eventName} enviado com sucesso!`, {
        eventId: eventId?.substring(0, 20) + '...',
        attempt: attempt + 1,
        response: result?.events_received || result
      });
      return true;

    } catch (error) {
      console.warn(`⚠️ CAPI: Falha ao enviar ${eventName} (tentativa ${attempt + 1}):`, error);

      // Retry se não atingiu limite
      if (attempt < this.MAX_RETRIES - 1) {
        const delay = this.RETRY_DELAYS[attempt] || 4000;
        console.log(`🔄 CAPI: Retry em ${delay}ms...`);
        await this._sleep(delay);
        return await this._sendWithRetry(eventData, attempt + 1);
      }

      // Todas as tentativas falharam - adicionar à queue para retry posterior
      console.error(`❌ CAPI: ${eventName} falhou após ${this.MAX_RETRIES} tentativas. Adicionando à queue.`);
      this._addToQueue(eventData);
      return false;
    }
  }

  // Adicionar evento à queue de retry
  private static _addToQueue(eventData: MetaCAPIPayload): void {
    // Limite de 50 eventos na queue para evitar memory leak
    if (this._pendingQueue.length >= 50) {
      this._pendingQueue.shift(); // Remove o mais antigo
    }
    this._pendingQueue.push({ eventData, attempts: 0 });

    // Tentar processar queue em background
    this._processQueueInBackground();
  }

  // Processar queue em background
  private static async _processQueueInBackground(): Promise<void> {
    if (this._isProcessingQueue || this._pendingQueue.length === 0) return;

    this._isProcessingQueue = true;

    // Aguardar 30 segundos antes de tentar novamente
    await this._sleep(30000);

    while (this._pendingQueue.length > 0) {
      const item = this._pendingQueue.shift();
      if (!item) break;

      const success = await this._sendWithRetry(item.eventData, 0);
      if (!success && item.attempts < 2) {
        // Re-adicionar com contador incrementado
        this._pendingQueue.push({ ...item, attempts: item.attempts + 1 });
      }

      // Pausa entre eventos para não sobrecarregar
      await this._sleep(1000);
    }

    this._isProcessingQueue = false;
  }

  // Helper para sleep
  private static _sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Obter status da queue (para debug)
  static getQueueStatus(): { pending: number; processing: boolean } {
    return {
      pending: this._pendingQueue.length,
      processing: this._isProcessingQueue
    };
  }

  // Preparar payload do CAPI - APENAS PARÂMETROS OFICIAIS DA META
  static prepareCAPIPayload(
    eventName: string,
    eventId: string,
    userData: MetaUserData,
    customData: MetaCustomData
  ): MetaCAPIPayload {
    // URL dinâmico - usa produção se não for jardinei.com
    const currentUrl = window.location.href;
    const eventSourceUrl = currentUrl.includes('jardinei.com')
      ? currentUrl
      : 'https://www.jardinei.com'; // Fallback para produção

    return {
      data: [{
        event_name: eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId,
        user_data: userData,
        custom_data: customData,
        event_source_url: eventSourceUrl,
        action_source: 'website'
      }],
      pixel_id: '888149620416465'
    };
  }
}
