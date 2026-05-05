import { useEffect, useState, lazy, Suspense } from "react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProposalsProvider } from "@/contexts/ProposalsContext";
import { CatalogProvider } from "@/contexts/CatalogContext";
import { NotificationsProvider } from "@/contexts/NotificationsContext";
import { ExpensesProvider } from "@/contexts/ExpensesContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminRoute } from "@/components/AdminRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Lazy load all pages for code splitting
const LandingPage = lazy(() => import("./pages/LandingV2"));
const Checkout = lazy(() => import("./pages/Checkout"));
const Login = lazy(() => import("./pages/Login"));
const Cadastro = lazy(() => import("./pages/Cadastro"));
const Catalogo = lazy(() => import("./pages/Catalogo"));
const Clientes = lazy(() => import("./pages/Clientes"));
// Dashboard removido - redirecionado para Propostas
const Relatorios = lazy(() => import("./pages/Relatorios"));
const Agenda = lazy(() => import("./pages/Agenda"));
const Propostas = lazy(() => import("./pages/Propostas"));
const NovaProposta = lazy(() => import("./pages/NovaProposta"));
const PropostaDetalhe = lazy(() => import("./pages/PropostaDetalhe"));
const EditarProposta = lazy(() => import("./pages/EditarProposta"));
const PropostaPublica = lazy(() => import("./pages/PropostaPublica"));
const Configuracoes = lazy(() => import("./pages/Configuracoes"));
const EsqueciSenha = lazy(() => import("./pages/EsqueciSenha"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Upgrade = lazy(() => import("./pages/Upgrade"));
const PagamentoSucesso = lazy(() => import("./pages/PagamentoSucesso"));
const Termos = lazy(() => import("./pages/Termos"));
const Privacidade = lazy(() => import("./pages/Privacidade"));
const NotFound = lazy(() => import("./pages/NotFound"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const Despesas = lazy(() => import("./pages/Despesas"));
const NovaDespesa = lazy(() => import("./pages/NovaDespesa"));
const FaturasStub = lazy(() => import("./pages/FaturasStub"));

// Admin Pages
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminAssinantes = lazy(() => import("./pages/admin/AdminAssinantes"));
const AdminCupons = lazy(() => import("./pages/admin/AdminCupons"));
const AdminLogs = lazy(() => import("./pages/admin/AdminLogs"));
const AdminRelatorios = lazy(() => import("./pages/admin/AdminRelatorios"));
const AdminProjecao = lazy(() => import("./pages/admin/AdminProjecao"));

// React Query com cache otimizado
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Stale-while-revalidate: mostra cache enquanto atualiza em background
      staleTime: 1000 * 60 * 5, // 5 minutos - dados são "frescos" por 5 min
      gcTime: 1000 * 60 * 30, // 30 minutos - mantém no cache por 30 min
      refetchOnWindowFocus: false, // Não refetch ao focar janela
      refetchOnReconnect: true, // Refetch ao reconectar internet
      retry: 1, // Tentar 1 vez em caso de erro
    },
  },
});

// Loading fallback for Suspense
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-muted">
    <div className="flex flex-col items-center gap-4">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      <p className="text-muted-foreground">Carregando...</p>
    </div>
  </div>
);

// Redirect to /auth/callback if OAuth tokens are in URL
function OAuthRedirector({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    const search = window.location.search;
    const path = window.location.pathname;

    // If we have OAuth params and we're NOT already on /auth/callback, redirect there
    if (path !== "/auth/callback" && path !== "/reset-password") {
      // Check if it's a password recovery token
      if (hash.includes("type=recovery")) {
        console.log("OAuthRedirector: Found recovery token, redirecting to /reset-password");
        window.location.href = "/reset-password" + hash;
        return;
      }
      if (hash.includes("access_token") || search.includes("code=")) {
        console.log("OAuthRedirector: Found OAuth params, redirecting to /auth/callback");
        window.location.href = "/auth/callback" + search + hash;
        return;
      }
    }

    setReady(true);
  }, []);

  if (!ready) {
    return <PageLoader />;
  }

  return <>{children}</>;
}

