import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { X, Mail, Phone, Building, Calendar, CreditCard, FileText } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { fixEncoding } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserProfile } from "./UsersTable";

interface Payment {
  id: string;
  amount: number;
  status: string;
  payment_method: string;
  created_at: string;
}

interface Proposal {
  id: string;
  title: string;
  client_name: string;
  total: number;
  status: string;
  created_at: string;
}

interface UserDetailsModalProps {
  user: UserProfile | null;
  open: boolean;
  onClose: () => void;
}

export function UserDetailsModal({ user, open, onClose }: UserDetailsModalProps) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user && open) {
      loadUserData();
    }
  }, [user, open]);

  const loadUserData = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Carregar pagamentos
      const { data: paymentsData } = await getSupabase()
        .from("payments")
        .select("*")
        .eq("user_id", user.user_id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (paymentsData) setPayments(paymentsData);

      // Carregar propostas
      const { data: proposalsData } = await getSupabase()
        .from("proposals")
        .select("id, title, client_name, total, status, created_at")
        .eq("user_id", user.user_id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (proposalsData) setProposals(proposalsData);
    } catch (error) {
      console.error("Error loading user data:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    try {
      return format(new Date(dateString), "dd/MM/yyyy HH:mm", { locale: ptBR });
    } catch {
      return "-";
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      active: "bg-emerald-100 text-emerald-700",
      confirmed: "bg-emerald-100 text-emerald-700",
      approved: "bg-emerald-100 text-emerald-700",
      pending: "bg-amber-100 text-amber-700",
      draft: "bg-neutral-100 text-neutral-600",
      sent: "bg-blue-100 text-blue-700",
      viewed: "bg-purple-100 text-purple-700",
      cancelled: "bg-red-100 text-red-700",
      expired: "bg-neutral-100 text-neutral-600",
    };
    return colors[status] || "bg-neutral-100 text-neutral-600";
  };

  const translateStatus = (status: string) => {
    const translations: Record<string, string> = {
      active: "Ativo",
      confirmed: "Confirmado",
      approved: "Aprovada",
      pending: "Pendente",
      draft: "Rascunho",
      sent: "Enviada",
      viewed: "Visualizada",
      cancelled: "Cancelado",
      expired: "Expirado",
      overdue: "Inadimplente",
      paid: "Pago",
      refunded: "Reembolsado",
    };
    return translations[status] || status;
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Detalhes do Usuário</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Info basica */}
          <div className="bg-neutral-50 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-neutral-900 flex items-center justify-center text-white font-medium">
                {fixEncoding(user.full_name)?.substring(0, 2).toUpperCase() || "US"}
              </div>
              <div>
                <h3 className="font-semibold text-neutral-900">
                  {fixEncoding(user.full_name) || "Sem nome"}
                </h3>
                <p className="text-sm text-neutral-500">{user.email}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
              <div className="flex items-center gap-2 text-sm p-2 bg-white rounded-lg">
                <Mail className="w-4 h-4 text-neutral-400" />
                <span className="text-neutral-600">{user.email}</span>
              </div>
              <div className="flex items-center gap-2 text-sm p-2 bg-white rounded-lg">
                <Phone className="w-4 h-4 text-neutral-400" />
                <span className="text-neutral-600">{user.phone || "Não informado"}</span>
              </div>
              {user.company_name && (
                <div className="flex items-center gap-2 text-sm p-2 bg-white rounded-lg">
                  <Building className="w-4 h-4 text-neutral-400" />
                  <span className="text-neutral-600">{fixEncoding(user.company_name)}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm p-2 bg-white rounded-lg">
                <Calendar className="w-4 h-4 text-neutral-400" />
                <span className="text-neutral-600">
                  Cadastro: {formatDate(user.created_at)}
                </span>
              </div>
            </div>
          </div>

          {/* Plano */}
          <div className="bg-white border rounded-xl p-4">
            <h4 className="font-medium text-neutral-900 mb-3">Assinatura</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-neutral-500 mb-1">Plano</p>
                <Badge className={user.email === "admin@jardinei.com" ? "bg-neutral-900 text-white" : "bg-purple-100 text-purple-700"}>
                  {user.email === "admin@jardinei.com" ? "Admin" : user.plan === "pro" ? "Anual" : user.plan === "essential" ? "Mensal" : "Grátis"}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-neutral-500 mb-1">Status</p>
                <Badge className={getStatusColor(user.plan_status)}>
                  {translateStatus(user.plan_status)}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-neutral-500 mb-1">Expira em</p>
                <p className="text-sm text-neutral-700">
                  {formatDate(user.plan_expires_at)}
                </p>
              </div>
              <div>
                <p className="text-xs text-neutral-500 mb-1">ID Asaas</p>
                <p className="text-sm text-neutral-700 font-mono">
                  {user.asaas_customer_id || "-"}
                </p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="payments">
            <TabsList className="w-full">
              <TabsTrigger value="payments" className="flex-1">
                <CreditCard className="w-4 h-4 mr-2" />
                Pagamentos
              </TabsTrigger>
              <TabsTrigger value="proposals" className="flex-1">
                <FileText className="w-4 h-4 mr-2" />
                Propostas
              </TabsTrigger>
            </TabsList>

            <TabsContent value="payments" className="mt-4">
              {loading ? (
                <div className="text-center py-8 text-neutral-500">
                  Carregando...
                </div>
              ) : payments.length === 0 ? (
                <div className="text-center py-8 text-neutral-500">
                  Nenhum pagamento encontrado
                </div>
              ) : (
                <div className="space-y-2">
                  {payments.map((payment) => (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg"
                    >
                      <div>
                        <p className="text-sm font-medium text-neutral-900">
                          {formatCurrency(payment.amount)}
                        </p>
                        <p className="text-xs text-neutral-500">
                          {formatDate(payment.created_at)} • {payment.payment_method || "N/A"}
                        </p>
                      </div>
                      <Badge className={getStatusColor(payment.status)}>
                        {translateStatus(payment.status)}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="proposals" className="mt-4">
              {loading ? (
                <div className="text-center py-8 text-neutral-500">
                  Carregando...
                </div>
              ) : proposals.length === 0 ? (
                <div className="text-center py-8 text-neutral-500">
                  Nenhuma proposta encontrada
                </div>
              ) : (
                <div className="space-y-2">
                  {proposals.map((proposal) => (
                    <div
                      key={proposal.id}
                      className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg"
                    >
                      <div>
                        <p className="text-sm font-medium text-neutral-900">
                          {proposal.title || "Sem titulo"}
                        </p>
                        <p className="text-xs text-neutral-500">
                          {proposal.client_name} • {formatCurrency(proposal.total)}
                        </p>
                      </div>
                      <Badge className={getStatusColor(proposal.status)}>
                        {translateStatus(proposal.status)}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
