import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { useProposals, Proposal } from "@/contexts/ProposalsContext";
import { getSupabase } from "@/lib/supabase";
import {
  Check,
  AlertCircle,
  CheckCircle2,
  Download,
  Leaf,
  Loader2,
  MessageCircle,
  CreditCard,
  QrCode,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ProposalStyle {
  showLogo: boolean;
  showCnpj: boolean;
  showAddress: boolean;
  showInstagram: boolean;
  showBio: boolean;
  primaryColor: string;
  footerText: string;
  paymentTerms: string;
  generalTerms: string;
}

interface ProfileData {
  bio: string;
  instagram: string;
  cnpj: string;
  address: string;
  logoUrl: string;
}

const defaultStyle: ProposalStyle = {
  showLogo: true,
  showCnpj: true,
  showAddress: true,
  showInstagram: true,
  showBio: true,
  primaryColor: "#16a34a",
  footerText: "",
  paymentTerms: "• 50% no fechamento do contrato\n• 50% na conclusão do serviço\n• Formas: transferência ou dinheiro",
  generalTerms: "• Garantia de 30 dias após a conclusão do serviço\n• Materiais inclusos conforme especificado acima\n• Prazo de execução a combinar após aprovação",
};

const defaultProfile: ProfileData = {
  bio: "",
  instagram: "",
  cnpj: "",
  address: "",
  logoUrl: "",
};

// Verifica se é um UUID válido
const isUUID = (str: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
};

export default function PropostaPublica() {
  const { id, code, name } = useParams<{ id?: string; code?: string; name?: string }>();
  // Combinar code/name no formato do short_id ou usar id diretamente
  const proposalId = code && name ? `${code}/${name}` : id;
  const { getProposal, getProposalById, markAsViewed, markAsApproved } = useProposals();
  const [isAccepting, setIsAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [style, setStyle] = useState<ProposalStyle>(defaultStyle);
  const [profileData, setProfileData] = useState<ProfileData>(defaultProfile);

  // Payment state
  const [isCreatingPayment, setIsCreatingPayment] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [showPaymentOption, setShowPaymentOption] = useState(false);

  // Load style settings and profile data from Supabase based on proposal owner
  const fetchProposalStyleAndProfile = async (proposalId: string) => {
    try {
      // First, get the user_id from the proposal
      const column = isUUID(proposalId) ? "id" : "short_id";

      const { data: proposalData, error: proposalError } = await getSupabase()
        .from("proposals")
        .select("user_id")
        .eq(column, proposalId)
        .single();

      if (proposalError || !proposalData?.user_id) return;

      // Fetch style settings and profile data in parallel
      const [styleResult, profileResult] = await Promise.all([
        getSupabase()
          .from("proposal_settings")
          .select("*")
          .eq("user_id", proposalData.user_id)
          .maybeSingle(),
        getSupabase()
          .from("profiles")
          .select("bio, instagram, cnpj, address, logo_url")
          .eq("user_id", proposalData.user_id)
          .maybeSingle()
      ]);

      // Set style settings
      console.log("🎨 Style fetch result:", { styleResult, userId: proposalData.user_id });
      if (!styleResult.error && styleResult.data) {
        console.log("✅ Style data loaded:", styleResult.data);
        setStyle({
          showLogo: styleResult.data.show_logo ?? true,
          showCnpj: styleResult.data.show_cnpj ?? true,
          showAddress: styleResult.data.show_address ?? true,
          showInstagram: styleResult.data.show_instagram ?? true,
          showBio: styleResult.data.show_bio ?? true,
          primaryColor: styleResult.data.primary_color || "#16a34a",
          footerText: styleResult.data.footer_text || "",
          paymentTerms: styleResult.data.payment_terms || defaultStyle.paymentTerms,
          generalTerms: styleResult.data.general_terms || defaultStyle.generalTerms,
        });
      }

      // Set profile data
      console.log("🔍 Profile fetch result:", { profileResult, userId: proposalData.user_id });
      if (!profileResult.error && profileResult.data) {
        console.log("✅ Profile data loaded:", profileResult.data);
        setProfileData({
          bio: profileResult.data.bio || "",
          instagram: profileResult.data.instagram || "",
          cnpj: profileResult.data.cnpj || "",
          address: profileResult.data.address || "",
          logoUrl: profileResult.data.logo_url || "",
        });
      } else {
        console.log("❌ No profile data found or error:", profileResult.error);
      }
    } catch (error) {
      console.error("Error fetching proposal style and profile:", error);
    }
  };

  useEffect(() => {
    if (proposalId) {
      fetchProposalStyleAndProfile(proposalId);
    }
  }, [proposalId]);

  useEffect(() => {
    const fetchProposal = async () => {
      if (!proposalId) {
        setIsLoading(false);
        return;
      }

      const localProposal = getProposal(proposalId);
      if (localProposal) {
        setProposal(localProposal);
        setIsLoading(false);
        return;
      }

      try {
        const dbProposal = await getProposalById(proposalId);
        setProposal(dbProposal);
      } catch (error) {
        console.error("Erro ao buscar proposta:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProposal();
  }, [proposalId, getProposal, getProposalById]);

  useEffect(() => {
    if (proposal && proposal.status === "sent") {
      markAsViewed(proposal.id);
    }
  }, [proposal?.id, proposal?.status, markAsViewed]);

  useEffect(() => {
    if (!proposal) return;
    const previousTitle = document.title;
    const numero = proposal.shortId?.split('/')[0] || proposal.id.slice(-6).toUpperCase();
    const clienteNome = proposal.client.name?.replace(/[\r\n]+/g, ' ').trim();
    document.title = clienteNome
      ? `Orçamento ${numero} - ${clienteNome}`
      : `Orçamento ${numero}`;
    return () => {
      document.title = previousTitle;
    };
  }, [proposal?.id, proposal?.shortId, proposal?.client.name]);

  // Loading
  if (isLoading) {
    return (
      <div className="min-h-screen bg-stone-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-stone-400 animate-spin mx-auto mb-3" />
          <p className="text-stone-500 text-sm">Carregando documento...</p>
        </div>
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="min-h-screen bg-stone-100 flex items-center justify-center p-6">
        <div className="text-center bg-white border border-stone-200 p-8 max-w-md">
          <AlertCircle className="w-12 h-12 text-stone-300 mx-auto mb-4" />
          <h1 className="text-lg font-medium text-stone-900 mb-2">Documento não encontrado</h1>
          <p className="text-stone-500 text-sm">Este link pode estar incorreto ou o documento foi removido.</p>
        </div>
      </div>
    );
  }

  const isExpired = new Date(proposal.validUntil) < new Date();
  const isApproved = proposal.status === "approved";
  const showApproved = accepted || isApproved;

  const whatsappNumber = proposal.company?.phone?.replace(/\D/g, '') || '';
  const proposalUrl = window.location.href;
  const whatsappLink = whatsappNumber
    ? `https://wa.me/55${whatsappNumber}?text=${encodeURIComponent(`Olá! Tenho interesse na proposta #${proposal.shortId?.split('/')[0] || proposal.id.slice(-6).toUpperCase()}\n\n${proposalUrl}`)}`
    : '';

  const handleAccept = async () => {
    setIsAccepting(true);
    try {
      // Chamar API para aprovar (não requer autenticação)
      const response = await fetch('/api/approve-proposal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposalId: proposal.id,
          clientName: proposal.client.name,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setAccepted(true);
        setShowPaymentOption(true);
      } else {
        console.error('Erro ao aprovar:', data);
        alert('Erro ao aprovar proposta. Tente novamente.');
      }
    } catch (error) {
      console.error('Erro ao aprovar proposta:', error);
      alert('Erro ao aprovar proposta. Tente novamente.');
    } finally {
      setIsAccepting(false);
    }
  };

  const handleCreatePayment = async () => {
    if (!proposal) return;

    setIsCreatingPayment(true);
    try {
      const response = await fetch('/api/create-proposal-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposalId: proposal.id,
          clientName: proposal.client.name,
          clientEmail: null,
          amount: proposal.total,
          description: proposal.title,
        }),
      });

      const data = await response.json();

      if (data.success && data.paymentUrl) {
        setPaymentUrl(data.paymentUrl);
        // Abrir em nova aba
        window.open(data.paymentUrl, '_blank');
      } else {
        console.error('Erro ao criar pagamento:', data);
      }
    } catch (error) {
      console.error('Erro ao criar pagamento:', error);
    } finally {
      setIsCreatingPayment(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("pt-BR");
  };

  const formatDateLong = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 py-4 sm:py-8 px-2 sm:px-4">
      {/* Print styles */}
      <style>{`
        @media print {
          @page { margin: 15mm; size: A4; }
          body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* Documento */}
      <div className="max-w-[800px] mx-auto">
        {/* Papel */}
        <div id="proposta-documento" className="bg-white shadow-xl rounded-sm border border-slate-200 overflow-hidden">

          {/* Barra colorida */}
          <div className="h-1" style={{ backgroundColor: style.primaryColor }} />

          {/* Cabeçalho */}
          <div className="p-5 sm:p-8">
            {/* Título do documento */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl sm:text-3xl font-bold text-stone-800 tracking-tight">ORÇAMENTO</h2>
              <div className="text-right">
                <p className="text-xs text-stone-400 uppercase tracking-wider">Número</p>
                <p className="text-lg sm:text-xl font-bold text-stone-800">{proposal.shortId?.split('/')[0] || proposal.id.slice(-6).toUpperCase()}</p>
              </div>
            </div>

            {/* Dados da empresa */}
            <div className="flex items-start gap-4 pb-5 border-b border-stone-200">
              {style.showLogo && (
                (proposal.company?.logoUrl || profileData.logoUrl) ? (
                  <img
                    src={profileData.logoUrl || proposal.company?.logoUrl}
                    alt={proposal.company?.name || "Logo"}
                    className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover flex-shrink-0"
                  />
                ) : (
                  <div
                    className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${style.primaryColor}10` }}
                  >
                    <Leaf className="w-8 h-8 sm:w-10 sm:h-10" style={{ color: style.primaryColor }} />
                  </div>
                )
              )}
              <div className="flex-1 min-w-0">
                <h1 className="text-base sm:text-lg font-bold text-stone-800 truncate">
                  {proposal.company?.name || "Empresa"}
                </h1>
                {style.showCnpj && profileData.cnpj && (
                  <p className="text-xs sm:text-sm text-stone-400 mt-0.5">{profileData.cnpj}</p>
                )}
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-2 text-xs sm:text-sm text-stone-500">
                  {proposal.company?.phone && <span>{proposal.company.phone}</span>}
                  {proposal.company?.email && <span>{proposal.company.email}</span>}
                  {style.showAddress && profileData.address && <span>{profileData.address}</span>}
                  {style.showInstagram && profileData.instagram && (
                    <span style={{ color: style.primaryColor }} className="font-medium">{profileData.instagram}</span>
                  )}
                </div>
              </div>
              {showApproved && (
                <div className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-xs font-bold uppercase tracking-wide">
                  <CheckCircle2 className="w-4 h-4" />
                  Aprovado
                </div>
              )}
              {isExpired && !showApproved && (
                <div className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-bold uppercase tracking-wide">
                  <AlertCircle className="w-4 h-4" />
                  Expirado
                </div>
              )}
            </div>
          </div>

          {/* Info Cliente e Datas */}
          <div className="grid grid-cols-2 border-b border-stone-200">
            <div className="p-3 sm:p-6 border-r border-stone-200">
              <p className="text-xs text-stone-400 uppercase tracking-wider mb-1 sm:mb-2">Cliente</p>
              <p className="font-semibold text-stone-900 text-xs sm:text-base">{proposal.client.name?.replace(/[\r\n]+/g, ' ')}</p>
              {proposal.client.phone && (
                <p className="text-stone-600 text-xs sm:text-sm mt-1">{proposal.client.phone}</p>
              )}
              {proposal.client.email && (
                <p className="text-stone-600 text-xs sm:text-sm">{proposal.client.email}</p>
              )}
            </div>
            <div className="p-3 sm:p-6">
              <div className="grid grid-cols-2 gap-2 sm:gap-4">
                <div>
                  <p className="text-xs text-stone-400 uppercase tracking-wider mb-1 sm:mb-2">Data</p>
                  <p className="text-stone-900 text-xs sm:text-base">{formatDate(proposal.createdAt)}</p>
                </div>
                <div>
                  <p className="text-xs text-stone-400 uppercase tracking-wider mb-1 sm:mb-2">Validade</p>
                  <p className={cn(
                    "text-xs sm:text-base",
                    isExpired ? "text-red-500" : "text-stone-900"
                  )}>
                    {formatDate(proposal.validUntil)}
                  </p>
                </div>
              </div>
            </div>
          </div>


          {/* Apresentação da Empresa (Bio) */}
          {style.showBio && profileData.bio && (
            <div className="px-3 sm:px-6 py-3 sm:py-4 border-b border-stone-200">
              <p className="text-xs text-stone-400 uppercase tracking-wider mb-1 sm:mb-2">Sobre nós</p>
              <p className="text-stone-700 text-xs sm:text-sm italic">"{profileData.bio}"</p>
            </div>
          )}

          {/* Tabela de Itens */}
          <div className="p-3 sm:p-6">
            <table className="w-full text-xs sm:text-sm">
              <thead>
                <tr className="border-b-2 border-stone-300">
                  <th className="text-left py-2 sm:py-3 text-xs text-stone-500 uppercase tracking-wider font-medium">Item</th>
                  <th className="text-center py-2 sm:py-3 text-xs text-stone-500 uppercase tracking-wider font-medium w-10 sm:w-16">Qtd</th>
                  <th className="text-right py-2 sm:py-3 text-xs text-stone-500 uppercase tracking-wider font-medium w-20 sm:w-32 pl-2">Unit.</th>
                  <th className="text-right py-2 sm:py-3 text-xs text-stone-500 uppercase tracking-wider font-medium w-20 sm:w-32 pl-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {proposal.items.map((item, index) => (
                  <tr key={item.id} className="border-b border-stone-100">
                    <td className="py-2 sm:py-4">
                      <div className="flex items-center gap-2 sm:gap-3">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="w-14 h-14 sm:w-16 sm:h-16 object-cover rounded-lg border border-stone-200"
                          />
                        ) : (
                          <div className="w-14 h-14 sm:w-16 sm:h-16 bg-emerald-50 rounded-lg border border-emerald-100 flex items-center justify-center">
                            <Leaf className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-stone-900 text-xs sm:text-base">{item.name}</p>
                          {item.nomeCientifico && (
                            <p className="text-[10px] sm:text-xs text-stone-400 italic">{item.nomeCientifico}</p>
                          )}
                          <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5">
                            {item.unit && item.unit !== "un" && (
                              <span className="text-[10px] sm:text-xs text-emerald-600 font-medium">/{item.unit}</span>
                            )}
                            {item.description && (
                              <span className="text-[10px] sm:text-xs text-stone-500">{item.description}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-2 sm:py-4 text-center text-stone-700">{item.quantity}</td>
                    <td className="py-2 sm:py-4 text-right text-stone-700 pl-2">{formatCurrency(item.unitPrice)}</td>
                    <td className="py-2 sm:py-4 text-right font-medium text-stone-900 pl-2">
                      {formatCurrency(item.quantity * item.unitPrice)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Total */}
            <div className="mt-4 sm:mt-6 flex justify-end">
              <div className="w-44 sm:w-64">
                <div className="flex justify-between py-2 sm:py-3 border-b-2 border-stone-800">
                  <span className="font-bold text-stone-900 text-sm sm:text-lg">TOTAL</span>
                  <span className="font-bold text-stone-900 text-sm sm:text-lg">{formatCurrency(proposal.total)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Condições */}
          <div className="px-3 sm:px-6 py-3 sm:py-5 bg-stone-50 border-t border-stone-200">
            <p className="text-xs text-stone-400 uppercase tracking-wider mb-2 sm:mb-3">Condições de Pagamento</p>
            <div className="text-xs text-stone-600 space-y-0.5 sm:space-y-1 whitespace-pre-line">
              {style.paymentTerms}
            </div>
          </div>

          {/* Observações */}
          {proposal.notes && (
            <div className="px-3 sm:px-6 py-3 sm:py-5 border-t border-stone-200">
              <p className="text-xs text-stone-400 uppercase tracking-wider mb-1 sm:mb-2">Observações</p>
              <p className="text-stone-700 text-xs sm:text-sm">{proposal.notes}</p>
            </div>
          )}

          {/* Termos */}
          <div className="px-3 sm:px-6 py-3 sm:py-5 border-t border-stone-200">
            <p className="text-xs text-stone-400 uppercase tracking-wider mb-2 sm:mb-3">Termos</p>
            <div className="text-xs text-stone-600 space-y-0.5 sm:space-y-1">
              <p>• Proposta válida até {formatDateLong(proposal.validUntil)}</p>
              <div className="whitespace-pre-line">{style.generalTerms}</div>
            </div>
          </div>

          {/* Assinatura / Aprovação */}
          <div className="px-3 sm:px-6 py-6 sm:py-8 border-t border-slate-200">
            {showApproved ? (
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-3 mb-2">
                  <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                  <span className="text-lg sm:text-xl font-semibold text-stone-800">Orçamento Aprovado</span>
                </div>
                <p className="text-sm text-stone-500">
                  Aprovado por <span className="font-medium text-stone-700">{proposal.client.name.split(' ')[0]}</span>
                </p>
              </div>
            ) : !isExpired ? (
              <div className="text-center">
                <p className="text-xs sm:text-sm text-stone-600 mb-3 sm:mb-4">
                  Para aprovar esta proposta, clique no botão abaixo:
                </p>
                <button
                  onClick={handleAccept}
                  disabled={isAccepting}
                  className="inline-flex items-center gap-2 px-6 sm:px-8 py-2.5 sm:py-3 bg-primary hover:bg-primary/90 disabled:bg-primary/50 text-white font-medium transition-colors no-print text-sm sm:text-base"
                >
                  {isAccepting ? (
                    <>
                      <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 sm:w-5 sm:h-5" />
                      Aprovar Orçamento
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-red-500 font-medium">Esta proposta expirou</p>
                <p className="text-sm text-stone-500 mt-1">Entre em contato para solicitar uma nova</p>
              </div>
            )}
          </div>
        </div>

        {/* Botão baixar PDF */}
        <div className="mt-4 sm:mt-6 flex justify-center no-print">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-6 py-2.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-600 text-sm rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            Baixar PDF
          </button>
        </div>
      </div>
    </div>
  );
}
