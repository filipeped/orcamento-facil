/**
 * API unificada de notificações (WhatsApp + Email)
 * POST /api/notifications
 * Body: { channel: "whatsapp" | "email", ... }
 */

// ==================== WHATSAPP (Evolution API) ====================
// 🚫 KILL SWITCH: Desativado temporariamente para evitar block no WhatsApp
const WHATSAPP_DISABLED = true;

const EVOLUTION_URL = process.env.EVOLUTION_URL || 'https://digitalpaisagismo-evolution.cloudfy.live';
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE || 'jardinei';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;

// ==================== EMAIL (Resend) ====================
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'JARDINEI <noreply@jardinei.com>';

// Domínios permitidos
const ALLOWED_ORIGINS = [
  'https://www.jardinei.com',
  'https://jardinei.com',
  'https://verdepro-proposals.vercel.app',
  'http://localhost:8080',
  'http://localhost:3000',
];

// Templates de email
const EMAIL_TEMPLATES = {
  payment_confirmed: (data) => ({
    subject: '🎉 Pagamento Confirmado - JARDINEI',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #16a34a; margin: 0;">JARDINEI</h1>
          <p style="color: #666;">Orçamentos profissionais para jardineiros</p>
        </div>
        <div style="background: #f0fdf4; border-radius: 12px; padding: 24px; margin-bottom: 20px;">
          <h2 style="color: #166534; margin-top: 0;">Pagamento Confirmado! 🎉</h2>
          <p>Olá <strong>${data.name}</strong>,</p>
          <p>Seu pagamento foi confirmado com sucesso!</p>
          <div style="background: white; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <p style="margin: 0;"><strong>Plano:</strong> JARDINEI ${data.planName}</p>
            <p style="margin: 8px 0 0;"><strong>Valor:</strong> R$ ${data.amount.toFixed(2).replace('.', ',')}</p>
          </div>
          <p>Agora você tem acesso a todos os recursos do plano ${data.planName}!</p>
          <p style="background: #fff; border-left: 4px solid #16a34a; padding: 12px 14px; margin: 16px 0; border-radius: 6px; font-size: 14px;">
            <strong>Pra acessar:</strong> faça login em <a href="https://www.jardinei.com/login" style="color: #16a34a;">jardinei.com/login</a> com o e-mail e senha que você cadastrou.
          </p>
        </div>
        <div style="text-align: center; margin-top: 30px;">
          <a href="https://www.jardinei.com/login" style="background: #16a34a; color: white; padding: 12px 24px; border-radius: 25px; text-decoration: none; font-weight: bold;">Fazer Login</a>
        </div>
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e5e5; text-align: center; color: #999; font-size: 12px;">
          <p>© ${new Date().getFullYear()} JARDINEI - Todos os direitos reservados</p>
        </div>
      </div>
    `,
  }),

  payment_overdue: (data) => ({
    subject: '⚠️ Pagamento Pendente - JARDINEI',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #16a34a; margin: 0;">JARDINEI</h1>
        </div>
        <div style="background: #fffbeb; border-radius: 12px; padding: 24px; margin-bottom: 20px; border: 1px solid #fcd34d;">
          <h2 style="color: #92400e; margin-top: 0;">Pagamento Pendente ⚠️</h2>
          <p>Olá <strong>${data.name}</strong>,</p>
          <p>Identificamos que seu pagamento de <strong>R$ ${data.amount.toFixed(2).replace('.', ',')}</strong> está pendente.</p>
          <p>Para não perder acesso ao seu plano, regularize o pagamento o mais rápido possível.</p>
        </div>
        <div style="text-align: center; margin-top: 30px;">
          <a href="https://www.jardinei.com/upgrade" style="background: #f59e0b; color: white; padding: 12px 24px; border-radius: 25px; text-decoration: none; font-weight: bold;">Regularizar Pagamento</a>
        </div>
      </div>
    `,
  }),

  welcome_basic: (data) => ({
    subject: 'Bem-vindo ao JARDINEI!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #16a34a; margin: 0;">JARDINEI</h1>
        </div>
        <div style="background: linear-gradient(135deg, #f0fdf4, #ecfdf5); border-radius: 12px; padding: 24px; margin-bottom: 20px;">
          <h2 style="color: #166534; margin-top: 0;">Bem-vindo ao JARDINEI!</h2>
          <p>Olá <strong>${data.name}</strong>,</p>
          <p>Sua conta foi criada! Você está no plano <strong>Grátis</strong> com <strong>5 propostas grátis por mês</strong>.</p>
          <p style="color: #166534;">Quer mais propostas e recursos? Conheça os planos Mensal (R$97) e Anual (R$804)!</p>
        </div>
        <div style="text-align: center; margin-top: 30px;">
          <a href="https://www.jardinei.com/propostas" style="background: #16a34a; color: white; padding: 12px 24px; border-radius: 25px; text-decoration: none; font-weight: bold;">Criar Primeira Proposta</a>
        </div>
      </div>
    `,
  }),
};

// Helper para adicionar UTM aos links
function addUtm(baseUrl, source, campaign) {
  const separator = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${separator}utm_source=whatsapp&utm_medium=notification&utm_campaign=${campaign}`;
}

// Templates de WhatsApp
const WHATSAPP_TEMPLATES = {
  welcome: (data) => `🌱 *Bem-vindo ao JARDINEI!*

Olá ${data.name}! 👋

Sua conta está pronta!

Crie orçamentos profissionais em segundos e envie direto pro WhatsApp do cliente.

🎁 Você tem *5 propostas grátis* todo mês.

👉 Crie sua primeira proposta agora:
${addUtm('jardinei.com/propostas/nova', 'whatsapp', 'welcome')}

Quer mais propostas? Conheça nossos planos:
• *Mensal* R$ 97/mês: 30 propostas + sua marca
• *Anual* R$ 804/ano (R$67/mês): tudo ilimitado

👉 ${addUtm('jardinei.com/upgrade', 'whatsapp', 'welcome')}

Qualquer dúvida, responda aqui!

— JARDINEI`,

  proposal_reminder: (data) => `📋 *Proposta aguardando resposta*

Olá ${data.name},

Sua proposta para *${data.clientName}* foi enviada há ${data.days} dias e ainda não foi visualizada.

📋 *${data.proposalTitle}*
💰 ${data.proposalTotal}

💡 *Dica:* Envie novamente o link ou ligue para o cliente!

👉 Ver: ${data.proposalLink || 'jardinei.com/propostas'}

— JARDINEI`,

  approved: (data) => `🎉 *Proposta Aprovada!*

Parabéns${data.ownerName ? ` ${data.ownerName}` : ''}! 🏆

O cliente *${data.clientName}* aprovou sua proposta:

📋 *${data.proposalTitle}*
💰 *${data.proposalTotal}*

✅ Fechamento confirmado!

👉 Ver: ${data.proposalLink || 'jardinei.com/propostas'}

Bom trabalho! 💪

— JARDINEI`,

  limit_reached: (data) => `⚠️ *Limite de propostas atingido*

Olá ${data.name},

Você usou suas *5 propostas grátis* deste mês.

Quer continuar fechando novos clientes?

🚀 *Mensal* R$ 97/mês:
• 30 propostas por mês
• Sua marca nos orçamentos
• Notificações em tempo real

🔥 *Anual* R$ 804/ano (R$67/mês):
• Tudo ilimitado
• Melhor custo-benefício
• Suporte prioritário

👉 ${addUtm('jardinei.com/upgrade', 'whatsapp', 'limit_reached')}

— JARDINEI`,

  inactive: (data) => `👋 *Sentimos sua falta!*

Olá ${data.name}!

Faz tempo que você não cria um orçamento no JARDINEI.

Seus clientes estão esperando propostas profissionais! 📋

👉 Crie uma proposta agora:
${addUtm('jardinei.com/propostas/nova', 'whatsapp', 'inactive')}

— JARDINEI`,
};

// Enviar WhatsApp
async function sendWhatsApp(to, message, type, data) {
  if (WHATSAPP_DISABLED) {
    console.log('⏸️ WhatsApp desativado (kill switch). Mensagem não enviada para:', to);
    return false;
  }
  if (!EVOLUTION_API_KEY) {
    console.log('⚠️ EVOLUTION_API_KEY não configurada');
    return false;
  }

  let phoneNumber = to.replace(/\D/g, '');
  if (phoneNumber.length === 11 || phoneNumber.length === 10) {
    phoneNumber = '55' + phoneNumber;
  }

  let finalMessage = message;

  // Se não tem mensagem mas tem tipo, usar template
  if (!finalMessage && type && WHATSAPP_TEMPLATES[type]) {
    finalMessage = WHATSAPP_TEMPLATES[type](data || {});
  }

  // Fallback para tipo approved (compatibilidade)
  if (!finalMessage && data && type === 'approved') {
    finalMessage = WHATSAPP_TEMPLATES.approved(data);
  }

  try {
    const response = await fetch(`${EVOLUTION_URL}/message/sendText/${EVOLUTION_INSTANCE}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVOLUTION_API_KEY,
      },
      body: JSON.stringify({ number: phoneNumber, text: finalMessage }),
    });
    const result = await response.json();
    console.log('📱 WhatsApp enviado:', phoneNumber);
    return response.ok;
  } catch (error) {
    console.error('Erro WhatsApp:', error);
    return false;
  }
}

// Enviar Email
async function sendEmail(to, template, data) {
  if (!RESEND_API_KEY) {
    console.log('⚠️ RESEND_API_KEY não configurada');
    return false;
  }

  if (!EMAIL_TEMPLATES[template]) {
    console.error('Template inválido:', template);
    return false;
  }

  const emailContent = EMAIL_TEMPLATES[template](data);

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [to],
        subject: emailContent.subject,
        html: emailContent.html,
      }),
    });
    console.log('📧 Email enviado:', to);
    return response.ok;
  } catch (error) {
    console.error('Erro Email:', error);
    return false;
  }
}

// API Handler
export default async function handler(req, res) {
  // CORS
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { channel, to, message, type, template, data } = req.body;

  if (!channel || !to) {
    return res.status(400).json({ error: 'channel e to são obrigatórios' });
  }

  let success = false;

  if (channel === 'whatsapp') {
    success = await sendWhatsApp(to, message, type, data);
  } else if (channel === 'email') {
    success = await sendEmail(to, template, data);
  } else {
    return res.status(400).json({ error: 'channel deve ser whatsapp ou email' });
  }

  return res.status(200).json({ success, channel });
}

// Exports para uso em outros arquivos
export { sendWhatsApp, sendEmail };
