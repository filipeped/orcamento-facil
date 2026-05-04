// DeduplicationEngine V2.1 - Otimizado para Meta Attribution
// V2.1: Migrado external_id para localStorage (persistência cross-session)
export class DeduplicationEngine {
  private static readonly EXTERNAL_ID_KEY = 'external_id';
  private static readonly EXTERNAL_ID_CREATED_KEY = 'external_id_created';
  private static readonly EXTERNAL_ID_VALIDITY_HOURS = 24;

  // ✅ Cache em memória para evitar SHA256 repetido (apenas para External ID)
  private static _cachedExternalId: string | null = null;
  private static _cacheTimestamp: number | null = null;

  // ✅ CORREÇÃO RACE CONDITION: Mutex para geração de External ID
  private static _generationPromise: Promise<string> | null = null;

  // ✅ Contador de eventos para garantir unicidade de event_id
  private static _eventCounters: Map<string, number> = new Map();

  // ✅ Helper: Ler de localStorage com fallback para sessionStorage (migração)
  private static getStoredValue(key: string): string | null {
    return localStorage.getItem(key) || sessionStorage.getItem(key);
  }

  // ✅ Helper: Salvar em localStorage (e limpar sessionStorage legado)
  private static setStoredValue(key: string, value: string): void {
    localStorage.setItem(key, value);
    // Limpar sessionStorage legado se existir
    try { sessionStorage.removeItem(key); } catch { /* ignore */ }
  }

  // ✅ Helper: Remover de ambos storages
  private static removeStoredValue(key: string): void {
    localStorage.removeItem(key);
    try { sessionStorage.removeItem(key); } catch { /* ignore */ }
  }

  // ✅ CORRIGIDO: Gerar event_id ÚNICO para cada evento (não cachear)
  static async generateEventId(eventType: string = 'lead'): Promise<string> {
    const prefix = eventType.toLowerCase().replace(/[^a-z]/g, '');
    const sessionId = this.getOrCreateSessionId();

    // ✅ CRÍTICO: Incrementar contador para garantir unicidade por tipo de evento
    const currentCount = this.getAndIncrementEventCounter(eventType);

    // ✅ CORREÇÃO DESDUPLICAÇÃO: Usar timestamp com milissegundos + contador para garantir unicidade
    const now = Date.now();
    const timestamp = Math.floor(now / 1000);
    const microtime = now % 1000;

    // Criar dados determinísticos únicos para este evento específico
    const deterministicData = `${prefix}_${timestamp}_${microtime}_${currentCount}_${sessionId}`;

    // ✅ USAR SHA256 REAL para garantir unicidade e evitar colisões
    const fullHash = await this.hashSHA256(deterministicData);
    const eventId = `evt_${fullHash.substring(0, 16)}`;

    console.log('🆔 Event ID gerado:', {
      eventType,
      eventId: eventId.substring(0, 20) + '...',
      counter: currentCount,
      microtime,
      uniquenessGuaranteed: true
    });

    return eventId;
  }

  // Gerar external_id com hash SHA256 para melhor atribuição Meta
  static async generateExternalId(): Promise<string> {
    let externalId = this.getStoredValue('external_id');

    if (!externalId) {
      // Gerar ID base mais robusto
      const timestamp = Date.now();
      const randomPart = Math.random().toString(36).substr(2, 12);
      const sessionId = this.getOrCreateSessionId();
      const baseId = `${timestamp}_${randomPart}_${sessionId}`;

      // Aplicar hash SHA256 para formato consistente
      externalId = await this.hashSHA256(baseId);

      this.setStoredValue('external_id', externalId);
      this.setStoredValue('external_id_created', timestamp.toString());
    }

    return externalId;
  }

