import { useState, useEffect, useMemo, useCallback } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useProposals, DocType, DOC_TYPE_LABELS, formatSequenceNumber } from "@/contexts/ProposalsContext";
import { useAuth } from "@/contexts/AuthContext";
import { getSupabase } from "@/lib/supabase";
import { PrimeirosPassos } from "@/components/PrimeirosPassos";
import {
  FileText,
  Plus,
  Search,
  MoreVertical,
  Eye,
  Send,
  Trash2,
  Edit,
  Copy,
  Link as LinkIcon,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  TrendingUp,
  User,
  MessageCircle,
  Lock,
  Crown,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type PeriodFilter = "hoje" | "7dias" | "30dias" | "total";

// Formatar moeda
const formatCurrencyShort = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

export default function Propostas() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { proposals, visibleProposals: contextVisibleProposals, hiddenProposalsCount, historyDays, markAsSent, markAsApproved, updateProposal, duplicateProposal, deleteProposal, isLoading } = useProposals();

  // Detecta tipo de documento pela rota: /faturas → fatura, /recibos → recibo, resto → orcamento
  const docTypeFromRoute: DocType = location.pathname.startsWith("/faturas")
    ? "fatura"
    : location.pathname.startsWith("/recibos")
    ? "recibo"
    : "orcamento";
  const docLabel = DOC_TYPE_LABELS[docTypeFromRoute];
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("all");

  // Debounce search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareLink, setShareLink] = useState("");
  const [period, setPeriod] = useState<PeriodFilter>("30dias");
  const [visibleCount, setVisibleCount] = useState(20); // Paginação: mostra 20 por vez
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [hasProfile, setHasProfile] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null);
  const [tourCompleted, setTourCompleted] = useState(false);
  const [hasCustomCatalogItem, setHasCustomCatalogItem] = useState(false);

  // Check if user has profile filled and onboarding status
  useEffect(() => {
    const checkProfile = async () => {
      if (!user) return;
      try {
        // Buscar perfil
        const { data } = await getSupabase()
          .from("profiles")
          .select("company_name, logo_url, onboarding_completed, show_tour")
          .eq("user_id", user.id)
          .single();
        setHasProfile(!!(data?.company_name || data?.logo_url));
        setOnboardingCompleted(data?.onboarding_completed || false);
        setTourCompleted(data?.show_tour === false);

        // Verificar se tem item customizado no catálogo
        const { data: catalogData } = await getSupabase()
          .from("catalog_items")
          .select("id")
          .eq("user_id", user.id)
          .eq("is_custom", true)
          .limit(1);
        setHasCustomCatalogItem((catalogData?.length ?? 0) > 0);
      } catch {
        setHasProfile(false);
        setOnboardingCompleted(false);
        setTourCompleted(false);
        setHasCustomCatalogItem(false);
      } finally {
        setProfileLoaded(true);
      }
    };
    checkProfile();
  }, [user]);

  // Listen for tour completion event
  useEffect(() => {
    const handleTourComplete = () => {
      setTourCompleted(true);
    };
    window.addEventListener("tourComplete", handleTourComplete);
    return () => window.removeEventListener("tourComplete", handleTourComplete);
  }, []);

  const hasProposal = proposals.length > 0;

  const periods: { value: PeriodFilter; label: string }[] = [
    { value: "hoje", label: "Hoje" },
    { value: "7dias", label: "7 dias" },
    { value: "30dias", label: "30 dias" },
    { value: "total", label: "Total" },
  ];

  // Filtrar propostas por período E por tipo de documento (memoized)
  const periodProposals = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    return proposals.filter((p) => {
      // Filtra por docType da rota (default 'orcamento' pra propostas legadas sem doc_type)
      const pDocType = p.docType || "orcamento";
      if (pDocType !== docTypeFromRoute) return false;

      const createdAt = new Date(p.createdAt);

      switch (period) {
        case "hoje":
          return createdAt >= startOfToday;
        case "7dias": {
          const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          return createdAt >= sevenDaysAgo;
        }
        case "30dias": {
          const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          return createdAt >= thirtyDaysAgo;
        }
        case "total":
        default:
          return true;
      }
    });
  }, [proposals, period]);

  // Stats calculations (memoized)
  const stats = useMemo(() => {
    const approved = periodProposals.filter((p) => p.status === "approved");
    const pending = periodProposals.filter((p) => ["sent", "viewed"].includes(p.status));
    const totalApproved = approved.reduce((sum, p) => sum + p.total, 0);
    const totalPending = pending.reduce((sum, p) => sum + p.total, 0);
    const approvalRate = periodProposals.length > 0
      ? Math.round((approved.length / periodProposals.length) * 100)
      : 0;
    const avgTicket = approved.length > 0
      ? Math.round(totalApproved / approved.length)
      : 0;

    // Calcular período anterior para comparação
    const now = new Date();
    let previousStart: Date | null = null;
    let previousEnd: Date | null = null;

    if (period === "7dias") {
      previousStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      previousEnd = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (period === "30dias") {
      previousStart = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
      previousEnd = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    let previousApproved = 0;
    let growthPercent: number | null = null;

    if (previousStart && previousEnd) {
      const previousPeriodApproved = proposals.filter((p) => {
        const createdAt = new Date(p.createdAt);
        return p.status === "approved" && createdAt >= previousStart && createdAt < previousEnd;
      });
      previousApproved = previousPeriodApproved.reduce((sum, p) => sum + p.total, 0);

      if (previousApproved > 0) {
        growthPercent = Math.round(((totalApproved - previousApproved) / previousApproved) * 100);
      } else if (totalApproved > 0) {
        growthPercent = 100; // 100% de crescimento se não tinha nada antes
      }
    }

    return { approved, pending, totalApproved, totalPending, approvalRate, avgTicket, growthPercent };
  }, [periodProposals, proposals, period]);

  const { approved: approvedProposals, totalApproved, totalPending, approvalRate, avgTicket, growthPercent } = stats;

  // Dados para o gráfico de faturamento mensal (últimos 6 meses)
  const chartData = useMemo(() => {
    const months: { month: string; revenue: number; count: number }[] = [];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      const monthName = monthStart.toLocaleDateString("pt-BR", { month: "short" });

      const monthProposals = proposals.filter((p) => {
        const date = new Date(p.createdAt);
        return date >= monthStart && date <= monthEnd && p.status === "approved";
      });

      const revenue = monthProposals.reduce((sum, p) => sum + p.total, 0);

      months.push({
        month: monthName.replace(".", ""),
        revenue,
        count: monthProposals.length,
      });
    }

    return months;
  }, [proposals]);

  const maxRevenue = Math.max(...chartData.map((d) => d.revenue), 1);

  const filters = [
    { value: "all", label: "Todas" },
    { value: "pending", label: "Pendentes" },
    { value: "approved", label: "Aprovadas" },
  ];

  const statusConfig: Record<string, { label: string; icon: typeof CheckCircle; color: string }> = {
    draft: { label: "Rascunho", icon: FileText, color: "text-neutral-400" },
    sent: { label: "Enviada", icon: Send, color: "text-primary" },
    viewed: { label: "Visualizada", icon: Eye, color: "text-primary" },
    approved: { label: "Aprovada", icon: CheckCircle, color: "text-primary" },
    expired: { label: "Expirada", icon: Clock, color: "text-neutral-400" },
  };

  // Filtered proposals (memoized with debounced search)
  // Usa contextVisibleProposals que já está filtrado por limite de histórico
  const filteredProposals = useMemo(() => {
    return contextVisibleProposals.filter((proposal) => {
      const matchesSearch =
        proposal.client.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        proposal.title.toLowerCase().includes(debouncedSearch.toLowerCase());

      let matchesFilter = true;
      if (selectedFilter === "pending") {
        matchesFilter = ["draft", "sent", "viewed"].includes(proposal.status);
      } else if (selectedFilter === "approved") {
        matchesFilter = proposal.status === "approved";
      }
      // "all" shows everything

      return matchesSearch && matchesFilter;
    });
  }, [contextVisibleProposals, debouncedSearch, selectedFilter]);

  // Propostas visíveis (paginação)
  const visibleProposals = useMemo(() => {
    return filteredProposals.slice(0, visibleCount);
  }, [filteredProposals, visibleCount]);

  const hasMoreProposals = filteredProposals.length > visibleCount;

  const loadMore = useCallback(() => {
    setVisibleCount(prev => prev + 20);
  }, []);

  const handleView = useCallback((id: string) => {
    navigate(`/propostas/${id}`);
  }, [navigate]);

  const handleEdit = useCallback((id: string) => {
    navigate(`/propostas/${id}/editar`);
  }, [navigate]);

  const handleDuplicate = useCallback((id: string) => {
    const duplicated = duplicateProposal(id);
    if (duplicated) {
      toast.success("Proposta duplicada!");
    }
  }, [duplicateProposal]);

  const handleDelete = useCallback((id: string) => {
    deleteProposal(id);
    toast.success("Proposta excluida!");
  }, [deleteProposal]);

  const handleSend = useCallback((id: string) => {
    markAsSent(id);
    const proposal = proposals.find(p => p.id === id);
    const link = `https://verproposta.online/p/${proposal?.shortId || id}`;
    setShareLink(link);
    setShareDialogOpen(true);
    toast.success("Proposta enviada!");
  }, [markAsSent, proposals]);

  const handleApprove = useCallback((id: string) => {
    markAsApproved(id, "Aprovado manualmente");
    toast.success("Proposta marcada como aprovada!");
  }, [markAsApproved]);

  const handleUnapprove = useCallback(async (id: string) => {
    await updateProposal(id, { status: "sent" });
    toast.success("Aprovação removida!");
  }, [updateProposal]);

  const handleCopyLink = useCallback(async (id: string) => {
    const proposal = proposals.find(p => p.id === id);
    const link = `https://verproposta.online/p/${proposal?.shortId || id}`;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(link);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = link;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      toast.success("Link copiado!");
    } catch (err) {
      toast.error("Não foi possível copiar o link");
    }
  }, [proposals]);

  const handleSendWhatsApp = useCallback((id: string) => {
    const proposal = proposals.find(p => p.id === id);
    if (!proposal) return;

    const clientPhone = proposal.client?.phone?.replace(/\D/g, '') || '';
    if (!clientPhone) {
      toast.error("Cliente sem telefone cadastrado");
      return;
    }

    const link = `https://verproposta.online/p/${proposal.shortId || id}`;
    const message = `Olá ${proposal.client?.name || ''}! Segue sua proposta:\n\n${link}`;
    const whatsappUrl = `https://wa.me/55${clientPhone}?text=${encodeURIComponent(message)}`;

    window.open(whatsappUrl, '_blank');
  }, [proposals]);

  const formatCurrency = (value: number, short = false) => {
    if (short && value >= 1000) {
      return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        maximumFractionDigits: 0,
      }).format(value);
    }
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Hoje";
    if (diffDays === 1) return "Ontem";
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="flex items-center justify-between pb-4">
          <div>
            <p className="text-xs font-medium text-primary mb-0.5">Propostas</p>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-neutral-900">
              Seus Orçamentos
            </h1>
          </div>
          <Link
            to="/propostas/nova"
            data-tour="nova-proposta"
            className="flex items-center justify-center gap-2 h-10 px-4 bg-primary text-white rounded-full text-sm font-medium fab shadow-lg shadow-primary/25"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Nova Proposta</span>
          </Link>
        </header>

        {/* Primeiros Passos - Checklist (mostra após tour terminar) */}
        {showOnboarding && profileLoaded && !isLoading && tourCompleted && (
          <PrimeirosPassos
            hasProposal={hasProposal}
            hasProfile={hasProfile}
            hasCustomItem={hasCustomCatalogItem}
            tourCompleted={tourCompleted}
            onDismiss={() => setShowOnboarding(false)}
            onComplete={() => setOnboardingCompleted(true)}
            userId={user?.id}
          />
        )}

        {/* Dashboard Stats - só mostra quando tem pelo menos 1 proposta */}
        {hasProposal && (
          <>
        {/* Period Selector */}
        <div className="flex items-center gap-1 mb-4 overflow-x-auto no-scrollbar">
          {periods.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-full transition-all whitespace-nowrap flex-shrink-0 touch-feedback",
                period === p.value
                  ? "bg-primary text-white"
                  : "text-neutral-500 hover:bg-neutral-100 active:bg-neutral-200"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Hero Card - Faturamento */}
        <div className="relative overflow-hidden rounded-2xl bg-primary p-5 text-white mb-4 animate-card-in">
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
                <TrendingUp className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-medium text-white/80">Faturamento</span>
              {growthPercent !== null && (
                <span className={cn(
                  "text-xs font-medium px-1.5 py-0.5 rounded-full",
                  growthPercent >= 0 ? "bg-white/20 text-white" : "bg-red-500/30 text-white"
                )}>
                  {growthPercent >= 0 ? "+" : ""}{growthPercent}%
                </span>
              )}
            </div>
            <p className="text-3xl font-semibold tracking-tight leading-none mb-1">
              {formatCurrency(totalApproved)}
            </p>
            <p className="text-xs text-white/70">
              {approvedProposals.length} {approvedProposals.length === 1 ? 'aprovada' : 'aprovadas'}
              {growthPercent !== null && period !== "total" && period !== "hoje" && (
                <span className="ml-1">• vs período anterior</span>
              )}
            </p>
          </div>
          <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/10" />
          <div className="absolute -right-4 -bottom-12 w-28 h-28 rounded-full bg-white/5" />
        </div>

        {/* Gráfico de Faturamento Mensal */}
        <div className="bg-white rounded-2xl border border-neutral-200 p-4 mb-4 animate-card-in" style={{ animationDelay: '0.1s' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-neutral-900">Faturamento Mensal</h2>
            <span className="text-[10px] text-neutral-400">Últimos 6 meses</span>
          </div>

          {/* Chart */}
          <div className="flex items-end justify-between gap-1.5 h-28">
            {chartData.map((data, index) => (
              <div key={index} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] font-medium text-neutral-600">
                  {data.revenue > 0 ? formatCurrencyShort(data.revenue) : "-"}
                </span>
                <div className="w-full bg-neutral-100 rounded-t-lg relative" style={{ height: "70px" }}>
                  <div
                    className={cn(
                      "absolute bottom-0 left-0 right-0 rounded-t-lg transition-all duration-500",
                      index === chartData.length - 1 ? "bg-primary" : "bg-primary/60"
                    )}
                    style={{
                      height: `${maxRevenue > 0 ? (data.revenue / maxRevenue) * 100 : 0}%`,
                      minHeight: data.revenue > 0 ? "4px" : "0",
                    }}
                  />
                </div>
                <span className="text-[10px] text-neutral-500 capitalize">{data.month}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Performance Stats */}
        <div className="grid grid-cols-4 gap-1.5 sm:gap-2 mb-6">
          <div className="bg-white rounded-xl p-2 sm:p-3 border border-neutral-200/80 overflow-hidden card-lift">
            <p className="text-[10px] sm:text-[11px] text-neutral-500 mb-0.5 truncate">Em aberto</p>
            <p className="text-sm sm:text-lg font-semibold text-neutral-900 truncate">{formatCurrency(totalPending, true)}</p>
          </div>
          <div className="bg-white rounded-xl p-2 sm:p-3 border border-neutral-200/80 overflow-hidden card-lift">
            <p className="text-[10px] sm:text-[11px] text-neutral-500 mb-0.5 truncate">Ticket médio</p>
            <p className="text-sm sm:text-lg font-semibold text-neutral-900 truncate">{avgTicket > 0 ? formatCurrency(avgTicket, true) : "-"}</p>
          </div>
          <div className="bg-white rounded-xl p-2 sm:p-3 border border-neutral-200/80 overflow-hidden card-lift">
            <p className="text-[10px] sm:text-[11px] text-neutral-500 mb-0.5 truncate">Conversão</p>
            <p className="text-sm sm:text-lg font-semibold text-neutral-900 truncate">{approvalRate}%</p>
          </div>
          <div className="bg-white rounded-xl p-2 sm:p-3 border border-neutral-200/80 overflow-hidden card-lift">
            <p className="text-[10px] sm:text-[11px] text-neutral-500 mb-0.5 truncate">Total</p>
            <p className="text-sm sm:text-lg font-semibold text-neutral-900 truncate">{periodProposals.length}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-row gap-2 mb-6">
          <div className="relative flex-1 max-w-[230px] sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 w-4 h-4" />
            <Input
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 rounded-xl border-neutral-200 bg-neutral-50 text-sm h-10"
            />
          </div>

          <Link
            to="/propostas/nova"
            className="flex items-center justify-center gap-2 h-10 w-10 sm:w-auto sm:px-4 bg-primary text-white rounded-full text-sm font-medium shrink-0 fab shadow-lg shadow-primary/25"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Nova Proposta</span>
          </Link>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-0.5 mb-4">
          {filters.map((filter) => (
            <button
              key={filter.value}
              onClick={() => setSelectedFilter(filter.value)}
              className={cn(
                "px-2 py-1.5 text-xs font-medium rounded-full transition-all whitespace-nowrap touch-feedback",
                selectedFilter === filter.value
                  ? "bg-primary text-white"
                  : "text-neutral-500 hover:bg-neutral-100 active:bg-neutral-200"
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {/* Banner de histórico limitado */}
        {hiddenProposalsCount > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 sm:p-4 mb-4 animate-card-in">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <Lock size={18} className="text-amber-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-amber-900 text-sm">
                  +{hiddenProposalsCount} proposta{hiddenProposalsCount !== 1 ? 's' : ''} oculta{hiddenProposalsCount !== 1 ? 's' : ''}
                </p>
                <p className="text-amber-700 text-xs mt-0.5">
                  Plano Grátis mostra apenas os últimos {historyDays} dias
                </p>
              </div>
              <Link
                to="/upgrade"
                className="flex items-center justify-center gap-1 bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium h-8 px-3 rounded-full transition-colors"
              >
                <Crown size={12} />
                Upgrade
              </Link>
            </div>
          </div>
        )}
          </>
        )}

        {/* Empty State - quando não tem propostas */}
        {!hasProposal && profileLoaded && !isLoading && (
          <div className="bg-white rounded-xl border border-neutral-200/80 py-12 text-center mt-4">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <FileText className="w-6 h-6 text-primary" />
            </div>
            <p className="text-base font-semibold text-neutral-900 mb-1">
              Nenhuma proposta ainda
            </p>
            <p className="text-sm text-neutral-500 mb-5 max-w-xs mx-auto">
              Crie sua primeira proposta e envie para seu cliente em minutos
            </p>
            <Link
              to="/propostas/nova"
              className="inline-flex items-center justify-center gap-2 h-11 px-6 bg-primary hover:bg-primary/90 active:bg-primary/80 text-white rounded-full transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Criar Primeira Proposta
            </Link>
          </div>
        )}

        {/* Proposals List - só mostra quando tem propostas */}
        {hasProposal && (
          filteredProposals.length === 0 ? (
            <div className="bg-white rounded-xl border border-neutral-200/80 py-12 text-center">
              <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center mx-auto mb-3">
                <FileText className="w-5 h-5 text-neutral-400" />
              </div>
              <p className="text-sm font-medium text-neutral-900 mb-0.5">
                Nenhuma proposta encontrada
              </p>
              <p className="text-xs text-neutral-500 mb-4">
                Tente ajustar a busca ou filtros
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-neutral-200/80 overflow-hidden animate-card-in">
            <div className="divide-y divide-neutral-100">
              {visibleProposals.map((proposal, index) => {
                const StatusIcon = statusConfig[proposal.status].icon;
                const statusColor = statusConfig[proposal.status].color;

                return (
                  <div
                    key={proposal.id}
                    className="flex items-center gap-3 p-3 hover:bg-neutral-50 active:bg-neutral-100 transition-all touch-feedback list-item-interactive"
                    style={{ animationDelay: `${Math.min(index * 0.03, 0.3)}s` }}
                  >
                    <div
                      onClick={() => handleView(proposal.id)}
                      className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                    >
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <User size={20} className="text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium text-neutral-900 truncate">
                            {proposal.client.name}
                          </p>
                          <StatusIcon className={cn("w-3.5 h-3.5 flex-shrink-0", statusColor)} />
                        </div>
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-neutral-500 truncate">{proposal.title}</p>
                          <span className="text-xs font-medium text-neutral-900 flex-shrink-0">
                            {formatCurrency(proposal.total, true)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <span className="text-[11px] text-neutral-400 flex-shrink-0 hidden sm:block">
                      {formatDate(proposal.createdAt)}
                    </span>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="p-2 rounded-full hover:bg-neutral-100 transition-colors">
                          <MoreVertical className="w-4 h-4 text-neutral-400" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-xl">
                        <DropdownMenuItem onClick={() => handleView(proposal.id)} className="rounded-lg">
                          <Eye className="w-4 h-4 mr-2" />
                          Visualizar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleEdit(proposal.id)} className="rounded-lg">
                          <Edit className="w-4 h-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        {proposal.status === "draft" ? (
                          <DropdownMenuItem onClick={() => handleSend(proposal.id)} className="rounded-lg">
                            <Send className="w-4 h-4 mr-2" />
                            Enviar
                          </DropdownMenuItem>
                        ) : (
                          <>
                            <DropdownMenuItem onClick={() => handleCopyLink(proposal.id)} className="rounded-lg">
                              <LinkIcon className="w-4 h-4 mr-2" />
                              Copiar Link
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleSendWhatsApp(proposal.id)} className="rounded-lg text-green-600">
                              <MessageCircle className="w-4 h-4 mr-2" />
                              Enviar WhatsApp
                            </DropdownMenuItem>
                          </>
                        )}
                        <DropdownMenuItem onClick={() => handleDuplicate(proposal.id)} className="rounded-lg">
                          <Copy className="w-4 h-4 mr-2" />
                          Duplicar
                        </DropdownMenuItem>
                        {proposal.status !== "approved" && proposal.status !== "draft" && (
                          <DropdownMenuItem onClick={() => handleApprove(proposal.id)} className="rounded-lg text-green-600">
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Marcar Aprovada
                          </DropdownMenuItem>
                        )}
                        {proposal.status === "approved" && (
                          <DropdownMenuItem onClick={() => handleUnapprove(proposal.id)} className="rounded-lg text-neutral-600">
                            <XCircle className="w-4 h-4 mr-2" />
                            Remover Aprovação
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleDelete(proposal.id)}
                          className="text-red-500 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                );
              })}
            </div>
            {/* Botão Carregar Mais */}
            {hasMoreProposals && (
              <button
                onClick={loadMore}
                className="w-full py-3 text-sm font-medium text-primary hover:bg-primary/5 transition-colors border-t border-neutral-100"
              >
                Carregar mais ({filteredProposals.length - visibleCount} restantes)
              </button>
            )}
          </div>
          )
        )}

        {/* Share Dialog */}
        <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
          <DialogContent className="rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold">Compartilhar Proposta</DialogTitle>
              <DialogDescription className="text-sm text-neutral-500">
                Envie este link para o cliente visualizar a proposta.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <code className="block w-full bg-neutral-100 px-4 py-3 rounded-xl text-xs break-all text-neutral-700">
                {shareLink}
              </code>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(shareLink);
                    toast.success("Link copiado!");
                  }}
                  className="flex-1 py-3 bg-primary active:bg-primary/80 text-white rounded-full text-sm font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <Copy className="w-4 h-4" />
                  Copiar Link
                </button>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`Ola! Segue sua proposta: ${shareLink}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-3 px-5 bg-[#25D366] active:bg-[#20BD5A] text-white rounded-full text-sm font-medium transition-colors"
                >
                  WhatsApp
                </a>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <div className="h-6" />
      </div>
    </DashboardLayout>
  );
}
