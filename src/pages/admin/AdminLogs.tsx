import { useEffect, useState } from "react";
import { RefreshCw, ChevronDown, ChevronUp, Check, X, Clock, AlertCircle, CreditCard, User, Calendar, DollarSign, FileText } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getSupabase } from "@/lib/supabase";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface WebhookLog {
  id: string;
  event_type: string;
  payload: any;
  status: string;
  error_message: string | null;
  processed_at: string | null;
  created_at: string;
}

// Tradução dos eventos
const EVENT_TRANSLATIONS: Record<string, { name: string; description: string; icon: any }> = {
  PAYMENT_CREATED: {
    name: "Cobrança Criada",
    description: "Uma nova cobrança foi gerada",
    icon: FileText
  },
  PAYMENT_CONFIRMED: {
    name: "Pagamento Confirmado",
    description: "O pagamento foi confirmado com sucesso",
    icon: Check
  },
  PAYMENT_RECEIVED: {
    name: "Pagamento Recebido",
    description: "O dinheiro foi recebido na conta",
    icon: DollarSign
  },
  PAYMENT_OVERDUE: {
    name: "Pagamento Atrasado",
    description: "A cobrança passou da data de vencimento",
    icon: AlertCircle
  },
  PAYMENT_DELETED: {
    name: "Cobrança Excluída",
    description: "A cobrança foi removida do sistema",
    icon: X
  },
  PAYMENT_REFUNDED: {
    name: "Pagamento Estornado",
    description: "O valor foi devolvido ao cliente",
    icon: CreditCard
  },
  PAYMENT_UPDATED: {
    name: "Cobrança Atualizada",
    description: "Os dados da cobrança foram modificados",
    icon: FileText
  },
  PAYMENT_ANTICIPATED: {
    name: "Pagamento Antecipado",
    description: "O recebimento foi antecipado",
    icon: Calendar
  },
  PAYMENT_AWAITING_RISK_ANALYSIS: {
    name: "Em Análise",
    description: "Pagamento aguardando análise de risco",
    icon: Clock
  },
  SUBSCRIPTION_CREATED: {
    name: "Assinatura Criada",
    description: "Nova assinatura foi cadastrada",
    icon: User
  },
  SUBSCRIPTION_UPDATED: {
    name: "Assinatura Atualizada",
    description: "Dados da assinatura foram alterados",
    icon: User
  },
  SUBSCRIPTION_DELETED: {
    name: "Assinatura Cancelada",
    description: "A assinatura foi encerrada",
    icon: X
  },
};

// Tradução dos status de processamento
const STATUS_TRANSLATIONS: Record<string, string> = {
  processed: "Processado",
  processing: "Processando",
  error: "Erro",
  received: "Recebido",
};

