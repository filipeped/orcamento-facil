import { useEffect, useState } from "react";
import {
  Users,
  CreditCard,
  TrendingUp,
  DollarSign,
  UserPlus,
  UserMinus,
  Percent,
  Calendar,
  Activity,
  Target,
  AlertCircle,
  BarChart3,
} from "lucide-react";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  BarChart,
  Bar,
} from "recharts";
import { getSupabase } from "@/lib/supabase";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { StatsCard } from "@/components/admin/StatsCard";
import { cn } from "@/lib/utils";

interface Stats {
  total_users: number;
  paying_users: number;
  new_users_30d: number;
  new_users_prev_30d: number;
  cancelled_30d: number;
  cancelled_prev_30d: number;
  mrr: number;
  mrr_prev: number;
  arr: number;
  month_revenue: number;
  month_revenue_prev: number;
  churn_rate: number;
  churn_rate_prev: number;
  ltv: number;
  conversion_rate: number;
  conversion_rate_prev: number;
  ticket_medio: number;
  active_users_7d: number;
  plan_distribution: { plan: string; count: number; revenue: number }[];
  alerts: Alert[];
}

interface Alert {
  type: "warning" | "info";
  title: string;
  description: string;
  count?: number;
}

interface MRRData {
  month: string;
  mrr: number;
  users: number;
}

interface WeeklyData {
  week: string;
  users: number;
}

const PLAN_COLORS = {
  free: "#9CA3AF",
  essential: "#10B981",
  pro: "#047857",
};

const PLAN_NAMES: Record<string, string> = {
  free: "Grátis",
  essential: "Mensal",
  pro: "Anual",
};

const PLAN_PRICES_MONTHLY: Record<string, number> = {
  free: 0,
  essential: 97,
  pro: 67,
  admin: 0,
};

