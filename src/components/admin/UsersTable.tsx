import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Eye,
  RefreshCw,
  Trash2,
  Clock,
  KeyRound,
} from "lucide-react";
import { cn, fixEncoding } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface UserProfile {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  plan: string;
  plan_status: string;
  created_at: string;
  plan_started_at: string | null;
  plan_expires_at: string | null;
  asaas_customer_id: string | null;
  asaas_subscription_id: string | null;
  company_name: string | null;
  phone: string | null;
}

// Calcular dias de trial restantes
const TRIAL_DAYS = 3;
function getTrialInfo(planStartedAt: string | null, createdAt: string, plan: string): { daysLeft: number; isInTrial: boolean; label: string } {
  // Só aplica trial para plano free (Grátis)
  if (plan !== 'free') {
    return { daysLeft: 0, isInTrial: false, label: '-' };
  }

  // Usar plan_started_at ou created_at como fallback
  const startDateStr = planStartedAt || createdAt;
  if (!startDateStr) {
    return { daysLeft: TRIAL_DAYS, isInTrial: true, label: `${TRIAL_DAYS}d` };
  }

  // Normalizar datas para meia-noite (ignora hora do cadastro)
  const startDate = new Date(startDateStr);
  startDate.setHours(0, 0, 0, 0);

  const trialEndDate = new Date(startDate);
  trialEndDate.setDate(trialEndDate.getDate() + TRIAL_DAYS);

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const diffMs = trialEndDate.getTime() - now.getTime();
  const daysLeft = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (daysLeft > 0) {
    return { daysLeft, isInTrial: true, label: `${daysLeft}d` };
  }

  return { daysLeft: 0, isInTrial: false, label: 'Expirado' };
}

interface UsersTableProps {
  users: UserProfile[];
  currentUserId?: string;
  onViewDetails: (user: UserProfile) => void;
  onChangePlan: (user: UserProfile) => void;
  onCancelSubscription: (user: UserProfile) => void;
  onExtendPlan: (user: UserProfile) => void;
  onViewPayments: (user: UserProfile) => void;
  onDeleteUser: (user: UserProfile) => void;
  onResetPassword: (user: UserProfile) => void;
}

