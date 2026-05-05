import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { getSupabase } from "@/lib/supabase";
import {
  FileText,
  Receipt,
  Settings,
  LogOut,
  Menu,
  X,
  Bell,
  Eye,
  CheckCircle,
  Package,
  Users,
  BarChart3,
  CalendarDays,
  AlertTriangle,
  CreditCard,
  Sparkles,
  Shield,
  Clock,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/contexts/NotificationsContext";
import { ProductTour, TourStep } from "@/components/ProductTour";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const tourSteps: TourStep[] = [
  {
    target: "[data-tour='primeiro-item']",
    title: "📦 Seu Catálogo",
    description: "Aqui ficam plantas, serviços e materiais. Use esses itens para montar seus orçamentos!",
    position: "bottom",
    navigateTo: "/meus-itens",
  },
  {
    target: "[data-tour='adicionar-item']",
    title: "➕ Crie seus Itens",
    description: "Cadastre seus próprios serviços, plantas e materiais com preço e foto.",
    position: "left",
    navigateTo: "/meus-itens",
  },
  {
    target: "[data-tour='estilo-orcamento']",
    title: "🎨 Personalize",
    description: "Escolha a cor do seu orçamento e o que mostrar para o cliente.",
    position: "bottom",
    navigateTo: "/configuracoes?tab=proposal",
  },
  {
    target: "[data-tour='previa-orcamento']",
    title: "👀 Veja o Resultado",
    description: "É assim que seu orçamento fica para o cliente!",
    position: "top",
    navigateTo: "/configuracoes?tab=proposal",
  },
  {
    target: "[data-tour='nova-proposta']",
    title: "🚀 Crie seu Orçamento!",
    description: "Pronto! Agora crie seu primeiro orçamento e envie para o cliente.",
    position: "bottom",
    navigateTo: "/propostas",
  },
];

interface DashboardLayoutProps {
  children: React.ReactNode;
}

// Cache keys para sessionStorage
const PLAN_CACHE_KEY = 'fechaqui_plan_cache';

// Carregar cache do plano
function getPlanCache() {
  try {
    const cached = sessionStorage.getItem(PLAN_CACHE_KEY);
    if (cached) return JSON.parse(cached);
  } catch {
    // Ignore - sessionStorage may be unavailable in incognito
  }
  return null;
}

// Salvar cache do plano
function setPlanCache(data: { planStatus: string | null; daysUntilDowngrade: number | null }) {
  try {
    sessionStorage.setItem(PLAN_CACHE_KEY, JSON.stringify(data));
  } catch {
    // Ignore - sessionStorage may be unavailable in incognito
  }
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [showTour, setShowTour] = useState(false);

  // Inicializar com cache para evitar flash
  const cachedPlan = getPlanCache();
  const [planStatus, setPlanStatus] = useState<string | null>(cachedPlan?.planStatus ?? null);
  const [daysUntilDowngrade, setDaysUntilDowngrade] = useState<number | null>(cachedPlan?.daysUntilDowngrade ?? null);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      try {
        const { data } = await getSupabase()
          .from("profiles")
          .select("avatar_url, show_tour, plan_status, plan_overdue_since, plan_expires_at")
          .eq("user_id", user.id)
          .single();
        if (data?.avatar_url) {
          setAvatarUrl(data.avatar_url);
        }

        let newPlanStatus: string | null = null;
        let newDaysUntilDowngrade: number | null = null;

        if (data?.plan_status) {
          newPlanStatus = data.plan_status;
          setPlanStatus(newPlanStatus);
        }

        // Calcular dias restantes até downgrade (7 dias de carência)
        if (data?.plan_overdue_since) {
          const overdueDate = new Date(data.plan_overdue_since);
          const downgradeDate = new Date(overdueDate);
          downgradeDate.setDate(downgradeDate.getDate() + 7);
          const now = new Date();
          const diffTime = downgradeDate.getTime() - now.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          newDaysUntilDowngrade = Math.max(0, diffDays);
          setDaysUntilDowngrade(newDaysUntilDowngrade);
        }

        // Salvar no cache para evitar flash nas próximas navegações
        setPlanCache({
          planStatus: newPlanStatus,
          daysUntilDowngrade: newDaysUntilDowngrade
        });

        if (data?.show_tour === true) {
          // Delay to allow DOM to render
          setTimeout(() => setShowTour(true), 500);
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
      }
    };
    fetchProfile();
  }, [user]);

  const handleTourComplete = async () => {
    setShowTour(false);
    if (user?.id) {
      try {
        // Try with tour_step first, fallback to just show_tour
        const { error } = await getSupabase()
          .from("profiles")
          .update({ show_tour: false, tour_step: 0 })
          .eq("user_id", user.id);

        if (error) {
          // If tour_step column doesn't exist, just update show_tour
          await getSupabase()
            .from("profiles")
            .update({ show_tour: false })
            .eq("user_id", user.id);
        }

        // Notify other components that tour is complete
        window.dispatchEvent(new CustomEvent("tourComplete"));
      } catch (error) {
        console.error("Error updating tour status:", error);
      }
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "proposal_viewed":
        return <Eye className="w-4 h-4 text-blue-500" />;
      case "proposal_approved":
        return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case "payment_confirmed":
      case "plan_upgraded":
        return <Sparkles className="w-4 h-4 text-amber-500" />;
      case "payment_overdue":
      case "plan_expired":
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      default:
        return <Bell className="w-4 h-4 text-neutral-400" />;
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Agora";
    if (diffMins < 60) return `${diffMins}min`;
    if (diffHours < 24) return `${diffHours}h`;
    return `${diffDays}d`;
  };

  const navigation = [
    { name: "Orçamentos", icon: FileText, href: "/orcamentos" },
    { name: "Faturas", icon: Receipt, href: "/faturas" },
    { name: "Despesas", icon: Wallet, href: "/despesas" },
    { name: "Clientes", icon: Users, href: "/clientes" },
    { name: "Agenda", icon: CalendarDays, href: "/agenda" },
    { name: "Meus Itens", icon: Package, href: "/meus-itens" },
    { name: "Relatórios", icon: BarChart3, href: "/relatorios" },
    { name: "Configurações", icon: Settings, href: "/configuracoes" },
  ];

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex w-full overflow-x-hidden">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex lg:flex-col lg:w-60 lg:fixed lg:inset-y-0 bg-white border-r border-neutral-200/80">
        {/* Logo */}
        <div className="flex items-center h-14 px-4 border-b border-neutral-200/80">
          <Link to="/propostas">
            <Logo size="sm" />
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href ||
              location.pathname.startsWith(item.href + "/");
            const tourId = item.href === "/propostas" ? "nav-propostas" :
                          item.href === "/meus-itens" ? "nav-meus-itens" :
                          item.href === "/configuracoes" ? "nav-configuracoes" : undefined;
            return (
              <Link
                key={item.name}
                to={item.href}
                data-tour={tourId}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all touch-feedback",
                  isActive
                    ? "bg-emerald-50 text-emerald-600"
                    : "text-neutral-600 hover:bg-neutral-100 active:bg-neutral-200"
                )}
              >
                <item.icon className={cn("w-5 h-5", isActive ? "text-emerald-600" : "text-neutral-400")} />
                {item.name}
              </Link>
            );
          })}

          {/* Planos - Levemente destacado */}
          <Link
            to="/upgrade"
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all touch-feedback mt-2",
              location.pathname === "/upgrade"
                ? "bg-emerald-100 text-emerald-700"
                : "bg-emerald-50/70 text-emerald-600 hover:bg-emerald-100/80"
            )}
          >
            <Sparkles className="w-5 h-5 text-emerald-500" />
            Planos
          </Link>

          {/* Admin Link - only for admins */}
          {user?.isAdmin && (
            <Link
              to="/admin"
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all touch-feedback mt-4 border-t border-neutral-100 pt-4",
                location.pathname.startsWith("/admin")
                  ? "bg-neutral-900 text-white"
                  : "text-neutral-600 hover:bg-neutral-100 active:bg-neutral-200"
              )}
            >
              <Shield className={cn("w-5 h-5", location.pathname.startsWith("/admin") ? "text-white" : "text-neutral-400")} />
              Admin
            </Link>
          )}
        </nav>

        {/* User Profile */}
        <div className="p-3 border-t border-neutral-200/80">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-3 w-full p-2 rounded-xl hover:bg-neutral-50 transition-all">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-neutral-900 flex items-center justify-center text-white text-sm font-medium">
                    {user?.initials || "US"}
                  </div>
                )}
                <div className="flex-1 text-left min-w-0">
                  <p className="text-sm font-medium text-neutral-900 truncate">{user?.name || "Usuario"}</p>
                  <p className="text-xs text-neutral-500">
                    {`Plano ${user?.plan || "Grátis"}`}
                  </p>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 rounded-xl">
              <DropdownMenuItem asChild className="rounded-lg">
                <Link to="/configuracoes" className="cursor-pointer">
                  <Settings className="w-4 h-4 mr-2" />
                  Configuracoes
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-red-500 rounded-lg cursor-pointer">
                <LogOut className="w-4 h-4 mr-2" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      <div
        className={cn(
          "lg:hidden fixed inset-0 z-50 bg-black/40 transition-opacity",
          isSidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setIsSidebarOpen(false)}
      />

      {/* Mobile Sidebar */}
      <aside
        className={cn(
          "lg:hidden fixed inset-y-0 left-0 z-50 w-72 bg-white transform transition-transform duration-300 ease-out",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between h-14 px-4 border-b border-neutral-200/80">
          <Logo size="sm" />
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="p-2 rounded-full hover:bg-neutral-100 transition-colors"
          >
            <X className="w-5 h-5 text-neutral-600" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href ||
              location.pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setIsSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all touch-feedback btn-press",
                  isActive
                    ? "bg-emerald-50 text-emerald-600"
                    : "text-neutral-600 active:bg-neutral-100"
                )}
              >
                <item.icon className={cn("w-5 h-5", isActive ? "text-emerald-600" : "text-neutral-400")} />
                {item.name}
              </Link>
            );
          })}

          {/* Planos - Levemente destacado (mobile) */}
          <Link
            to="/upgrade"
            onClick={() => setIsSidebarOpen(false)}
            className={cn(
              "flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all touch-feedback btn-press mt-2",
              location.pathname === "/upgrade"
                ? "bg-emerald-100 text-emerald-700"
                : "bg-emerald-50/70 text-emerald-600 active:bg-emerald-100/80"
            )}
          >
            <Sparkles className="w-5 h-5 text-emerald-500" />
            Planos
          </Link>

          {/* Admin Link - only for admins (mobile) */}
          {user?.isAdmin && (
            <Link
              to="/admin"
              onClick={() => setIsSidebarOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all touch-feedback btn-press mt-4 border-t border-neutral-100 pt-4",
                location.pathname.startsWith("/admin")
                  ? "bg-neutral-900 text-white"
                  : "text-neutral-600 active:bg-neutral-100"
              )}
            >
              <Shield className={cn("w-5 h-5", location.pathname.startsWith("/admin") ? "text-white" : "text-neutral-400")} />
              Admin
            </Link>
          )}
        </nav>

        {/* User Section */}
        <div className="p-3 border-t border-neutral-200/80">
          <Link
            to="/configuracoes"
            onClick={() => setIsSidebarOpen(false)}
            className="flex items-center gap-3 p-2 rounded-xl hover:bg-neutral-50 transition-all mb-2"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-10 h-10 rounded-full object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-neutral-900 flex items-center justify-center text-white text-sm font-medium">
                {user?.initials || "US"}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-neutral-900 truncate">{user?.name || "Usuario"}</p>
              <p className="text-xs text-neutral-500">
                {`Plano ${user?.plan || "Grátis"}`}
              </p>
            </div>
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sair
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 lg:pl-60 overflow-x-hidden">
        {/* Top Bar */}
        <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-lg border-b border-neutral-200/80 h-14 flex items-center justify-between px-4 lg:px-6">
          {/* Mobile Menu Button */}
          <button
            className="lg:hidden p-2 -ml-2 rounded-full hover:bg-neutral-100 active:bg-neutral-200 transition-colors"
            onClick={() => setIsSidebarOpen(true)}
          >
            <Menu className="w-5 h-5 text-neutral-700" />
          </button>

          <div className="flex-1" />

          <div className="flex items-center gap-2">
            {/* Notifications */}
            <DropdownMenu onOpenChange={(open) => open && unreadCount > 0 && markAllAsRead()}>
              <DropdownMenuTrigger asChild>
                <button data-tour="notificacoes" className="relative p-2 rounded-full hover:bg-neutral-100 active:bg-neutral-200 transition-colors">
                  <Bell className="w-5 h-5 text-neutral-600" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 bg-red-500 rounded-full text-[10px] text-white font-bold flex items-center justify-center">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 rounded-xl">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center">
                    <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center mx-auto mb-2">
                      <Bell className="w-5 h-5 text-neutral-400" />
                    </div>
                    <p className="text-sm text-neutral-500">Nenhuma notificacao</p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100">
                      <span className="text-sm font-semibold text-neutral-900">Notificacoes</span>
                      {unreadCount > 0 && (
                        <button
                          onClick={() => markAllAsRead()}
                          className="text-xs text-blue-500 font-medium"
                        >
                          Marcar como lidas
                        </button>
                      )}
                    </div>
                    <div className="max-h-[280px] overflow-y-auto">
                      {notifications.slice(0, 10).map((notification) => (
                        <div
                          key={notification.id}
                          onClick={() => {
                            if (!notification.read) markAsRead(notification.id);
                            if (notification.metadata?.proposalId) {
                              navigate(`/propostas/${notification.metadata.proposalId}`);
                            }
                          }}
                          className={cn(
                            "flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-neutral-50 transition-colors",
                            !notification.read && "bg-blue-50/50"
                          )}
                        >
                          <div className="flex-shrink-0 mt-0.5">
                            {getNotificationIcon(notification.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={cn(
                              "text-sm text-neutral-900",
                              !notification.read && "font-medium"
                            )}>
                              {notification.title}
                            </p>
                            <p className="text-xs text-neutral-500 truncate">
                              {notification.message}
                            </p>
                          </div>
                          <span className="text-[10px] text-neutral-400 flex-shrink-0">
                            {formatTimeAgo(notification.createdAt)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            </div>
        </header>

        {/* Banner de Aviso - Pagamento Atrasado (admin nunca vê) */}
        {planStatus === 'overdue' && !user?.isAdmin && (
          <div className="bg-neutral-900 px-4 py-3">
            <div className="flex items-center gap-3 max-w-4xl mx-auto">
              <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                <CreditCard className="w-4 h-4 text-red-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">
                  Pagamento pendente {daysUntilDowngrade !== null && daysUntilDowngrade > 0 && (
                    <span className="text-red-400">• {daysUntilDowngrade} {daysUntilDowngrade === 1 ? 'dia restante' : 'dias restantes'}</span>
                  )}
                </p>
                <p className="text-xs text-neutral-400">
                  {daysUntilDowngrade !== null && daysUntilDowngrade > 0
                    ? `Regularize para manter acesso ao plano.`
                    : 'Regularize seu pagamento para continuar usando todos os recursos.'}
                </p>
              </div>
              <Link
                to="/upgrade"
                className="flex-shrink-0 px-4 py-2 bg-white hover:bg-neutral-100 text-neutral-900 text-xs font-semibold rounded-full transition-colors"
              >
                Regularizar
              </Link>
            </div>
          </div>
        )}

        {/* Banner de Aviso - Plano Cancelado/Expirado */}
        {(planStatus === 'cancelled' || planStatus === 'expired') && !user?.isAdmin && (
          <div className="bg-red-50 border-b border-red-200 px-4 py-3">
            <div className="flex items-center gap-3 max-w-4xl mx-auto">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-red-800">
                  Seu plano expirou
                </p>
                <p className="text-xs text-red-600">
                  Você está no plano gratuito. Faça upgrade para desbloquear todos os recursos.
                </p>
              </div>
              <Link
                to="/upgrade"
                className="flex-shrink-0 px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-full transition-colors"
              >
                Fazer Upgrade
              </Link>
            </div>
          </div>
        )}

        {/* Banner Trial */}
        {user?.isInTrial && user?.plan === "Grátis" && !user?.isAdmin && (() => {
          const trialDaysLeft = user?.trialEndsAt
            ? Math.max(0, Math.ceil((new Date(user.trialEndsAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))
            : 7;
          const showCoupon = trialDaysLeft <= 1;

          return (
            <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-2.5">
              <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  {showCoupon ? (
                    <>
                      <span className="text-lg">🎁</span>
                      <p className="text-sm text-emerald-800">
                        <span className="font-bold">Último dia!</span>{" "}
                        <span className="hidden sm:inline">Use <span className="font-bold text-emerald-700">FICA10</span> e ganhe 10% OFF</span>
                        <span className="sm:hidden font-bold text-emerald-700">FICA10 = 10% OFF</span>
                      </p>
                    </>
                  ) : (
                    <>
                      <Clock className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <p className="text-sm text-emerald-800">
                        <span className="font-medium">Trial:</span>{" "}
                        {trialDaysLeft} {trialDaysLeft === 1 ? 'dia restante' : 'dias restantes'}
                        <span className="hidden sm:inline text-emerald-600"> — 5 propostas para testar</span>
                      </p>
                    </>
                  )}
                </div>
                <Link
                  to={showCoupon ? "/upgrade?cupom=FICA10" : "/upgrade"}
                  className="flex-shrink-0 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-full transition-colors"
                >
                  {showCoupon ? "Usar Cupom" : "Ver Planos"}
                </Link>
              </div>
            </div>
          );
        })()}

        {/* Banner Trial Expirado com Cupom */}
        {!user?.isInTrial && user?.plan === "Grátis" && !user?.isAdmin && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-2.5">
            <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-lg">🎁</span>
                <p className="text-sm text-emerald-800">
                  <span className="font-medium">Trial expirado</span>
                  <span className="hidden sm:inline"> — Use <span className="font-bold text-emerald-700">VOLTA15</span> e ganhe 15% OFF!</span>
                  <span className="sm:hidden font-bold text-emerald-700"> VOLTA15 = 15% OFF</span>
                </p>
              </div>
              <Link
                to="/upgrade?cupom=VOLTA15"
                className="flex-shrink-0 px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium rounded-full transition-colors"
              >
                Usar Cupom
              </Link>
            </div>
          </div>
        )}

        {/* Page Content */}
        <main className="p-4 lg:p-6 animate-page-in overflow-x-hidden">
          {children}
        </main>
      </div>

      {/* Product Tour */}
      {showTour && user?.id && (
        <ProductTour
          steps={tourSteps}
          userId={user.id}
          onComplete={handleTourComplete}
          onSkip={handleTourComplete}
        />
      )}
    </div>
  );
}
