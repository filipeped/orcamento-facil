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
const FROM_EMAIL_JARDINEI = process.env.FROM_EMAIL || 'JARDINEI <noreply@jardinei.com>';
const FROM_EMAIL_FECHAQUI = process.env.FROM_EMAIL_FECHAQUI || 'FechaAqui <noreply@fechaqui.com>';

// ==================== BRAND CONFIG ====================
// Config por brand. JARDINEI é o legado (não pode quebrar). FechaAqui é o novo.
const BRAND_CONFIG = {
  jardinei: {
    label: 'JARDINEI',
    host: (process.env.JARDINEI_PUBLIC_DOMAIN || 'https://www.jardinei.com').replace(/^https?:\/\//, ''),
    fromEmail: FROM_EMAIL_JARDINEI,
    primaryColor: '#16a34a',
    appPath: '/propostas',
    newPath: '/propostas/nova',
    upgradePath: '/upgrade',
    propostasPath: '/propostas',
    tagline: 'Orçamentos profissionais para jardineiros',
    monthlyPrice: 'R$ 97/mês',
    annualPrice: 'R$ 804/ano (R$67/mês)',
  },
  fechaqui: {
    label: 'FechaAqui',
    host: (process.env.FECHAQUI_PUBLIC_DOMAIN || 'https://www.fechaqui.com').replace(/^https?:\/\//, ''),
    fromEmail: FROM_EMAIL_FECHAQUI,
    primaryColor: '#0E2A5C',
    appPath: '/orcamentos',
    newPath: '/orcamentos/novo',
    upgradePath: '/upgrade',
    propostasPath: '/orcamentos',
    tagline: 'Propostas profissionais pra prestadores de serviço',
    monthlyPrice: 'R$ 29/mês',
    annualPrice: 'R$ 228/ano (R$19/mês)',
  },
};

function detectBrand(req) {
  const reqOrigin = (req?.headers?.origin || req?.headers?.referer || '').toLowerCase();
  if (reqOrigin.includes('fechaqui')) return 'fechaqui';
  return 'jardinei';
}

// Domínios permitidos
const ALLOWED_ORIGINS = [
  'https://www.jardinei.com',
  'https://jardinei.com',
  'https://www.fechaqui.com',
  'https://fechaqui.com',
  'https://verdepro-proposals.vercel.app',
  'http://localhost:8080',
  'http://localhost:3000',
];

// Templates de email — recebem (data, brand). Default brand = jardinei (legacy).
const EMAIL_TEMPLATES = {
  payment_confirmed: (data, brand = 'jardinei') => {
    const cfg = BRAND_CONFIG[brand];
    return {
      subject: `🎉 Pagamento Confirmado - ${cfg.label}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: ${cfg.primaryColor}; margin: 0;">${cfg.label}</h1>
            <p style="color: #666;">${cfg.tagline}</p>
          </div>
          <div style="background: #f0fdf4; border-radius: 12px; padding: 24px; margin-bottom: 20px;">
            <h2 style="color: #166534; margin-top: 0;">Pagamento Confirmado! 🎉</h2>
            <p>Olá <strong>${data.name}</strong>,</p>
            <p>Seu pagamento foi confirmado com sucesso!</p>
            <div style="background: white; border-radius: 8px; padding: 16px; margin: 16px 0;">
              <p style="margin: 0;"><strong>Plano:</strong> ${cfg.label} ${data.planName}</p>
              <p style="margin: 8px 0 0;"><strong>Valor:</strong> R$ ${data.amount.toFixed(2).replace('.', ',')}</p>
            </div>
            <p>Agora você tem acesso a todos os recursos do plano ${data.planName}!</p>
            <p style="background: #fff; border-left: 4px solid ${cfg.primaryColor}; padding: 12px 14px; margin: 16px 0; border-radius: 6px; font-size: 14px;">
              <strong>Pra acessar:</strong> faça login em <a href="https://${cfg.host}/login" style="color: ${cfg.primaryColor};">${cfg.host}/login</a> com o e-mail e senha que você cadastrou.
            </p>
          </div>
          <div style="text-align: center; margin-top: 30px;">
            <a href="https://${cfg.host}/login" style="background: ${cfg.primaryColor}; color: white; padding: 12px 24px; border-radius: 25px; text-decoration: none; font-weight: bold;">Fazer Login</a>
          </div>
          <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e5e5; text-align: center; color: #999; font-size: 12px;">
            <p>© ${new Date().getFullYear()} ${cfg.label} - Todos os direitos reservados</p>
          </div>
        </div>
      `,
    };
  },

  payment_overdue: (data, brand = 'jardinei') => {
    const cfg = BRAND_CONFIG[brand];
    return {
      subject: `⚠️ Pagamento Pendente - ${cfg.label}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: ${cfg.primaryColor}; margin: 0;">${cfg.label}</h1>
          </div>
          <div style="background: #fffbeb; border-radius: 12px; padding: 24px; margin-bottom: 20px; border: 1px solid #fcd34d;">
            <h2 style="color: #92400e; margin-top: 0;">Pagamento Pendente ⚠️</h2>
            <p>Olá <strong>${data.name}</strong>,</p>
            <p>Identificamos que seu pagamento de <strong>R$ ${data.amount.toFixed(2).replace('.', ',')}</strong> está pendente.</p>
            <p>Para não perder acesso ao seu plano, regularize o pagamento o mais rápido possível.</p>
          </div>
          <div style="text-align: center; margin-top: 30px;">
            <a href="https://${cfg.host}${cfg.upgradePath}" style="background: #f59e0b; color: white; padding: 12px 24px; border-radius: 25px; text-decoration: none; font-weight: bold;">Regularizar Pagamento</a>
          </div>
        </div>
      `,
    };
  },

  welcome_basic: (data, brand = 'jardinei') => {
    const cfg = BRAND_CONFIG[brand];
    return {
      subject: `Bem-vindo ao ${cfg.label}!`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: ${cfg.primaryColor}; margin: 0;">${cfg.label}</h1>
          </div>
          <div style="background: linear-gradient(135deg, #f0fdf4, #ecfdf5); border-radius: 12px; padding: 24px; margin-bottom: 20px;">
            <h2 style="color: #166534; margin-top: 0;">Bem-vindo ao ${cfg.label}!</h2>
            <p>Olá <strong>${data.name}</strong>,</p>
            <p>Sua conta foi criada! Você está no plano <strong>Grátis</strong> com <strong>5 propostas grátis por mês</strong>.</p>
            <p style="color: #166534;">Quer mais propostas e recursos? Conheça os planos ${cfg.monthlyPrice} e ${cfg.annualPrice}!</p>
          </div>
          <div style="text-align: center; margin-top: 30px;">
            <a href="https://${cfg.host}${cfg.appPath}" style="background: ${cfg.primaryColor}; color: white; padding: 12px 24px; border-radius: 25px; text-decoration: none; font-weight: bold;">Criar Primeira Proposta</a>
          </div>
        </div>
      `,
    };
  },
};

// Helper para adicionar UTM aos links
function addUtm(baseUrl, source, campaign) {
  const separator = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${separator}utm_source=whatsapp&utm_medium=notification&utm_campaign=${campaign}`;
}

// Templates de WhatsApp — recebem (data, brand). Default brand = jardinei (legacy).
const WHATSAPP_TEMPLATES = {
  welcome: (data, brand = 'jardinei') => {
    const cfg = BRAND_CONFIG[brand];
    const emoji = brand === 'jardinei' ? '🌱 ' : '';
    return `${emoji}*Bem-vindo ao ${cfg.label}!*

Olá ${data.name}! 👋

Sua conta está pronta!

Crie orçamentos profissionais em segundos e envie direto pro WhatsApp do cliente.

🎁 Você tem *5 propostas grátis* todo mês.

👉 Crie sua primeira proposta agora:
${addUtm(`${cfg.host}${cfg.newPath}`, 'whatsapp', 'welcome')}

Quer mais propostas? Conheça nossos planos:
• *Mensal* ${cfg.monthlyPrice}: 30 propostas + sua marca
• *Anual* ${cfg.annualPrice}: tudo ilimitado

👉 ${addUtm(`${cfg.host}${cfg.upgradePath}`, 'whatsapp', 'welcome')}

Qualquer dúvida, responda aqui!

— ${cfg.label}`;
  },

  proposal_reminder: (data, brand = 'jardinei') => {
    const cfg = BRAND_CONFIG[brand];
    return `📋 *Proposta aguardando resposta*

Olá ${data.name},

Sua proposta para *${data.clientName}* foi enviada há ${data.days} dias e ainda não foi visualizada.

📋 *${data.proposalTitle}*
💰 ${data.proposalTotal}

💡 *Dica:* Envie novamente o link ou ligue para o cliente!

👉 Ver: ${data.proposalLink || `${cfg.host}${cfg.propostasPath}`}

— ${cfg.label}`;
  },

  approved: (data, brand = 'jardinei') => {
    const cfg = BRAND_CONFIG[brand];
    return `🎉 *Proposta Aprovada!*

Parabéns${data.ownerName ? ` ${data.ownerName}` : ''}! 🏆

O cliente *${data.clientName}* aprovou sua proposta:

📋 *${data.proposalTitle}*
💰 *${data.proposalTotal}*

✅ Fechamento confirmado!

👉 Ver: ${data.proposalLink || `${cfg.host}${cfg.propostasPath}`}

Bom trabalho! 💪

— ${cfg.label}`;
  },

  limit_reached: (data, brand = 'jardinei') => {
    const cfg = BRAND_CONFIG[brand];
    return `⚠️ *Limite de propostas atingido*

Olá ${data.name},

Você usou suas *5 propostas grátis* deste mês.

Quer continuar fechando novos clientes?

🚀 *Mensal* ${cfg.monthlyPrice}:
• 30 propostas por mês
• Sua marca nos orçamentos
• Notificações em tempo real

🔥 *Anual* ${cfg.annualPrice}:
• Tudo ilimitado
• Melhor custo-benefício
• Suporte prioritário

👉 ${addUtm(`${cfg.host}${cfg.upgradePath}`, 'whatsapp', 'limit_reached')}

— ${cfg.label}`;
  },

  inactive: (data, brand = 'jardinei') => {
    const cfg = BRAND_CONFIG[brand];
    return `👋 *Sentimos sua falta!*

Olá ${data.name}!

Faz tempo que você não cria um orçamento no ${cfg.label}.

Seus clientes estão esperando propostas profissionais! 📋

👉 Crie uma proposta agora:
${addUtm(`${cfg.host}${cfg.newPath}`, 'whatsapp', 'inactive')}

— ${cfg.label}`;
  },
};

// Enviar WhatsApp
async function sendWhatsApp(to, message, type, data, brand = 'jardinei') {
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

  // Se não tem mensagem mas tem tipo, usar template (parametrizado por brand)
  if (!finalMessage && type && WHATSAPP_TEMPLATES[type]) {
    finalMessage = WHATSAPP_TEMPLATES[type](data || {}, brand);
  }

  // Fallback para tipo approved (compatibilidade)
  if (!finalMessage && data && type === 'approved') {
    finalMessage = WHATSAPP_TEMPLATES.approved(data, brand);
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
async function sendEmail(to, template, data, brand = 'jardinei') {
  if (!RESEND_API_KEY) {
    console.log('⚠️ RESEND_API_KEY não configurada');
    return false;
  }

  if (!EMAIL_TEMPLATES[template]) {
    console.error('Template inválido:', template);
    return false;
  }

  const emailContent = EMAIL_TEMPLATES[template](data, brand);
  const fromEmail = BRAND_CONFIG[brand]?.fromEmail || FROM_EMAIL_JARDINEI;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
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

  const { channel, to, message, type, template, data, brand: brandFromBody } = req.body;

  if (!channel || !to) {
    return res.status(400).json({ error: 'channel e to são obrigatórios' });
  }

  // Brand: body explícito > origin do request > default jardinei
  const brand = brandFromBody === 'fechaqui' || brandFromBody === 'jardinei'
    ? brandFromBody
    : detectBrand(req);

  let success = false;

  if (channel === 'whatsapp') {
    success = await sendWhatsApp(to, message, type, data, brand);
  } else if (channel === 'email') {
    success = await sendEmail(to, template, data, brand);
  } else {
    return res.status(400).json({ error: 'channel deve ser whatsapp ou email' });
  }

  return res.status(200).json({ success, channel });
}

// Exports para uso em outros arquivos
export { sendWhatsApp, sendEmail };