export function UsersTable({
  users,
  currentUserId,
  onViewDetails,
  onChangePlan,
  onExtendPlan,
  onDeleteUser,
  onResetPassword,
}: UsersTableProps) {
  const ADMIN_EMAIL = "admin@jardinei.com";

  const getPlanBadge = (plan: string, email?: string) => {
    if (email === ADMIN_EMAIL) {
      return (
        <Badge className={cn("font-medium", "bg-neutral-900 text-white")}>
          Admin
        </Badge>
      );
    }
    const styles = {
      free: "bg-neutral-100 text-neutral-600",
      essential: "bg-blue-100 text-blue-700",
      pro: "bg-purple-100 text-purple-700",
    };
    const names = {
      free: "Grátis",
      essential: "Mensal",
      pro: "Anual",
    };
    return (
      <Badge className={cn("font-medium", styles[plan as keyof typeof styles] || styles.free)}>
        {names[plan as keyof typeof names] || plan}
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      active: "bg-green-100 text-green-700",
      cancelled: "bg-red-100 text-red-700",
      expired: "bg-neutral-100 text-neutral-600",
      overdue: "bg-amber-100 text-amber-700",
      trialing: "bg-blue-100 text-blue-700",
    };
    const names = {
      active: "Ativo",
      cancelled: "Cancelado",
      expired: "Expirado",
      overdue: "Inadimplente",
      trialing: "Trial",
    };
    return (
      <Badge className={cn("font-medium", styles[status as keyof typeof styles] || styles.expired)}>
        {names[status as keyof typeof names] || status}
      </Badge>
    );
  };

  const getTrialBadge = (planStartedAt: string | null, createdAt: string, plan: string) => {
    const trialInfo = getTrialInfo(planStartedAt, createdAt, plan);

    if (plan !== 'free') {
      return <span className="text-sm text-neutral-400">-</span>;
    }

    return (
      <Badge className={cn("font-medium", trialInfo.isInTrial ? "bg-neutral-100 text-neutral-600" : "bg-red-100 text-red-700")}>
        {trialInfo.isInTrial ? `${trialInfo.daysLeft}d restantes` : "Expirado"}
      </Badge>
    );
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    try {
      return format(new Date(dateString), "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return "-";
    }
  };

  return (
    <>
      {/* Mobile/Tablet: Cards */}
      <div className="xl:hidden space-y-3">
        {users.map((user) => (
          <div key={user.id} className="bg-white rounded-xl border shadow-sm p-3 sm:p-4">
            {/* Header: Nome + Badges */}
            <div className="flex items-start gap-2 mb-2">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-neutral-900 truncate text-sm sm:text-base">
                  {fixEncoding(user.full_name) || "Sem nome"}
                </p>
                <p className="text-xs text-neutral-500 truncate">{user.email}</p>
              </div>
            </div>

            {/* Badges + Info */}
            <div className="flex flex-wrap items-center gap-1.5 mb-3">
              {getPlanBadge(user.plan, user.email)}
              {getTrialBadge(user.plan_started_at, user.created_at, user.plan)}
              <span className="text-xs text-neutral-400">{formatDate(user.created_at)}</span>
              {getStatusBadge(user.plan_status)}
              <span className="text-xs text-neutral-400 ml-auto">
                {formatDate(user.created_at)}
              </span>
            </div>

            {/* Ações */}
            <div className="flex items-center justify-between pt-2 border-t border-neutral-100">
              <p className="text-xs text-neutral-400">
                {user.plan_expires_at ? `Expira: ${formatDate(user.plan_expires_at)}` : "Sem expiração"}
              </p>
              <div className="flex gap-0.5">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onViewDetails(user)}>
                  <Eye className="h-4 w-4 text-neutral-500" />
                </Button>
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onChangePlan(user)}>
                  Plano
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onExtendPlan(user)}>
                  <Clock className="h-4 w-4 text-neutral-500" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onResetPassword(user)}>
                  <KeyRound className="h-4 w-4 text-neutral-500" />
                </Button>
                {user.user_id !== currentUserId && (
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onDeleteUser(user)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: Table (apenas xl+) */}
      <div className="hidden xl:block bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-neutral-50 border-b">
                <th className="text-left text-xs font-medium text-neutral-500 uppercase tracking-wider px-4 py-3">
                  Usuario
                </th>
                <th className="text-left text-xs font-medium text-neutral-500 uppercase tracking-wider px-3 py-3">
                  Plano
                </th>
                <th className="text-left text-xs font-medium text-neutral-500 uppercase tracking-wider px-3 py-3">
                  Trial
                </th>
                <th className="text-left text-xs font-medium text-neutral-500 uppercase tracking-wider px-3 py-3">
                  Expira
                </th>
                <th className="text-left text-xs font-medium text-neutral-500 uppercase tracking-wider px-3 py-3">
                  Status
                </th>
                <th className="text-left text-xs font-medium text-neutral-500 uppercase tracking-wider px-3 py-3">
                  Cadastro
                </th>
                <th className="text-right text-xs font-medium text-neutral-500 uppercase tracking-wider px-4 py-3">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-neutral-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="max-w-[200px]">
                      <p className="text-sm font-medium text-neutral-900 truncate">
                        {fixEncoding(user.full_name) || "Sem nome"}
                      </p>
                      <p className="text-xs text-neutral-500 truncate">{user.email}</p>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    {getPlanBadge(user.plan, user.email)}
                  </td>
                  <td className="px-3 py-3">
                    {getTrialBadge(user.plan_started_at, user.created_at, user.plan)}
                  </td>
                  <td className="px-3 py-3">
                    <span className="text-sm text-neutral-600 whitespace-nowrap">
                      {formatDate(user.plan_expires_at)}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    {getStatusBadge(user.plan_status)}
                  </td>
                  <td className="px-3 py-3">
                    <span className="text-sm text-neutral-600 whitespace-nowrap">
                      {formatDate(user.created_at)}
                    </span>
                  </td>
                <td className="px-4 py-4">
                  <div className="flex items-center justify-end gap-0.5">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => onViewDetails(user)}
                        >
                          <Eye className="h-4 w-4 text-neutral-500" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Ver detalhes</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => onChangePlan(user)}
                        >
                          <RefreshCw className="h-4 w-4 text-neutral-500" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Mudar plano</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => onExtendPlan(user)}
                        >
                          <Clock className="h-4 w-4 text-neutral-500" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Estender prazo</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => onResetPassword(user)}
                        >
                          <KeyRound className="h-4 w-4 text-neutral-500" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Redefinir senha</TooltipContent>
                    </Tooltip>

                    {user.user_id !== currentUserId && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => onDeleteUser(user)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Excluir</TooltipContent>
                      </Tooltip>
                    )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {users.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border">
          <p className="text-neutral-500">Nenhum usuario encontrado</p>
        </div>
      )}
    </>
  );
}
