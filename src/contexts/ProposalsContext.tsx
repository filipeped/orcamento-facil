import { createContext, useContext, useState, useEffect, ReactNode, useMemo, useCallback } from "react";
import { getSupabase } from "@/lib/supabase";
import { useAuth } from "./AuthContext";
import {
  createProposalViewedNotification,
  createProposalApprovedNotification,
} from "./NotificationsContext";

// Função para gerar slug do nome do cliente
const generateSlug = (name: string): string => {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove acentos
    .replace(/[^a-z0-9]+/g, "-") // Substitui caracteres especiais por hífen
    .replace(/^-+|-+$/g, "") // Remove hífens do início e fim
    .substring(0, 30); // Limita tamanho
};

// Verifica se é um UUID válido
const isUUID = (str: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
};

// Limites de propostas por plano
// - free (Grátis): 0 propostas/mês após trial - FORÇA UPGRADE
// - essential (Mensal R$97): 30 propostas/mês, 3 meses histórico
// - pro (Anual R$804/ano): Ilimitado
//
// TRIAL (3 dias):
// - 5 propostas ENVIADAS (não criadas)
// - Se cliente aprovar: +48h e encerra trial
//
// FLUXO:
// 1. Novo usuário → Trial 3 dias (5 propostas enviadas)
// 2. Trial acaba → Grátis (0 propostas, só visualiza histórico)
// 3. Quer criar mais → Paga Mensal ou Anual
export const PLAN_LIMITS = {
  free: { proposalsPerMonth: 0, historyDays: 30 },
  essential: { proposalsPerMonth: 30, historyDays: 90 },
  pro: { proposalsPerMonth: Infinity, historyDays: Infinity },
  admin: { proposalsPerMonth: Infinity, historyDays: Infinity },
};

// Limite de propostas ENVIADAS durante o trial — Infinity = ilimitado nos 7 dias
export const TRIAL_SENT_LIMIT = Infinity;

export interface ProposalItem {
  id: string;
  name: string;
  description: string;
  quantity: number;
  unitPrice: number;
  imageUrl?: string;
  photos?: string[]; // Galeria de fotos do item
  unit?: string; // Unidade de medida (un, m, m², kg, etc.)
  nomeCientifico?: string; // Nome científico da planta
  discount?: {
    amount: number;
    type: "fixed" | "percentage";
  };
}

// Calcula o subtotal de um item já considerando desconto.
// Se a coluna discount_* não existir no banco (Jardinei legacy), o item.discount vem undefined.
export function itemSubtotal(item: ProposalItem): number {
  const base = item.quantity * item.unitPrice;
  if (!item.discount || !item.discount.amount) return base;
  if (item.discount.type === "percentage") {
    return Math.max(0, base * (1 - item.discount.amount / 100));
  }
  return Math.max(0, base - item.discount.amount);
}

export interface ProposalClient {
  id: string;
  name: string;
  email: string;
  phone: string;
}

export type ServiceType =
  | "servico"
  | "manutencao"
  | "instalacao"
  | "reparo"
  | "consultoria"
  | "paisagismo"
  | "outro";

export const SERVICE_TYPES: Record<ServiceType, { label: string; icon: string }> = {
  servico: { label: "Serviço", icon: "briefcase" },
  manutencao: { label: "Manutenção", icon: "wrench" },
  instalacao: { label: "Instalação", icon: "tool" },
  reparo: { label: "Reparo", icon: "hammer" },
  consultoria: { label: "Consultoria", icon: "message-square" },
  paisagismo: { label: "Paisagismo", icon: "palette" },
  outro: { label: "Outro", icon: "clipboard-list" },
};

// O CHECK constraint do banco (compartilhado com Jardinei produção) só aceita
// 'manutencao', 'paisagismo', 'outro'. Mapeamos os 7 tipos da UI pra esses 3
// no momento de salvar — preserva legado sem alterar schema.
function mapServiceTypeForDB(t: ServiceType): "manutencao" | "paisagismo" | "outro" {
  if (t === "manutencao" || t === "reparo") return "manutencao";
  if (t === "paisagismo") return "paisagismo";
  return "outro";
}

