import { useEffect, useState } from "react";
import { Search, Download, Copy, Check } from "lucide-react";
import { getSupabase, supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { UsersTable, UserProfile } from "@/components/admin/UsersTable";
import { UserDetailsModal } from "@/components/admin/UserDetailsModal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export default function AdminAssinantes() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [planFilter, setPlanFilter] = useState("all");

  // Modals
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showChangePlanModal, setShowChangePlanModal] = useState(false);
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;
  const [newPlan, setNewPlan] = useState("free");
  const [newPeriod, setNewPeriod] = useState("monthly");
  const [extendDays, setExtendDays] = useState(30);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [resetPasswordLoading, setResetPasswordLoading] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState("");
  const [passwordCopied, setPasswordCopied] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    filterUsers();
  }, [users, search, statusFilter, planFilter]);

  const loadUsers = async () => {
    try {
      // Tentar usar a função RPC que retorna emails reais
      const { data: rpcData, error: rpcError } = await getSupabase()
        .rpc("get_admin_users");

      if (!rpcError && rpcData) {
        setUsers(rpcData as UserProfile[]);
      } else {
        // Fallback: usar query normal se a função RPC não existir ainda
        const { data, error } = await getSupabase()
          .from("profiles")
          .select(`
            id,
            user_id,
            full_name,
            plan,
            plan_status,
            created_at,
            plan_started_at,
            plan_expires_at,
            asaas_customer_id,
            asaas_subscription_id,
            company_name,
            phone
          `)
          .order("created_at", { ascending: false });

        if (error) throw error;

        // Adicionar email placeholder até a migration ser aplicada
        const usersWithEmail = data?.map((u) => ({
          ...u,
          email: `${u.full_name?.split(" ")[0]?.toLowerCase() || "user"}@email.com`,
        })) || [];

        setUsers(usersWithEmail as UserProfile[]);
      }
    } catch (error) {
      console.error("Error loading users:", error);
      toast.error("Erro ao carregar usuarios");
    } finally {
      setLoading(false);
    }
  };

  const filterUsers = () => {
    // Excluir admin da lista (não conta como assinante)
    let filtered = users.filter((u) => u.email !== "admin@jardinei.com" && u.email !== "admin@fechaqui.com");

    // Filtro de busca
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        (u) =>
          u.full_name?.toLowerCase().includes(searchLower) ||
          u.email?.toLowerCase().includes(searchLower) ||
          u.company_name?.toLowerCase().includes(searchLower)
      );
    }

    // Filtro de status
    if (statusFilter === "paid") {
      filtered = filtered.filter((u) => u.plan !== "free");
    } else if (statusFilter !== "all") {
      filtered = filtered.filter((u) => u.plan_status === statusFilter);
    }

    // Filtro de plano
    if (planFilter !== "all") {
      filtered = filtered.filter((u) => u.plan === planFilter);
    }

    setFilteredUsers(filtered);
    setCurrentPage(1);
  };

  const handleChangePlan = async () => {
    if (!selectedUser) return;

    try {
      // Calcular data de expiração baseado no período
      const now = new Date();
      const expiresAt = new Date(now);
      if (newPeriod === "annual") {
        expiresAt.setFullYear(expiresAt.getFullYear() + 1);
      } else {
        expiresAt.setDate(expiresAt.getDate() + 30);
      }

      const { error } = await getSupabase()
        .from("profiles")
        .update({
          plan: newPlan,
          plan_status: "active",
          plan_period: newPeriod,
          plan_started_at: now.toISOString(),
          plan_expires_at: expiresAt.toISOString(),
          updated_at: now.toISOString(),
        })
        .eq("user_id", selectedUser.user_id);

      if (error) throw error;

      toast.success(`Plano alterado para ${newPlan === "pro" ? "Anual" : newPlan === "essential" ? "Mensal" : "Grátis"} (${newPeriod === "annual" ? "anual" : "mensal"})`);
      setShowChangePlanModal(false);
      loadUsers();
    } catch (error) {
      console.error("Error changing plan:", error);
      toast.error("Erro ao alterar plano");
    }
  };

  const handleExtendPlan = async () => {
    if (!selectedUser) return;

    try {
      const currentExpiry = selectedUser.plan_expires_at
        ? new Date(selectedUser.plan_expires_at)
        : new Date();
      const newExpiry = new Date(currentExpiry);
      newExpiry.setDate(newExpiry.getDate() + extendDays);

      const { error } = await getSupabase()
        .from("profiles")
        .update({
          plan_expires_at: newExpiry.toISOString(),
          plan_status: "active",
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", selectedUser.user_id);

      if (error) throw error;

      toast.success(`Prazo estendido em ${extendDays} dias`);
      setShowExtendModal(false);
      loadUsers();
    } catch (error) {
      console.error("Error extending plan:", error);
      toast.error("Erro ao estender prazo");
    }
  };

  const handleCancelSubscription = async () => {
    if (!selectedUser) return;

    try {
      const { error } = await getSupabase()
        .from("profiles")
        .update({
          plan_status: "cancelled",
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", selectedUser.user_id);

      if (error) throw error;

      toast.success("Assinatura cancelada");
      setShowCancelModal(false);
      loadUsers();
    } catch (error) {
      console.error("Error cancelling subscription:", error);
      toast.error("Erro ao cancelar assinatura");
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    setDeleteLoading(true);
    try {
      // Pegar o ID do admin atual
      const { data: { user: currentUser } } = await getSupabase().auth.getUser();

      if (!currentUser) {
        throw new Error("Usuário não autenticado");
      }

      // Chamar API que deleta completamente (incluindo auth.users)
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const response = await fetch('/api/manage-asaas?action=delete-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
        body: JSON.stringify({
          userId: selectedUser.user_id,
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao excluir usuário');
      }

      toast.success("Usuário excluído completamente");
      setShowDeleteModal(false);
      loadUsers();
    } catch (error) {
      console.error("Error deleting user:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao excluir usuário");
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!selectedUser) return;

    setResetPasswordLoading(true);
    setGeneratedPassword("");
    setPasswordCopied(false);

    try {
      const { data: { user: adminUser } } = await getSupabase().auth.getUser();

      if (!adminUser) {
        throw new Error("Usuário não autenticado");
      }

      const { data: adminSession } = await supabase.auth.getSession();
      const adminToken = adminSession?.session?.access_token;
      const response = await fetch('/api/verify-phone', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(adminToken && { 'Authorization': `Bearer ${adminToken}` }),
        },
        body: JSON.stringify({
          action: 'admin-reset-password',
          phone: selectedUser.phone || '0',
          userId: selectedUser.user_id,
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao redefinir senha');
      }

      setGeneratedPassword(result.newPassword);
      toast.success("Senha redefinida com sucesso!");
    } catch (error) {
      console.error("Error resetting password:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao redefinir senha");
      setShowResetPasswordModal(false);
    } finally {
      setResetPasswordLoading(false);
    }
  };

  const copyPassword = () => {
    navigator.clipboard.writeText(generatedPassword);
    setPasswordCopied(true);
    toast.success("Senha copiada!");
    setTimeout(() => setPasswordCopied(false), 2000);
  };

  const exportCSV = () => {
    const headers = ["Nome", "Email", "Plano", "Status", "Cadastro"];
    const rows = filteredUsers.map((u) => [
      u.full_name || "",
      u.email || "",
      u.plan,
      u.plan_status,
      u.created_at,
    ]);

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "assinantes.csv";
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
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-neutral-900">Assinantes</h1>
            <p className="text-sm text-neutral-500">
              {filteredUsers.length} de {users.filter((u) => u.email !== "admin@jardinei.com" && u.email !== "admin@fechaqui.com").length}
            </p>
          </div>
          <Button onClick={exportCSV} variant="outline" size="sm" className="shrink-0">
            <Download className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Exportar</span>
          </Button>
        </div>

        {/* Filters */}
        <div className="space-y-3">
          {/* Busca */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <Input
              placeholder="Buscar por nome, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          {/* Filtros lado a lado */}
          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <option value="all">Status</option>
              <option value="active">Ativo</option>
              <option value="paid">Já comprou</option>
              <option value="cancelled">Cancelado</option>
              <option value="expired">Expirado</option>
              <option value="overdue">Inadimplente</option>
            </select>
            <select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
              className="h-10 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <option value="all">Plano</option>
              <option value="free">Grátis</option>
              <option value="essential">Mensal</option>
              <option value="pro">Anual</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <UsersTable
          users={filteredUsers.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)}
          currentUserId={currentUser?.id}
          onViewDetails={(user) => {
            setSelectedUser(user);
            setShowDetailsModal(true);
          }}
          onChangePlan={(user) => {
            setSelectedUser(user);
            setNewPlan(user.plan);
            setShowChangePlanModal(true);
          }}
          onCancelSubscription={(user) => {
            setSelectedUser(user);
            setShowCancelModal(true);
          }}
          onExtendPlan={(user) => {
            setSelectedUser(user);
            setExtendDays(30);
            setShowExtendModal(true);
          }}
          onViewPayments={(user) => {
            setSelectedUser(user);
            setShowDetailsModal(true);
          }}
          onDeleteUser={(user) => {
            setSelectedUser(user);
            setShowDeleteModal(true);
          }}
          onResetPassword={(user) => {
            setSelectedUser(user);
            setGeneratedPassword("");
            setPasswordCopied(false);
            setShowResetPasswordModal(true);
          }}
        />

        {/* Pagination */}
        {filteredUsers.length > ITEMS_PER_PAGE && (
          <div className="flex items-center justify-between pt-2">
            <p className="text-sm text-neutral-500">
              {(currentPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredUsers.length)} de {filteredUsers.length}
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                Anterior
              </Button>
              {Array.from({ length: Math.ceil(filteredUsers.length / ITEMS_PER_PAGE) }, (_, i) => i + 1)
                .filter(page => {
                  const total = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE);
                  if (total <= 7) return true;
                  if (page === 1 || page === total) return true;
                  if (Math.abs(page - currentPage) <= 1) return true;
                  return false;
                })
                .map((page, idx, arr) => (
                  <span key={page} className="flex items-center">
                    {idx > 0 && arr[idx - 1] !== page - 1 && (
                      <span className="px-1 text-neutral-400">...</span>
                    )}
                    <Button
                      variant={currentPage === page ? "default" : "outline"}
                      size="sm"
                      className={`w-9 ${currentPage === page ? "bg-emerald-600 hover:bg-emerald-700" : ""}`}
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </Button>
                  </span>
                ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredUsers.length / ITEMS_PER_PAGE), p + 1))}
                disabled={currentPage === Math.ceil(filteredUsers.length / ITEMS_PER_PAGE)}
              >
                Próximo
              </Button>
            </div>
          </div>
        )}

        {/* Details Modal */}
        <UserDetailsModal
          user={selectedUser}
          open={showDetailsModal}
          onClose={() => setShowDetailsModal(false)}
        />

        {/* Change Plan Modal */}
        <Dialog open={showChangePlanModal} onOpenChange={setShowChangePlanModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Alterar Plano</DialogTitle>
              <DialogDescription>
                {selectedUser?.full_name || "Usuário"}
              </DialogDescription>
            </DialogHeader>

            <div className="py-2 space-y-6">
              {/* Período */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-neutral-700">Período de cobrança</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setNewPeriod("monthly")}
                    className={`p-4 rounded-xl border-2 text-center transition-all ${
                      newPeriod === "monthly"
                        ? "bg-emerald-50 border-emerald-500 shadow-sm"
                        : "bg-white border-neutral-200 hover:border-neutral-300"
                    }`}
                  >
                    <p className={`font-semibold ${newPeriod === "monthly" ? "text-emerald-700" : "text-neutral-800"}`}>
                      Mensal
                    </p>
                    <p className="text-xs text-neutral-500 mt-1">Renovação a cada 30 dias</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewPeriod("annual")}
                    className={`p-4 rounded-xl border-2 text-center transition-all relative ${
                      newPeriod === "annual"
                        ? "bg-emerald-50 border-emerald-500 shadow-sm"
                        : "bg-white border-neutral-200 hover:border-neutral-300"
                    }`}
                  >
                    <span className="absolute -top-2 -right-2 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      -15%
                    </span>
                    <p className={`font-semibold ${newPeriod === "annual" ? "text-emerald-700" : "text-neutral-800"}`}>
                      Anual
                    </p>
                    <p className="text-xs text-neutral-500 mt-1">Renovação a cada 365 dias</p>
                  </button>
                </div>
              </div>

              {/* Plano */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-neutral-700">Escolha o plano</label>
                <div className="space-y-2">
                  {/* Grátis */}
                  <button
                    type="button"
                    onClick={() => setNewPlan("free")}
                    className={`w-full p-4 rounded-xl border-2 flex items-center justify-between transition-all ${
                      newPlan === "free"
                        ? "bg-emerald-50 border-emerald-500 shadow-sm"
                        : "bg-white border-neutral-200 hover:border-neutral-300"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        newPlan === "free" ? "border-emerald-500 bg-emerald-500" : "border-neutral-300"
                      }`}>
                        {newPlan === "free" && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                      </div>
                      <span className={`font-medium ${newPlan === "free" ? "text-emerald-700" : "text-neutral-800"}`}>
                        Grátis
                      </span>
                    </div>
                    <span className="text-neutral-500 font-medium">Grátis</span>
                  </button>

                  {/* Mensal */}
                  <button
                    type="button"
                    onClick={() => setNewPlan("essential")}
                    className={`w-full p-4 rounded-xl border-2 flex items-center justify-between transition-all ${
                      newPlan === "essential"
                        ? "bg-emerald-50 border-emerald-500 shadow-sm"
                        : "bg-white border-neutral-200 hover:border-neutral-300"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        newPlan === "essential" ? "border-emerald-500 bg-emerald-500" : "border-neutral-300"
                      }`}>
                        {newPlan === "essential" && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                      </div>
                      <span className={`font-medium ${newPlan === "essential" ? "text-emerald-700" : "text-neutral-800"}`}>
                        Mensal
                      </span>
                    </div>
                    <span className="font-semibold text-neutral-800">
                      R$ 97
                      <span className="text-neutral-400 font-normal text-sm">
                        /mês
                      </span>
                    </span>
                  </button>

                  {/* Anual */}
                  <button
                    type="button"
                    onClick={() => setNewPlan("pro")}
                    className={`w-full p-4 rounded-xl border-2 flex items-center justify-between transition-all ${
                      newPlan === "pro"
                        ? "bg-emerald-50 border-emerald-500 shadow-sm"
                        : "bg-white border-neutral-200 hover:border-neutral-300"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        newPlan === "pro" ? "border-emerald-500 bg-emerald-500" : "border-neutral-300"
                      }`}>
                        {newPlan === "pro" && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                      </div>
                      <span className={`font-medium ${newPlan === "pro" ? "text-emerald-700" : "text-neutral-800"}`}>
                        Anual
                      </span>
                    </div>
                    <span className="font-semibold text-neutral-800">
                      R$ 804
                      <span className="text-neutral-400 font-normal text-sm">
                        /ano (R$ 67/mês)
                      </span>
                    </span>
                  </button>
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setShowChangePlanModal(false)}>
                Cancelar
              </Button>
              <Button onClick={handleChangePlan} className="bg-emerald-600 hover:bg-emerald-700">
                Confirmar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Extend Plan Modal */}
        <Dialog open={showExtendModal} onOpenChange={setShowExtendModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Estender Prazo</DialogTitle>
              <DialogDescription>
                {selectedUser?.full_name || "Usuário"}
              </DialogDescription>
            </DialogHeader>

            <div className="py-2 space-y-4">
              {/* Info atual e nova data */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-neutral-50 rounded-xl p-3 text-sm">
                  <p className="text-neutral-500">Expira atualmente em:</p>
                  <p className="font-semibold text-neutral-800">
                    {selectedUser?.plan_expires_at
                      ? new Date(selectedUser.plan_expires_at).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric"
                        })
                      : "Sem data"
                    }
                  </p>
                </div>
                <div className="bg-emerald-50 rounded-xl p-3 text-sm border border-emerald-200">
                  <p className="text-emerald-600">Nova data:</p>
                  <p className="font-semibold text-emerald-700">
                    {(() => {
                      const currentExpiry = selectedUser?.plan_expires_at
                        ? new Date(selectedUser.plan_expires_at)
                        : new Date();
                      const newExpiry = new Date(currentExpiry);
                      newExpiry.setDate(newExpiry.getDate() + extendDays);
                      return newExpiry.toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric"
                      });
                    })()}
                  </p>
                </div>
              </div>

              {/* Opções de prazo */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-neutral-700">Adicionar tempo</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { days: 7, label: "+7 dias", desc: "1 semana" },
                    { days: 15, label: "+15 dias", desc: "2 semanas" },
                    { days: 30, label: "+30 dias", desc: "1 mês" },
                    { days: 60, label: "+60 dias", desc: "2 meses" },
                    { days: 90, label: "+90 dias", desc: "3 meses" },
                    { days: 365, label: "+365 dias", desc: "1 ano" },
                  ].map((option) => (
                    <button
                      key={option.days}
                      type="button"
                      onClick={() => setExtendDays(option.days)}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${
                        extendDays === option.days
                          ? "bg-emerald-50 border-emerald-500 shadow-sm"
                          : "bg-white border-neutral-200 hover:border-neutral-300"
                      }`}
                    >
                      <p className={`font-semibold ${extendDays === option.days ? "text-emerald-700" : "text-neutral-800"}`}>
                        {option.label}
                      </p>
                      <p className="text-xs text-neutral-500">{option.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setShowExtendModal(false)}>
                Cancelar
              </Button>
              <Button onClick={handleExtendPlan} className="bg-emerald-600 hover:bg-emerald-700">
                Confirmar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Cancel Subscription Modal */}
        <Dialog open={showCancelModal} onOpenChange={setShowCancelModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cancelar Assinatura</DialogTitle>
              <DialogDescription>
                Tem certeza que deseja cancelar a assinatura de{" "}
                <strong>{selectedUser?.full_name || "usuario"}</strong>?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCancelModal(false)}>
                Voltar
              </Button>
              <Button variant="destructive" onClick={handleCancelSubscription}>
                Cancelar Assinatura
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete User Modal */}
        <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader className="sr-only">
              <DialogTitle>Excluir usuário</DialogTitle>
            </DialogHeader>
            <div className="text-center py-4">
              {/* Ícone */}
              <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>

              {/* Título visual */}
              <h3 className="text-lg font-semibold text-neutral-900 mb-2">
                Excluir usuário?
              </h3>

              {/* Nome do usuário */}
              <p className="text-neutral-600 mb-4">
                <span className="font-medium text-neutral-900">{selectedUser?.full_name || "Usuário"}</span>
                <br />
                <span className="text-sm text-neutral-500">{selectedUser?.email}</span>
              </p>

              {/* Aviso */}
              <p className="text-sm text-neutral-500 mb-6">
                Todos os dados serão removidos permanentemente.
              </p>

              {/* Botões */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDeleteUser}
                  disabled={deleteLoading}
                  className="flex-1"
                >
                  {deleteLoading ? "Excluindo..." : "Excluir"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Reset Password Modal */}
        <Dialog open={showResetPasswordModal} onOpenChange={(open) => {
          if (!open) {
            setShowResetPasswordModal(false);
            setGeneratedPassword("");
          }
        }}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader className="sr-only">
              <DialogTitle>Redefinir senha</DialogTitle>
            </DialogHeader>
            <div className="text-center py-4">
              {/* Ícone */}
              <div className="mx-auto w-12 h-12 bg-verde-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </div>

              {/* Título visual */}
              <h3 className="text-lg font-semibold text-neutral-900 mb-2">
                {generatedPassword ? "Senha redefinida!" : "Redefinir senha?"}
              </h3>

              {/* Nome do usuário */}
              <p className="text-neutral-600 mb-4">
                <span className="font-medium text-neutral-900">{selectedUser?.full_name || "Usuário"}</span>
                <br />
                <span className="text-sm text-neutral-500">{selectedUser?.email}</span>
              </p>

              {generatedPassword ? (
                <>
                  {/* Senha gerada */}
                  <div className="bg-verde-50 border border-verde-200 rounded-xl p-4 mb-4">
                    <p className="text-xs text-neutral-500 mb-2">Nova senha (6 dígitos)</p>
                    <div className="flex items-center justify-center gap-3">
                      <span className="text-3xl font-mono font-bold text-neutral-900 tracking-widest">
                        {generatedPassword}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10"
                        onClick={copyPassword}
                      >
                        {passwordCopied ? (
                          <Check className="h-5 w-5 text-primary" />
                        ) : (
                          <Copy className="h-5 w-5 text-neutral-500" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <p className="text-sm text-neutral-500 mb-6">
                    Copie e envie para o cliente. Recomende que ele altere após o primeiro login.
                  </p>

                  <Button
                    onClick={() => {
                      setShowResetPasswordModal(false);
                      setGeneratedPassword("");
                    }}
                    className="w-full"
                  >
                    Fechar
                  </Button>
                </>
              ) : (
                <>
                  {/* Aviso */}
                  <p className="text-sm text-neutral-500 mb-6">
                    Uma nova senha de 6 dígitos será gerada automaticamente.
                  </p>

                  {/* Botões */}
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setShowResetPasswordModal(false)}
                      className="flex-1"
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={handleResetPassword}
                      disabled={resetPasswordLoading}
                      className="flex-1"
                    >
                      {resetPasswordLoading ? "Gerando..." : "Gerar nova senha"}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