  // Gerar hash SHA256 para external_id
  static async hashSHA256(text: string): Promise<string> {
    // ✅ CORREÇÃO: Verificar se crypto.subtle está disponível (não funciona em HTTP)
    if (typeof crypto === 'undefined' || !crypto.subtle) {
      console.warn('⚠️ crypto.subtle não disponível (HTTP). Usando fallback.');
      let hash = 0;
      for (let i = 0; i < text.length; i++) {
        const char = text.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      const fallbackHash = Math.abs(hash).toString(16).padStart(16, '0');
      return fallbackHash.repeat(4); // 64 chars para manter formato
    }

    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(text);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (error) {
      console.error('❌ Erro ao gerar hash SHA256:', error);
      return Math.random().toString(16).substring(2).padEnd(64, '0');
    }
  }

  // ✅ Validação de formato do external_id
  static validateExternalId(externalId: string): boolean {
    return externalId && externalId.length === 64 && /^[a-f0-9]{64}$/.test(externalId);
  }

  // ✅ Obter e incrementar contador de eventos por tipo
  static getAndIncrementEventCounter(eventType: string): number {
    const currentCount = this._eventCounters.get(eventType) || 0;
    const newCount = currentCount + 1;
    this._eventCounters.set(eventType, newCount);
    return newCount;
  }

  // Gerar ou recuperar session ID único (session-scoped, OK em sessionStorage)
  static getOrCreateSessionId(): string {
    let sessionId = sessionStorage.getItem('session_id');
    if (!sessionId) {
      sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
      sessionStorage.setItem('session_id', sessionId);
    }
    return sessionId;
  }

  // Verificar se external_id precisa ser renovado (24h)
  static shouldRefreshExternalId(): boolean {
    const created = this.getStoredValue('external_id_created');
    if (!created) return true;

    const createdTime = parseInt(created);
    const now = Date.now();
    const hoursPassed = (now - createdTime) / (1000 * 60 * 60);

    return hoursPassed >= 24; // Renovar após 24 horas
  }

  // ✅ CORRIGIDO: Obter external_id válido SEM RACE CONDITIONS
  static async getValidExternalId(): Promise<string> {
    // ✅ MUTEX PATTERN: Se já está gerando, aguardar a mesma Promise
    if (this._generationPromise) {
      console.log('🔄 Aguardando geração de External ID em andamento...');
      return this._generationPromise;
    }

    // ✅ Verificar cache em memória primeiro (mais rápido)
    if (this._cachedExternalId && this._cacheTimestamp) {
      const age = (Date.now() - this._cacheTimestamp) / (1000 * 60 * 60);
      if (age < 24 && this.validateExternalId(this._cachedExternalId)) {
        return this._cachedExternalId;
      }
    }

    // ✅ Criar Promise para geração thread-safe
    this._generationPromise = this._generateExternalIdSafe();

    try {
      const result = await this._generationPromise;
      return result;
    } finally {
      this._generationPromise = null;
    }
  }

  // ✅ Geração thread-safe de External ID
  private static async _generateExternalIdSafe(): Promise<string> {
    console.log('🆔 Gerando External ID thread-safe...');

    // ✅ Verificar TTL
    if (this.shouldRefreshExternalId()) {
      this.clearExternalId();
      this._cachedExternalId = null;
      this._cacheTimestamp = null;
    }

    // Tentar obter do localStorage (com fallback sessionStorage legado)
    const existingId = this.getStoredValue('external_id');
    if (existingId && this.validateExternalId(existingId)) {
      this._cachedExternalId = existingId;
      this._cacheTimestamp = Date.now();
      // Migrar para localStorage se estava em sessionStorage
      this.setStoredValue('external_id', existingId);
      console.log('✅ External ID recuperado do storage');
      return existingId;
    }

    // ✅ Gerar novo se necessário
    const externalId = await this.generateExternalId();

    if (!this.validateExternalId(externalId)) {
      throw new Error('Falha na geração de external_id válido');
    }

    this._cachedExternalId = externalId;
    this._cacheTimestamp = Date.now();

    console.log('✅ External ID gerado com sucesso (persistente em localStorage)');
    return externalId;
  }

  // Verificar se já existe external_id válido
  static hasExistingExternalId(): boolean {
    const externalId = this.getStoredValue('external_id');
    const created = this.getStoredValue('external_id_created');

    if (!externalId || !created) return false;

    return !this.shouldRefreshExternalId();
  }

  // Limpar external_id e dados relacionados
  static clearExternalId(): void {
    this.removeStoredValue('external_id');
    this.removeStoredValue('external_id_created');
    this._cachedExternalId = null;
    this._cacheTimestamp = null;
  }

  // Obter informações de debug do external_id
  static getExternalIdInfo(): {
    id: string | null;
    created: number | null;
    age: number;
    isValid: boolean;
    needsRefresh: boolean;
  } {
    const id = this.getStoredValue('external_id');
    const createdStr = this.getStoredValue('external_id_created');
    const created = createdStr ? parseInt(createdStr) : null;
    const age = created ? (Date.now() - created) / (1000 * 60 * 60) : 0;

    return {
      id,
      created,
      age,
      isValid: !!id && !!created,
      needsRefresh: this.shouldRefreshExternalId()
    };
  }
}
