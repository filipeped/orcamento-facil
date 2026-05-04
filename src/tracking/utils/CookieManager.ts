// CookieManager - Gerenciamento avançado de cookies do Facebook
export class CookieManager {
  // ✅ OTIMIZADO: Aguardar pixel + fallback robusto para FBP (5s timeout)
  static async getFbpWithPixelWait(): Promise<string | null> {
    return new Promise((resolve) => {
      const maxWait = 5000; // 5 segundos máximo (otimizado)
      const checkInterval = 100; // Verificar a cada 100ms
      let elapsed = 0;

      const checkFbp = () => {
        const fbp = this.getFbpCookie();
        if (fbp && this.isValidFbp(fbp)) {
          console.log('🍪 FBP real encontrado:', fbp.substring(0, 20) + '...');
          resolve(fbp);
          return;
        }

        elapsed += checkInterval;
        if (elapsed >= maxWait) {
          console.warn('⚠️ Timeout 5s aguardando cookie FBP real - ativando fallback');
          // ✅ FALLBACK: Tentar obter FBP com estratégias alternativas
          const fallbackFbp = this.getFbpWithFallback();
          resolve(fallbackFbp);
          return;
        }

        setTimeout(checkFbp, checkInterval);
      };

      checkFbp();
    });
  }

  // ✅ NOVO: FBP com fallback robusto (similar ao FBC)
  static getFbpWithFallback(): string | null {
    // 1. Primeiro: tentar obter do cookie _fbp
    const fbpFromCookie = this.getFbpCookie();
    if (fbpFromCookie && this.isValidFbp(fbpFromCookie)) {
      console.log('🍪 FBP obtido do cookie:', fbpFromCookie.substring(0, 20) + '...');
      return fbpFromCookie;
    }

    // 2. Fallback: verificar se existe FBP em localStorage (backup)
    const fbpFromStorage = this.getFbpFromStorage();
    if (fbpFromStorage && this.isValidFbp(fbpFromStorage)) {
      console.log('💾 FBP recuperado do localStorage:', fbpFromStorage.substring(0, 20) + '...');
      // Restaurar cookie se possível
      this.setFbpCookie(fbpFromStorage);
      return fbpFromStorage;
    }

    // 3. Último recurso: desativado - Meta proíbe fabricar _fbp
    // generateEmergencyFbp() agora retorna null, não tentamos mais gerar

    console.warn('⚠️ FBP não disponível - todas as estratégias falharam');
    return null;
  }

  // Obter cookie FBP
  static getFbpCookie(): string | null {
    return this.getCookie('_fbp');
  }

  // Obter cookie FBC
  static getFbcCookie(): string | null {
    const fbc = this.getCookie('_fbc');
    if (fbc) {
      if (this.isValidFbc(fbc)) {
        console.log('🍪 FBC real encontrado:', fbc.substring(0, 20) + '...');
        return fbc;
      } else {
        // ✅ PRESERVAR FBC mesmo se formato não reconhecido
        console.warn('⚠️ FBC com formato não reconhecido, mas preservando valor:', fbc.substring(0, 20) + '...');
        return fbc;
      }
    }
    console.warn('⚠️ FBC não encontrado');
    return null;
  }