export default function AdminLogs() {
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [eventFilter, setEventFilter] = useState("all");
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
  const [showTechnical, setShowTechnical] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadLogs();
  }, [statusFilter, eventFilter]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      let query = getSupabase()
        .from("webhook_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      if (eventFilter !== "all") {
        query = query.eq("event_type", eventFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error("Error loading logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLog = async (id: string) => {
    try {
      const { error } = await getSupabase()
        .from("webhook_logs")
        .delete()
        .eq("id", id);

      if (error) throw error;

      // Remove do state local
      setLogs((prev) => prev.filter((log) => log.id !== id));
    } catch (error) {
      console.error("Error deleting log:", error);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedLogs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleTechnical = (id: string) => {
    setShowTechnical((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    } catch {
      return dateString;
    }
  };

  const formatDateShort = (dateString: string) => {
    try {
      return format(new Date(dateString), "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return dateString;
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getEventInfo = (eventType: string) => {
    return EVENT_TRANSLATIONS[eventType] || {
      name: eventType,
      description: "Evento do sistema de pagamento",
      icon: FileText
    };
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      processed: "bg-green-100 text-green-700",
      processing: "bg-neutral-100 text-neutral-700",
      error: "bg-red-100 text-red-700",
      received: "bg-neutral-100 text-neutral-600",
    };
    return (
      <Badge className={styles[status] || "bg-neutral-100 text-neutral-600"}>
        {STATUS_TRANSLATIONS[status] || status}
      </Badge>
    );
  };

  const getEventBadgeColor = (eventType: string) => {
    if (eventType.includes("CONFIRMED") || eventType.includes("RECEIVED")) {
      return "bg-green-100 text-green-700 border-green-200";
    }
    if (eventType.includes("OVERDUE") || eventType.includes("DELETED")) {
      return "bg-neutral-100 text-neutral-700 border-neutral-200";
    }
    if (eventType.includes("CREATED")) {
      return "bg-accent/10 text-green-600 border-green-100";
    }
    return "bg-neutral-50 text-neutral-600 border-neutral-200";
  };

  // Extrair informações úteis do payload
  const extractPaymentInfo = (payload: any) => {
    const payment = payload?.payment;
    if (!payment) return null;

    return {
      valor: payment.value,
      valorLiquido: payment.netValue,
      vencimento: payment.dueDate,
      status: payment.status,
      descricao: payment.description,
      cliente: payment.customer,
      tipo: payment.billingType,
      linkPagamento: payment.invoiceUrl,
    };
  };

  const translatePaymentStatus = (status: string) => {
    const translations: Record<string, string> = {
      PENDING: "Pendente",
      RECEIVED: "Recebido",
      CONFIRMED: "Confirmado",
      OVERDUE: "Atrasado",
      REFUNDED: "Estornado",
      RECEIVED_IN_CASH: "Recebido em Dinheiro",
      REFUND_REQUESTED: "Estorno Solicitado",
      CHARGEBACK_REQUESTED: "Chargeback Solicitado",
      CHARGEBACK_DISPUTE: "Disputa de Chargeback",
      AWAITING_CHARGEBACK_REVERSAL: "Aguardando Reversão",
      DUNNING_REQUESTED: "Cobrança Solicitada",
      DUNNING_RECEIVED: "Cobrança Recebida",
      AWAITING_RISK_ANALYSIS: "Em Análise de Risco",
    };
    return translations[status] || status;
  };

  const uniqueEventTypes = [...new Set(logs.map((l) => l.event_type))];

  // Traduzir erros técnicos para mensagens amigáveis
  const formatErrorMessage = (error: string) => {
    const errorMappings: Record<string, { title: string; description: string; solution: string }> = {
      "Cannot read properties of undefined (reading 'externalReference')": {
        title: "Webhook sem dados de pagamento",
        description: "O Asaas enviou um evento sem as informações necessárias do pagamento.",
        solution: "Isso geralmente acontece com eventos de teste ou quando há instabilidade no Asaas. Não afeta pagamentos reais."
      },
      "User ID não encontrado": {
        title: "Usuário não identificado",
        description: "Não foi possível identificar o usuário associado a este pagamento.",
        solution: "Verifique se o externalReference está configurado corretamente no Asaas."
      },
      "Failed to update profile": {
        title: "Falha ao atualizar perfil",
        description: "Não foi possível atualizar o plano do usuário no banco de dados.",
        solution: "Verifique as permissões do banco de dados e tente novamente."
      },
    };

    // Procurar por correspondência parcial
    for (const [key, value] of Object.entries(errorMappings)) {
      if (error.includes(key)) {
        return value;
      }
    }

    // Erro genérico
    return {
      title: "Erro no processamento",
      description: error,
      solution: "Se o problema persistir, verifique os logs técnicos abaixo."
    };
  };

  if (loading && logs.length === 0) {
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
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">Histórico de Pagamentos</h1>
            <p className="text-neutral-500">
              Acompanhe os eventos do gateway de pagamento
            </p>
          </div>
          <Button onClick={loadLogs} variant="outline" disabled={loading}>
            <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} />
            Atualizar
          </Button>
        </div>

        {/* Filters */}
        <div className="flex gap-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="processed">Processado</SelectItem>
              <SelectItem value="processing">Processando</SelectItem>
              <SelectItem value="error">Com Erro</SelectItem>
            </SelectContent>
          </Select>

          <Select value={eventFilter} onValueChange={setEventFilter}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Tipo de Evento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Eventos</SelectItem>
              {uniqueEventTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {getEventInfo(type).name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border p-4">
            <p className="text-sm text-neutral-500">Total de Eventos</p>
            <p className="text-2xl font-bold text-neutral-900">{logs.length}</p>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <p className="text-sm text-neutral-500">Confirmados</p>
            <p className="text-2xl font-bold text-green-600">
              {logs.filter(l => l.event_type.includes("CONFIRMED") || l.event_type.includes("RECEIVED")).length}
            </p>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <p className="text-sm text-neutral-500">Atrasados</p>
            <p className="text-2xl font-bold text-neutral-600">
              {logs.filter(l => l.event_type.includes("OVERDUE")).length}
            </p>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <p className="text-sm text-neutral-500">Com Erro</p>
            <p className="text-2xl font-bold text-neutral-600">
              {logs.filter(l => l.status === "error").length}
            </p>
          </div>
        </div>

        {/* Logs List */}
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          {logs.length === 0 ? (
            <div className="text-center py-12">
              <CreditCard className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
              <p className="text-neutral-500">Nenhum evento registrado</p>
            </div>
          ) : (
            <div className="divide-y divide-neutral-100">
              {logs.map((log) => {
                const eventInfo = getEventInfo(log.event_type);
                const EventIcon = eventInfo.icon;
                const paymentInfo = extractPaymentInfo(log.payload);

                return (
                  <div key={log.id}>
                    <button
                      onClick={() => toggleExpand(log.id)}
                      className="w-full px-6 py-4 flex items-center justify-between hover:bg-neutral-50 transition-colors text-left"
                    >
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "p-2 rounded-lg",
                          log.event_type.includes("CONFIRMED") || log.event_type.includes("RECEIVED")
                            ? "bg-green-100"
                            : "bg-neutral-100"
                        )}>
                          <EventIcon className={cn(
                            "w-5 h-5",
                            log.event_type.includes("CONFIRMED") || log.event_type.includes("RECEIVED")
                              ? "text-green-600"
                              : "text-neutral-600"
                          )} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-neutral-900">
                            {eventInfo.name}
                          </p>
                          <p className="text-xs text-neutral-500">
                            {formatDate(log.created_at)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {paymentInfo && (
                          <span className="text-sm font-medium text-neutral-700">
                            {formatCurrency(paymentInfo.valor)}
                          </span>
                        )}
                        {getStatusBadge(log.status)}
                        {expandedLogs.has(log.id) ? (
                          <ChevronUp className="w-4 h-4 text-neutral-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-neutral-400" />
                        )}
                      </div>
                    </button>

                    {expandedLogs.has(log.id) && (
                      <div className="px-6 pb-4 bg-neutral-50">
                        {/* Erro */}
                        {log.error_message && (() => {
                          const errorInfo = formatErrorMessage(log.error_message);
                          return (
                            <div className="mb-4 p-4 bg-neutral-100 border border-neutral-200 rounded-lg">
                              <div className="flex items-start gap-3">
                                <div className="p-1.5 bg-neutral-200 rounded-full">
                                  <AlertCircle className="w-4 h-4 text-neutral-600" />
                                </div>
                                <div className="flex-1">
                                  <p className="text-sm font-semibold text-neutral-800">
                                    {errorInfo.title}
                                  </p>
                                  <p className="text-sm text-neutral-600 mt-1">
                                    {errorInfo.description}
                                  </p>
                                  <p className="text-xs text-neutral-500 mt-2">
                                    💡 {errorInfo.solution}
                                  </p>
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteLog(log.id);
                                  }}
                                  className="p-1.5 hover:bg-neutral-200 rounded-md transition-colors"
                                  title="Excluir log"
                                >
                                  <X className="w-4 h-4 text-neutral-400 hover:text-neutral-600" />
                                </button>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Informações do Pagamento */}
                        {paymentInfo && (
                          <div className="bg-white rounded-lg border p-4 mb-4">
                            <h4 className="text-sm font-semibold text-neutral-700 mb-3">
                              Detalhes da Cobrança
                            </h4>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                              <div>
                                <p className="text-xs text-neutral-500">Valor</p>
                                <p className="text-sm font-medium text-neutral-900">
                                  {formatCurrency(paymentInfo.valor)}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-neutral-500">Valor Líquido</p>
                                <p className="text-sm font-medium text-neutral-900">
                                  {formatCurrency(paymentInfo.valorLiquido)}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-neutral-500">Vencimento</p>
                                <p className="text-sm font-medium text-neutral-900">
                                  {formatDateShort(paymentInfo.vencimento)}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-neutral-500">Status do Pagamento</p>
                                <p className="text-sm font-medium text-neutral-900">
                                  {translatePaymentStatus(paymentInfo.status)}
                                </p>
                              </div>
                              <div className="col-span-2">
                                <p className="text-xs text-neutral-500">Descrição</p>
                                <p className="text-sm font-medium text-neutral-900">
                                  {paymentInfo.descricao || "—"}
                                </p>
                              </div>
                            </div>
                            {paymentInfo.linkPagamento && (
                              <a
                                href={paymentInfo.linkPagamento}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 mt-3 text-sm text-green-600 hover:text-green-700"
                              >
                                Ver fatura completa →
                              </a>
                            )}
                          </div>
                        )}

                        {/* Descrição do evento */}
                        <p className="text-sm text-neutral-600 mb-3">
                          {eventInfo.description}
                        </p>

                        {/* Toggle para dados técnicos */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleTechnical(log.id);
                          }}
                          className="text-xs text-neutral-500 hover:text-neutral-700 underline"
                        >
                          {showTechnical.has(log.id) ? "Ocultar dados técnicos" : "Ver dados técnicos"}
                        </button>

                        {showTechnical.has(log.id) && (
                          <div className="mt-3">
                            <pre className="p-3 bg-neutral-900 text-neutral-100 rounded-lg text-xs overflow-x-auto max-h-64">
                              {JSON.stringify(log.payload, null, 2)}
                            </pre>
                          </div>
                        )}

                        {log.processed_at && (
                          <p className="text-xs text-neutral-500 mt-3">
                            Processado em: {formatDate(log.processed_at)}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
