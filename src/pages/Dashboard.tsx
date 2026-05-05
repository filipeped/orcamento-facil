import { useMemo } from "react";
import { Link } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useProposals } from "@/contexts/ProposalsContext";
import {
  TrendingUp,
  TrendingDown,
  FileText,
  CheckCircle,
  Clock,
  Users,
  DollarSign,
  ArrowRight,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function Dashboard() {
  const { proposals } = useProposals();

  // Estatísticas gerais
  const stats = useMemo(() => {
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    // Propostas do mês atual
    const thisMonthProposals = proposals.filter(
      (p) => new Date(p.createdAt) >= thisMonth
    );
    const thisMonthApproved = thisMonthProposals.filter((p) => p.status === "approved");
    const thisMonthRevenue = thisMonthApproved.reduce((sum, p) => sum + p.total, 0);

    // Propostas do mês passado
    const lastMonthProposals = proposals.filter(
      (p) => new Date(p.createdAt) >= lastMonth && new Date(p.createdAt) <= lastMonthEnd
    );
    const lastMonthApproved = lastMonthProposals.filter((p) => p.status === "approved");
    const lastMonthRevenue = lastMonthApproved.reduce((sum, p) => sum + p.total, 0);

    // Calcular variação
    const revenueChange = lastMonthRevenue > 0
      ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
      : thisMonthRevenue > 0 ? 100 : 0;

    // Taxa de conversão
    const conversionRate = thisMonthProposals.length > 0
      ? (thisMonthApproved.length / thisMonthProposals.length) * 100
      : 0;

    // Ticket médio
    const avgTicket = thisMonthApproved.length > 0
      ? thisMonthRevenue / thisMonthApproved.length
      : 0;

    // Clientes únicos
    const uniqueClients = new Set(proposals.map((p) => p.client.phone || p.client.name)).size;

    return {
      thisMonthRevenue,
      revenueChange,
      thisMonthProposals: thisMonthProposals.length,
      thisMonthApproved: thisMonthApproved.length,
      conversionRate,
      avgTicket,
      uniqueClients,
      pendingCount: thisMonthProposals.filter((p) => ["sent", "viewed"].includes(p.status)).length,
    };
  }, [proposals]);

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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Propostas recentes
  const recentProposals = useMemo(() => {
    return [...proposals]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
  }, [proposals]);

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="flex items-center justify-between pb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
              Dashboard
            </h1>
            <p className="text-sm text-neutral-500 mt-1">
              Visão geral do seu negócio
            </p>
          </div>
          <Button asChild>
            <Link to="/propostas/nova">
              <Plus size={16} className="mr-2" />
              Nova Proposta
            </Link>
          </Button>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          {/* Faturamento */}
          <div className="bg-white rounded-2xl border border-neutral-200 p-4 sm:p-5 animate-card-in card-lift">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-neutral-500">Faturamento</span>
              <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center">
                <DollarSign size={18} className="text-green-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-neutral-900">
              {formatCurrency(stats.thisMonthRevenue)}
            </p>
            <div className="flex items-center gap-1 mt-1">
              {stats.revenueChange >= 0 ? (
                <TrendingUp size={14} className="text-green-500" />
              ) : (
                <TrendingDown size={14} className="text-red-500" />
              )}
              <span className={cn(
                "text-xs font-medium",
                stats.revenueChange >= 0 ? "text-green-600" : "text-red-600"
              )}>
                {stats.revenueChange >= 0 ? "+" : ""}{stats.revenueChange.toFixed(0)}% vs mês anterior
              </span>
            </div>
          </div>

          {/* Propostas */}
          <div className="bg-white rounded-2xl border border-neutral-200 p-4 sm:p-5 animate-card-in stagger-1 card-lift">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-neutral-500">Propostas</span>
              <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center">
                <FileText size={18} className="text-green-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-neutral-900">
              {stats.thisMonthProposals}
            </p>
            <p className="text-xs text-neutral-500 mt-1">
              {stats.thisMonthApproved} aprovadas este mês
            </p>
          </div>

          {/* Conversão */}
          <div className="bg-white rounded-2xl border border-neutral-200 p-4 sm:p-5 animate-card-in stagger-2 card-lift">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-neutral-500">Conversão</span>
              <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center">
                <CheckCircle size={18} className="text-green-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-neutral-900">
              {stats.conversionRate.toFixed(0)}%
            </p>
            <p className="text-xs text-neutral-500 mt-1">
              {stats.pendingCount} pendentes
            </p>
          </div>

          {/* Clientes */}
          <div className="bg-white rounded-2xl border border-neutral-200 p-4 sm:p-5 animate-card-in stagger-3 card-lift">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-neutral-500">Clientes</span>
              <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center">
                <Users size={18} className="text-green-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-neutral-900">
              {stats.uniqueClients}
            </p>
            <p className="text-xs text-neutral-500 mt-1">
              Ticket médio: {formatCurrency(stats.avgTicket)}
            </p>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Gráfico de Faturamento */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-neutral-200 p-5 animate-card-in stagger-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-semibold text-neutral-900">Faturamento Mensal</h2>
              <span className="text-xs text-neutral-400">Últimos 6 meses</span>
            </div>

            {/* Chart */}
            <div className="flex items-end justify-between gap-2 h-48">
              {chartData.map((data, index) => (
                <div key={index} className="flex-1 flex flex-col items-center gap-2">
                  <span className="text-xs font-medium text-neutral-600">
                    {data.revenue > 0 ? formatCurrency(data.revenue) : "-"}
                  </span>
                  <div className="w-full bg-neutral-100 rounded-t-lg relative" style={{ height: "140px" }}>
                    <div
                      className={cn(
                        "absolute bottom-0 left-0 right-0 rounded-t-lg transition-all duration-500",
                        index === chartData.length - 1 ? "bg-primary" : "bg-primary/60"
                      )}
                      style={{
                        height: `${maxRevenue > 0 ? (data.revenue / maxRevenue) * 100 : 0}%`,
                        minHeight: data.revenue > 0 ? "8px" : "0",
                      }}
                    />
                  </div>
                  <span className="text-xs text-neutral-500 capitalize">{data.month}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Propostas Recentes */}
          <div className="bg-white rounded-2xl border border-neutral-200 p-5 animate-card-in stagger-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-neutral-900">Recentes</h2>
              <Link to="/propostas" className="text-xs text-primary hover:underline">
                Ver todas
              </Link>
            </div>

            {recentProposals.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="w-10 h-10 text-neutral-300 mx-auto mb-2" />
                <p className="text-sm text-neutral-500">Nenhuma proposta ainda</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentProposals.map((proposal) => (
                  <Link
                    key={proposal.id}
                    to={`/propostas/${proposal.id}`}
                    className="flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-neutral-50 active:bg-neutral-100 transition-all touch-feedback list-item-interactive"
                  >
                    <div className={cn(
                      "w-2 h-2 rounded-full",
                      proposal.status === "approved" ? "bg-green-500" :
                      proposal.status === "viewed" ? "bg-green-400" :
                      proposal.status === "sent" ? "bg-neutral-400" : "bg-neutral-300"
                    )} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-neutral-900 truncate">
                        {proposal.client.name}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {formatCurrency(proposal.total)}
                      </p>
                    </div>
                    <ArrowRight size={14} className="text-neutral-400" />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