  // Função genérica para obter cookies
  private static getCookie(name: string): string | null {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
      const cookie = parts.pop()?.split(';').shift();
      return cookie || null;
    }
    return null;
  }

  // ✅ VALIDAÇÃO FBP MELHORADA (removida duplicação)

  // Validar se FBC é real
  private static isValidFbc(fbc: string): boolean {
    if (!fbc || typeof fbc !== 'string') return false;

    // ✅ CORREÇÃO: FBC formato: fb.{subdomainIndex}.{timestamp_10+_digitos}.{fbclid}
    // Aceita timestamps de 10+ dígitos para compatibilidade (segundos e milissegundos)
    // Documentação Meta: "ClickID value is case sensitive - do not apply any modifications"
    const fbcRegex = /^fb\.[0-9]+\.[0-9]{10,}\..+$/;
    const isValidFormat = fbcRegex.test(fbc);

    if (!isValidFormat) return false;

    // Validação de comprimento específica: mínimo 30 caracteres
    // fb.1. (4) + timestamp (13) + . (1) + fbclid (min 12) = 30+
    if (fbc.length < 30) return false;

    // Verificar se timestamp é válido (últimos 90 dias)
    const parts = fbc.split('.');
    if (parts.length >= 3) {
      const timestamp = parseInt(parts[2]);
      const now = Date.now();
      const ninetyDaysAgo = now - (90 * 24 * 60 * 60 * 1000);
      const oneHourFuture = now + (60 * 60 * 1000);

      return timestamp >= ninetyDaysAgo && timestamp <= oneHourFuture;
    }

    return false;
  }

  // ✅ V9.4: FBC - Apenas cookie real do Pixel ou backup exato (NUNCA criar novo)
  // Meta: "do not apply any modifications to the Click ID value"
  // FIX: Remover fallbacks que CRIAM fbc (causavam erro "fbclid modificado")
  static getFbcWithFallback(): string | null {
    // 1. PRIORIDADE: Cookie _fbc real (criado pelo Meta Pixel)
    const fbcFromCookie = this.getCookie('_fbc');
    if (fbcFromCookie && fbcFromCookie.length > 20) {
      console.log('🍪 FBC do cookie (preservado sem modificação):', fbcFromCookie.substring(0, 30) + '...');
      this.saveFbcToStorage(fbcFromCookie);
      return fbcFromCookie;
    }

    // 2. BACKUP: localStorage (cópia exata de um cookie anterior do Pixel)
    const fbcFromStorage = this.getFbcFromStorage();
    if (fbcFromStorage && fbcFromStorage.length > 20) {
      // Validar que é formato de cookie real (fb.X.timestamp.fbclid)
      const fbcFormat = /^fb\.[0-9]+\.[0-9]{10,}\..+$/;
      if (fbcFormat.test(fbcFromStorage)) {
        console.log('💾 FBC recuperado do localStorage (backup do cookie real):', fbcFromStorage.substring(0, 30) + '...');
        this.setFbcCookie(fbcFromStorage);
        return fbcFromStorage;
      }
    }

    // ✅ NÃO criar fbc a partir de fbclid - melhor omitir do que enviar valor fabricado
    // Isso evita o erro "O servidor está enviando um valor fbclid modificado no parâmetro fbc"
    console.log('ℹ️ FBC não disponível (cookie do Pixel não encontrado) - omitindo para evitar erro Meta');
    return null;
  }

  // ✅ NOVO: Obter FBC do localStorage (backup crítico para navegação SPA)
  private static getFbcFromStorage(): string | null {
    try {
      const storedFbc = localStorage.getItem('_fbc_backup');
      if (storedFbc && storedFbc.length > 10) {
        // Verificar se não expirou (90 dias)
        const storedTime = localStorage.getItem('_fbc_backup_time');
        if (storedTime) {
          const ageInDays = (Date.now() - parseInt(storedTime)) / (1000 * 60 * 60 * 24);
          if (ageInDays < 90) {
            return storedFbc;
          } else {
            // Limpar dados expirados
            localStorage.removeItem('_fbc_backup');
            localStorage.removeItem('_fbc_backup_time');
            console.log('🗑️ FBC expirado removido do localStorage');
          }
        } else {
          // Se não tem timestamp, considerar válido (compatibilidade)
          return storedFbc;
        }
      }
    } catch (error) {
      console.warn('⚠️ Erro ao acessar localStorage para FBC:', error);
    }
    return null;
  }

  // ✅ NOVO: Salvar FBC no localStorage (backup)
  private static saveFbcToStorage(fbc: string): void {
    try {
      // ✅ Verificar se já existe o mesmo valor (evitar sobrescrita desnecessária)
      const existing = localStorage.getItem('_fbc_backup');
      if (existing === fbc) {
        return; // Já salvo, não precisa atualizar
      }
      localStorage.setItem('_fbc_backup', fbc);
      localStorage.setItem('_fbc_backup_time', Date.now().toString());
      console.log('💾 FBC salvo no localStorage como backup');
    } catch (error) {
      console.warn('⚠️ Erro ao salvar FBC no localStorage:', error);
    }
  }

  // Extrair fbclid dos parâmetros da URL
  static getFbclidFromUrl(): string | null {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const fbclid = urlParams.get('fbclid');

      if (fbclid && fbclid.length > 0) {
        // ✅ CORREÇÃO NOTIFICAÇÃO META: Validação mais rigorosa do fbclid
        // - Preserva case-sensitivity ABSOLUTA conforme diretrizes Meta
        // - NUNCA aplica modificações ao valor original
        // - Validação mais rigorosa para evitar notificações

        // Remover prefixo fbclid= se presente (mas preservar valor original)
        let cleanFbclid = fbclid;
        if (fbclid.startsWith('fbclid=')) {
          cleanFbclid = fbclid.substring(7);
        }

        // Validação mais rigorosa: fbclid típico tem 20+ caracteres alfanuméricos
        const fbclidPattern = /^[A-Za-z0-9_-]{15,}$/; // Mínimo 15 chars, mais rigoroso

        if (fbclidPattern.test(cleanFbclid)) {
          console.log('🔗 fbclid válido encontrado na URL:', cleanFbclid.substring(0, 10) + '...');
          return cleanFbclid; // Retorna valor limpo sem prefixo
        } else if (cleanFbclid.length >= 10) {
          // Fallback: aceita se tem pelo menos 10 caracteres (evitar perda total)
          console.warn('⚠️ fbclid com formato não padrão, mas preservando:', cleanFbclid.substring(0, 10) + '...');
          return cleanFbclid;
        } else {
          console.warn('⚠️ fbclid muito curto, rejeitando:', cleanFbclid);
          return null;
        }
      }
    } catch (error) {
      console.warn('⚠️ Erro ao extrair fbclid da URL:', error);
    }

    return null;
  }

  // REMOVIDO: formatFbcFromFbclid - código morto (nunca chamado)
  // V9.4: Nunca criar fbc manualmente, apenas usar cookie do Pixel

  // ✅ CORREÇÃO: Salvar fbclid e timestamp, mas NÃO criar cookie (deixar Pixel criar)
  // Isso evita o erro "fbclid modificado" da Meta
  static captureClickTimestamp(): void {
    try {
      if (typeof window !== 'undefined' && window.location.search.includes('fbclid=')) {
        const now = Date.now();

        // Salvar timestamp se não existe (session + localStorage para persistência)
        if (!sessionStorage.getItem('_fbclid_click_time')) {
          sessionStorage.setItem('_fbclid_click_time', now.toString());
          localStorage.setItem('_fbclid_click_time', now.toString());
          console.log('📌 Timestamp do clique fbclid salvo:', now);
        }

        // ✅ SALVAR FBCLID ORIGINAL (para fallback posterior)
        const fbclid = this.getFbclidFromUrl();
        if (fbclid && !localStorage.getItem('_fbclid_original')) {
          localStorage.setItem('_fbclid_original', fbclid);
          console.log('📌 fbclid original salvo para backup');
        }

        // ✅ Se cookie já existe (criado pelo Pixel), apenas sincronizar com localStorage
        const existingFbc = this.getFbcCookie();
        if (existingFbc) {
          try {
            const storedFbc = localStorage.getItem('_fbc_backup');
            if (!storedFbc || storedFbc !== existingFbc) {
              localStorage.setItem('_fbc_backup', existingFbc);
              localStorage.setItem('_fbc_backup_time', now.toString());
              console.log('💾 FBC do Pixel sincronizado com localStorage:', existingFbc.substring(0, 30) + '...');
            }
          } catch (e) {
            // Ignorar erro de localStorage
          }
        }
        // ✅ NÃO criar cookie aqui - deixar o Pixel da Meta criar
        // O index.html tem fallback que cria após 2s se Pixel não criar
      }
    } catch (e) {
      console.warn('⚠️ Erro ao capturar fbclid:', e);
    }
  }

  // ✅ NOVO: Definir cookie FBC (persistir por 90 dias)
  static setFbcCookie(fbc: string): void {
    try {
      // ✅ VERIFICAÇÃO ANTI-MODIFICAÇÃO: Detectar se FBC está sendo sobrescrito
      const existingFbc = this.getCookie('_fbc');
      if (existingFbc && existingFbc !== fbc) {
        console.error('🚨 ATENÇÃO: FBC sendo sobrescrito! (pode causar aviso Meta)', {
          antigo: existingFbc.substring(0, 30) + '...',
          novo: fbc.substring(0, 30) + '...'
        });
        // ✅ CORREÇÃO: Não sobrescrever se já existe (preservar original)
        return;
      }

      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + 90); // 90 dias (padrão Meta)

      // ✅ CORREÇÃO: Domain dinâmico (igual ao index.html)
      const currentDomain = window.location.hostname;
      const isLocalhost = currentDomain === 'localhost' || currentDomain === '127.0.0.1';
      const domainPart = isLocalhost
        ? ''
        : `; domain=.${currentDomain.replace(/^www\./, '')}`; // Remove www. se presente

      document.cookie = `_fbc=${fbc}; expires=${expirationDate.toUTCString()}; path=/${domainPart}; SameSite=Lax`;

      // ✅ SEMPRE salvar no localStorage como backup (garante persistência SPA)
      try {
        localStorage.setItem('_fbc_backup', fbc);
        localStorage.setItem('_fbc_backup_time', Date.now().toString());
      } catch (e) {
        // Ignorar erro de localStorage
      }

      console.log('🍪 Cookie _fbc definido:', fbc.substring(0, 30) + '...', isLocalhost ? '(localhost)' : `(${currentDomain})`);
    } catch (error) {
      console.warn('⚠️ Erro ao definir cookie _fbc:', error);
    }
  }

  // ✅ NOVA FUNÇÃO: Calcular subdomain index conforme documentação da Meta
  static calculateSubdomainIndex(): number {
    try {
      const hostname = window.location.hostname;

      // Casos especiais para desenvolvimento
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 1; // Usar 1 para desenvolvimento local
      }

      // Contar pontos: 'example.com' = 1 ponto = index 1, 'www.example.com' = 2 pontos = index 2
      const parts = hostname.split('.');

      // Se for apenas um TLD (ex: 'com'), retorna 0
      if (parts.length <= 1) {
        return 0;
      }

      // Calcular índice = número de pontos no hostname (conforme Meta Pixel SDK)
      // 'example.com' = 1 ponto = índice 1
      // 'www.example.com' = 2 pontos = índice 2
      // 'sub.www.example.com' = 3 pontos = índice 3
      const subdomainIndex = Math.max(0, parts.length - 1);

      console.log('🌐 Subdomain index calculado:', {
        hostname,
        parts: parts.length,
        index: subdomainIndex
      });

      return subdomainIndex;
    } catch (error) {
      console.warn('⚠️ Erro ao calcular subdomain index, usando fallback 1:', error);
      return 1; // Fallback seguro
    }
  }

  // ✅ NOVAS FUNÇÕES DE FALLBACK PARA FBP

  // Obter FBP do localStorage (backup)
  private static getFbpFromStorage(): string | null {
    try {
      const storedFbp = localStorage.getItem('_fbp_backup');
      if (storedFbp && this.isValidFbp(storedFbp)) {
        // Verificar se não expirou (90 dias)
        const storedTime = localStorage.getItem('_fbp_backup_time');
        if (storedTime) {
          const ageInDays = (Date.now() - parseInt(storedTime)) / (1000 * 60 * 60 * 24);
          if (ageInDays < 90) {
            return storedFbp;
          } else {
            // Limpar dados expirados
            localStorage.removeItem('_fbp_backup');
            localStorage.removeItem('_fbp_backup_time');
          }
        }
      }
    } catch (error) {
      console.warn('⚠️ Erro ao acessar localStorage para FBP:', error);
    }
    return null;
  }

  // Salvar FBP no localStorage
  private static saveFbpToStorage(fbp: string): void {
    try {
      localStorage.setItem('_fbp_backup', fbp);
      localStorage.setItem('_fbp_backup_time', Date.now().toString());
      console.log('💾 FBP salvo no localStorage como backup');
    } catch (error) {
      console.warn('⚠️ Erro ao salvar FBP no localStorage:', error);
    }
  }

  // Definir cookie FBP
  private static setFbpCookie(fbp: string): void {
    try {
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + 90); // 90 dias

      // ✅ CORREÇÃO: Domain dinâmico (igual ao index.html)
      const currentDomain = window.location.hostname;
      const isLocalhost = currentDomain === 'localhost' || currentDomain === '127.0.0.1';
      const domainPart = isLocalhost
        ? ''
        : `; domain=.${currentDomain.replace(/^www\./, '')}`; // Remove www. se presente

      document.cookie = `_fbp=${fbp}; expires=${expirationDate.toUTCString()}; path=/${domainPart}; SameSite=Lax`;
      console.log('🍪 Cookie FBP restaurado:', fbp.substring(0, 20) + '...', isLocalhost ? '(localhost)' : `(${currentDomain})`);
    } catch (error) {
      console.warn('⚠️ Erro ao definir cookie FBP:', error);
    }
  }

  // Verificar se deve gerar FBP de emergência
  private static shouldGenerateEmergencyFbp(): boolean {
    // ✅ CORRIGIDO: Limitação por sessão (máximo 3 tentativas)
    const sessionKey = '_fbp_emergency_session_' + Date.now().toString().slice(0, -6); // Por hora
    const sessionAttempts = parseInt(sessionStorage.getItem(sessionKey) || '0');

    if (sessionAttempts >= 3) {
      console.log('🚫 Limite de 3 tentativas de FBP emergência por sessão atingido');
      return false;
    }

    // ✅ MELHORADO: Detectar múltiplos cenários de falha
    const pixelBlocked = !window.fbq || typeof window.fbq !== 'function';
    const noCookie = !this.getFbpCookie();
    const invalidCookie = this.getFbpCookie() && !this.isValidFbp(this.getFbpCookie()!);
    const noStorage = !this.getFbpFromStorage();

    const shouldGenerate = pixelBlocked || (noCookie && noStorage) || invalidCookie;

    if (shouldGenerate) {
      // Incrementar contador da sessão
      sessionStorage.setItem(sessionKey, (sessionAttempts + 1).toString());
      console.log(`🚨 Gerando FBP emergência - Tentativa ${sessionAttempts + 1}/3`);
    }

    return shouldGenerate;
  }

  // ✅ CORREÇÃO: Meta PROÍBE fabricar _fbp - retornar null
  private static generateEmergencyFbp(): null {
    console.warn('⚠️ FBP de emergência desativado - Meta proíbe fabricar _fbp');
    return null;
  }

  // Gerar ID aleatório seguro
  private static generateSecureRandomId(): string {
    // Usar crypto.getRandomValues se disponível
    if (window.crypto && window.crypto.getRandomValues) {
      const array = new Uint32Array(4);
      window.crypto.getRandomValues(array);
      return Array.from(array, dec => dec.toString(16)).join('');
    }

    // Fallback para Math.random
    return Math.random().toString(36).substr(2, 16) + Math.random().toString(36).substr(2, 16);
  }

  // ✅ CORREÇÃO CRÍTICA: Validação FBP flexível para aceitar formatos válidos
  private static isValidFbp(fbp: string): boolean {
    if (!fbp || typeof fbp !== 'string') return false;

    // ✅ CORRIGIDO: FBP pode ter diferentes formatos válidos
    // - fb.1.{timestamp}.{id} (formato padrão)
    // - fb.{version}.{timestamp}.{id} (versões diferentes)
    // - Timestamp pode conter letras em alguns casos especiais
    const fbpRegex = /^fb\.[0-9]+\.[A-Za-z0-9]{10,}\.[A-Za-z0-9_-]{10,}$/;
    const isValidFormat = fbpRegex.test(fbp);

    if (!isValidFormat) {
      console.warn('⚠️ FBP com formato não reconhecido, rejeitando:', fbp.substring(0, 20) + '...');
      return false; // Rejeitar FBPs que não correspondem ao formato fb.X.timestamp.randomid
    }

    // Verificar se timestamp é razoável (não muito antigo ou futuro)
    const parts = fbp.split('.');
    if (parts.length >= 3) {
      // ✅ CORRIGIDO: Extrair apenas números do timestamp
      const timestampStr = parts[2].replace(/[^0-9]/g, '');
      if (timestampStr.length >= 10) { // Pelo menos 10 dígitos
        const timestamp = parseInt(timestampStr);
        const now = Date.now();
        const ninetyDaysAgo = now - (90 * 24 * 60 * 60 * 1000);
        const oneYearFuture = now + (365 * 24 * 60 * 60 * 1000); // Mais flexível

        if (timestamp >= ninetyDaysAgo && timestamp <= oneYearFuture) {
          return true;
        }
      }
    }

    // Timestamp fora do intervalo ou formato numérico inválido
    console.warn('⚠️ FBP com timestamp inválido, rejeitando:', fbp.substring(0, 20) + '...');
    return false; // Rejeitar FBPs com timestamp inválido
  }
}
