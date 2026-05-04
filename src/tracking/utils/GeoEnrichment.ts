// GeoEnrichment - Sistema automático de enriquecimento geográfico por IP
// API: IPGeolocation.io com timeout de 3s e cache TTL de 24h
// Recursos: Detecção de VPN/Proxy, dados de segurança, maior precisão

export interface GeoData {
  country_code2: string;
  country_name: string;
  state_prov: string;
  state_code: string;
  district: string;
  city: string;
  zipcode: string;
  latitude: string;
  longitude: string;
  timezone: {
    name: string;
    offset: number;
    current_time: string;
    current_time_unix: number;
    is_dst: boolean;
    dst_savings: number;
  };
  currency: {
    code: string;
    name: string;
    symbol: string;
  };
  connection_type: string;
  isp: string;
  organization: string;
  asn: string;
  // Recursos de segurança do IPGeolocation.io
  security?: {
    threat_types: string[];
    is_tor: boolean;
    is_proxy: boolean;
    is_anonymous: boolean;
    is_known_attacker: boolean;
    is_known_abuser: boolean;
    is_threat: boolean;
    is_bogon: boolean;
  };
}

export interface CachedGeoData {
  data: GeoData;
  timestamp: number;
  ip: string;
}

export class GeoEnrichment {
  private static readonly CACHE_KEY = '__geo_enrichment_cache';
  private static readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 horas em ms
  private static readonly API_TIMEOUT = 3000; // 3 segundos
  private static readonly API_BASE_URL = 'https://api.ipgeolocation.io/ipgeo';
  private static readonly API_KEY = (import.meta.env.VITE_IPGEOLOCATION_API_KEY || '86ceb141b4964e02931f28ce31951e9f').trim();
  private static cachedData: CachedGeoData | null = null;

  /**
   * Obter dados de geolocalização com cache inteligente
   */
  static async getGeoData(clientIP?: string): Promise<GeoData | null> {
    try {
      // Verificar se a API key está configurada (graceful degradation)
      if (!this.API_KEY) {
        console.warn('⚠️ GEO: VITE_IPGEOLOCATION_API_KEY não configurada - geolocalização desabilitada');
        return null;
      }

      // 1. Verificar cache em memória primeiro
      if (this.cachedData && this.isCacheValid(this.cachedData)) {
        console.log('🌍 GEO: Dados obtidos do cache em memória');
        return this.cachedData.data;
      }

      // 2. Verificar cache no localStorage
      const localCache = this.getFromLocalStorage();
      if (localCache && this.isCacheValid(localCache)) {
        this.cachedData = localCache;
        console.log('🌍 GEO: Dados obtidos do cache localStorage');
        return localCache.data;
      }

      // 3. Buscar dados da API com timeout
      console.log('🌍 GEO: Buscando dados da API IPGeolocation.io...');
      const geoData = await this.fetchFromAPI(clientIP);

      if (geoData) {
        // 4. Salvar no cache
        const cacheData: CachedGeoData = {
          data: geoData,
          timestamp: Date.now(),
          ip: clientIP || 'auto-detect'
        };

        this.cachedData = cacheData;
        this.saveToLocalStorage(cacheData);

        console.log('🌍 GEO: Dados obtidos da API e salvos no cache:', {
          country: geoData.country_name,
          state: geoData.state_prov,
          city: geoData.city,
          security: geoData.security ? 'Enabled' : 'Basic',
          cached_until: new Date(Date.now() + this.CACHE_TTL).toISOString()
        });

        return geoData;
      }

      console.warn('⚠️ GEO: Não foi possível obter dados de geolocalização');
      return null;

    } catch (error) {
      console.error('❌ GEO: Erro ao obter dados de geolocalização:', error);
      return null;
    }
  }

