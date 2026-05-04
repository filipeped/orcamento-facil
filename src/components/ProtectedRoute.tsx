import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { getSupabase, getStoredSession } from "@/lib/supabase";
import { OnboardingWizard } from "@/components/OnboardingWizard";
import { PhoneVerification } from "@/components/PhoneVerification";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();
  const [waiting, setWaiting] = useState(true);
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null);
  const [phoneVerified, setPhoneVerified] = useState<boolean | null>(null);
  const [planActive, setPlanActive] = useState<boolean | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);

  // Check if URL has OAuth tokens/code that need processing
  const hasAuthParams = window.location.hash.includes("access_token") ||
                        window.location.search.includes("code=");

  useEffect(() => {
    // If there are auth params in URL, wait longer for processing
    const delay = hasAuthParams ? 4000 : 2000;

    const timer = setTimeout(() => {
      setWaiting(false);
    }, delay);

    return () => clearTimeout(timer);
  }, [hasAuthParams]);

  // Check onboarding status
  useEffect(() => {
    const checkOnboarding = async () => {
      if (!user?.id) {
        setCheckingOnboarding(false);
        return;
      }

      // Verificar se tem sessão válida antes de fazer query
      const session = getStoredSession();
      if (!session?.access_token) {
        console.warn('⚠️ Sem token de acesso - pulando verificação de perfil');
        setCheckingOnboarding(false);
        return;
      }

      console.log('🔍 Verificando perfil do usuário:', user.id);

      try {
        const { data, error } = await getSupabase()
          .from("profiles")
          .select("onboarding_completed, phone_verified, plan, plan_status, is_admin")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) {
          console.error('❌ Erro ao buscar perfil:', error.message, error.code);
          // Se erro for de autenticação, não setar como false (usuário precisa relogar)
          if (error.code === 'PGRST301' || error.code === '42501') {
            console.error('🔐 Erro de autenticação - token pode estar inválido');
          }
          setOnboardingCompleted(false);
          setPhoneVerified(false);
          setPlanActive(false);
          setIsAdmin(false);
        } else {
          console.log('✅ Perfil carregado:', data);
          setOnboardingCompleted(data?.onboarding_completed || false);
          setPhoneVerified(data?.phone_verified || false);
          setIsAdmin(data?.is_admin === true);
          // Plano ativo: status active E plano pago (nao-free)
          const hasActivePaidPlan =
            data?.plan_status === "active" && data?.plan && data.plan !== "free";
          setPlanActive(hasActivePaidPlan);
        }
      } catch (e) {
        console.error('❌ Exceção ao buscar perfil:', e);
        setOnboardingCompleted(false);
        setPhoneVerified(false);
        setPlanActive(false);
        setIsAdmin(false);
      } finally {
        setCheckingOnboarding(false);
      }
    };

    if (isAuthenticated && user?.id) {
      checkOnboarding();
    } else {
      setCheckingOnboarding(false);
    }
  }, [isAuthenticated, user?.id]);

  console.log("ProtectedRoute:", { isLoading, isAuthenticated, user: user?.email, waiting, hasAuthParams, onboardingCompleted });

  // Still loading or waiting for auth params to be processed
  if (isLoading || (waiting && hasAuthParams) || (isAuthenticated && checkingOnboarding)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    console.log("ProtectedRoute: Not authenticated, redirecting to login");
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Rotas de pagamento: pular onboarding/verificacao/plan-check pra nao travar
  // o fluxo de cliente recem-cadastrado que precisa pagar ANTES de ter acesso.
  const isPaymentRoute = location.pathname === "/upgrade" || location.pathname === "/pagamento-sucesso";
  if (isPaymentRoute) {
    return <>{children}</>;
  }

  // ============================================
  // GATE DE PAGAMENTO
  // Quem se cadastrou mas nao pagou NAO acessa a plataforma.
  // Admin escapa. Plano ativo pago (essential/pro + active) passa.
  // Qualquer outra combinacao (free+trial, expired, cancelled, overdue) → /upgrade.
  // ============================================
  if (!isAdmin && planActive === false) {
    console.log("ProtectedRoute: plano inativo, redirecionando pra /upgrade");
    return <Navigate to="/upgrade" replace />;
  }

  // ============================================
  // VERIFICACAO DE WHATSAPP
  // Para usuários Google: obrigatório (allowSkip=false)
  // Para usuários cadastro manual: opcional (allowSkip=true)
  // ============================================
  if (phoneVerified === false) {
    // Detectar se é usuário do Google (email real, não @jardinei.app)
    const isGoogleUser = user?.email && !user.email.endsWith('@jardinei.app');

    return (
      <PhoneVerification
        userId={user!.id}
        userName={user?.name}
        onComplete={() => setPhoneVerified(true)}
        allowSkip={!isGoogleUser} // Google = não pode pular, Manual = pode pular
      />
    );
  }

  // Show onboarding wizard if not completed
  if (onboardingCompleted === false) {
    return (
      <OnboardingWizard
        userId={user!.id}
        userName={user?.name}
        onComplete={() => setOnboardingCompleted(true)}
      />
    );
  }

  return <>{children}</>;
}

