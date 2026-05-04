import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useProposals } from "@/contexts/ProposalsContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  ArrowLeft,
  Edit,
  Send,
  Copy,
  Trash2,
  MoreVertical,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  FileText,
  Phone,
  User,
  ExternalLink,
  AlertCircle,
  Download,
  Loader2,
} from "lucide-react";
import { generateProposalPDF } from "@/lib/generatePDF";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

export default function PropostaDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { getProposal, markAsSent, markAsApproved, updateProposal, duplicateProposal, deleteProposal, isLoading } = useProposals();
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const proposal = getProposal(id || "");

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!proposal) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-16">
          <AlertCircle className="w-16 h-16 text-muted-foreground mb-4" />
          <h1 className="text-xl font-bold mb-2">Proposta não encontrada</h1>
          <p className="text-muted-foreground mb-4">
            Esta proposta pode ter sido excluída ou o link está incorreto.
          </p>
          <Button asChild>
            <Link to="/propostas">Voltar para Propostas</Link>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const shareLink = `https://verproposta.online/p/${proposal.shortId || proposal.id}`;
  const isExpired = new Date(proposal.validUntil) < new Date() && proposal.status !== "approved";

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleSend = () => {
    markAsSent(proposal.id);
    setShowShareDialog(true);
    toast.success("Proposta marcada como enviada!");
  };

  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(shareLink);
      } else {
        // Fallback para HTTP ou navegadores antigos
        const textArea = document.createElement("textarea");
        textArea.value = shareLink;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      toast.success("Link copiado!");
    } catch (err) {
      toast.error("Não foi possível copiar o link");
    }
  };

  const handleDuplicate = () => {
    const duplicated = duplicateProposal(proposal.id);
    if (duplicated) {
      toast.success("Proposta duplicada com sucesso!");
      navigate(`/propostas/${duplicated.id}`);
    }
  };

  const handleDelete = () => {
    deleteProposal(proposal.id);
    toast.success("Proposta excluída com sucesso!");
    navigate("/propostas");
  };

  const handleDownloadPDF = async () => {
    setIsGeneratingPDF(true);
    try {
      // Marca d'água só aparece no plano Grátis DEPOIS do trial (3 dias)
      // Durante o trial, PDF é limpo como nos planos pagos
      const showWatermark = user?.plan === "Grátis" && !user?.isInTrial;
      await generateProposalPDF(proposal, showWatermark);
      toast.success("PDF gerado com sucesso!");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Erro ao gerar PDF. Tente novamente.");
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleApprove = () => {
    markAsApproved(proposal.id, "Aprovado manualmente");
    toast.success("Proposta marcada como aprovada!");
  };

  const handleUnapprove = async () => {
    await updateProposal(proposal.id, { status: "sent" });
    toast.success("Aprovação removida!");
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto overflow-x-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/propostas")}>
            <ArrowLeft size={20} />
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold truncate">{proposal.title}</h1>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            {proposal.status === "draft" && (
              <Button size="sm" onClick={handleSend} className="text-xs sm:text-sm">
                <Send size={14} className="mr-1.5" />
                Enviar
              </Button>
            )}

            <Button variant="outline" size="sm" asChild className="text-xs sm:text-sm">
              <Link to={`/propostas/${proposal.id}/editar`}>
                <Edit size={14} className="mr-1.5" />
                Editar
              </Link>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9">
                  <MoreVertical size={18} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleDownloadPDF} disabled={isGeneratingPDF}>
                  <Download size={16} className="mr-2" />
                  Baixar PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDuplicate}>
                  <Copy size={16} className="mr-2" />
                  Duplicar
                </DropdownMenuItem>
                {proposal.status !== "approved" && proposal.status !== "draft" && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleApprove} className="text-emerald-600">
                      <CheckCircle size={16} className="mr-2" />
                      Marcar Aprovada
                    </DropdownMenuItem>
                  </>
                )}
                {proposal.status === "approved" && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleUnapprove} className="text-neutral-600">
                      <XCircle size={16} className="mr-2" />
                      Remover Aprovação
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setShowDeleteDialog(true)}
                  className="text-destructive"
                >
                  <Trash2 size={16} className="mr-2" />
                  Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Client Info Card */}
          <div className="bg-card rounded-xl border border-border p-4 animate-card-in card-lift overflow-hidden">
            <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
              <div className="w-11 h-11 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <User size={24} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{proposal.client.name}</p>
                {proposal.client.phone && (
                  <p className="text-sm text-muted-foreground">{proposal.client.phone}</p>
                )}
              </div>
              {proposal.client.phone && (
                <a
                  href={`https://wa.me/55${proposal.client.phone.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#25D366] text-white text-sm font-medium hover:bg-[#20bd5a] active:scale-95 transition-all shadow-sm touch-feedback flex-shrink-0"
                >
                  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  Chamar
                </a>
              )}
            </div>
          </div>

          {/* Items Card */}
          <div className="bg-card rounded-xl sm:rounded-2xl border border-border p-4 sm:p-6 overflow-hidden animate-card-in stagger-1 card-lift">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <FileText size={18} className="text-primary" />
              Itens e Serviços
            </h2>

            {/* Mobile/Tablet Layout */}
            <div className="lg:hidden space-y-3">
              {proposal.items.map((item, index) => (
                <div key={item.id} className="bg-muted/30 rounded-xl p-3 transition-all touch-feedback" style={{ animationDelay: `${index * 50}ms` }}>
                  <p className="font-medium text-sm">{item.name}</p>
                  {item.nomeCientifico && (
                    <p className="text-xs text-muted-foreground/70 italic">{item.nomeCientifico}</p>
                  )}
                  <div className="flex flex-wrap gap-x-2 mt-0.5 mb-2">
                    {item.unit && item.unit !== "un" && (
                      <span className="text-xs text-primary font-medium">/{item.unit}</span>
                    )}
                    {item.description && (
                      <span className="text-xs text-muted-foreground">{item.description}</span>
                    )}
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">{item.quantity}x {formatCurrency(item.unitPrice)}</span>
                    <span className="font-semibold">{formatCurrency(item.quantity * item.unitPrice)}</span>
                  </div>
                </div>
              ))}
              <div className="bg-primary/10 rounded-xl p-4 flex justify-between items-center">
                <span className="font-semibold">Total</span>
                <span className="text-xl font-bold text-primary">{formatCurrency(proposal.total)}</span>
              </div>
            </div>

            {/* Desktop Layout */}
            <div className="hidden lg:block">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Item
                    </th>
                    <th className="text-center py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Qtd
                    </th>
                    <th className="text-right py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Unit.
                    </th>
                    <th className="text-right py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {proposal.items.map((item) => (
                    <tr key={item.id} className="border-b border-border last:border-0">
                      <td className="py-3">
                        <p className="font-medium text-sm">{item.name}</p>
                        {item.nomeCientifico && (
                          <p className="text-xs text-muted-foreground/70 italic">{item.nomeCientifico}</p>
                        )}
                        <div className="flex flex-wrap gap-x-2">
                          {item.unit && item.unit !== "un" && (
                            <span className="text-xs text-primary font-medium">/{item.unit}</span>
                          )}
                          {item.description && (
                            <span className="text-xs text-muted-foreground">{item.description}</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 text-center text-sm">{item.quantity}</td>
                      <td className="py-3 text-right text-sm">{formatCurrency(item.unitPrice)}</td>
                      <td className="py-3 text-right font-medium text-sm">
                        {formatCurrency(item.quantity * item.unitPrice)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/50">
                    <td colSpan={3} className="py-4 text-right font-semibold">
                      Total
                    </td>
                    <td className="py-4 text-right text-xl font-bold text-primary">
                      {formatCurrency(proposal.total)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Notes */}
          {proposal.notes && (
            <div className="bg-card rounded-xl sm:rounded-2xl border border-border p-4 sm:p-6 animate-card-in stagger-2 card-lift">
              <h2 className="font-semibold mb-3">Observações</h2>
              <p className="text-muted-foreground text-sm">{proposal.notes}</p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Dates Card */}
          <div className="bg-card rounded-xl sm:rounded-2xl border border-border p-4 sm:p-6 animate-card-in stagger-2 card-lift">
            <h2 className="font-semibold mb-4">Detalhes</h2>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Calendar size={18} className="text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Validade</p>
                  <p className={cn("font-medium", isExpired && "text-destructive")}>
                    {formatDate(proposal.validUntil)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Clock size={18} className="text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Criada em</p>
                  <p className="font-medium">{formatDateTime(proposal.createdAt)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Timeline Card */}
          <div className="bg-card rounded-xl sm:rounded-2xl border border-border p-4 sm:p-6 animate-card-in stagger-3 card-lift">
            <h2 className="font-semibold mb-4">Histórico</h2>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-verde-100 flex items-center justify-center flex-shrink-0">
                  <FileText size={14} className="text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">Proposta criada</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(proposal.createdAt)}</p>
                </div>
              </div>

              {proposal.sentAt && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-verde-100 flex items-center justify-center flex-shrink-0">
                    <Send size={14} className="text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Proposta enviada</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(proposal.sentAt)}</p>
                  </div>
                </div>
              )}

              {proposal.viewedAt && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-verde-100 flex items-center justify-center flex-shrink-0">
                    <Eye size={14} className="text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Cliente visualizou</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(proposal.viewedAt)}</p>
                  </div>
                </div>
              )}

              {proposal.approvedAt && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-success/20 flex items-center justify-center flex-shrink-0">
                    <CheckCircle size={14} className="text-success" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Proposta aprovada</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(proposal.approvedAt)}</p>
                    {proposal.signature && (
                      <p className="text-xs text-muted-foreground">Por: {proposal.signature}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Share Link */}
          <div className="bg-card rounded-xl sm:rounded-2xl border border-border p-4 sm:p-6 animate-card-in stagger-4 card-lift">
            <h2 className="font-semibold mb-3">Link da Proposta</h2>
            <p className="text-sm text-muted-foreground mb-3 break-all">{shareLink}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={handleCopyLink}>
                <Copy size={14} className="mr-2" />
                Copiar
              </Button>
              <Button size="sm" className="flex-1" asChild>
                <a href={shareLink} target="_blank" rel="noopener noreferrer">
                  <ExternalLink size={14} className="mr-2" />
                  Abrir
                </a>
              </Button>
            </div>
          </div>
        </div>
      </div>

        <div className="h-6" />
      </div>

      {/* Share Dialog */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Compartilhar Proposta</DialogTitle>
            <DialogDescription>
              Envie este link para o cliente visualizar e aceitar a proposta.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <code className="flex-1 bg-muted px-3 py-2 rounded-lg text-sm break-all">
                {shareLink}
              </code>
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={handleCopyLink}>
                <Copy size={16} className="mr-2" />
                Copiar Link
              </Button>
              <Button variant="outline" asChild>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`Olá${proposal.client.name ? ` ${proposal.client.name.split(' ')[0]}` : ''}! Segue seu orçamento no valor de ${formatCurrency(proposal.total)}:\n\n${shareLink}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  WhatsApp
                </a>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Proposta</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir esta proposta? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              <Trash2 size={16} className="mr-2" />
              Excluir
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