const App = () => (
  <OAuthRedirector>
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AuthProvider>
            <NotificationsProvider>
              <ProposalsProvider>
                <CatalogProvider>
                  <ExpensesProvider>
                  <Suspense fallback={<PageLoader />}>
                    <Routes>
                      <Route path="/" element={<LandingPage />} />
                      <Route path="/checkout" element={<Checkout />} />
                      <Route path="/login" element={<Login />} />
                      <Route path="/cadastro" element={<Cadastro />} />
                      <Route path="/esqueci-senha" element={<EsqueciSenha />} />
                      <Route path="/reset-password" element={<ResetPassword />} />
                      <Route path="/termos" element={<Termos />} />
                      <Route path="/privacidade" element={<Privacidade />} />
                      <Route path="/auth/callback" element={<AuthCallback />} />

                      {/* Public Proposal View (for clients) */}
                      <Route path="/p/:code/:name" element={<PropostaPublica />} />
                      <Route path="/p/:id" element={<PropostaPublica />} />

                      {/* Protected Routes */}
                      <Route path="/dashboard" element={<Navigate to="/orcamentos" replace />} />

                      {/* Orcamentos (canonical) + Propostas (legacy alias) */}
                      <Route path="/orcamentos" element={<ProtectedRoute><Propostas /></ProtectedRoute>} />
                      <Route path="/orcamentos/novo" element={<ProtectedRoute><NovaProposta /></ProtectedRoute>} />
                      <Route path="/orcamentos/:id" element={<ProtectedRoute><PropostaDetalhe /></ProtectedRoute>} />
                      <Route path="/orcamentos/:id/editar" element={<ProtectedRoute><EditarProposta /></ProtectedRoute>} />
                      <Route path="/propostas" element={<ProtectedRoute><Propostas /></ProtectedRoute>} />
                      <Route path="/propostas/nova" element={<ProtectedRoute><NovaProposta /></ProtectedRoute>} />
                      <Route path="/propostas/:id" element={<ProtectedRoute><PropostaDetalhe /></ProtectedRoute>} />
                      <Route path="/propostas/:id/editar" element={<ProtectedRoute><EditarProposta /></ProtectedRoute>} />

                      {/* Faturas — reusa Propostas/NovaProposta filtrando por docType=fatura na rota */}
                      <Route path="/faturas" element={<ProtectedRoute><Propostas /></ProtectedRoute>} />
                      <Route path="/faturas/nova" element={<ProtectedRoute><NovaProposta /></ProtectedRoute>} />
                      <Route path="/faturas/:id" element={<ProtectedRoute><PropostaDetalhe /></ProtectedRoute>} />
                      <Route path="/faturas/:id/editar" element={<ProtectedRoute><EditarProposta /></ProtectedRoute>} />

                      {/* Recibos — mesmo padrão */}
                      <Route path="/recibos" element={<ProtectedRoute><Propostas /></ProtectedRoute>} />
                      <Route path="/recibos/nova" element={<ProtectedRoute><NovaProposta /></ProtectedRoute>} />
                      <Route path="/recibos/:id" element={<ProtectedRoute><PropostaDetalhe /></ProtectedRoute>} />
                      <Route path="/meus-itens" element={<ProtectedRoute><Catalogo /></ProtectedRoute>} />
                      <Route path="/clientes" element={<ProtectedRoute><Clientes /></ProtectedRoute>} />
                      <Route path="/despesas" element={<ProtectedRoute><Despesas /></ProtectedRoute>} />
                      <Route path="/despesas/nova" element={<ProtectedRoute><NovaDespesa /></ProtectedRoute>} />
                      <Route path="/relatorios" element={<ProtectedRoute><Relatorios /></ProtectedRoute>} />
                      <Route path="/agenda" element={<ProtectedRoute><Agenda /></ProtectedRoute>} />
                      <Route path="/configuracoes" element={<ProtectedRoute><Configuracoes /></ProtectedRoute>} />
                      <Route path="/upgrade" element={<ProtectedRoute><Upgrade /></ProtectedRoute>} />
                      {/* /pagamento-sucesso e PUBLICO pra receber cliente que pagou mas ainda nao logou */}
                      <Route path="/pagamento-sucesso" element={<PagamentoSucesso />} />

                      {/* Admin Routes */}
                      <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
                      <Route path="/admin/assinantes" element={<AdminRoute><AdminAssinantes /></AdminRoute>} />
                      <Route path="/admin/cupons" element={<AdminRoute><AdminCupons /></AdminRoute>} />
                      <Route path="/admin/logs" element={<AdminRoute><AdminLogs /></AdminRoute>} />
                      <Route path="/admin/relatorios" element={<AdminRoute><AdminRelatorios /></AdminRoute>} />
                      <Route path="/admin/projecao" element={<AdminRoute><AdminProjecao /></AdminRoute>} />

                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </Suspense>
                  </ExpensesProvider>
                </CatalogProvider>
              </ProposalsProvider>
            </NotificationsProvider>
            </AuthProvider>
          </BrowserRouter>
          <SpeedInsights />
        </TooltipProvider>
      </ErrorBoundary>
    </QueryClientProvider>
  </OAuthRedirector>
);

export default App;
