import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initSentry } from "./lib/sentry";
import { CookieManager } from "./tracking/utils/CookieManager";

// Inicializar Sentry antes de renderizar o app
initSentry();

// ✅ CORREÇÃO META V10: Capturar timestamp do clique fbclid IMEDIATAMENTE
// Isso evita o erro "fbclid modificado" - Meta quer o timestamp original
CookieManager.captureClickTimestamp();

// ✅ CORREÇÃO COBERTURA FBC: Sincronizar cookie existente com localStorage
// Isso garante que o FBC não se perca durante navegação SPA
try {
  const existingFbc = CookieManager.getFbcWithFallback();
  if (existingFbc) {
    console.log('🔄 FBC sincronizado no carregamento:', existingFbc.substring(0, 30) + '...');
  }
} catch (e) {
  // Ignorar erros de sincronização
}

// Handler para erros de módulos não encontrados após deploy
// Isso acontece quando o Vercel faz deploy e os arquivos JS mudam de hash
window.addEventListener('error', (event) => {
  if (
    event.message?.includes('Failed to fetch dynamically imported module') ||
    event.message?.includes('Loading chunk') ||
    event.message?.includes('Loading CSS chunk')
  ) {
    console.log('Detectado erro de módulo após deploy, recarregando...');
    window.location.reload();
  }
});

window.addEventListener('unhandledrejection', (event) => {
  if (
    event.reason?.message?.includes('Failed to fetch dynamically imported module') ||
    event.reason?.message?.includes('Loading chunk')
  ) {
    console.log('Detectado erro de módulo após deploy, recarregando...');
    window.location.reload();
  }
});

createRoot(document.getElementById("root")!).render(<App />);
