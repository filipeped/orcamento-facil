/**
 * Configuração do Sentry para monitoramento de erros
 *
 * Para configurar:
 * 1. Crie conta em https://sentry.io (grátis)
 * 2. Crie um projeto React
 * 3. Pegue o DSN
 * 4. Adicione VITE_SENTRY_DSN no .env e Vercel
 */

import * as Sentry from "@sentry/react";

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;

export function initSentry() {
  if (!SENTRY_DSN) {
    console.log("Sentry DSN não configurado - monitoramento desabilitado");
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE,

    // Configurações de performance
    tracesSampleRate: 0.1, // 10% das transações para não estourar cota

    // Configurações de replay (opcional - consome mais cota)
    replaysSessionSampleRate: 0.01, // 1% das sessões
    replaysOnErrorSampleRate: 0.1, // 10% das sessões com erro

    // Integrations
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true, // Proteger dados sensíveis
        blockAllMedia: true,
      }),
    ],

    // Filtrar erros não relevantes
    beforeSend(event, hint) {
      // Ignorar erros de extensões do navegador
      if (event.exception?.values?.[0]?.stacktrace?.frames?.some(
        frame => frame.filename?.includes("extension")
      )) {
        return null;
      }

      // Ignorar erros de rede comuns
      const message = event.exception?.values?.[0]?.value || "";
      if (
        message.includes("Failed to fetch") ||
        message.includes("NetworkError") ||
        message.includes("Load failed")
      ) {
        // Só reportar se for muito frequente
        return null;
      }

      return event;
    },

    // Tags globais
    initialScope: {
      tags: {
        app: "fechaaqui",
        platform: "web",
      },
    },
  });

  console.log("Sentry inicializado para monitoramento de erros");
}

// Função para capturar erros manualmente
export function captureError(error: Error, context?: Record<string, unknown>) {
  if (!SENTRY_DSN) return;

  Sentry.captureException(error, {
    extra: context,
  });
}

// Função para adicionar breadcrumb (trilha de navegação)
export function addBreadcrumb(message: string, category?: string, data?: Record<string, unknown>) {
  if (!SENTRY_DSN) return;

  Sentry.addBreadcrumb({
    message,
    category: category || "app",
    level: "info",
    data,
  });
}

// Função para identificar usuário (após login)
export function setUser(userId: string, email?: string, name?: string) {
  if (!SENTRY_DSN) return;

  Sentry.setUser({
    id: userId,
    email: email,
    username: name,
  });
}

// Limpar usuário (após logout)
export function clearUser() {
  if (!SENTRY_DSN) return;

  Sentry.setUser(null);
}

export { Sentry };
