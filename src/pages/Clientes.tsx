import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useProposals } from "@/contexts/ProposalsContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  Search,
  User,
  Phone,
  FileText,
  Plus,
  ChevronRight,
  CheckCircle,
  Clock,
  TrendingUp,
  Lock,
  Crown,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Limites de clientes novos por mês por plano
// - free (Grátis): 5 após trial
// - essential (Mensal R$97): 30/mês
// - pro (Anual R$804): Ilimitado
const CLIENT_LIMITS = {
  free: 5,
  essential: 30,
  pro: Infinity,
  admin: Infinity,
};

interface Client {
  id: string;
  name: string;
  phone: string;
  email: string;
  proposalsCount: number;
  approvedCount: number;
  totalValue: number;
  lastProposalDate: string;
}

export default function Clientes() {
  const navigate = useNavigate();
  const { proposals } = useProposals();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");

  // Determinar plano do usuário para limites
  const userPlan = useMemo((): "free" | "essential" | "pro" | "admin" => {
    if (user?.isAdmin) return "admin";
    if (!user?.plan) return "free";
    if (user.plan === "Mensal") return "essential";
    if (user.plan === "Anual") return "pro";
    if (user.plan === "Admin") return "admin";
    return "free";
  }, [user?.plan, user?.isAdmin]);

  // Se está no trial, clientes ilimitados. Depois, aplica limite
  const clientLimit = user?.isInTrial ? Infinity : CLIENT_LIMITS[userPlan];

  // Extrair clientes únicos das propostas
  const clients = useMemo(() => {
    const clientMap = new Map<string, Client>();

    proposals.forEach((proposal) => {
      const clientKey = proposal.client.phone || proposal.client.name;

      if (clientMap.has(clientKey)) {
        const existing = clientMap.get(clientKey)!;
        existing.proposalsCount++;
        existing.totalValue += proposal.total;
        if (proposal.status === "approved") {
          existing.approvedCount++;
        }
        if (new Date(proposal.createdAt) > new Date(existing.lastProposalDate)) {
          existing.lastProposalDate = proposal.createdAt;
        }
      } else {
        clientMap.set(clientKey, {
          id: clientKey,
          name: proposal.client.name,
          phone: proposal.client.phone,
          email: proposal.client.email,
          proposalsCount: 1,
          approvedCount: proposal.status === "approved" ? 1 : 0,
          totalValue: proposal.total,
          lastProposalDate: proposal.createdAt,
        });
      }
    });

    return Array.from(clientMap.values()).sort((a, b) =>
      new Date(b.lastProposalDate).getTime() - new Date(a.lastProposalDate).getTime()
    );
  }, [proposals]);

  // Total de clientes (antes do limite)
  const totalClientsCount = clients.length;

  // Aplicar limite de clientes visíveis baseado no plano
  const limitedClients = useMemo(() => {
    if (clientLimit === Infinity) return clients;
    return clients.slice(0, clientLimit);
  }, [clients, clientLimit]);

  // Quantos clientes estão ocultos pelo limite
  const hiddenClientsCount = Math.max(0, totalClientsCount - (clientLimit === Infinity ? totalClientsCount : clientLimit));

  // Filtrar clientes (já limitados)
  const filteredClients = useMemo(() => {
    if (!searchTerm) return limitedClients;
    const term = searchTerm.toLowerCase();
    return limitedClients.filter(
      (client) =>
        client.name.toLowerCase().includes(term) ||
        client.phone.includes(term)
    );
  }, [limitedClients, searchTerm]);

  // Estatísticas
  const stats = useMemo(() => {
    const totalClients = clients.length;
    const totalApproved = clients.reduce((sum, c) => sum + c.approvedCount, 0);
    const totalValue = clients.reduce((sum, c) => sum + c.totalValue, 0);
    return { totalClients, totalApproved, totalValue };
  }, [clients]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Hoje";
    if (diffDays === 1) return "Ontem";
    if (diffDays < 7) return `${diffDays} dias atrás`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} sem. atrás`;
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  };

  const handleNewProposal = (client: Client) => {
    // Navegar para nova proposta com dados do cliente preenchidos
    navigate("/propostas/nova", {
      state: {
        clientName: client.name,
        clientPhone: client.phone,
        clientEmail: client.email
      }
    });
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="flex items-center justify-between pb-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-neutral-900">
              Clientes
            </h1>
            <p className="text-sm text-neutral-500 mt-0.5">
              {stats.totalClients} {stats.totalClients === 1 ? "cliente" : "clientes"}
            </p>
          </div>
        </header>

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4">
          <div className="bg-white rounded-lg sm:rounded-xl border border-neutral-200 p-2.5 sm:p-3 animate-card-in card-lift">
            <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
              <User size={12} className="sm:w-3.5 sm:h-3.5 text-neutral-400" />
              <span className="text-[10px] sm:text-xs text-neutral-500">Clientes</span>
            </div>
            <p className="text-base sm:text-lg font-bold text-neutral-900">{stats.totalClients}</p>
          </div>
          <div className="bg-white rounded-lg sm:rounded-xl border border-neutral-200 p-2.5 sm:p-3 animate-card-in stagger-1 card-lift">
            <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
              <CheckCircle size={12} className="sm:w-3.5 sm:h-3.5 text-green-500" />
              <span className="text-[10px] sm:text-xs text-neutral-500">Aprovadas</span>
            </div>
            <p className="text-base sm:text-lg font-bold text-green-600">{stats.totalApproved}</p>
          </div>
          <div className="bg-white rounded-lg sm:rounded-xl border border-neutral-200 p-2.5 sm:p-3 animate-card-in stagger-2 card-lift">
            <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
              <TrendingUp size={12} className="sm:w-3.5 sm:h-3.5 text-green-500" />
              <span className="text-[10px] sm:text-xs text-neutral-500">Total</span>
            </div>
            <p className="text-sm sm:text-lg font-bold text-green-600 truncate">{formatCurrency(stats.totalValue)}</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-3 sm:mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
          <Input
            placeholder="Buscar cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 sm:pl-10 h-10 sm:h-11 rounded-lg sm:rounded-xl bg-white border-neutral-200 text-sm sm:text-base"
          />
        </div>

        {/* Banner de limite atingido */}
        {hiddenClientsCount > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 sm:p-4 mb-3 sm:mb-4 animate-card-in">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <Lock size={18} className="text-amber-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-amber-900 text-sm">
                  +{hiddenClientsCount} cliente{hiddenClientsCount !== 1 ? 's' : ''} oculto{hiddenClientsCount !== 1 ? 's' : ''}
                </p>
                <p className="text-amber-700 text-xs mt-0.5">
                  Plano Grátis mostra apenas os mais recentes
                </p>
              </div>
              <Button
                size="sm"
                className="bg-amber-500 hover:bg-amber-600 text-white text-xs h-8"
                asChild
              >
                <Link to="/upgrade">
                  <Crown size={12} className="mr-1" />
                  Upgrade
                </Link>
              </Button>
            </div>
          </div>
        )}

        {/* Clients List */}
        {filteredClients.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-neutral-200">
            <div className="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center mx-auto mb-4">
              <User className="w-8 h-8 text-neutral-400" />
            </div>
            <h2 className="text-lg font-semibold text-neutral-900 mb-2">
              {searchTerm ? "Nenhum cliente encontrado" : "Nenhum cliente ainda"}
            </h2>
            <p className="text-neutral-500 mb-4">
              {searchTerm
                ? "Tente buscar com outros termos"
                : "Seus clientes aparecerão aqui quando você criar propostas"}
            </p>
            <Button asChild>
              <Link to="/propostas/nova">
                <Plus size={16} className="mr-2" />
                Nova Proposta
              </Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredClients.map((client, index) => (
              <div
                key={client.id}
                className="bg-white rounded-lg sm:rounded-xl border border-neutral-200 p-3 sm:p-4 hover:border-neutral-300 active:bg-neutral-50 transition-all touch-feedback animate-card-in list-item-interactive card-lift"
                style={{ animationDelay: `${Math.min(index * 0.05, 0.4)}s` }}
              >
                <div className="flex items-center gap-2.5 sm:gap-3">
                  {/* Avatar */}
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-base sm:text-lg font-semibold text-green-600">
                      {client.name.charAt(0).toUpperCase()}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                      <h3 className="font-semibold text-neutral-900 truncate text-sm sm:text-base">
                        {client.name}
                      </h3>
                      {client.approvedCount > 0 && (
                        <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-[9px] sm:text-[10px] font-medium rounded flex-shrink-0">
                          {client.approvedCount} aprovada{client.approvedCount !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 mt-0.5 sm:mt-1">
                      {client.phone && (
                        <span className="text-xs sm:text-sm text-neutral-500 flex items-center gap-1">
                          <Phone size={10} className="sm:w-3 sm:h-3" />
                          {client.phone}
                        </span>
                      )}
                      <span className="text-xs sm:text-sm text-neutral-400">
                        {client.proposalsCount} proposta{client.proposalsCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>

                  {/* Value & Actions */}
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-green-600 text-sm sm:text-base">{formatCurrency(client.totalValue)}</p>
                    <p className="text-[10px] sm:text-xs text-neutral-400">{formatDate(client.lastProposalDate)}</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-1.5 sm:gap-2 mt-2.5 sm:mt-3 pt-2.5 sm:pt-3 border-t border-neutral-100">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-8 sm:h-9 text-xs sm:text-sm"
                    onClick={() => handleNewProposal(client)}
                  >
                    <Plus size={12} className="sm:w-3.5 sm:h-3.5 mr-1" />
                    <span className="hidden sm:inline">Nova Proposta</span>
                    <span className="sm:hidden">Nova</span>
                  </Button>
                  {client.phone && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 sm:h-9 px-2 sm:px-3"
                      asChild
                    >
                      <a
                        href={`https://wa.me/55${client.phone.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-[#25D366]">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                        </svg>
                      </a>
                    </Button>
                  )}
                  <Link
                    to={`/propostas?cliente=${encodeURIComponent(client.name)}`}
                    className="h-8 sm:h-9 px-2 sm:px-3 inline-flex items-center justify-center rounded-md border border-neutral-200 text-xs sm:text-sm font-medium hover:bg-neutral-50 active:bg-neutral-100 transition-colors touch-feedback btn-press"
                  >
                    <FileText size={12} className="sm:w-3.5 sm:h-3.5 mr-1" />
                    <span className="hidden sm:inline">Ver Propostas</span>
                    <span className="sm:hidden">Ver</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
