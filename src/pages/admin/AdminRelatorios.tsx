import { useEffect, useState } from "react";
import {
  DollarSign,
  Users,
  TrendingUp,
  FileText,
  Download,
  RefreshCw,
  Filter,
  CheckCircle,
  Clock,
  AlertCircle,
} from "lucide-react";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import { getSupabase } from "@/lib/supabase";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface RevenueData {
  period: string;
  revenue: number;
  payments: number;
}

interface RetentionData {
  cohort: string;
  month1: number;
  month2: number;
  month3: number;
  month4: number;
  month5: number;
  month6: number;
}

interface TopUser {
  id: string;
  full_name: string;
  company_name?: string;
  proposals_count: number;
  plan: string;
  created_at: string;
}

interface PaymentSummary {
  confirmed: number;
  pending: number;
  failed: number;
  total_value: number;
  confirmed_value: number;
  pending_value: number;
  failed_value: number;
}

const PLAN_COLORS: Record<string, string> = {
  free: "#9CA3AF",
  essential: "#10B981",
  pro: "#047857",
};

const PLAN_NAMES: Record<string, string> = {
  free: "Grátis",
  essential: "Mensal",
  pro: "Anual",
};

export default function AdminRelatorios() {
  const [period, setPeriod] = useState("30");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [revenueData, setRevenueData] = useState<RevenueData[]>([]);
  const [retentionData, setRetentionData] = useState<RetentionData[]>([]);
  const [topUsers, setTopUsers] = useState<TopUser[]>([]);
  const [paymentSummary, setPaymentSummary] = useState<PaymentSummary | null>(null);

  useEffect(() => {
    loadData();
  }, [period]);

  const loadData = async () => {
    setRefreshing(true);
    try {
      const days = parseInt(period);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Carregar pagamentos via API admin (bypass RLS)
      const session = JSON.parse(localStorage.getItem("sb-nnqctrjvtacswjvdgred-auth-token") || "{}");
      const paymentsRes = await fetch(`/api/manage-asaas?action=admin-payments&days=${days}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const paymentsJson = paymentsRes.ok ? await paymentsRes.json() : { payments: [] };
      const payments = paymentsJson.payments || [];

      // Carregar perfis
      const { data: profiles } = await getSupabase()
        .from("profiles")
        .select("id, user_id, full_name, company_name, plan, plan_status, created_at, plan_started_at");

      // Carregar propostas
      const { data: proposals } = await getSupabase()
        .from("proposals")
        .select("id, user_id, created_at");

      // Processar dados de receita por período
      const revenueByPeriod: Record<string, { revenue: number; payments: number }> = {};

      if (days <= 30) {
        // Agrupar por dia
        payments?.forEach(p => {
          const date = new Date(p.paid_at || p.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
          if (!revenueByPeriod[date]) {
            revenueByPeriod[date] = { revenue: 0, payments: 0 };
          }
          if (p.status === "paid") {
            revenueByPeriod[date].revenue += p.amount || 0;
          }
          revenueByPeriod[date].payments++;
        });
      } else {
        // Agrupar por semana
        payments?.forEach(p => {
          const date = new Date(p.paid_at || p.created_at);
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          const weekLabel = weekStart.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

          if (!revenueByPeriod[weekLabel]) {
            revenueByPeriod[weekLabel] = { revenue: 0, payments: 0 };
          }
          if (p.status === "paid") {
            revenueByPeriod[weekLabel].revenue += p.amount || 0;
          }
          revenueByPeriod[weekLabel].payments++;
        });
      }

      setRevenueData(
        Object.entries(revenueByPeriod).map(([period, data]) => ({
          period,
          ...data,
        }))
      );

      // Calcular resumo de pagamentos (payment_history usa status "paid")
      const confirmed = payments?.filter(p => p.status === "paid") || [];
      const pending = payments?.filter(p => p.status === "pending") || [];
      const failed = payments?.filter(p => p.status === "failed" || p.status === "overdue" || p.status === "refunded") || [];

      setPaymentSummary({
        confirmed: confirmed.length,
        pending: pending.length,
        failed: failed.length,
        total_value: payments?.reduce((acc, p) => acc + (p.amount || 0), 0) || 0,
        confirmed_value: confirmed.reduce((acc, p) => acc + (p.amount || 0), 0),
        pending_value: pending.reduce((acc, p) => acc + (p.amount || 0), 0),
        failed_value: failed.reduce((acc, p) => acc + (p.amount || 0), 0),
      });

      // Top usuários por propostas
      const userProposalCounts: Record<string, number> = {};
      proposals?.forEach(p => {
        userProposalCounts[p.user_id] = (userProposalCounts[p.user_id] || 0) + 1;
      });

      const sortedUsers = Object.entries(userProposalCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10);

      const topUsersData = sortedUsers.map(([userId, count]) => {
        const profile = profiles?.find(p => p.user_id === userId);
        return {
          id: userId,
          full_name: profile?.full_name || "Usuário",
          company_name: profile?.company_name,
          proposals_count: count,
          plan: profile?.plan || "free",
          created_at: profile?.created_at || "",
        };
      });

      setTopUsers(topUsersData);

      // Dados de retenção simplificado (coorte por mês de cadastro)
      const now = new Date();
      const cohortData: RetentionData[] = [];

      for (let i = 5; i >= 0; i--) {
        const cohortDate = new Date(now);
        cohortDate.setMonth(cohortDate.getMonth() - i);
        const cohortMonth = cohortDate.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });

        // Usuários que se cadastraram nesse mês
        const cohortUsers = profiles?.filter(p => {
          const created = new Date(p.created_at);
          return created.getMonth() === cohortDate.getMonth() &&
                 created.getFullYear() === cohortDate.getFullYear();
        }) || [];

        const totalCohort = cohortUsers.length;

        // Calcular retenção por mês subsequente
        const retention: number[] = [];
        for (let m = 1; m <= 6; m++) {
          if (i + m > 5) {
            retention.push(0);
          } else {
            const retainedUsers = cohortUsers.filter(u => {
              return u.plan_status === "active";
            }).length;
            retention.push(totalCohort > 0 ? Math.round((retainedUsers / totalCohort) * 100) : 0);
          }
        }

        cohortData.push({
          cohort: cohortMonth.charAt(0).toUpperCase() + cohortMonth.slice(1).replace(".", ""),
          month1: retention[0],
          month2: retention[1],
          month3: retention[2],
          month4: retention[3],
          month5: retention[4],
          month6: retention[5],
        });
      }

      setRetentionData(cohortData);

    } catch (error) {
      console.error("Error loading report data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const exportCSV = () => {
    const headers = ["Período", "Receita", "Pagamentos"];
    const rows = revenueData.map(d => [d.period, d.revenue, d.payments]);
    const csv = [headers, ...rows].map(row => row.join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-receita-${period}dias.csv`;
    a.click();
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">Relatórios</h1>
            <p className="text-neutral-500">Análises avançadas e métricas detalhadas</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="h-10 w-44 pl-9 pr-3 rounded-md border border-input bg-background text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 appearance-none"
              >
                <option value="7">Últimos 7 dias</option>
                <option value="30">Últimos 30 dias</option>
                <option value="90">Últimos 90 dias</option>
                <option value="180">Últimos 6 meses</option>
              </select>
            </div>
            <Button variant="outline" onClick={loadData} disabled={refreshing}>
              <RefreshCw className={cn("w-4 h-4 mr-2", refreshing && "animate-spin")} />
              Atualizar
            </Button>
            <Button onClick={exportCSV}>
              <Download className="w-4 h-4 mr-2" />
              Exportar
            </Button>
          </div>
        </div>

        {/* Resumo de Pagamentos */}
        {paymentSummary && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border shadow-sm p-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-100 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm text-neutral-500">Confirmados</p>
                  <p className="text-xl font-bold text-neutral-900">{paymentSummary.confirmed}</p>
                  <p className="text-sm text-emerald-600 font-medium">
                    {formatCurrency(paymentSummary.confirmed_value)}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border shadow-sm p-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-neutral-100 rounded-lg">
                  <Clock className="w-5 h-5 text-neutral-600" />
                </div>
                <div>
                  <p className="text-sm text-neutral-500">Pendentes</p>
                  <p className="text-xl font-bold text-neutral-900">{paymentSummary.pending}</p>
                  <p className="text-sm text-neutral-600 font-medium">
                    {formatCurrency(paymentSummary.pending_value)}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border shadow-sm p-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-neutral-100 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-neutral-600" />
                </div>
                <div>
                  <p className="text-sm text-neutral-500">Com Problema</p>
                  <p className="text-xl font-bold text-neutral-900">{paymentSummary.failed}</p>
                  <p className="text-sm text-neutral-600 font-medium">
                    {formatCurrency(paymentSummary.failed_value)}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl shadow-sm p-5 text-white">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/20 rounded-lg">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm text-emerald-100">Receita Total</p>
                  <p className="text-xl font-bold">{formatCurrency(paymentSummary.confirmed_value)}</p>
                  <p className="text-sm text-emerald-200">
                    {paymentSummary.confirmed + paymentSummary.pending + paymentSummary.failed} pagamentos
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Gráfico de Receita */}
        <div className="bg-white rounded-xl border shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-neutral-900">
                Receita por Período
              </h3>
              <p className="text-sm text-neutral-500">
                Evolução da receita confirmada
              </p>
            </div>
            <TrendingUp className="w-5 h-5 text-neutral-400" />
          </div>
          <div className="h-72">
            {revenueData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                  <XAxis
                    dataKey="period"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#6B7280", fontSize: 11 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#6B7280", fontSize: 12 }}
                    tickFormatter={(value) => `R$${value}`}
                  />
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      name === "revenue" ? formatCurrency(value) : value,
                      name === "revenue" ? "Receita" : "Pagamentos",
                    ]}
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid #E5E7EB",
                      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                    }}
                  />
                  <Bar dataKey="revenue" fill="#10B981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-neutral-500">
                Sem dados para o período selecionado
              </div>
            )}
          </div>
        </div>

        {/* Top Usuários e Retenção */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Usuários */}
          <div className="bg-white rounded-xl border shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-neutral-900">
                  Top Usuários
                </h3>
                <p className="text-sm text-neutral-500">Por propostas criadas</p>
              </div>
              <FileText className="w-5 h-5 text-neutral-400" />
            </div>
            <div className="space-y-3">
              {topUsers.length > 0 ? (
                topUsers.map((user, index) => (
                  <div
                    key={user.id}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-neutral-50 transition-colors"
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold",
                      index === 0 && "bg-emerald-100 text-emerald-700",
                      index === 1 && "bg-emerald-50 text-emerald-600",
                      index === 2 && "bg-neutral-100 text-neutral-700",
                      index > 2 && "bg-neutral-50 text-neutral-600"
                    )}>
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-neutral-900 truncate">
                        {user.full_name}
                      </p>
                      {user.company_name && (
                        <p className="text-xs text-neutral-500 truncate">
                          {user.company_name}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-neutral-900">
                        {user.proposals_count}
                      </p>
                      <p className="text-xs text-neutral-500">propostas</p>
                    </div>
                    <div
                      className="w-2 h-8 rounded-full"
                      style={{ backgroundColor: PLAN_COLORS[user.plan] }}
                      title={PLAN_NAMES[user.plan]}
                    />
                  </div>
                ))
              ) : (
                <p className="text-neutral-500 text-center py-8">
                  Nenhum usuário com propostas
                </p>
              )}
            </div>
          </div>

          {/* Tabela de Retenção */}
          <div className="bg-white rounded-xl border shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-neutral-900">
                  Retenção por Coorte
                </h3>
                <p className="text-sm text-neutral-500">% de usuários retidos por mês</p>
              </div>
              <Users className="w-5 h-5 text-neutral-400" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 px-2 text-left text-neutral-500 font-medium">Coorte</th>
                    <th className="py-2 px-2 text-center text-neutral-500 font-medium">M1</th>
                    <th className="py-2 px-2 text-center text-neutral-500 font-medium">M2</th>
                    <th className="py-2 px-2 text-center text-neutral-500 font-medium">M3</th>
                    <th className="py-2 px-2 text-center text-neutral-500 font-medium">M4</th>
                    <th className="py-2 px-2 text-center text-neutral-500 font-medium">M5</th>
                    <th className="py-2 px-2 text-center text-neutral-500 font-medium">M6</th>
                  </tr>
                </thead>
                <tbody>
                  {retentionData.map((row, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-2 px-2 font-medium text-neutral-900">{row.cohort}</td>
                      {[row.month1, row.month2, row.month3, row.month4, row.month5, row.month6].map((value, j) => (
                        <td key={j} className="py-2 px-2 text-center">
                          {value > 0 ? (
                            <span
                              className={cn(
                                "inline-block px-2 py-0.5 rounded text-xs font-medium",
                                value >= 80 && "bg-emerald-100 text-emerald-700",
                                value >= 50 && value < 80 && "bg-emerald-50 text-emerald-600",
                                value > 0 && value < 50 && "bg-neutral-100 text-neutral-600"
                              )}
                            >
                              {value}%
                            </span>
                          ) : (
                            <span className="text-neutral-300">-</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Insights */}
        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 rounded-xl border border-emerald-200 p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-emerald-100 rounded-xl">
              <TrendingUp className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-emerald-900 mb-2">
                Insights do Período
              </h3>
              <ul className="space-y-2 text-sm text-emerald-800">
                {paymentSummary && paymentSummary.failed > 0 && (
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-neutral-500 rounded-full" />
                    <strong>{paymentSummary.failed}</strong> pagamentos precisam de atenção
                  </li>
                )}
                {topUsers.length > 0 && (
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                    <strong>{topUsers[0]?.full_name}</strong> é o usuário mais ativo com {topUsers[0]?.proposals_count} propostas
                  </li>
                )}
                {paymentSummary && paymentSummary.pending > 0 && (
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-neutral-400 rounded-full" />
                    <strong>{formatCurrency(paymentSummary.pending_value)}</strong> em pagamentos pendentes
                  </li>
                )}
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full" />
                  Análise baseada nos últimos <strong>{period} dias</strong>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
