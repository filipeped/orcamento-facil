import { Proposal } from "@/contexts/ProposalsContext";
import { getSupabase } from "./supabase";

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};

const numberToWords = (num: number): string => {
  const units = ["", "um", "dois", "tres", "quatro", "cinco", "seis", "sete", "oito", "nove"];
  const teens = ["dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
  const tens = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
  const hundreds = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

  if (num === 0) return "zero";
  if (num === 100) return "cem";
  if (num < 10) return units[num];
  if (num < 20) return teens[num - 10];
  if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? " e " + units[num % 10] : "");
  if (num < 1000) return hundreds[Math.floor(num / 100)] + (num % 100 ? " e " + numberToWords(num % 100) : "");
  if (num < 1000000) {
    const thousands = Math.floor(num / 1000);
    const remainder = num % 1000;
    return (thousands === 1 ? "mil" : numberToWords(thousands) + " mil") + (remainder ? " e " + numberToWords(remainder) : "");
  }
  return num.toString();
};

const currencyToWords = (value: number): string => {
  const reais = Math.floor(value);
  const centavos = Math.round((value - reais) * 100);

  let result = numberToWords(reais) + (reais === 1 ? " real" : " reais");
  if (centavos > 0) {
    result += " e " + numberToWords(centavos) + (centavos === 1 ? " centavo" : " centavos");
  }
  return result;
};

interface ContractData {
  proposal: Proposal;
  companyName: string;
  companyDocument?: string;
  companyAddress?: string;
}

