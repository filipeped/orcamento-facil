import { useState, useMemo, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useProposals } from "@/contexts/ProposalsContext";
import { useAuth } from "@/contexts/AuthContext";
import { getSupabase } from "@/lib/supabase";
import {
  Download,
  FileText,
  Calendar,
  TrendingUp,
  CheckCircle,
  FileDown,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function Relatorios() {
  const { proposals } = useProposals();
  const { user } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [companyData, setCompanyData] = useState<{
    name: string;
    logo: string | null;
    phone: string;
    address: string;
  }>({ name: "", logo: null, phone: "", address: "" });

  // Buscar dados da empresa
  useEffect(() => {
    const fetchCompanyData = async () => {
      if (!user) return;
      try {
        const { data } = await getSupabase()
          .from("profiles")
          .select("company_name, logo_url, phone")
          .eq("user_id", user.id)
          .single();
        if (data) {
          setCompanyData({
            name: data.company_name || user.name || "Minha Empresa",
            logo: data.logo_url,
            phone: data.phone || "",
            address: "",
          });
        }
      } catch (error) {
        console.error("Erro ao buscar dados da empresa:", error);
      }
    };
    fetchCompanyData();
  }, [user]);

  // Gerar lista de meses disponíveis
  const availableMonths = useMemo(() => {
    const months: string[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
    }
    return months;
  }, []);

  // Filtrar propostas do mês selecionado
  const monthProposals = useMemo(() => {
    const [year, month] = selectedMonth.split("-").map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    return proposals.filter((p) => {
      const date = new Date(p.createdAt);
      return date >= startDate && date <= endDate;
    });
  }, [proposals, selectedMonth]);

  // Estatísticas do mês
  const stats = useMemo(() => {
    const approved = monthProposals.filter((p) => p.status === "approved");
    const pending = monthProposals.filter((p) => ["sent", "viewed"].includes(p.status));

    return {
      total: monthProposals.length,
      approved: approved.length,
      pending: pending.length,
      draft: monthProposals.filter((p) => p.status === "draft").length,
      revenue: approved.reduce((sum, p) => sum + p.total, 0),
      potential: pending.reduce((sum, p) => sum + p.total, 0),
      avgTicket: approved.length > 0
        ? approved.reduce((sum, p) => sum + p.total, 0) / approved.length
        : 0,
      conversionRate: monthProposals.length > 0
        ? (approved.length / monthProposals.length) * 100
        : 0,
    };
  }, [monthProposals]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatMonthName = (monthStr: string) => {
    const [year, month] = monthStr.split("-").map(Number);
    const date = new Date(year, month - 1, 1);
    return date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  };

  // Exportar para CSV
  const exportToCSV = () => {
    if (monthProposals.length === 0) {
      toast.error("Nenhuma proposta para exportar");
      return;
    }

    const headers = ["Data", "Cliente", "Telefone", "Título", "Valor", "Status"];
    const rows = monthProposals.map((p) => [
      new Date(p.createdAt).toLocaleDateString("pt-BR"),
      p.client.name,
      p.client.phone || "-",
      p.title,
      p.total.toFixed(2),
      p.status === "approved" ? "Aprovada" :
      p.status === "sent" ? "Enviada" :
      p.status === "viewed" ? "Visualizada" :
      p.status === "draft" ? "Rascunho" : p.status,
    ]);

    const csvContent = [
      headers.join(";"),
      ...rows.map((row) => row.join(";")),
    ].join("\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio-${selectedMonth}.csv`;
    link.click();

    toast.success("Relatório exportado!");
  };

  // Exportar para PDF profissional
  const exportToPDF = async () => {
    if (monthProposals.length === 0) {
      toast.error("Nenhuma proposta para exportar");
      return;
    }

    setIsExportingPDF(true);

    try {
      const html2pdf = (await import("html2pdf.js")).default;
      const monthName = formatMonthName(selectedMonth);
      const empresa = companyData.name || user?.company || user?.name || "Minha Empresa";
      const [year, month] = selectedMonth.split("-");

      // Nome do arquivo: Relatorio_NomeEmpresa_Mes_Ano.pdf
      const nomeArquivo = `Relatorio_${empresa.replace(/\s+/g, '_')}_${monthName.replace(' de ', '_').replace(/\s+/g, '_')}.pdf`;

      // Criar HTML do relatório profissional
      // Cores emerald do site: green-500=#22C55E, green-600=#059669, green-700=#047857
      const reportHTML = `
        <div style="font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif; background: #fff; min-height: 100%;">
          <!-- Header com gradiente -->
          <div style="background: linear-gradient(135deg, #22C55E 0%, #059669 100%); padding: 32px 40px; color: white;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div>
                ${companyData.logo ? `<img src="${companyData.logo}" alt="Logo" style="height: 48px; margin-bottom: 12px; border-radius: 8px;">` : ''}
                <h1 style="margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">${empresa}</h1>
                ${companyData.phone ? `<p style="margin: 4px 0 0 0; font-size: 12px; opacity: 0.9;">${companyData.phone}</p>` : ''}
              </div>
              <div style="text-align: right;">
                <p style="margin: 0; font-size: 11px; opacity: 0.8; text-transform: uppercase; letter-spacing: 1px;">Relatório Mensal</p>
                <p style="margin: 4px 0 0 0; font-size: 20px; font-weight: 600;">${monthName.charAt(0).toUpperCase() + monthName.slice(1)}</p>
              </div>
            </div>
          </div>

          <!-- Conteúdo -->
          <div style="padding: 32px 40px;">

            <!-- Cards principais -->
            <div style="display: flex; gap: 16px; margin-bottom: 28px;">
              <div style="flex: 1; background: linear-gradient(135deg, #059669 0%, #22C55E 100%); border-radius: 16px; padding: 24px; color: white; box-shadow: 0 4px 20px rgba(34, 197, 94, 0.3);">
                <p style="margin: 0 0 4px 0; font-size: 12px; opacity: 0.9; text-transform: uppercase; letter-spacing: 0.5px;">Faturamento</p>
                <p style="margin: 0; font-size: 28px; font-weight: 700;">${formatCurrency(stats.revenue)}</p>
                <p style="margin: 8px 0 0 0; font-size: 11px; opacity: 0.8;">${stats.approved} proposta${stats.approved !== 1 ? 's' : ''} aprovada${stats.approved !== 1 ? 's' : ''}</p>
              </div>
              <div style="flex: 1; background: #f8fafc; border-radius: 16px; padding: 24px; border: 1px solid #e2e8f0;">
                <p style="margin: 0 0 4px 0; font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Em Aberto</p>
                <p style="margin: 0; font-size: 28px; font-weight: 700; color: #f59e0b;">${formatCurrency(stats.potential)}</p>
                <p style="margin: 8px 0 0 0; font-size: 11px; color: #94a3b8;">${stats.pending} pendente${stats.pending !== 1 ? 's' : ''}</p>
              </div>
            </div>

            <!-- Métricas em linha -->
            <div style="display: flex; gap: 12px; margin-bottom: 32px;">
              <div style="flex: 1; background: #f8fafc; border-radius: 12px; padding: 16px 20px; text-align: center; border: 1px solid #e2e8f0;">
                <p style="margin: 0; font-size: 11px; color: #64748b; text-transform: uppercase;">Propostas</p>
                <p style="margin: 4px 0 0 0; font-size: 22px; font-weight: 700; color: #1e293b;">${stats.total}</p>
              </div>
              <div style="flex: 1; background: #f8fafc; border-radius: 12px; padding: 16px 20px; text-align: center; border: 1px solid #e2e8f0;">
                <p style="margin: 0; font-size: 11px; color: #64748b; text-transform: uppercase;">Aprovadas</p>
                <p style="margin: 4px 0 0 0; font-size: 22px; font-weight: 700; color: #22C55E;">${stats.approved}</p>
              </div>
              <div style="flex: 1; background: #f8fafc; border-radius: 12px; padding: 16px 20px; text-align: center; border: 1px solid #e2e8f0;">
                <p style="margin: 0; font-size: 11px; color: #64748b; text-transform: uppercase;">Conversão</p>
                <p style="margin: 4px 0 0 0; font-size: 22px; font-weight: 700; color: #22C55E;">${stats.conversionRate.toFixed(0)}%</p>
              </div>
              <div style="flex: 1; background: #f8fafc; border-radius: 12px; padding: 16px 20px; text-align: center; border: 1px solid #e2e8f0;">
                <p style="margin: 0; font-size: 11px; color: #64748b; text-transform: uppercase;">Ticket Médio</p>
                <p style="margin: 4px 0 0 0; font-size: 18px; font-weight: 700; color: #1e293b;">${formatCurrency(stats.avgTicket)}</p>
              </div>
            </div>

            <!-- Tabela de Propostas -->
            <div style="background: #fff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden;">
              <div style="padding: 16px 20px; background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                <h3 style="margin: 0; font-size: 14px; font-weight: 600; color: #1e293b;">Detalhamento das Propostas</h3>
              </div>
              <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                <thead>
                  <tr style="background: #fafafa;">
                    <th style="text-align: left; padding: 12px 16px; color: #64748b; font-weight: 600; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px;">Data</th>
                    <th style="text-align: left; padding: 12px 16px; color: #64748b; font-weight: 600; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px;">Cliente</th>
                    <th style="text-align: left; padding: 12px 16px; color: #64748b; font-weight: 600; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px;">Serviço</th>
                    <th style="text-align: right; padding: 12px 16px; color: #64748b; font-weight: 600; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px;">Valor</th>
                    <th style="text-align: center; padding: 12px 16px; color: #64748b; font-weight: 600; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px;">Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${monthProposals.map((p, i) => `
                    <tr style="border-bottom: 1px solid #f1f5f9;">
                      <td style="padding: 14px 16px; color: #64748b; font-size: 12px;">${new Date(p.createdAt).toLocaleDateString("pt-BR")}</td>
                      <td style="padding: 14px 16px; color: #1e293b; font-weight: 500; font-size: 12px;">${p.client.name}</td>
                      <td style="padding: 14px 16px; color: #64748b; font-size: 12px; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${p.title}</td>
                      <td style="padding: 14px 16px; color: #1e293b; font-weight: 600; text-align: right; font-size: 12px;">${formatCurrency(p.total)}</td>
                      <td style="padding: 14px 16px; text-align: center;">
                        <span style="
                          display: inline-block;
                          padding: 4px 12px;
                          border-radius: 20px;
                          font-size: 10px;
                          font-weight: 600;
                          ${p.status === 'approved'
                            ? 'background: #d1fae5; color: #059669;'
                            : p.status === 'viewed'
                              ? 'background: #dbeafe; color: #2563eb;'
                              : p.status === 'sent'
                                ? 'background: #fef3c7; color: #d97706;'
                                : 'background: #f1f5f9; color: #64748b;'
                          }
                        ">
                          ${p.status === 'approved' ? '✓ Aprovada' : p.status === 'viewed' ? 'Visualizada' : p.status === 'sent' ? 'Enviada' : 'Rascunho'}
                        </span>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
                <tfoot>
                  <tr style="background: #f8fafc;">
                    <td colspan="3" style="padding: 14px 16px; font-weight: 600; color: #1e293b; font-size: 12px;">Total do Período</td>
                    <td style="padding: 14px 16px; font-weight: 700; color: #22C55E; text-align: right; font-size: 14px;">${formatCurrency(stats.revenue + stats.potential)}</td>
                    <td style="padding: 14px 16px; text-align: center; font-size: 11px; color: #64748b;">${stats.total} proposta${stats.total !== 1 ? 's' : ''}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <!-- Footer -->
          <div style="padding: 24px 40px; background: #f8fafc; border-top: 1px solid #e2e8f0; margin-top: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <p style="margin: 0; font-size: 10px; color: #94a3b8;">
                Gerado em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </p>
              <p style="margin: 0; font-size: 10px; color: #94a3b8;">
                Powered by <span style="color: #22C55E; font-weight: 600;">FechaAqui</span>
              </p>
            </div>
          </div>
        </div>
      `;

      const container = document.createElement("div");
      container.innerHTML = reportHTML;
      document.body.appendChild(container);

      // Usar datauristring para evitar erro de blob em HTTP
      const pdfDataUri = await html2pdf()
        .set({
          margin: 0,
          filename: nomeArquivo,
          image: { type: "jpeg", quality: 0.95 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            logging: false,
            allowTaint: true,
          },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        })
        .from(container)
        .outputPdf('datauristring');

      document.body.removeChild(container);

      // Download via data URI (funciona em HTTP)
      const link = document.createElement('a');
      link.href = pdfDataUri;
      link.download = nomeArquivo;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success("Relatório PDF exportado!");
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      toast.error("Erro ao gerar PDF");
    } finally {
      setIsExportingPDF(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="pb-4 sm:pb-6">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900">
            Relatórios
          </h1>
          <p className="text-xs sm:text-sm text-neutral-500 mt-0.5">
            Exporte relatórios mensais
          </p>
        </header>

        {/* Month Selector - Design elegante e responsivo */}
        <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-2xl p-4 sm:p-5 mb-5 shadow-lg shadow-green-500/20">
          <div className="flex items-center justify-between gap-2">
            {/* Botão Anterior */}
            <button
              onClick={() => {
                const currentIndex = availableMonths.indexOf(selectedMonth);
                if (currentIndex < availableMonths.length - 1) {
                  setSelectedMonth(availableMonths[currentIndex + 1]);
                }
              }}
              disabled={availableMonths.indexOf(selectedMonth) === availableMonths.length - 1}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/20 hover:bg-white/30 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-white transition-all flex-shrink-0"
            >
              <ChevronLeft size={20} />
            </button>

            {/* Mês Central */}
            <div className="flex-1 text-center min-w-0">
              <p className="text-lg sm:text-2xl font-bold text-white capitalize truncate">
                {formatMonthName(selectedMonth)}
              </p>
              {stats.total > 0 && (
                <p className="text-white/70 text-xs sm:text-sm mt-0.5 truncate">
                  {stats.total} proposta{stats.total !== 1 ? 's' : ''} • {formatCurrency(stats.revenue)}
                </p>
              )}
            </div>

            {/* Botão Próximo */}
            <button
              onClick={() => {
                const currentIndex = availableMonths.indexOf(selectedMonth);
                if (currentIndex > 0) {
                  setSelectedMonth(availableMonths[currentIndex - 1]);
                }
              }}
              disabled={availableMonths.indexOf(selectedMonth) === 0}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/20 hover:bg-white/30 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-white transition-all flex-shrink-0"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          {/* Mini timeline dos últimos meses - scroll horizontal no mobile */}
          <div className="flex justify-start sm:justify-center gap-1.5 mt-3 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
            {availableMonths.slice(0, 6).reverse().map((month) => {
              const isSelected = month === selectedMonth;
              const [year, m] = month.split("-");
              const monthShort = new Date(parseInt(year), parseInt(m) - 1).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
              return (
                <button
                  key={month}
                  onClick={() => setSelectedMonth(month)}
                  className={cn(
                    "px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap flex-shrink-0",
                    isSelected
                      ? "bg-white text-green-600 shadow-md"
                      : "bg-white/20 text-white/80 hover:bg-white/30 active:bg-white/40"
                  )}
                >
                  {monthShort}
                </button>
              );
            })}
          </div>
        </div>

        {/* Stats Cards - Otimizado para mobile */}
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 mb-5">
          <div className="bg-white rounded-xl sm:rounded-2xl border border-neutral-100 p-3 sm:p-4 shadow-sm animate-card-in">
            <div className="flex items-center gap-2 sm:block">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-neutral-100 flex items-center justify-center sm:mb-2">
                <FileText size={16} className="text-neutral-500" />
              </div>
              <div>
                <p className="text-[10px] sm:text-xs text-neutral-500 font-medium">Propostas</p>
                <p className="text-xl sm:text-2xl font-bold text-neutral-900">{stats.total}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl sm:rounded-2xl border border-neutral-100 p-3 sm:p-4 shadow-sm animate-card-in stagger-1">
            <div className="flex items-center gap-2 sm:block">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-green-100 flex items-center justify-center sm:mb-2">
                <CheckCircle size={16} className="text-green-600" />
              </div>
              <div>
                <p className="text-[10px] sm:text-xs text-neutral-500 font-medium">Aprovadas</p>
                <p className="text-xl sm:text-2xl font-bold text-green-600">{stats.approved}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl sm:rounded-2xl border border-neutral-100 p-3 sm:p-4 shadow-sm animate-card-in stagger-2">
            <div className="flex items-center gap-2 sm:block">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-green-100 flex items-center justify-center sm:mb-2">
                <TrendingUp size={16} className="text-green-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] sm:text-xs text-neutral-500 font-medium">Faturamento</p>
                <p className="text-lg sm:text-xl font-bold text-green-600 truncate">{formatCurrency(stats.revenue)}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl sm:rounded-2xl border border-neutral-100 p-3 sm:p-4 shadow-sm animate-card-in stagger-3">
            <div className="flex items-center gap-2 sm:block">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-green-100 flex items-center justify-center sm:mb-2">
                <TrendingUp size={16} className="text-green-600" />
              </div>
              <div>
                <p className="text-[10px] sm:text-xs text-neutral-500 font-medium">Conversão</p>
                <p className="text-xl sm:text-2xl font-bold text-green-600">{stats.conversionRate.toFixed(0)}%</p>
              </div>
            </div>
          </div>
        </div>

        {/* Export Options */}
        <div className="mb-3">
          <h2 className="text-base sm:text-lg font-semibold text-neutral-900 mb-0.5">Exportar Relatório</h2>
          <p className="text-xs sm:text-sm text-neutral-500">Escolha o formato</p>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-5">
          {/* CSV */}
          <button
            onClick={exportToCSV}
            className="group relative overflow-hidden bg-white rounded-2xl border border-neutral-100 p-4 sm:p-5 hover:shadow-lg hover:border-green-200 transition-all text-left shadow-sm touch-feedback btn-press animate-card-in stagger-4"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-500/10 to-green-500/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500" />
            <div className="relative">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center mb-3 sm:mb-4 shadow-lg shadow-green-500/25 group-hover:scale-110 transition-transform">
                <Download size={20} className="text-white" />
              </div>
              <h3 className="font-bold text-neutral-900 mb-1 text-sm sm:text-base">Planilha CSV</h3>
              <p className="text-xs sm:text-sm text-neutral-500">
                Para Excel
              </p>
              <div className="mt-2 sm:mt-3 flex items-center gap-1 text-green-600 text-xs font-medium">
                <span>Baixar agora</span>
                <ChevronRight size={14} />
              </div>
            </div>
          </button>

          {/* PDF */}
          <button
            onClick={exportToPDF}
            disabled={isExportingPDF}
            className="group relative overflow-hidden bg-white rounded-2xl border border-neutral-100 p-4 sm:p-5 hover:shadow-lg hover:border-neutral-300 transition-all text-left shadow-sm disabled:opacity-50 touch-feedback btn-press animate-card-in stagger-5"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-neutral-500/10 to-neutral-500/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500" />
            <div className="relative">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-neutral-700 to-neutral-800 flex items-center justify-center mb-3 sm:mb-4 shadow-lg shadow-neutral-500/25 group-hover:scale-110 transition-transform">
                {isExportingPDF ? (
                  <Loader2 size={20} className="text-white animate-spin" />
                ) : (
                  <FileDown size={20} className="text-white" />
                )}
              </div>
              <h3 className="font-bold text-neutral-900 mb-1 text-sm sm:text-base">Relatório PDF</h3>
              <p className="text-xs sm:text-sm text-neutral-500">
                Visual profissional
              </p>
              <div className="mt-2 sm:mt-3 flex items-center gap-1 text-neutral-600 text-xs font-medium">
                <span>{isExportingPDF ? "Gerando..." : "Baixar agora"}</span>
                {!isExportingPDF && <ChevronRight size={14} />}
              </div>
            </div>
          </button>
        </div>

        {/* Proposals List */}
        {monthProposals.length > 0 && (
          <div className="bg-white rounded-xl sm:rounded-2xl border border-neutral-100 p-3 sm:p-5 mt-4 shadow-sm animate-card-in stagger-6">
            <h2 className="font-semibold text-neutral-900 mb-3 text-sm sm:text-base">
              Propostas de {formatMonthName(selectedMonth)}
            </h2>
            <div className="space-y-2">
              {monthProposals.map((proposal) => (
                <div
                  key={proposal.id}
                  className="flex items-center gap-2.5 sm:gap-3 p-2.5 sm:p-3 rounded-lg bg-neutral-50"
                >
                  <div className={cn(
                    "w-2 h-2 rounded-full flex-shrink-0",
                    proposal.status === "approved" ? "bg-green-500" :
                    proposal.status === "viewed" ? "bg-green-400" :
                    proposal.status === "sent" ? "bg-neutral-400" : "bg-neutral-300"
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-xs sm:text-sm text-neutral-900 truncate">
                      {proposal.client.name}
                    </p>
                    <p className="text-[10px] sm:text-xs text-neutral-500 truncate">{proposal.title}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-semibold text-xs sm:text-sm text-neutral-900">
                      {formatCurrency(proposal.total)}
                    </p>
                    <p className="text-[10px] sm:text-xs text-neutral-400">
                      {new Date(proposal.createdAt).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
