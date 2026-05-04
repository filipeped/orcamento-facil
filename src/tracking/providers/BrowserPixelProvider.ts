import type { MetaCustomData, MetaTrackOptions } from "@/types/meta";

// BrowserPixelProvider - Gerenciamento do pixel do Facebook no navegador
export class BrowserPixelProvider {
  private static pixelId = "888149620416465";

  // Verificar se o pixel está carregado
  static isPixelLoaded(): boolean {
    return typeof window !== 'undefined' && !!window.fbq;
  }

  // Aguardar o pixel carregar
  static async waitForPixel(): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.isPixelLoaded()) {
        resolve(true);
        return;
      }

      const maxWait = 5000; // 5 segundos (otimizado)
      const checkInterval = 100;
      let elapsed = 0;

      const checkPixel = () => {
        if (this.isPixelLoaded()) {
          console.log('✅ Pixel do Facebook carregado');
          resolve(true);
          return;
        }

        elapsed += checkInterval;
        if (elapsed >= maxWait) {
          console.warn('⚠️ Timeout aguardando pixel do Facebook');
          resolve(false);
          return;
        }

        setTimeout(checkPixel, checkInterval);
      };

      checkPixel();
    });
  }

  // Disparar evento via pixel
  // userData: dados hasheados do usuário para Advanced Matching (fn, ln, em, ph, etc.)
  static trackEvent(
    eventName: string,
    customData: MetaCustomData,
    options?: MetaTrackOptions,
    userData?: Record<string, string>
  ): boolean {
    if (!this.isPixelLoaded()) {
      console.warn('⚠️ Pixel do Facebook não carregado');
      return false;
    }

    try {
      // Garantir que o fbq está disponível
      if (typeof window.fbq !== 'function') {
        console.error('❌ fbq não é uma função');
        return false;
      }

      // Log detalhado antes de disparar o evento
      console.log(`🔍 Disparando evento via Pixel: ${eventName}`, {
        customData,
        options,
        hasUserData: !!userData,
        userDataFields: userData ? Object.keys(userData) : [],
        pixelStatus: 'loaded',
        timestamp: new Date().toISOString()
      });

      // ✅ Advanced Matching: Passar dados do usuário via track
      // Meta Pixel aceita userData nos options do evento
      const trackOptions = { ...options };
      if (userData && Object.keys(userData).length > 0) {
        // Adicionar userData aos options para Advanced Matching
        // Meta Pixel usa esses campos: em, ph, fn, ln, ct, st, zp, country
        Object.assign(trackOptions, userData);
        console.log('📊 Advanced Matching incluído:', Object.keys(userData));
      }

      // ✅ CRÍTICO: Verificar se eventID está presente nos trackOptions
      if (!trackOptions.eventID) {
        console.error('❌ ERRO CRÍTICO: eventID ausente nos trackOptions!', {
          originalOptions: options,
          finalTrackOptions: trackOptions,
          eventName
        });
      } else {
        console.log('✅ eventID presente:', trackOptions.eventID.substring(0, 20) + '...');
      }

      // Disparar o evento com Advanced Matching embutido
      window.fbq('track', eventName, customData, trackOptions);
      console.log('✅ Evento disparado via Pixel:', eventName, userData ? '(com Advanced Matching)' : '');
      
      return true;
    } catch (error) {
      console.error('❌ Erro ao disparar evento via Pixel:', error);
      return false;
    }
  }

  // Inicializar pixel (se necessário)
  static initPixel(): void {
    if (typeof window !== 'undefined' && !window.fbq) {
      console.log('🔄 Inicializando pixel do Facebook...');
      // O pixel já está inicializado no index.html
    }
  }
}