export interface CompanyInfo {
  name: string;
  logoUrl?: string;
  phone?: string;
  email?: string;
  address?: string;
  instagram?: string;
  bio?: string;
  ownerName?: string;
  ownerPhoto?: string;
}

export type DocType = "orcamento" | "fatura" | "recibo";
export type PaymentStatus = "pendente" | "parcial" | "pago" | "cancelado";

export interface Proposal {
  id: string;
  shortId?: string;
  client: ProposalClient;
  serviceType: ServiceType;
  title: string;
  description: string;
  items: ProposalItem[];
  notes: string;
  validUntil: string;
  status: "draft" | "sent" | "viewed" | "approved" | "expired";
  total: number;
  createdAt: string;
  sentAt?: string;
  viewedAt?: string;
  approvedAt?: string;
  signature?: string;
  company?: CompanyInfo;
  // FechaAqui v2 — doc types
  docType?: DocType;
  sequenceNumber?: number;
  poNumber?: string;
  paymentStatus?: PaymentStatus;
  amountPaid?: number;
  dueDate?: string;
  parentProposalId?: string;
}

// Label visual de cada tipo de doc
export const DOC_TYPE_LABELS: Record<DocType, { singular: string; pluralAccusative: string; pdfTitle: string }> = {
  orcamento: { singular: "Orçamento", pluralAccusative: "orçamentos", pdfTitle: "ORÇAMENTO" },
  fatura: { singular: "Fatura", pluralAccusative: "faturas", pdfTitle: "FATURA" },
  recibo: { singular: "Recibo", pluralAccusative: "recibos", pdfTitle: "RECIBO" },
};

export function formatSequenceNumber(seq: number | undefined | null): string {
  if (!seq) return "";
  return `#${String(seq).padStart(4, "0")}`;
}

interface ProposalsContextType {
  proposals: Proposal[];
  visibleProposals: Proposal[]; // Propostas visíveis (filtradas por histórico)
  hiddenProposalsCount: number; // Quantas propostas estão ocultas pelo limite de histórico
  isLoading: boolean;
  createProposal: (data: Omit<Proposal, "id" | "createdAt" | "status" | "total">) => Promise<Proposal | null>;
  updateProposal: (id: string, data: Partial<Proposal>) => Promise<void>;
  deleteProposal: (id: string) => Promise<void>;
  duplicateProposal: (id: string) => Promise<Proposal | null>;
  // FechaAqui v2 — converte orçamento aprovado em fatura ou fatura paga em recibo.
  convertProposalDoc: (id: string, targetType: DocType) => Promise<Proposal | null>;
  getProposal: (id: string) => Proposal | undefined;
  getProposalById: (id: string) => Promise<Proposal | null>;
  markAsSent: (id: string) => Promise<void>;
  markAsViewed: (id: string) => Promise<void>;
  markAsApproved: (id: string, signature: string) => Promise<void>;
  refreshProposals: () => Promise<void>;
  // Limites de plano
  monthlyProposalsCount: number;
  monthlyLimit: number;
  canCreateProposal: boolean;
  userPlan: "free" | "essential" | "pro" | "admin";
  // Histórico
  historyDays: number;
  // Bloqueio por inadimplência
  isBlocked: boolean;
  blockReason: string | null;
}

const ProposalsContext = createContext<ProposalsContextType | undefined>(undefined);

// Calculate proposal total
function calculateTotal(items: ProposalItem[]): number {
  return items.reduce((sum, item) => sum + itemSubtotal(item), 0);
}

