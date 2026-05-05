import { Proposal } from "@/contexts/ProposalsContext";
import { BRAND } from "@/lib/brand";

// Templates de PDF disponíveis. Inspirados nos layouts do Invoice Fly.
export type PdfTemplate = "classic" | "modern" | "minimal";

const TEMPLATE_KEY = "fechaaqui_pdf_template";

export function getActivePdfTemplate(): PdfTemplate {
  try {
    const v = localStorage.getItem(TEMPLATE_KEY);
    if (v === "classic" || v === "modern" || v === "minimal") return v;
  } catch { /* ignore */ }
  return "classic";
}

export function setActivePdfTemplate(t: PdfTemplate) {
  try { localStorage.setItem(TEMPLATE_KEY, t); } catch { /* ignore */ }
}

interface TemplateStyle {
  topBarHeight: string;
  topBarBg: string;
  headerBg: string;
  titleColor: string;
  titleSize: string;
  totalBorder: string;
  totalBg: string;
  totalColor: string;
}

function getTemplateStyle(template: PdfTemplate, primary: string): TemplateStyle {
  switch (template) {
    case "modern":
      // Header colorido grande tipo invoice-fly template3
      return {
        topBarHeight: "0px",
        topBarBg: "transparent",
        headerBg: `linear-gradient(135deg, #0E2A5C 0%, ${primary} 100%)`,
        titleColor: "#ffffff",
        titleSize: "32px",
        totalBorder: `2px solid ${primary}`,
        totalBg: `${primary}10`,
        totalColor: primary,
      };
    case "minimal":
      // Sem cor no topo, tipografia limpa tipo invoice-fly template5
      return {
        topBarHeight: "0px",
        topBarBg: "transparent",
        headerBg: "transparent",
        titleColor: "#0f172a",
        titleSize: "28px",
        totalBorder: "1px solid #0f172a",
        totalBg: "transparent",
        totalColor: "#0f172a",
      };
    case "classic":
    default:
      // Barra colorida sutil no topo (atual)
      return {
        topBarHeight: "4px",
        topBarBg: primary,
        headerBg: "transparent",
        titleColor: "#1f2937",
        titleSize: "28px",
        totalBorder: "2px solid #1f2937",
        totalBg: "transparent",
        totalColor: "#1f2937",
      };
  }
}

// Converte uma imagem URL para base64
async function imageToBase64(url: string): Promise<string | null> {
  try {
    // Tenta buscar a imagem via fetch com CORS
    const response = await fetch(url, { mode: 'cors' });
    const blob = await response.blob();

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.warn('Não foi possível converter imagem para base64:', url, error);
    return null;
  }
}

// Pré-carrega todas as imagens do elemento como base64
async function preloadImages(element: HTMLElement): Promise<void> {
  const images = element.querySelectorAll('img');

  const promises = Array.from(images).map(async (img) => {
    const src = img.src;

    // Pula imagens que já são base64 ou data URLs
    if (src.startsWith('data:')) return;

    // Pula imagens locais (mesmo domínio)
    if (src.startsWith(window.location.origin)) return;

    try {
      const base64 = await imageToBase64(src);
      if (base64) {
        img.src = base64;
      }
    } catch (error) {
      console.warn('Erro ao pré-carregar imagem:', src, error);
    }
  });

  await Promise.all(promises);
}

// Formata valor como moeda brasileira
function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

// Formata data
function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("pt-BR");
}