export async function generateContractPDF(data: ContractData): Promise<void> {
  const { proposal, companyName } = data;
  const today = new Date();

  const html = `
    <div id="contract-content" style="font-family: 'Times New Roman', serif; padding: 40px; color: #1e293b; width: 100%; background: white; line-height: 1.8; font-size: 12pt;">

      <div style="text-align: center; margin-bottom: 40px;">
        <h1 style="font-size: 18pt; margin: 0; text-transform: uppercase; letter-spacing: 2px;">
          CONTRATO DE PRESTACAO DE SERVICOS
        </h1>
        <p style="font-size: 10pt; color: #666; margin-top: 10px;">
          Contrato N. ${(proposal.shortId?.split('/')[0] || proposal.id.slice(-6).toUpperCase())} / ${today.getFullYear()}
        </p>
      </div>

      <p style="text-align: justify; margin-bottom: 20px;">
        Pelo presente instrumento particular, as partes abaixo qualificadas:
      </p>

      <div style="margin-bottom: 30px; padding: 15px; background: #f8f9fa; border-left: 4px solid #10b981;">
        <p style="margin: 0 0 10px 0;"><strong>CONTRATADA:</strong></p>
        <p style="margin: 0;">${companyName}</p>
        <p style="margin: 0; font-size: 10pt; color: #666;">Doravante denominada simplesmente "CONTRATADA"</p>
      </div>

      <div style="margin-bottom: 30px; padding: 15px; background: #f8f9fa; border-left: 4px solid #3b82f6;">
        <p style="margin: 0 0 10px 0;"><strong>CONTRATANTE:</strong></p>
        <p style="margin: 0;">${proposal.client.name}</p>
        ${proposal.client.phone ? `<p style="margin: 0; font-size: 10pt;">Telefone: ${proposal.client.phone}</p>` : ""}
        ${proposal.client.email ? `<p style="margin: 0; font-size: 10pt;">E-mail: ${proposal.client.email}</p>` : ""}
        <p style="margin: 0; font-size: 10pt; color: #666;">Doravante denominado(a) simplesmente "CONTRATANTE"</p>
      </div>

      <p style="text-align: justify; margin-bottom: 20px;">
        Tem entre si justo e contratado o seguinte:
      </p>

      <h2 style="font-size: 14pt; margin: 30px 0 15px 0; border-bottom: 1px solid #ddd; padding-bottom: 5px;">
        CLAUSULA PRIMEIRA - DO OBJETO
      </h2>
      <p style="text-align: justify;">
        O presente contrato tem como objeto a prestacao dos seguintes servicos:
      </p>
      <p style="text-align: justify; font-weight: bold; color: #10b981;">
        ${proposal.title}
      </p>

      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <thead>
          <tr style="background: #f1f5f9;">
            <th style="text-align: left; padding: 10px; border: 1px solid #e2e8f0; font-size: 11pt;">Item/Servico</th>
            <th style="text-align: center; padding: 10px; border: 1px solid #e2e8f0; font-size: 11pt; width: 60px;">Qtd</th>
            <th style="text-align: right; padding: 10px; border: 1px solid #e2e8f0; font-size: 11pt; width: 100px;">Valor Unit.</th>
            <th style="text-align: right; padding: 10px; border: 1px solid #e2e8f0; font-size: 11pt; width: 100px;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${proposal.items.map((item, index) => `
            <tr style="background: ${index % 2 === 0 ? "#fff" : "#f8fafc"};">
              <td style="padding: 10px; border: 1px solid #e2e8f0; font-size: 11pt;">
                ${item.name}
                ${item.description ? `<br/><span style="font-size: 9pt; color: #666;">${item.description}</span>` : ""}
              </td>
              <td style="text-align: center; padding: 10px; border: 1px solid #e2e8f0; font-size: 11pt;">${item.quantity}</td>
              <td style="text-align: right; padding: 10px; border: 1px solid #e2e8f0; font-size: 11pt;">${formatCurrency(item.unitPrice)}</td>
              <td style="text-align: right; padding: 10px; border: 1px solid #e2e8f0; font-size: 11pt; font-weight: bold;">${formatCurrency(item.quantity * item.unitPrice)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>

      <h2 style="font-size: 14pt; margin: 30px 0 15px 0; border-bottom: 1px solid #ddd; padding-bottom: 5px;">
        CLAUSULA SEGUNDA - DO PRECO E FORMA DE PAGAMENTO
      </h2>
      <p style="text-align: justify;">
        Pela execucao dos servicos descritos na Clausula Primeira, o CONTRATANTE pagara a CONTRATADA o valor total de:
      </p>
      <div style="text-align: center; margin: 20px 0; padding: 20px; background: #f0fdf4; border: 2px solid #10b981; border-radius: 8px;">
        <p style="margin: 0; font-size: 24pt; font-weight: bold; color: #10b981;">${formatCurrency(proposal.total)}</p>
        <p style="margin: 10px 0 0 0; font-size: 10pt; color: #666;">(${currencyToWords(proposal.total)})</p>
      </div>

      <p style="text-align: justify;">
        <strong>Paragrafo Unico:</strong> A forma de pagamento sera acordada entre as partes, podendo ser realizada mediante transferencia bancaria, PIX, ou outra forma convencionada.
      </p>

      <h2 style="font-size: 14pt; margin: 30px 0 15px 0; border-bottom: 1px solid #ddd; padding-bottom: 5px;">
        CLAUSULA TERCEIRA - DO PRAZO
      </h2>
      <p style="text-align: justify;">
        O prazo para execucao dos servicos sera acordado entre as partes apos a assinatura deste contrato, considerando a disponibilidade de materiais e condicoes climaticas.
      </p>

      <h2 style="font-size: 14pt; margin: 30px 0 15px 0; border-bottom: 1px solid #ddd; padding-bottom: 5px;">
        CLAUSULA QUARTA - DAS OBRIGACOES DA CONTRATADA
      </h2>
      <p style="text-align: justify;">
        Sao obrigacoes da CONTRATADA:
      </p>
      <ul style="text-align: justify; margin-left: 20px;">
        <li>Executar os servicos com qualidade e dentro dos padroes tecnicos;</li>
        <li>Fornecer os materiais e insumos necessarios conforme descrito no orcamento;</li>
        <li>Manter o ambiente de trabalho limpo e organizado;</li>
        <li>Comunicar qualquer imprevisto que possa afetar a execucao dos servicos.</li>
      </ul>

      <h2 style="font-size: 14pt; margin: 30px 0 15px 0; border-bottom: 1px solid #ddd; padding-bottom: 5px;">
        CLAUSULA QUINTA - DAS OBRIGACOES DO CONTRATANTE
      </h2>
      <p style="text-align: justify;">
        Sao obrigacoes do CONTRATANTE:
      </p>
      <ul style="text-align: justify; margin-left: 20px;">
        <li>Efetuar o pagamento conforme acordado;</li>
        <li>Fornecer acesso ao local de execucao dos servicos;</li>
        <li>Disponibilizar agua e energia eletrica quando necessario.</li>
      </ul>

      ${proposal.notes ? `
      <h2 style="font-size: 14pt; margin: 30px 0 15px 0; border-bottom: 1px solid #ddd; padding-bottom: 5px;">
        CLAUSULA SEXTA - DAS OBSERVACOES
      </h2>
      <div style="padding: 15px; background: #fffbeb; border: 1px solid #fcd34d; border-radius: 8px;">
        <p style="text-align: justify; margin: 0;">${proposal.notes}</p>
      </div>
      ` : ""}

      <h2 style="font-size: 14pt; margin: 30px 0 15px 0; border-bottom: 1px solid #ddd; padding-bottom: 5px;">
        CLAUSULA SETIMA - DO FORO
      </h2>
      <p style="text-align: justify;">
        As partes elegem o foro da comarca onde os servicos serao executados para dirimir quaisquer duvidas oriundas do presente contrato.
      </p>

      <p style="text-align: justify; margin-top: 30px;">
        E, por estarem assim justos e contratados, firmam o presente instrumento em duas vias de igual teor.
      </p>

      <p style="text-align: right; margin-top: 30px;">
        _________________, ${formatDate(today.toISOString())}
      </p>

      <div style="margin-top: 60px; display: flex; justify-content: space-between;">
        <div style="text-align: center; width: 45%;">
          <div style="border-top: 1px solid #333; padding-top: 10px;">
            <p style="margin: 0; font-weight: bold;">${companyName}</p>
            <p style="margin: 0; font-size: 10pt; color: #666;">CONTRATADA</p>
          </div>
        </div>
        <div style="text-align: center; width: 45%;">
          <div style="border-top: 1px solid #333; padding-top: 10px;">
            <p style="margin: 0; font-weight: bold;">${proposal.client.name}</p>
            <p style="margin: 0; font-size: 10pt; color: #666;">CONTRATANTE</p>
          </div>
        </div>
      </div>

      <div style="margin-top: 40px; padding: 10px; background: #f1f5f9; font-size: 9pt; color: #666; text-align: center;">
        Documento gerado em ${formatDate(today.toISOString())}
        <br/>
        Referente ao orcamento #${(proposal.shortId?.split('/')[0] || proposal.id.slice(-6).toUpperCase())} aprovado em ${proposal.approvedAt ? formatDate(proposal.approvedAt) : "N/A"}
      </div>
    </div>
  `;

  const container = document.createElement("div");
  container.innerHTML = html;
  container.style.position = "fixed";
  container.style.left = "0";
  container.style.top = "0";
  container.style.width = "210mm";
  container.style.background = "white";
  container.style.zIndex = "-1000";
  container.style.opacity = "0";
  document.body.appendChild(container);

  await new Promise(resolve => setTimeout(resolve, 100));

  const options = {
    margin: 10,
    filename: `contrato-${(proposal.shortId?.split('/')[0] || proposal.id.slice(-6).toUpperCase())}.pdf`,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      logging: false,
      width: 794,
      windowWidth: 794
    },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" as const },
  };

  try {
    const element = container.querySelector("#contract-content");
    if (element) {
      // Dynamic import of html2pdf.js (lazy load ~200KB)
      const html2pdf = (await import("html2pdf.js")).default;
      await html2pdf().set(options).from(element).save();
    }
  } finally {
    document.body.removeChild(container);
  }
}

// Salvar contrato no banco de dados
export async function saveContract(
  userId: string,
  proposalId: string,
  clientName: string,
  totalValue: number
): Promise<string | null> {
  try {
    const { data, error } = await getSupabase()
      .from("contracts")
      .insert({
        user_id: userId,
        proposal_id: proposalId,
        client_name: clientName,
        total_value: totalValue,
        status: "active",
      })
      .select("id")
      .single();

    if (error) throw error;
    return data.id;
  } catch (error) {
    console.error("Error saving contract:", error);
    return null;
  }
}

// Buscar contrato por proposta
export async function getContractByProposal(proposalId: string) {
  try {
    const { data, error } = await getSupabase()
      .from("contracts")
      .select("*")
      .eq("proposal_id", proposalId)
      .single();

    if (error && error.code !== "PGRST116") throw error;
    return data;
  } catch (error) {
    console.error("Error fetching contract:", error);
    return null;
  }
}