export function ProposalsProvider({ children }: { children: ReactNode }) {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userPlan, setUserPlan] = useState<"free" | "essential" | "pro" | "admin">("free");
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockReason, setBlockReason] = useState<string | null>(null);

  // Buscar plano do usuário do banco de dados
  useEffect(() => {
    async function fetchUserPlan() {
      if (!user?.id) return;
      try {
        const { data } = await getSupabase()
          .from("profiles")
          .select("plan, plan_status, plan_expires_at, plan_overdue_since, is_admin")
          .eq("user_id", user.id)
          .single();

        // Resetar bloqueio
        setIsBlocked(false);
        setBlockReason(null);

        // Admin tem tudo liberado
        if (data?.is_admin) {
          setUserPlan("admin");
          return;
        }

        if (data?.plan && ["free", "essential", "pro"].includes(data.plan)) {
          const now = new Date();

          // Verificar se está overdue há mais de 7 dias
          if (data.plan_status === "overdue" && data.plan_overdue_since) {
            const overdueSince = new Date(data.plan_overdue_since);
            const daysSinceOverdue = Math.floor((now.getTime() - overdueSince.getTime()) / (1000 * 60 * 60 * 24));

            if (daysSinceOverdue >= 7) {
              // Periodo de graca expirou - volta pro Grátis (NAO bloqueia)
              setUserPlan("free");
              setIsBlocked(false);
              setBlockReason(null);

              // Atualizar no banco
              await getSupabase()
                .from("profiles")
                .update({
                  plan: "free",
                  plan_status: "active", // Volta pro Grátis ativo
                  plan_overdue_since: null,
                  updated_at: new Date().toISOString(),
                })
                .eq("user_id", user.id);

              // Notificar que voltou pro Grátis
              const { data: existingNotification } = await getSupabase()
                .from("notifications")
                .select("id")
                .eq("user_id", user.id)
                .eq("type", "plan_downgraded")
                .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
                .single();

              if (!existingNotification) {
                await getSupabase().from("notifications").insert({
                  user_id: user.id,
                  type: "plan_downgraded",
                  title: "Plano alterado para Grátis",
                  message: "Seu plano foi alterado para Grátis (0 propostas/mês). Assine Mensal ou Anual para mais.",
                  read: false,
                });
              }

              return;
            }
          }

          // Plano expirado = volta pro plano Grátis (NAO bloqueia)
          if (data.plan_status === "expired") {
            setUserPlan("free");
            setIsBlocked(false); // NAO bloqueia, volta pro Grátis
            setBlockReason(null);
            return;
          }

          // Backward compatibility: usuários antigos com trial -> volta pro Grátis
          if (data.plan_status === "trial") {
            setUserPlan("free");
            setIsBlocked(false);
            setBlockReason(null);

            await getSupabase()
              .from("profiles")
              .update({
                plan: "free",
                plan_status: "active",
                updated_at: new Date().toISOString(),
              })
              .eq("user_id", user.id);

            return;
          }

          // Assinatura cancelada
          if (data.plan_status === "cancelled" && data.plan_expires_at) {
            const expiresAt = new Date(data.plan_expires_at);
            if (expiresAt > now) {
              // Ainda tem acesso ate expirar
              setUserPlan(data.plan as "free" | "essential" | "pro" | "admin");
            } else {
              // Expirou = volta pro Grátis (NAO bloqueia)
              setUserPlan("free");
              setIsBlocked(false);
              setBlockReason(null);
            }
          } else {
            // Plano ativo ou Grátis
            setUserPlan(data.plan as "free" | "essential" | "pro" | "admin");
          }
        }
      } catch (error) {
        console.error("Error fetching user plan:", error);
      }
    }
    fetchUserPlan();
  }, [user?.id]);

  // TRIAL: 3 dias com limite de 5 propostas ENVIADAS
  // Após trial: aplica limite do plano (0 para Grátis)
  const monthlyLimit = user?.isInTrial ? TRIAL_SENT_LIMIT : PLAN_LIMITS[userPlan].proposalsPerMonth;

  // Limite de histórico (dias)
  // Durante trial: ilimitado. Depois: conforme plano
  const historyDays = user?.isInTrial ? Infinity : PLAN_LIMITS[userPlan].historyDays;

  // Filtrar propostas por limite de histórico
  const { visibleProposals, hiddenProposalsCount } = useMemo(() => {
    if (historyDays === Infinity) {
      return { visibleProposals: proposals, hiddenProposalsCount: 0 };
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - historyDays);

    const visible = proposals.filter((p) => {
      const createdAt = new Date(p.createdAt);
      return createdAt >= cutoffDate;
    });

    return {
      visibleProposals: visible,
      hiddenProposalsCount: proposals.length - visible.length,
    };
  }, [proposals, historyDays]);

  // Contar propostas ENVIADAS no mês atual (não rascunhos)
  // Durante o trial, conta todas as enviadas (não apenas do mês)
  const monthlyProposalsCount = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Durante o trial: conta TODAS as propostas enviadas (desde o início)
    if (user?.isInTrial) {
      return proposals.filter((p) => p.status !== 'draft').length;
    }

    // Após o trial: conta propostas enviadas no mês atual
    return proposals.filter((p) => {
      const createdAt = new Date(p.createdAt);
      return createdAt >= startOfMonth && p.status !== 'draft';
    }).length;
  }, [proposals, user?.isInTrial]);

  // Pode criar proposta se: não está bloqueado E não atingiu o limite mensal
  const canCreateProposal = !isBlocked && monthlyProposalsCount < monthlyLimit;

  // Log para debug
  if (user?.plan === "Grátis") {
    console.log("📊 Limite propostas ENVIADAS:", monthlyLimit, user?.isInTrial ? "(trial)" : "(plano)", "| Enviadas:", monthlyProposalsCount);
  }

  // Fetch proposals from Supabase (optimized with JOIN)
  const fetchProposals = async () => {
    // Aguardar autenticação carregar antes de definir estado
    if (isAuthLoading) {
      return;
    }

    if (!user) {
      setProposals([]);
      setIsLoading(false);
      return;
    }

    try {
      // Single query with JOIN to fetch proposals and items together
      const { data: proposalsData, error } = await getSupabase()
        .from("proposals")
        .select(`
          *,
          proposal_items (*)
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Transform data
      const proposalsWithItems: Proposal[] = (proposalsData || []).map((p) => {
        const items = p.proposal_items || [];
        return {
          id: p.id,
          shortId: p.short_id,
          client: {
            id: p.client_id || "",
            name: p.client_name,
            email: p.client_email || "",
            phone: p.client_phone || "",
          },
          serviceType: p.service_type as ServiceType,
          title: p.title,
          description: p.description || "",
          items: items.map((item: { id: string; name: string; description?: string; quantity: number; unit_price: number; image_url?: string; photos?: string[]; unit?: string; nome_cientifico?: string; discount_amount?: number; discount_type?: "fixed" | "percentage" | null }) => ({
            id: item.id,
            name: item.name,
            description: item.description || "",
            quantity: item.quantity,
            unitPrice: Number(item.unit_price),
            imageUrl: item.image_url,
            photos: item.photos || [],
            unit: item.unit || "un",
            discount: item.discount_amount && item.discount_type
              ? { amount: Number(item.discount_amount), type: item.discount_type }
              : undefined,
            nomeCientifico: item.nome_cientifico || undefined,
          })),
          notes: p.notes || "",
          validUntil: p.valid_until,
          status: p.status as Proposal["status"],
          total: Number(p.total),
          createdAt: p.created_at,
          sentAt: p.sent_at,
          viewedAt: p.viewed_at,
          approvedAt: p.approved_at,
          signature: p.signature,
          // FechaAqui v2 — doc types
          docType: (p.doc_type as DocType) || "orcamento",
          sequenceNumber: p.sequence_number ?? undefined,
          poNumber: p.po_number ?? undefined,
          paymentStatus: (p.payment_status as PaymentStatus) ?? undefined,
          amountPaid: p.amount_paid != null ? Number(p.amount_paid) : undefined,
          dueDate: p.due_date ?? undefined,
          parentProposalId: p.parent_proposal_id ?? undefined,
          company: p.company_name ? {
            name: p.company_name,
            logoUrl: p.company_logo || undefined,
            phone: p.company_phone || undefined,
            email: p.company_email || undefined,
          } : undefined,
        };
      });

      setProposals(proposalsWithItems);
    } catch (error) {
      console.error("Error fetching proposals:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProposals();
  }, [user, isAuthLoading]);

  const refreshProposals = async () => {
    setIsLoading(true);
    await fetchProposals();
  };

  const createProposal = async (data: Omit<Proposal, "id" | "createdAt" | "status" | "total">): Promise<Proposal | null> => {
    if (!user) return null;

    // Verificar se está bloqueado por inadimplência
    if (isBlocked) {
      throw new Error(blockReason || "Sua conta está bloqueada. Regularize o pagamento para criar propostas.");
    }

    // Verificar limite de propostas do plano
    if (monthlyProposalsCount >= monthlyLimit) {
      // Enviar notificação de limite atingido (apenas uma vez por mês)
      const limitKey = `fechaaqui_limit_notified_${new Date().getMonth()}_${new Date().getFullYear()}`;
      if (!localStorage.getItem(limitKey)) {
        localStorage.setItem(limitKey, "true");
        // Buscar telefone e enviar WhatsApp
        const { data: profile } = await getSupabase()
          .from("profiles")
          .select("phone, full_name")
          .eq("user_id", user.id)
          .single();

        if (profile?.phone) {
          fetch("/api/notifications", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              channel: "whatsapp",
              to: profile.phone,
              type: "limit_reached",
              data: { name: profile.full_name?.split(" ")[0] || "Cliente" },
            }),
          }).catch(() => {}); // Silently fail
        }
      }
      const errorMsg = user?.isInTrial
        ? `Limite de ${monthlyLimit} propostas enviadas no trial. Faça upgrade para continuar.`
        : monthlyLimit === 0
        ? `Seu trial acabou. Faça upgrade para criar propostas.`
        : `Limite de ${monthlyLimit} propostas/mês atingido. Faça upgrade para criar mais.`;
      throw new Error(errorMsg);
    }

    try {
      const total = calculateTotal(data.items as ProposalItem[]);

      // Gerar código único de 6 caracteres (como o que aparece no orçamento)
      const generateUniqueCode = () => {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        let code = "";
        for (let i = 0; i < 6; i++) {
          code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
      };

      // Gerar slug único: codigo/nome_cliente (formato URL amigável)
      const clientSlug = generateSlug(data.client.name);
      const uniqueCode = generateUniqueCode();
      const shortId = `${uniqueCode}/${clientSlug}`;

      // Fetch company info from user profile
      const { data: profile } = await getSupabase()
        .from("profiles")
        .select("company_name, logo_url, phone, address")
        .eq("user_id", user.id)
        .single();

      // Calcula próximo sequence_number do user (FechaAqui v2)
      const { data: lastSeq } = await getSupabase()
        .from("proposals")
        .select("sequence_number")
        .eq("user_id", user.id)
        .order("sequence_number", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      const nextSequence = ((lastSeq as { sequence_number?: number } | null)?.sequence_number || 0) + 1;

      // Insert proposal with company info
      const { data: newProposal, error: proposalError } = await getSupabase()
        .from("proposals")
        .insert({
          user_id: user.id,
          short_id: shortId,
          client_name: data.client.name,
          client_email: data.client.email,
          client_phone: data.client.phone,
          service_type: mapServiceTypeForDB(data.serviceType),
          title: data.title,
          description: data.description,
          notes: data.notes,
          valid_until: data.validUntil,
          status: "draft",
          total,
          company_name: profile?.company_name || user.name || "Minha Empresa",
          company_logo: profile?.logo_url || null,
          company_phone: profile?.phone || null,
          company_email: user.email || null,
          // FechaAqui v2 — defaults pra orçamento. Se a coluna não existir (Jardinei
          // antes da migration), Supabase ignora o campo. Tem que estar lá pra funcionar.
          doc_type: data.docType || "orcamento",
          sequence_number: nextSequence,
        })
        .select()
        .single();

      if (proposalError) throw proposalError;

      // Insert items
      if (data.items.length > 0) {
        const itemsToInsert = data.items.map((item) => ({
          proposal_id: newProposal.id,
          name: item.name,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          image_url: item.imageUrl,
          photos: item.photos || [],
          unit: item.unit || "un",
          nome_cientifico: item.nomeCientifico || null,
          discount_amount: item.discount?.amount || 0,
          discount_type: item.discount?.type || null,
        }));

        const { error: itemsError } = await getSupabase()
          .from("proposal_items")
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;
      }

      // Refresh proposals list
      await fetchProposals();

      // Return the created proposal
      return {
        id: newProposal.id,
        shortId: newProposal.short_id,
        client: data.client,
        serviceType: data.serviceType,
        title: data.title,
        description: data.description,
        items: data.items as ProposalItem[],
        notes: data.notes,
        validUntil: data.validUntil,
        status: "draft",
        total,
        createdAt: newProposal.created_at,
        company: {
          name: profile?.company_name || user.name || "Minha Empresa",
          logoUrl: profile?.logo_url || undefined,
          phone: profile?.phone || undefined,
          email: user.email || undefined,
        },
      };
    } catch (error) {
      console.error("Error creating proposal:", error);
      return null;
    }
  };

  const updateProposal = async (id: string, data: Partial<Proposal>) => {
    try {
      console.log("🔄 updateProposal chamado:", { id, data });
      const updateData: Record<string, unknown> = {};

      if (data.client) {
        updateData.client_name = data.client.name;
        updateData.client_email = data.client.email;
        updateData.client_phone = data.client.phone;
      }
      if (data.serviceType) updateData.service_type = mapServiceTypeForDB(data.serviceType);
      if (data.title) updateData.title = data.title;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.notes !== undefined) updateData.notes = data.notes;
      if (data.validUntil) updateData.valid_until = data.validUntil;
      if (data.status) updateData.status = data.status;
      if (data.items) updateData.total = calculateTotal(data.items);

      console.log("📤 Enviando para Supabase:", { id, updateData });

      const { error, data: result } = await getSupabase()
        .from("proposals")
        .update(updateData)
        .eq("id", id)
        .select();

      console.log("📥 Resposta Supabase:", { error, result });

      if (error) throw error;

      // Update items if provided
      if (data.items) {
        // Delete existing items
        await getSupabase().from("proposal_items").delete().eq("proposal_id", id);

        // Insert new items
        if (data.items.length > 0) {
          const itemsToInsert = data.items.map((item) => ({
            proposal_id: id,
            name: item.name,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unitPrice,
            image_url: item.imageUrl,
            photos: item.photos || [],
            unit: item.unit || "un",
            nome_cientifico: item.nomeCientifico || null,
            discount_amount: item.discount?.amount || 0,
            discount_type: item.discount?.type || null,
          }));

          await getSupabase().from("proposal_items").insert(itemsToInsert);
        }
      }

      await fetchProposals();
    } catch (error) {
      console.error("Error updating proposal:", error);
    }
  };

  const deleteProposal = async (id: string) => {
    try {
      const { error } = await getSupabase().from("proposals").delete().eq("id", id);
      if (error) throw error;
      setProposals((prev) => prev.filter((p) => p.id !== id));
    } catch (error) {
      console.error("Error deleting proposal:", error);
    }
  };

  const duplicateProposal = async (id: string): Promise<Proposal | null> => {
    const original = proposals.find((p) => p.id === id);
    if (!original) return null;

    return createProposal({
      client: original.client,
      serviceType: original.serviceType,
      title: `${original.title} (copia)`,
      description: original.description,
      items: original.items,
      notes: original.notes,
      validUntil: original.validUntil,
    });
  };

  const getProposal = (id: string): Proposal | undefined => {
    return proposals.find((p) => p.id === id || p.shortId === id);
  };

  // Get proposal by ID or short_id (for public page - doesn't require auth)
  const getProposalById = async (id: string): Promise<Proposal | null> => {
    try {
      // Determinar se é UUID ou short_id (slug do nome)
      const column = isUUID(id) ? "id" : "short_id";

      const { data: p, error } = await getSupabase()
        .from("proposals")
        .select("*")
        .eq(column, id)
        .single();

      if (error || !p) return null;

      const { data: items } = await getSupabase()
        .from("proposal_items")
        .select("*")
        .eq("proposal_id", p.id);

      return {
        id: p.id,
        shortId: p.short_id,
        client: {
          id: p.client_id || "",
          name: p.client_name,
          email: p.client_email || "",
          phone: p.client_phone || "",
        },
        serviceType: p.service_type as ServiceType,
        title: p.title,
        description: p.description || "",
        items: (items || []).map((item) => ({
          id: item.id,
          name: item.name,
          description: item.description || "",
          quantity: item.quantity,
          unitPrice: Number(item.unit_price),
          imageUrl: item.image_url,
          photos: item.photos || [],
          unit: item.unit || "un",
          nomeCientifico: item.nome_cientifico || undefined,
        })),
        notes: p.notes || "",
        validUntil: p.valid_until,
        status: p.status as Proposal["status"],
        total: Number(p.total),
        createdAt: p.created_at,
        sentAt: p.sent_at,
        viewedAt: p.viewed_at,
        approvedAt: p.approved_at,
        signature: p.signature,
        company: p.company_name ? {
          name: p.company_name,
          logoUrl: p.company_logo || undefined,
          phone: p.company_phone || undefined,
          email: p.company_email || undefined,
        } : undefined,
      };
    } catch (error) {
      console.error("Error fetching proposal:", error);
      return null;
    }
  };

  const markAsSent = async (id: string) => {
    try {
      const { error } = await getSupabase()
        .from("proposals")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;

      setProposals((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, status: "sent" as const, sentAt: new Date().toISOString() } : p
        )
      );
    } catch (error) {
      console.error("Error marking as sent:", error);
    }
  };

  const markAsViewed = async (id: string) => {
    try {
      // First check current status and get proposal details for notification
      const { data: current } = await getSupabase()
        .from("proposals")
        .select("status, user_id, title, client_name")
        .eq("id", id)
        .single();

      if (current?.status === "sent") {
        const { error } = await getSupabase()
          .from("proposals")
          .update({ status: "viewed", viewed_at: new Date().toISOString() })
          .eq("id", id);

        if (error) throw error;

        // Create notification for proposal owner (in-app only, sem WhatsApp)
        // O prestador vê a notificação no dashboard, não precisa de WhatsApp
        if (current.user_id) {
          await createProposalViewedNotification(
            current.user_id,
            id,
            current.title,
            current.client_name
          );
        }
      }
    } catch (error) {
      console.error("Error marking as viewed:", error);
    }
  };

  const markAsApproved = async (id: string, signature: string) => {
    try {
      // First get proposal details for notification
      const { data: proposal } = await getSupabase()
        .from("proposals")
        .select("user_id, title, client_name")
        .eq("id", id)
        .single();

      const { error } = await getSupabase()
        .from("proposals")
        .update({
          status: "approved",
          approved_at: new Date().toISOString(),
          signature,
        })
        .eq("id", id);

      if (error) throw error;

      // Create notification for proposal owner (in-app only)
      // WhatsApp é enviado apenas quando o CLIENTE aprova via /api/approve-proposal
      // Não enviamos WhatsApp aqui porque é o próprio prestador aprovando manualmente
      if (proposal?.user_id) {
        await createProposalApprovedNotification(
          proposal.user_id,
          id,
          proposal.title,
          proposal.client_name
        );
      }
    } catch (error) {
      console.error("Error marking as approved:", error);
    }
  };

  // FechaAqui v2 — converte orçamento aprovado em fatura ou fatura paga em recibo.
  // Cria nova entry no banco, copia items, gera novo sequence_number, mantém ref
  // ao parent_proposal_id pra rastreabilidade.
  const convertProposalDoc = async (id: string, targetType: DocType): Promise<Proposal | null> => {
    if (!user) return null;
    const original = proposals.find((p) => p.id === id);
    if (!original) return null;

    try {
      // Próximo sequence_number do user
      const { data: lastSeq } = await getSupabase()
        .from("proposals")
        .select("sequence_number")
        .eq("user_id", user.id)
        .order("sequence_number", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      const nextSequence = ((lastSeq as { sequence_number?: number } | null)?.sequence_number || 0) + 1;

      const { data: newProposal, error } = await getSupabase()
        .from("proposals")
        .insert({
          user_id: user.id,
          short_id: `${targetType.charAt(0).toUpperCase()}${nextSequence}-${Math.random().toString(36).substring(2, 6)}`,
          client_id: original.client.id || null,
          client_name: original.client.name,
          client_email: original.client.email,
          client_phone: original.client.phone,
          service_type: mapServiceTypeForDB(original.serviceType),
          title: original.title,
          description: original.description,
          notes: original.notes,
          valid_until: original.validUntil,
          status: "draft",
          total: original.total,
          company_name: original.company?.name || null,
          company_logo: original.company?.logoUrl || null,
          company_phone: original.company?.phone || null,
          company_email: original.company?.email || null,
          doc_type: targetType,
          sequence_number: nextSequence,
          parent_proposal_id: original.id,
          payment_status: targetType === "fatura" ? "pendente" : (targetType === "recibo" ? "pago" : null),
          amount_paid: targetType === "recibo" ? original.total : 0,
        })
        .select()
        .single();

      if (error) throw error;

      // Copia items
      if (original.items.length > 0) {
        const itemsToInsert = original.items.map((item) => ({
          proposal_id: newProposal.id,
          name: item.name,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          image_url: item.imageUrl,
          photos: item.photos || [],
          unit: item.unit || "un",
          nome_cientifico: item.nomeCientifico || null,
          discount_amount: item.discount?.amount || 0,
          discount_type: item.discount?.type || null,
        }));
        await getSupabase().from("proposal_items").insert(itemsToInsert);
      }

      await fetchProposals();
      return proposals.find((p) => p.id === newProposal.id) || null;
    } catch (err) {
      console.error("Erro convertProposalDoc:", err);
      return null;
    }
  };

  return (
    <ProposalsContext.Provider
      value={{
        proposals,
        visibleProposals,
        hiddenProposalsCount,
        isLoading,
        createProposal,
        updateProposal,
        deleteProposal,
        duplicateProposal,
        convertProposalDoc,
        getProposal,
        getProposalById,
        markAsSent,
        markAsViewed,
        markAsApproved,
        refreshProposals,
        // Limites de plano
        monthlyProposalsCount,
        monthlyLimit,
        canCreateProposal,
        userPlan,
        // Histórico
        historyDays,
        // Bloqueio por inadimplência
        isBlocked,
        blockReason,
      }}
    >
      {children}
    </ProposalsContext.Provider>
  );
}

export function useProposals() {
  const context = useContext(ProposalsContext);
  if (context === undefined) {
    throw new Error("useProposals must be used within a ProposalsProvider");
  }
  return context;
}