  /**
   * Buscar dados da API IPGeolocation.io com timeout
   */
  private static async fetchFromAPI(clientIP?: string): Promise<GeoData | null> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.API_TIMEOUT);

      // Construir URL com parâmetros (sem recursos de segurança para chave gratuita)
      const params = new URLSearchParams({
        apiKey: this.API_KEY,
        fields: 'geo,time_zone,currency,connection,security' // ✅ ADICIONADO: 'connection' e 'security'
      });

      // Adicionar IP específico se fornecido
      if (clientIP) {
        params.append('ip', clientIP);
      }

      const url = `${this.API_BASE_URL}?${params.toString()}`;

      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'DigitalPaisagismo-GeoEnrichment/2.0'
        }
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // Validar dados essenciais
      if (!data.country_code2 || !data.country_name) {
        throw new Error('Dados de geolocalização incompletos');
      }

      // Log de recursos de segurança se disponíveis
      if (data.security) {
        console.log('🔒 GEO: Recursos de segurança detectados:', {
          is_proxy: data.security.is_proxy,
          is_tor: data.security.is_tor,
          is_threat: data.security.is_threat,
          threat_types: data.security.threat_types
        });
      }

      return data as GeoData;

    } catch (error) {
      if (error.name === 'AbortError') {
        console.warn('⚠️ GEO: Timeout na API IPGeolocation.io (3s)');
      } else {
        console.error('❌ GEO: Erro na API IPGeolocation.io:', error);
      }
      return null;
    }
  }

  /**
   * Verificar se o cache ainda é válido
   */
  private static isCacheValid(cache: CachedGeoData): boolean {
    const now = Date.now();
    const isValid = (now - cache.timestamp) < this.CACHE_TTL;

    if (!isValid) {
      console.log('🌍 GEO: Cache expirado, será renovado');
    }

    return isValid;
  }

  /**
   * Obter dados do localStorage
   */
  private static getFromLocalStorage(): CachedGeoData | null {
    try {
      if (typeof localStorage === 'undefined') return null;

      const cached = localStorage.getItem(this.CACHE_KEY);
      if (!cached) return null;

      return JSON.parse(cached) as CachedGeoData;

    } catch (error) {
      console.warn('⚠️ GEO: Erro ao ler cache do localStorage:', error);
      return null;
    }
  }

  /**
   * Salvar dados no localStorage
   */
  private static saveToLocalStorage(data: CachedGeoData): void {
    try {
      if (typeof localStorage === 'undefined') return;

      localStorage.setItem(this.CACHE_KEY, JSON.stringify(data));

    } catch (error) {
      console.warn('⚠️ GEO: Erro ao salvar cache no localStorage:', error);
    }
  }

  /**
   * Limpar cache manualmente
   */
  static clearCache(): void {
    try {
      this.cachedData = null;
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(this.CACHE_KEY);
        // Limpar cache legado
        localStorage.removeItem('__geo_enrichment_cache_ipgeo');
      }
      console.log('🧹 GEO: Cache limpo manualmente');
    } catch (error) {
      console.warn('⚠️ GEO: Erro ao limpar cache:', error);
    }
  }

  /**
   * Limpeza automática de cache expirado
   */
  static cleanupExpiredCache(): void {
    try {
      const cached = this.getFromLocalStorage();
      if (cached && !this.isCacheValid(cached)) {
        this.clearCache();
        console.log('🧹 GEO: Cache expirado removido automaticamente');
      }
    } catch (error) {
      console.warn('⚠️ GEO: Erro na limpeza automática:', error);
    }
  }

  /**
   * Obter informações do cache atual
   */
  static getCacheInfo(): { hasCache: boolean; isValid: boolean; expiresAt?: string; data?: Partial<GeoData> } {
    const cached = this.getFromLocalStorage();

    if (!cached) {
      return { hasCache: false, isValid: false };
    }

    const isValid = this.isCacheValid(cached);
    const expiresAt = new Date(cached.timestamp + this.CACHE_TTL).toISOString();

    return {
      hasCache: true,
      isValid,
      expiresAt,
      data: {
        country_name: cached.data.country_name,
        state_prov: cached.data.state_prov,
        city: cached.data.city,
        timezone: cached.data.timezone
      }
    };
  }

  /**
   * Hash SHA256 para consistência com API (Meta CAPI exigência)
   */
  private static async hashSHA256(value: string): Promise<string> {
    if (!value || typeof value !== 'string') {
      console.warn('⚠️ hashSHA256: Valor inválido');
      return '';
    }

    // ✅ CORREÇÃO: Verificar se Web Crypto API está disponível
    if (!window.crypto || !window.crypto.subtle) {
      console.warn('⚠️ hashSHA256: Web Crypto API não disponível');
      return '';
    }

    try {
      // Usar Web Crypto API (disponível em navegadores modernos)
      const encoder = new TextEncoder();
      // ✅ CORREÇÃO META: Preservar valor original sem trim() desnecessário
      const data = encoder.encode(value);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      // ✅ CORREÇÃO: Log seguro sem expor dados originais
      console.log('🔐 SHA256 hash gerado no frontend:', {
        length: value.length,
        hash: hashHex.substring(0, 16) + '...'
      });

      return hashHex;
    } catch (error) {
      console.error('❌ Erro ao gerar hash SHA256:', error);
      // ✅ CORREÇÃO CRÍTICA: Retornar string vazia em vez do valor original
      return '';
    }
  }

  /**
   * ✅ OBTENÇÃO DE DADOS GEO HASHEADOS PARA META CAPI
   * Retorna dados de geolocalização (ct, st, zp, country) já hasheados em SHA256
   * para compliance com as exigências da Meta CAPI.
   */
  static async getGeoDataForCAPI(clientIP?: string): Promise<{
    ct?: string;
    st?: string;
    zp?: string;
    country?: string;
  } | null> {
    const geoData = await this.getGeoData(clientIP);
    if (!geoData) {
      console.warn('⚠️ GEO-CAPI: Não foi possível obter dados de geolocalização para hashear');
      return null;
    }

    // ✅ FUNÇÃO INTERNA DE HASHING: Garante consistência e segurança
    const hash = async (value: string | undefined | null): Promise<string | undefined> => {
      if (!value || value.trim().length === 0) return undefined;

      // ✅ CORREÇÃO META: Lowercase + NFD antes de hashear (exigência Meta para geo data)
      const normalized = value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

      // SHA256 Hashing
      const hashedValue = await this.hashSHA256(normalized);

      console.log(`🔒 GEO-HASH: Campo normalizado e hasheado:`, {
        original: value,
        normalized: normalized,
        hashed: hashedValue.substring(0, 15) + '...'
      });

      return hashedValue;
    };

    // ✅ MAPEAMENTO E HASHING DOS CAMPOS PARA META CAPI
    const hashedGeoData = {
      ct: await hash(geoData.city),
      st: await hash(geoData.state_prov),
      zp: await hash(geoData.zipcode),
      country: await hash(geoData.country_code2)
    };

    console.log('🌍 GEO-CAPI: Dados de geolocalização hasheados para Meta CAPI:', {
      city: hashedGeoData.ct ? 'present' : 'missing',
      state: hashedGeoData.st ? 'present' : 'missing',
      zip: hashedGeoData.zp ? 'present' : 'missing',
      country: hashedGeoData.country ? 'present' : 'missing'
    });

    return hashedGeoData;
  }
}