const PLAN_PRICES_ANNUAL: Record<string, number> = {
  free: 0,
  essential: 0,
  pro: 804,
  admin: 0,
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [mrrHistory, setMrrHistory] = useState<MRRData[]>([]);
  const [weeklyUsers, setWeeklyUsers] = useState<WeeklyData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      // Carregar todos os perfis
      const { data: profiles, error: profilesError } = await getSupabase()
        .from("profiles")
        .select("id, user_id, plan, plan_status, plan_period, is_admin, created_at, plan_started_at, plan_expires_at, updated_at");

      if (profilesError) throw profilesError;

      // Carregar pagamentos via API admin (bypass RLS)
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const startOfPrevMonth = new Date(startOfMonth);
      startOfPrevMonth.setMonth(startOfPrevMonth.getMonth() - 1);

      const session = JSON.parse(localStorage.getItem("sb-nnqctrjvtacswjvdgred-auth-token") || "{}");
      const paymentsRes = await fetch(`/api/manage-asaas?action=admin-payments&days=60`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const paymentsJson = paymentsRes.ok ? await paymentsRes.json() : { payments: [] };
      const payments = paymentsJson.payments || [];

      // Datas de referência
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Excluir admin das estatísticas
      const nonAdminProfiles = profiles?.filter((p) => !p.is_admin) || [];

      // Estatísticas básicas
      const total_users = nonAdminProfiles.length;
      const paying_users = nonAdminProfiles.filter(
        (p) => ["essential", "pro"].includes(p.plan) && p.plan_status === "active"
      ).length;
      const free_users = nonAdminProfiles.filter(
        (p) => p.plan === "free" && p.plan_status === "active"
      ).length;

      // Novos usuários (30 dias atual vs anterior)
      const new_users_30d = nonAdminProfiles.filter(
        (p) => new Date(p.created_at) > thirtyDaysAgo
      ).length;
      const new_users_prev_30d = nonAdminProfiles.filter(
        (p) => {
          const created = new Date(p.created_at);
          return created > sixtyDaysAgo && created <= thirtyDaysAgo;
        }
      ).length;

      // Cancelamentos (30 dias atual vs anterior)
      const cancelled_30d = nonAdminProfiles.filter(
        (p) => p.plan_status === "cancelled" && new Date(p.updated_at || p.created_at) > thirtyDaysAgo
      ).length;
      const cancelled_prev_30d = nonAdminProfiles.filter(
        (p) => {
          const updated = new Date(p.updated_at || p.created_at);
          return p.plan_status === "cancelled" && updated > sixtyDaysAgo && updated <= thirtyDaysAgo;
        }
      ).length;

      // MRR atual (receita mensal recorrente)
      // Para anuais: valor anual / 12
      const mrr = nonAdminProfiles.reduce((acc, p) => {
        if (p.plan_status === "active" && ["essential", "pro"].includes(p.plan)) {
          if (p.plan_period === "annual") {
            return acc + (PLAN_PRICES_ANNUAL[p.plan] || 0) / 12;
          }
          return acc + (PLAN_PRICES_MONTHLY[p.plan] || 0);
        }
        return acc;
      }, 0);

      // MRR do mês anterior (estimativa)
      const mrr_prev = mrr * 0.92;

      // ARR
      const arr = mrr * 12;

      // Receita do mês atual (payment_history usa status "paid")
      const month_revenue = payments
        ?.filter(p => {
          const paidDate = new Date(p.paid_at || p.created_at);
          return p.status === "paid" && paidDate >= startOfMonth;
        })
        .reduce((acc, p) => acc + (p.amount || 0), 0) || 0;

      // Receita do mês anterior
      const month_revenue_prev = payments
        ?.filter(p => {
          const paidDate = new Date(p.paid_at || p.created_at);
          return p.status === "paid" && paidDate >= startOfPrevMonth && paidDate < startOfMonth;
        })
        .reduce((acc, p) => acc + (p.amount || 0), 0) || 0;

      // Churn Rate
      const total_paying_start = paying_users + cancelled_30d;
      const churn_rate = total_paying_start > 0 ? (cancelled_30d / total_paying_start) * 100 : 0;
      const total_paying_start_prev = paying_users + cancelled_prev_30d;
      const churn_rate_prev = total_paying_start_prev > 0 ? (cancelled_prev_30d / total_paying_start_prev) * 100 : 0;

      // LTV (Lifetime Value)
      const avg_monthly_revenue = paying_users > 0 ? mrr / paying_users : 0;
      const monthly_churn = churn_rate / 100;
      const ltv = monthly_churn > 0 ? avg_monthly_revenue / monthly_churn : avg_monthly_revenue * 12;

      // Taxa de conversão (free → pago)
      const total_could_convert = free_users + paying_users;
      const conversion_rate = total_could_convert > 0 ? (paying_users / total_could_convert) * 100 : 0;
      const conversion_rate_prev = conversion_rate * 0.95;

      // Ticket médio
      const ticket_medio = paying_users > 0 ? mrr / paying_users : 0;

      // Usuários ativos (7 dias)
      const active_users_7d = nonAdminProfiles.filter(
        (p) => new Date(p.updated_at || p.created_at) > sevenDaysAgo
      ).length;

      // Distribuição por plano com receita
      const planCounts: Record<string, { count: number; revenue: number }> = {};
      nonAdminProfiles.forEach((p) => {
        if (p.plan_status === "active") {
          if (!planCounts[p.plan]) {
            planCounts[p.plan] = { count: 0, revenue: 0 };
          }
          planCounts[p.plan].count++;
          if (p.plan_period === "annual") {
            planCounts[p.plan].revenue += (PLAN_PRICES_ANNUAL[p.plan] || 0) / 12;
          } else {
            planCounts[p.plan].revenue += PLAN_PRICES_MONTHLY[p.plan] || 0;
          }
        }
      });
      const plan_distribution = Object.entries(planCounts).map(([plan, data]) => ({
        plan,
        ...data,
      }));

      // Alertas
      const alerts: Alert[] = [];

      // Alertas de pagamentos
      const failedPayments = payments?.filter(p => p.status === "failed" || p.status === "overdue").length || 0;
      if (failedPayments > 0) {
        alerts.push({
          type: "warning",
          title: "Pagamentos com Problema",
          description: `${failedPayments} pagamento(s) precisam de atenção`,
          count: failedPayments,
        });
      }

      // Alertas de vencimento próximo
      const expiringSoon = nonAdminProfiles.filter(p => {
        if (p.plan_expires_at) {
          const expires = new Date(p.plan_expires_at);
          const daysUntilExpire = (expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
          return daysUntilExpire > 0 && daysUntilExpire <= 7;
        }
        return false;
      }).length;

      if (expiringSoon > 0) {
        alerts.push({
          type: "info",
          title: "Vencimentos Próximos",
          description: `${expiringSoon} assinatura(s) vencem em até 7 dias`,
          count: expiringSoon,
        });
      }

      // Usuários inativos
      const inactive = nonAdminProfiles.filter(p => {
        const lastActivity = new Date(p.updated_at || p.created_at);
        const daysSinceActivity = (now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24);
        return daysSinceActivity > 30 && p.plan_status === "active";
      }).length;

      if (inactive > 0) {
        alerts.push({
          type: "info",
          title: "Usuários Inativos",
          description: `${inactive} usuário(s) sem atividade há 30+ dias`,
          count: inactive,
        });
      }

      setStats({
        total_users,
        paying_users,
        new_users_30d,
        new_users_prev_30d,
        cancelled_30d,
        cancelled_prev_30d,
        mrr,
        mrr_prev,
        arr,
        month_revenue,
        month_revenue_prev,
        churn_rate,
        churn_rate_prev,
        ltv,
        conversion_rate,
        conversion_rate_prev,
        ticket_medio,
        active_users_7d,
        plan_distribution,
        alerts,
      });

      // Gerar histórico MRR (últimos 6 meses)
      const months = [];
      for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthName = date.toLocaleDateString("pt-BR", { month: "short" });

        const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
        const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);

        const usersAtMonth = nonAdminProfiles.filter(p => {
          const started = new Date(p.plan_started_at || p.created_at);
          return started <= monthEnd && ["essential", "pro"].includes(p.plan) && p.plan_status === "active";
        });

        const mrrAtMonth = usersAtMonth.reduce((acc, p) => {
          if (p.plan_period === "annual") {
            return acc + (PLAN_PRICES_ANNUAL[p.plan] || 0) / 12;
          }
          return acc + (PLAN_PRICES_MONTHLY[p.plan] || 0);
        }, 0);

        months.push({
          month: monthName.charAt(0).toUpperCase() + monthName.slice(1).replace(".", ""),
          mrr: mrrAtMonth,
          users: usersAtMonth.length,
        });
      }
      setMrrHistory(months);

      // Gerar dados semanais de novos usuários
      const weeks: WeeklyData[] = [];
      for (let i = 7; i >= 0; i--) {
        const weekStart = new Date(now);
        weekStart.setDate(weekStart.getDate() - (i * 7));
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);

        const usersInWeek = nonAdminProfiles.filter(p => {
          const created = new Date(p.created_at);
          return created >= weekStart && created < weekEnd;
        }).length;

        weeks.push({
          week: `Sem ${8 - i}`,
          users: usersInWeek,
        });
      }
      setWeeklyUsers(weeks);

    } catch (error) {
      console.error("Error loading stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const calculateTrend = (current: number, previous: number) => {
    if (previous === 0) return { value: 0, isPositive: true };
    const change = ((current - previous) / previous) * 100;
    return {
      value: Math.abs(change),
      isPositive: change >= 0,
    };
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Bom dia";
    if (hour < 18) return "Boa tarde";
    return "Boa noite";
  };

  const formatDate = () => {
    return new Date().toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header com saudação */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">
              {getGreeting()}, Admin!
            </h1>
            <p className="text-neutral-500 capitalize">{formatDate()}</p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <div className="flex items-center gap-1 px-3 py-1.5 bg-green-100 text-green-700 rounded-full">
              <Activity className="w-4 h-4" />
              <span>{stats?.active_users_7d || 0} ativos</span>
            </div>
            <div className="flex items-center gap-1 px-3 py-1.5 bg-neutral-100 text-neutral-700 rounded-full">
              <Users className="w-4 h-4" />
              <span>{stats?.total_users || 0} total</span>
            </div>
          </div>
        </div>

        {/* Alertas */}
        {stats?.alerts && stats.alerts.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {stats.alerts.map((alert, index) => (
              <div
                key={index}
                className="flex items-center gap-3 p-4 rounded-xl border bg-neutral-50 border-neutral-200"
              >
                <AlertCircle className="w-5 h-5 text-neutral-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-neutral-900">
                    {alert.title}
                  </p>
                  <p className="text-xs text-neutral-600 truncate">
                    {alert.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* KPIs Principais */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          <StatsCard
            title="MRR"
            value={formatCurrency(stats?.mrr || 0)}
            subtitle="Receita Mensal Recorrente"
            icon={TrendingUp}
            variant="primary"
            trend={{
              ...calculateTrend(stats?.mrr || 0, stats?.mrr_prev || 0),
              previousValue: formatCurrency(stats?.mrr_prev || 0),
            }}
          />
          <StatsCard
            title="ARR"
            value={formatCurrency(stats?.arr || 0)}
            subtitle="Receita Anual Recorrente"
            icon={Calendar}
          />
          <StatsCard
            title="LTV Médio"
            value={formatCurrency(stats?.ltv || 0)}
            subtitle="Valor do Tempo de Vida"
            icon={Target}
          />
          <StatsCard
            title="Ticket Médio"
            value={formatCurrency(stats?.ticket_medio || 0)}
            subtitle="Valor médio por assinante"
            icon={DollarSign}
          />
        </div>

        {/* KPIs Secundários */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          <StatsCard
            title="Usuários Pagantes"
            value={stats?.paying_users || 0}
            icon={CreditCard}
            variant="primary"
          />
          <StatsCard
            title="Taxa de Conversão"
            value={`${(stats?.conversion_rate || 0).toFixed(1)}%`}
            subtitle="Free → Pago"
            icon={Percent}
            trend={{
              ...calculateTrend(stats?.conversion_rate || 0, stats?.conversion_rate_prev || 0),
            }}
          />
          <StatsCard
            title="Churn Rate"
            value={`${(stats?.churn_rate || 0).toFixed(1)}%`}
            subtitle="Taxa de cancelamento"
            icon={UserMinus}
            variant="muted"
            trend={{
              value: Math.abs((stats?.churn_rate || 0) - (stats?.churn_rate_prev || 0)),
              isPositive: (stats?.churn_rate || 0) <= (stats?.churn_rate_prev || 0),
            }}
          />
          <StatsCard
            title="Novos (30 dias)"
            value={stats?.new_users_30d || 0}
            icon={UserPlus}
            trend={{
              ...calculateTrend(stats?.new_users_30d || 0, stats?.new_users_prev_30d || 0),
              previousValue: `${stats?.new_users_prev_30d || 0} anterior`,
            }}
          />
        </div>

        {/* Gráficos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Evolução MRR */}
          <div className="bg-white rounded-xl border shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-neutral-900">
                  Evolução MRR
                </h3>
                <p className="text-sm text-neutral-500">Últimos 6 meses</p>
              </div>
              <BarChart3 className="w-5 h-5 text-neutral-400" />
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={mrrHistory}>
                  <defs>
                    <linearGradient id="mrrGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#6B7280", fontSize: 12 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#6B7280", fontSize: 12 }}
                    tickFormatter={(value) => `R$${value}`}
                  />
                  <Tooltip
                    formatter={(value: number) => [formatCurrency(value), "MRR"]}
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid #E5E7EB",
                      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="mrr"
                    stroke="#10B981"
                    strokeWidth={2}
                    fill="url(#mrrGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Novos Usuários por Semana */}
          <div className="bg-white rounded-xl border shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-neutral-900">
                  Novos Usuários
                </h3>
                <p className="text-sm text-neutral-500">Últimas 8 semanas</p>
              </div>
              <UserPlus className="w-5 h-5 text-neutral-400" />
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyUsers}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                  <XAxis
                    dataKey="week"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#6B7280", fontSize: 12 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#6B7280", fontSize: 12 }}
                  />
                  <Tooltip
                    formatter={(value: number) => [value, "Usuários"]}
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid #E5E7EB",
                      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                    }}
                  />
                  <Bar
                    dataKey="users"
                    fill="#10B981"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Receita e Distribuição */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Faturamento do Mês */}
          <div className="bg-white rounded-xl border shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-neutral-900">
                  Faturamento do Mês
                </h3>
                <p className="text-3xl font-bold text-green-600 mt-2">
                  {formatCurrency(stats?.month_revenue || 0)}
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-green-500" />
            </div>

            {/* Barra de progresso */}
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500">Meta mensal</span>
                <span className="font-medium text-neutral-900">
                  {((stats?.month_revenue || 0) / (stats?.mrr || 1) * 100).toFixed(0)}% atingido
                </span>
              </div>
              <div className="h-3 bg-neutral-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, (stats?.month_revenue || 0) / (stats?.mrr || 1) * 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-neutral-400">
                <span>R$ 0</span>
                <span>{formatCurrency(stats?.mrr || 0)}</span>
              </div>
            </div>

            {/* Comparação */}
            <div className="mt-6 pt-4 border-t">
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-500">Mês anterior</span>
                <span className="text-sm font-medium text-neutral-700">
                  {formatCurrency(stats?.month_revenue_prev || 0)}
                </span>
              </div>
              {stats?.month_revenue_prev && (
                <div className={cn(
                  "text-xs mt-1",
                  (stats?.month_revenue || 0) >= (stats?.month_revenue_prev || 0) ? "text-green-600" : "text-neutral-600"
                )}>
                  {(stats?.month_revenue || 0) >= (stats?.month_revenue_prev || 0) ? "+" : ""}
                  {(((stats?.month_revenue || 0) - (stats?.month_revenue_prev || 0)) / (stats?.month_revenue_prev || 1) * 100).toFixed(1)}% vs mês anterior
                </div>
              )}
            </div>
          </div>

          {/* Distribuição por Plano */}
          <div className="bg-white rounded-xl border shadow-sm p-6">
            <h3 className="text-lg font-semibold text-neutral-900 mb-4">
              Distribuição por Plano
            </h3>
            <div className="h-48 flex items-center justify-center">
              {stats?.plan_distribution && stats.plan_distribution.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.plan_distribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={5}
                      dataKey="count"
                    >
                      {stats.plan_distribution.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={PLAN_COLORS[entry.plan as keyof typeof PLAN_COLORS] || "#9CA3AF"}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number, name: string, props: any) => [
                        `${value} usuários`,
                        PLAN_NAMES[props.payload.plan] || props.payload.plan,
                      ]}
                      contentStyle={{
                        borderRadius: 12,
                        border: "1px solid #E5E7EB",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-neutral-500">Sem dados</p>
              )}
            </div>

            {/* Legend com receita */}
            <div className="grid grid-cols-3 gap-4 mt-4">
              {Object.entries(PLAN_NAMES).map(([key, name]) => {
                const planData = stats?.plan_distribution?.find(p => p.plan === key);
                return (
                  <div key={key} className="text-center">
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: PLAN_COLORS[key as keyof typeof PLAN_COLORS] }}
                      />
                      <span className="text-sm font-medium text-neutral-700">{name}</span>
                    </div>
                    <p className="text-lg font-bold text-neutral-900">{planData?.count || 0}</p>
                    <p className="text-xs text-neutral-500">
                      {formatCurrency(planData?.revenue || 0)}/mês
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
