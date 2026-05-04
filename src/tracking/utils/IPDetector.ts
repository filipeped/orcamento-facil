// IPDetector - Detecção automática do IP do cliente
export class IPDetector {
  private static cachedIP: string | null = null;

  // Obter IP do cliente para CAPI (formatado para Meta)
  static async getClientIPForCAPI(): Promise<string | null> {
    if (this.cachedIP) {
      return this.formatIPForMeta(this.cachedIP);
    }

    try {
      // ✅ TENTAR MÚLTIPLAS FONTES DE IP CONFIÁVEIS
      // 🌐 PRIORIDADE IPv6: api64 primeiro para melhor matching no Meta
      const ipSources = [
        'https://api64.ipify.org?format=json', // IPv6 preferido (Meta recomenda)
        'https://api.ipify.org?format=json',   // Fallback IPv4
        'https://api.myip.com'
      ];

      for (const source of ipSources) {
        try {
          const response = await fetch(source, {
            method: 'GET'
          });

          if (response.ok) {
            const data = await response.json();
            const ip = data.ip || data.query;

            if (ip && this.isValidIP(ip)) {
              this.cachedIP = ip;
              const formattedIP = this.formatIPForMeta(ip);
              console.log('🌐 IP real detectado e formatado para Meta:', {
                original: ip,
                formatted: formattedIP,
                type: this.detectIPType(ip)
              });
              return formattedIP;
            }
          }
        } catch (error) {
          console.warn(`⚠️ Erro ao detectar IP de ${source}:`, error);
          continue;
        }
      }

      console.warn('⚠️ Não foi possível detectar IP real');
      return null; // ✅ RETORNAR NULL EM VEZ DE PLACEHOLDER

    } catch (error) {
      console.error('❌ Erro crítico ao detectar IP:', error);
      return null;
    }
  }

  // Verificar se é IP válido
  static isValidIP(ip: string): boolean {
    if (!ip || ip === '{{client_ip_address}}' || ip === '0.0.0.0') {
      return false;
    }

    return this.isValidIPv4(ip) || this.isValidIPv6(ip);
  }

  // Função para validar IPv4
  private static isValidIPv4(ip: string): boolean {
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipv4Regex.test(ip);
  }

  // ✅ Função para validar IPv6 (consistente com backend - URL constructor)
  private static isValidIPv6(ip: string): boolean {
    const cleanIP = ip.replace(/^\[|\]$/g, "");
    // ✅ VALIDAÇÃO IPv6 OTIMIZADA: Usar URL constructor como no backend
    try {
      // Validação básica de formato IPv6
      if (!/^[0-9a-fA-F:]+$/.test(cleanIP.replace(/\./g, ''))) return false;

      // Usar URL constructor para validação nativa (mais eficiente)
      new URL(`http://[${cleanIP}]`);
      return true;
    } catch {
      // Fallback para regex simplificada
      const ipv6Simple = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$|^::1$|^::$/;
      return ipv6Simple.test(cleanIP);
    }
  }

  // ✅ NOVA FUNÇÃO: Detectar tipo de IP
  private static detectIPType(ip: string): string {
    if (!ip || ip === 'unknown') return 'unknown';

    // IPv6 contém ':'
    if (ip.includes(':')) {
      return 'IPv6';
    }

    // IPv4 contém apenas números e pontos
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
      return 'IPv4';
    }

    return 'unknown';
  }

  // ✅ FUNÇÃO PÚBLICA: Formatação otimizada de IP para Meta CAPI
  public static formatIPForMeta(ip: string): string {
    const ipType = this.detectIPType(ip);

    if (ipType === 'IPv6') {
      // Remove colchetes se presentes e garante formato limpo
      const cleanIP = ip.replace(/^\[|\]$/g, '');

      console.log('🌐 IPv6 formatado para Meta:', {
        original: ip,
        formatted: cleanIP,
        is_native_ipv6: true
      });

      return cleanIP;
    }

    if (ipType === 'IPv4') {
      // ✅ Meta recomenda IPv6: converter IPv4 para IPv6-mapped (::ffff:x.x.x.x)
      const ipv6Mapped = `::ffff:${ip}`;
      console.log('🌐 IPv4 convertido para IPv6-mapped:', { original: ip, mapped: ipv6Mapped });
      return ipv6Mapped;
    }

    return ip;
  }
}