// Formata data por extenso
function formatDateLong(dateString: string): string {
  return new Date(dateString).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

// Mapa de título PDF por docType (FechaAqui v2)
const DOC_TITLES: Record<string, string> = {
  orcamento: "ORÇAMENTO",
  fatura: "FATURA",
  recibo: "RECIBO",
};

// Gera o HTML do orçamento para PDF
function generateProposalHTML(proposal: Proposal, isFreePlan: boolean = false, template: PdfTemplate = "classic"): string {
  const primary = "#22C55E"; // verde brand FechaAqui
  const tpl = getTemplateStyle(template, primary);
  const docTitle = DOC_TITLES[proposal.docType || "orcamento"] || "ORÇAMENTO";
  // Marca d'água para plano grátis
  const watermarkHTML = isFreePlan ? `
    <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); z-index: 1000; pointer-events: none;">
      <p style="font-size: 60px; color: rgba(34, 197, 94, 0.15); font-weight: bold; white-space: nowrap; margin: 0;">
        ${BRAND.watermarkText}
      </p>
    </div>
    <div style="position: fixed; bottom: 20px; left: 0; right: 0; text-align: center; z-index: 1000;">
      <p style="font-size: 10px; color: #22C55E; margin: 0;">
        ${BRAND.watermarkFooter}
      </p>
    </div>
  ` : '';
  const itemsHTML = proposal.items.map(item => {
    const imageHTML = item.imageUrl
      ? `<img src="${item.imageUrl}" alt="${item.name}" style="width: 40px; height: 40px; object-fit: cover; border: 1px solid #e5e5e5;" />`
      : `<div style="width: 40px; height: 40px; background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 6px; display: flex; align-items: center; justify-content: center;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M16.5 9.4 7.55 4.24"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" x2="12" y1="22.08" y2="12"/>
          </svg>
        </div>`;

    const nomeCientificoHTML = item.nomeCientifico
      ? `<p style="font-size: 10px; color: #9ca3af; font-style: italic; margin: 0;">${item.nomeCientifico}</p>`
      : '';

    const unitHTML = item.unit && item.unit !== 'un'
      ? `<span style="font-size: 10px; color: #22C55E; font-weight: 500;">/${item.unit}</span>`
      : '';

    const descriptionHTML = item.description
      ? `<span style="font-size: 10px; color: #6b7280; margin-left: 8px;">${item.description}</span>`
      : '';

    return `
      <tr style="border-bottom: 1px solid #f3f4f6;">
        <td style="padding: 12px 0;">
          <div style="display: flex; align-items: center; gap: 12px;">
            ${imageHTML}
            <div>
              <p style="font-weight: 500; color: #1f2937; margin: 0; font-size: 13px;">${item.name}</p>
              ${nomeCientificoHTML}
              <div style="margin-top: 2px;">
                ${unitHTML}${descriptionHTML}
              </div>
            </div>
          </div>
        </td>
        <td style="padding: 12px 0; text-align: center; color: #4b5563; font-size: 13px;">${item.quantity}</td>
        <td style="padding: 12px 0 12px 16px; text-align: right; color: #4b5563; font-size: 13px;">${formatCurrency(item.unitPrice)}</td>
        <td style="padding: 12px 0 12px 16px; text-align: right; font-weight: 500; color: #1f2937; font-size: 13px;">${formatCurrency(item.quantity * item.unitPrice)}</td>
      </tr>
    `;
  }).join('');

  const notesHTML = proposal.notes
    ? `
      <div style="padding: 16px 24px; border-top: 1px solid #e5e7eb;">
        <p style="font-size: 10px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 8px 0;">Observações</p>
        <p style="color: #4b5563; font-size: 13px; margin: 0;">${proposal.notes}</p>
      </div>
    `
    : '';

  // Header HTML varia conforme template — modern usa fundo colorido, classic e minimal não.
  const isModern = template === "modern";
  const titleSubColor = isModern ? "rgba(255,255,255,0.7)" : "#9ca3af";
  const titleNumColor = isModern ? "#ffffff" : "#1f2937";
  const headerInnerStyle = isModern
    ? `background: ${tpl.headerBg}; padding: 32px 24px; color: white;`
    : `padding: 24px;`;

  return `
    <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 800px; margin: 0 auto; background: white; position: relative;">
      ${watermarkHTML}
      ${tpl.topBarHeight !== "0px" ? `<div style="height: ${tpl.topBarHeight}; background: ${tpl.topBarBg};"></div>` : ""}

      <!-- Cabeçalho -->
      <div style="${headerInnerStyle}">
        <!-- Título -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px;">
          <h2 style="font-size: ${tpl.titleSize}; font-weight: bold; color: ${tpl.titleColor}; margin: 0; letter-spacing: -0.025em;">${docTitle}</h2>
          <div style="text-align: right;">
            <p style="font-size: 10px; color: ${titleSubColor}; text-transform: uppercase; letter-spacing: 0.05em; margin: 0;">Número</p>
            <p style="font-size: 18px; font-weight: bold; color: ${titleNumColor}; margin: 4px 0 0 0;">${proposal.shortId?.split('/')[0] || proposal.id.slice(-6).toUpperCase()}</p>
          </div>
        </div>

        <!-- Dados da empresa -->
        <div style="display: flex; align-items: flex-start; gap: 16px; padding-bottom: 20px; border-bottom: 1px solid ${isModern ? 'rgba(255,255,255,0.2)' : '#e5e7eb'};">
          <div style="width: 64px; height: 64px; background: ${isModern ? 'rgba(255,255,255,0.15)' : '#0E2A5C10'}; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="${isModern ? '#ffffff' : '#0E2A5C'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <path d="M7 7h10M7 12h10M7 17h6"/>
            </svg>
          </div>
          <div style="flex: 1;">
            <h1 style="font-size: 16px; font-weight: bold; color: ${isModern ? '#ffffff' : '#1f2937'}; margin: 0;">${proposal.company?.name || "Empresa"}</h1>
            <div style="display: flex; flex-wrap: wrap; gap: 16px; margin-top: 8px; font-size: 13px; color: ${isModern ? 'rgba(255,255,255,0.85)' : '#6b7280'};">
              ${proposal.company?.phone ? `<span>${proposal.company.phone}</span>` : ''}
              ${proposal.company?.email ? `<span>${proposal.company.email}</span>` : ''}
            </div>
          </div>
        </div>
      </div>

      <!-- Info Cliente e Datas -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; border-bottom: 1px solid #e5e7eb;">
        <div style="padding: 20px 24px; border-right: 1px solid #e5e7eb;">
          <p style="font-size: 10px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 8px 0;">Cliente</p>
          <p style="font-weight: 600; color: #1f2937; margin: 0; font-size: 14px;">${proposal.client.name}</p>
          ${proposal.client.phone ? `<p style="color: #6b7280; font-size: 13px; margin: 4px 0 0 0;">${proposal.client.phone}</p>` : ''}
        </div>
        <div style="padding: 20px 24px;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
            <div>
              <p style="font-size: 10px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 8px 0;">Data</p>
              <p style="color: #1f2937; margin: 0; font-size: 13px;">${formatDate(proposal.createdAt)}</p>
            </div>
            <div>
              <p style="font-size: 10px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 8px 0;">Validade</p>
              <p style="color: #1f2937; margin: 0; font-size: 13px;">${formatDate(proposal.validUntil)}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Tabela de Itens -->
      <div style="padding: 24px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <thead>
            <tr style="border-bottom: 2px solid #d1d5db;">
              <th style="text-align: left; padding: 12px 0; font-size: 10px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 500;">Item</th>
              <th style="text-align: center; padding: 12px 0; font-size: 10px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 500; width: 50px;">Qtd</th>
              <th style="text-align: right; padding: 12px 0 12px 16px; font-size: 10px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 500; width: 110px;">Unit.</th>
              <th style="text-align: right; padding: 12px 0 12px 16px; font-size: 10px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 500; width: 110px;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHTML}
          </tbody>
        </table>

        <!-- Total -->
        <div style="margin-top: 24px; display: flex; justify-content: flex-end;">
          <div style="width: 240px;">
            <div style="display: flex; justify-content: space-between; padding: 12px; border-bottom: ${tpl.totalBorder}; background: ${tpl.totalBg}; border-radius: ${tpl.totalBg !== 'transparent' ? '8px' : '0'};">
              <span style="font-weight: bold; color: ${tpl.totalColor}; font-size: 16px;">TOTAL</span>
              <span style="font-weight: bold; color: ${tpl.totalColor}; font-size: 16px;">${formatCurrency(proposal.total)}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Condições -->
      <div style="padding: 20px 24px; background: #fafafa; border-top: 1px solid #e5e7eb;">
        <p style="font-size: 10px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 12px 0;">Condições de Pagamento</p>
        <ul style="font-size: 12px; color: #6b7280; margin: 0; padding-left: 16px;">
          <li style="margin-bottom: 4px;">50% no fechamento do contrato</li>
          <li style="margin-bottom: 4px;">50% na conclusão do serviço</li>
          <li>Formas: transferência ou dinheiro</li>
        </ul>
      </div>

      ${notesHTML}

      <!-- Termos -->
      <div style="padding: 20px 24px; border-top: 1px solid #e5e7eb;">
        <p style="font-size: 10px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 12px 0;">Termos</p>
        <ul style="font-size: 12px; color: #6b7280; margin: 0; padding-left: 16px;">
          <li style="margin-bottom: 4px;">Proposta válida até ${formatDateLong(proposal.validUntil)}</li>
          <li style="margin-bottom: 4px;">Garantia de 30 dias após a conclusão do serviço</li>
          <li style="margin-bottom: 4px;">Materiais inclusos conforme especificado acima</li>
          <li>Prazo de execução a combinar após aprovação</li>
        </ul>
      </div>

      <!-- Espaço para assinatura -->
      <div style="padding: 32px 24px; border-top: 1px solid #e5e7eb; text-align: center;">
        <p style="font-size: 12px; color: #6b7280; margin: 0 0 24px 0;">De acordo com os termos acima:</p>
        <div style="display: inline-block; width: 280px;">
          <div style="border-bottom: 1px solid #9ca3af; margin-bottom: 8px; height: 40px;"></div>
          <p style="font-size: 11px; color: #6b7280; margin: 0;">${proposal.client.name}</p>
        </div>
      </div>
    </div>
  `;
}

// Gera PDF a partir de uma proposta
// isFreePlan: se true, adiciona marca d'agua da marca
// template: layout visual do PDF (default lê do localStorage / 'classic')
export async function generateProposalPDF(proposal: Proposal, isFreePlan: boolean = false, template?: PdfTemplate): Promise<void> {
  const tpl = template || getActivePdfTemplate();
  // Criar elemento temporário com o HTML do orçamento
  const container = document.createElement('div');
  container.innerHTML = generateProposalHTML(proposal, isFreePlan, tpl);
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '0';
  document.body.appendChild(container);

  try {
    // Pré-carregar imagens como base64
    await preloadImages(container);

    // Aguardar um pouco para garantir que as imagens foram atualizadas
    await new Promise(resolve => setTimeout(resolve, 100));

    // Dynamic import of html2pdf.js (lazy load ~200KB)
    const html2pdf = (await import("html2pdf.js")).default;

    const filename = `orcamento-${proposal.shortId?.split('/')[0] || proposal.id.slice(-6)}.pdf`;

    const options = {
      margin: 10,
      filename: filename,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        logging: false,
        allowTaint: true,
      },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" as const },
    };

    await html2pdf().set(options).from(container).save();
  } finally {
    // Remover o container
    document.body.removeChild(container);
  }
}

// Gera PDF a partir de um elemento DOM (mantido para compatibilidade)
export async function generatePDFFromElement(elementId: string, filename: string): Promise<void> {
  const element = document.getElementById(elementId);

  if (!element) {
    console.error("Element not found:", elementId);
    return;
  }

  // Clonar o elemento para não modificar o original
  const clone = element.cloneNode(true) as HTMLElement;
  clone.style.position = 'absolute';
  clone.style.left = '-9999px';
  clone.style.top = '0';
  document.body.appendChild(clone);

  try {
    // Pré-carregar imagens como base64 no clone
    await preloadImages(clone);

    // Aguardar um pouco para garantir que as imagens foram atualizadas
    await new Promise(resolve => setTimeout(resolve, 100));

    // Dynamic import of html2pdf.js (lazy load ~200KB)
    const html2pdf = (await import("html2pdf.js")).default;

    const options = {
      margin: 10,
      filename: filename,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        logging: false,
        allowTaint: true,
      },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" as const },
    };

    await html2pdf().set(options).from(clone).save();
  } finally {
    // Remover o clone
    document.body.removeChild(clone);
  }
}
