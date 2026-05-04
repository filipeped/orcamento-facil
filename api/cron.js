/**
 * API unificada de cron jobs
 * GET/POST /api/cron?job=check-plans|recurring|monthly-report|proposal-reminders|reengagement
 *
 * Configurar no vercel.json:
 * - /api/cron?job=check-plans → 0 8 * * * (diário 8h)
 * - /api/cron?job=proposal-reminders → 0 10 * * * (diário 10h)
 * - /api/cron?job=reengagement → 0 11 * * * (diário 11h)
 * - /api/cron?job=recurring → 0 7 1 * * (dia 1 do mês)
 * - /api/cron?job=monthly-report → 0 10 1 * * (dia 1 do mês)
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'JARDINEI <noreply@jardinei.com>';
// 🚫 KILL SWITCH: WhatsApp transacional desativado (propostas, lembretes, etc.)
const WHATSAPP_DISABLED = true;

const EVOLUTION_URL = process.env.EVOLUTION_URL || 'https://digitalpaisagismo-evolution.cloudfy.live';
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE || 'jardinei';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;

// 📢 Instância separada para mensagens promocionais (cupons, ofertas)
const EVOLUTION_PROMO_INSTANCE = process.env.EVOLUTION_PROMO_INSTANCE || 'Jardinei Promoção';
const EVOLUTION_PROMO_API_KEY = process.env.EVOLUTION_PROMO_API_KEY || EVOLUTION_API_KEY;

// ========== HELPERS ==========

async function sendEmail(to, subject, html) {
  if (!RESEND_API_KEY) return false;
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function sendWhatsApp(phone, message) {
  if (WHATSAPP_DISABLED) {
    console.log('⏸️ WhatsApp desativado (kill switch). Msg não enviada para:', phone);
    return false;
  }
  if (!EVOLUTION_API_KEY || !phone) return false;
  try {
    let phoneNumber = phone.replace(/\D/g, '');
    if (phoneNumber.length === 11) phoneNumber = '55' + phoneNumber;
    if (phoneNumber.length < 12) return false;
    const response = await fetch(`${EVOLUTION_URL}/message/sendText/${EVOLUTION_INSTANCE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_API_KEY },
      body: JSON.stringify({ number: phoneNumber, text: message }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

// 📢 WhatsApp promocional - instância separada, SEM kill switch
async function sendWhatsAppPromo(phone, message) {
  if (!EVOLUTION_PROMO_API_KEY || !phone) return false;
  try {
    let phoneNumber = phone.replace(/\D/g, '');
    if (phoneNumber.length === 11) phoneNumber = '55' + phoneNumber;
    if (phoneNumber.length < 12) return false;
    const response = await fetch(`${EVOLUTION_URL}/message/sendText/${encodeURIComponent(EVOLUTION_PROMO_INSTANCE)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_PROMO_API_KEY },
      body: JSON.stringify({ number: phoneNumber, text: message }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

// 10 variações - trial expirou, promoção 15% OFF válida até amanhã
function getPromoMessage(nome) {
  const msgs = [
    `Oi ${nome}! Seu teste gratis do JARDINEI acabou. Mas esse mes estamos com uma promocao de 15% OFF pra quem assinar.\n\nVale ate amanha: jardinei.com/upgrade?cupom=VOLTA15\n\nDepois de amanha volta pro preco normal.`,

    `${nome}, tudo bem? Seu teste terminou, mas tenho uma boa noticia. Estamos com 15% de desconto esse mes, so que vale ate amanha.\n\nAcessa aqui: jardinei.com/upgrade?cupom=VOLTA15\n\nSe quiser aproveitar, e so clicar.`,

    `E ai ${nome}! Seu periodo de teste acabou. A boa noticia e que esse mes temos uma promocao: 15% OFF em qualquer plano.\n\nMas so ate amanha: jardinei.com/upgrade?cupom=VOLTA15\n\nDepois disso o preco volta ao normal.`,

    `Oi ${nome}, seu teste acabou mas calhou de cair numa semana de promocao. 15% OFF pra assinar, valido ate amanha.\n\njardinei.com/upgrade?cupom=VOLTA15\n\nSe precisar de ajuda pra escolher o plano, me chama.`,

    `${nome}! Seu teste do JARDINEI encerrou. Mas olha so: esse mes liberamos 15% de desconto pra novos assinantes. Vale ate amanha.\n\nAproveita: jardinei.com/upgrade?cupom=VOLTA15\n\nDepois o cupom expira.`,

    `Oi ${nome}, passando pra avisar que seu teste acabou. Mas voce pegou uma epoca boa: temos 15% OFF esse mes.\n\nO desconto vale ate amanha: jardinei.com/upgrade?cupom=VOLTA15\n\nAmanha ja era, volta pro preco cheio.`,

    `${nome}, tudo certo? Seu acesso gratis terminou, mas essa semana estamos com uma oferta de 15% OFF. So vale ate amanha.\n\njardinei.com/upgrade?cupom=VOLTA15\n\nQualquer duvida estou por aqui.`,

    `E ai ${nome}! Vi que seu teste encerrou. Estamos com promocao esse mes: 15% OFF em qualquer plano, mas acaba amanha.\n\nLink com desconto: jardinei.com/upgrade?cupom=VOLTA15\n\nBora continuar fechando servico?`,

    `Oi ${nome}! Seu teste acabou, mas consegui incluir voce na promocao do mes. 15% de desconto, valido ate amanha.\n\njardinei.com/upgrade?cupom=VOLTA15\n\nE so escolher o plano e o desconto ja aplica.`,

    `${nome}, seu teste gratis terminou. A boa e que pegou a promocao do mes: 15% OFF pra quem assinar ate amanha.\n\nAcessa: jardinei.com/upgrade?cupom=VOLTA15\n\nDepois de amanha o cupom para de funcionar.`,
  ];
  return msgs[Math.floor(Math.random() * msgs.length)];
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verificar autenticação do cron (OBRIGATÓRIO em produção)
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${cronSecret}`) {
      console.error('Cron rejeitado: token inválido');
      return res.status(401).json({ error: 'Unauthorized' });
    }
  } else if (process.env.VERCEL_ENV === 'production') {
    console.error('❌ CRON_SECRET não configurado em produção!');
    return res.status(500).json({ error: 'CRON_SECRET not configured' });
  }

  const { job } = req.query;

  try {
    switch (job) {
      case 'check-plans':
        return await checkPlans(req, res);
      case 'proposal-reminders':
        return await sendProposalReminders(req, res);
      case 'reengagement':
        return await sendReengagement(req, res);
      case 'recurring':
        return await processRecurring(req, res);
      case 'monthly-report':
        return await sendMonthlyReport(req, res);
      default:
        return res.status(400).json({ error: 'Job inválido. Use: check-plans, proposal-reminders, reengagement, recurring, monthly-report' });
    }
  } catch (error) {
    console.error('Erro no cron:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

// ========== CHECK PLANS ==========
// Fluxo SEM trial:
// - Usuário novo: Grátis (grátis pra sempre, 5 propostas/mês)
// - Pagou: Mensal (R$97) ou Anual (R$804)
// - Atrasou: Overdue (7 dias de carência)
// - Não pagou em 7 dias: Volta pro Grátis
async function checkPlans(req, res) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const now = new Date();
  const results = { plansExpired: 0, overdueDowngraded: 0, reminders: 0, overdueReconciled: 0 };

  // Reconciliação: overdue com vencimento futuro → volta pra active
  // (cobre webhook PAYMENT_CONFIRMED perdido ou renovação manual que esqueceu o status)
  const { data: staleOverdue } = await supabase
    .from('profiles')
    .select('user_id')
    .eq('plan_status', 'overdue')
    .gt('plan_expires_at', now.toISOString());

  for (const user of staleOverdue || []) {
    await supabase.from('profiles').update({
      plan_status: 'active', plan_overdue_since: null, updated_at: now.toISOString(),
    }).eq('user_id', user.user_id);
    results.overdueReconciled++;
  }

  // Planos pagos expirados → muda para overdue (7 dias de carência)
  const { data: expiredPlans } = await supabase
    .from('profiles')
    .select('user_id, full_name, phone, plan')
    .eq('plan_status', 'active')
    .in('plan', ['essential', 'pro'])
    .lt('plan_expires_at', now.toISOString());

  for (const user of expiredPlans || []) {
    await supabase.from('profiles').update({
      plan_status: 'overdue', plan_overdue_since: now.toISOString(), updated_at: now.toISOString(),
    }).eq('user_id', user.user_id);
    results.plansExpired++;
  }

  // Overdue há mais de 7 dias → volta pro Grátis
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const { data: overdueUsers } = await supabase
    .from('profiles')
    .select('user_id, full_name, phone')
    .eq('plan_status', 'overdue')
    .lt('plan_overdue_since', sevenDaysAgo.toISOString());

  for (const user of overdueUsers || []) {
    await supabase.from('profiles').update({
      plan: 'free', plan_status: 'active', plan_overdue_since: null, updated_at: now.toISOString(),
    }).eq('user_id', user.user_id);

    await supabase.from('notifications').insert({
      user_id: user.user_id, type: 'plan_downgraded',
      title: 'Plano alterado para Grátis',
      message: 'Voce agora tem 5 propostas/mes gratis. Assine Mensal ou Anual para mais!',
      read: false,
    });

    if (user.phone) {
      const nome = user.full_name?.split(' ')[0] || 'Cliente';
      const msg = getPromoMessage(nome);
      await sendWhatsAppPromo(user.phone, msg);
    }
    results.overdueDowngraded++;
  }

  // Lembretes de renovação (3 dias antes de expirar) - apenas planos pagos
  const threeDays = new Date(now);
  threeDays.setDate(threeDays.getDate() + 3);
  const { data: expiringSoon } = await supabase
    .from('profiles')
    .select('user_id, full_name, phone, plan')
    .eq('plan_status', 'active')
    .in('plan', ['essential', 'pro'])
    .gte('plan_expires_at', new Date(threeDays.setHours(0,0,0,0)).toISOString())
    .lte('plan_expires_at', new Date(threeDays.setHours(23,59,59,999)).toISOString());

  for (const user of expiringSoon || []) {
    await supabase.from('notifications').insert({
      user_id: user.user_id, type: 'plan_expiring_soon',
      title: 'Plano expira em 3 dias',
      message: 'Renove para continuar usando todos os recursos!',
      read: false,
    });

    // 📱 Enviar WhatsApp de lembrete
    if (user.phone) {
      const nome = user.full_name?.split(' ')[0] || 'Cliente';
      const planoNome = user.plan === 'pro' ? 'Anual' : 'Mensal';
      const msg = `⏰ *Seu plano expira em 3 dias*

Olá ${nome}!

Seu plano *JARDINEI ${planoNome}* expira em 3 dias.

Renove agora para continuar com:
• Propostas ilimitadas
• Sua marca nos orçamentos
• Notificações em tempo real

👉 jardinei.com/configuracoes?tab=billing

— JARDINEI`;
      await sendWhatsApp(user.phone, msg);
    }
    results.reminders++;
  }

  // 📧 SEQUÊNCIA DE 5 EMAILS - benefícios durante e após trial (sem WhatsApp)
  const nurturingEmails = [
    { day: 1, type: 'nurture_email_day1', subject: (n) => `${n}, uma dica pra fechar mais servicos`,
      html: (n) => `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <h2 style="color:#16a34a;">Bem-vindo ao JARDINEI, ${n}!</h2>
        <p>Sabia que voce pode criar uma proposta profissional em menos de 2 minutos?</p>
        <p>O cliente recebe pelo celular, ve suas plantas com foto e aprova na hora. Sem app, sem complicacao.</p>
        <div style="background:#f0fdf4;padding:16px;border-radius:12px;margin:20px 0;">
          <p style="margin:0;font-weight:bold;color:#16a34a;">Dica: crie sua primeira proposta agora e veja como fica!</p>
        </div>
        <div style="text-align:center;margin:24px 0;">
          <a href="https://www.jardinei.com/propostas/nova" style="background:#16a34a;color:white;padding:14px 32px;border-radius:25px;text-decoration:none;display:inline-block;font-weight:bold;">Criar Minha Primeira Proposta</a>
        </div>
        <p style="color:#999;font-size:12px;">Voce tem 3 dias pra testar tudo de graca.</p>
      </div>` },
    { day: 2, type: 'nurture_email_day2', subject: (n) => `${n}, seus clientes vao notar a diferenca`,
      html: (n) => `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <h2 style="color:#16a34a;">Sua marca em cada proposta</h2>
        <p>Oi ${n}!</p>
        <p>A proposta sai com <strong>sua marca, seus precos</strong>, tudo personalizado. O cliente acha que voce tem uma empresa grande.</p>
        <p>E o melhor: voce recebe uma <strong>notificacao quando o cliente abre</strong>. Assim sabe a hora certa de ligar.</p>
        <div style="background:#f0fdf4;padding:16px;border-radius:12px;margin:20px 0;">
          <p style="margin:0;font-weight:bold;color:#16a34a;">Jardineiros que enviam proposta profissional fecham ate 3x mais.</p>
        </div>
        <div style="text-align:center;margin:24px 0;">
          <a href="https://www.jardinei.com/configuracoes" style="background:#16a34a;color:white;padding:14px 32px;border-radius:25px;text-decoration:none;display:inline-block;font-weight:bold;">Personalizar Minha Marca</a>
        </div>
        <p style="color:#999;font-size:12px;">Seu teste gratis acaba amanha. Aproveite!</p>
      </div>` },
    { day: 4, type: 'nurture_email_day4', subject: (n) => `${n}, voce viu como funciona. E agora?`,
      html: (n) => `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <h2 style="color:#16a34a;">Seu teste acabou, ${n}. E agora?</h2>
        <p>Voce ja viu como e enviar uma proposta profissional. O cliente recebe, abre no celular e aprova.</p>
        <p>Sem o JARDINEI, volta a ser orcamento por texto no WhatsApp. O cliente compara e escolhe quem parece mais profissional.</p>
        <div style="background:#f0fdf4;padding:16px;border-radius:12px;margin:20px 0;">
          <p style="margin:0;font-weight:bold;color:#16a34a;">Plano Mensal: R$ 97/mes. Plano Anual: R$ 67/mes.</p>
          <p style="margin:8px 0 0;color:#666;">1 servico aprovado ja paga o investimento do mes.</p>
        </div>
        <div style="text-align:center;margin:24px 0;">
          <a href="https://www.jardinei.com/upgrade" style="background:#16a34a;color:white;padding:14px 32px;border-radius:25px;text-decoration:none;display:inline-block;font-weight:bold;">Ver Planos</a>
        </div>
      </div>` },
    { day: 5, type: 'nurture_email_day5', subject: (n) => `${n}, ultima chance de garantir 15% OFF`,
      html: (n) => `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <h2 style="color:#16a34a;">Ainda da tempo, ${n}</h2>
        <p>Ontem te mandei uma promocao de 15% OFF no WhatsApp. Se voce nao viu, o cupom ainda ta valido.</p>
        <div style="background:#f0fdf4;padding:20px;border-radius:12px;margin:20px 0;text-align:center;">
          <p style="font-size:28px;font-weight:bold;color:#16a34a;margin:0;">15% OFF</p>
          <p style="color:#666;margin:8px 0 0;">Cupom: <strong>VOLTA15</strong></p>
        </div>
        <p>O desconto ja esta aplicado no link abaixo:</p>
        <div style="text-align:center;margin:24px 0;">
          <a href="https://www.jardinei.com/upgrade?cupom=VOLTA15" style="background:#16a34a;color:white;padding:14px 32px;border-radius:25px;text-decoration:none;display:inline-block;font-weight:bold;">Aproveitar 15% OFF</a>
        </div>
        <p style="color:#999;font-size:12px;">Esse e o ultimo email sobre isso. Depois disso o cupom expira.</p>
      </div>` },
  ];

  for (const step of nurturingEmails) {
    const daysAgo = new Date(now);
    daysAgo.setDate(daysAgo.getDate() - step.day);
    const dayBefore = new Date(now);
    dayBefore.setDate(dayBefore.getDate() - (step.day + 1));

    const { data: usersForStep } = await supabase
      .from('profiles')
      .select('user_id, full_name, created_at')
      .eq('plan', 'free')
      .gte('created_at', new Date(dayBefore.setHours(0,0,0,0)).toISOString())
      .lte('created_at', new Date(daysAgo.setHours(23,59,59,999)).toISOString());

    for (const user of usersForStep || []) {
      const { data: existing } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', user.user_id)
        .eq('type', step.type)
        .single();

      if (existing) continue;

      const nome = user.full_name?.split(' ')[0] || 'Cliente';
      const { data: authUser } = await supabase.auth.admin.getUserById(user.user_id);
      const email = authUser?.user?.email;

      if (email) {
        await sendEmail(email, step.subject(nome), step.html(nome));
      }

      await supabase.from('notifications').insert({
        user_id: user.user_id, type: step.type,
        title: 'Dica do JARDINEI',
        message: 'Confira uma dica para fechar mais servicos.',
        read: false,
      });

      results.nurturingEmails = (results.nurturingEmails || 0) + 1;
    }
  }

  // 🎁 PROMOÇÃO 15% OFF - Única mensagem WhatsApp + email, no dia que o trial expira (3º dia)
  // Uma única mensagem: WhatsApp promo + email, avisando que acabou + promoção até amanhã
  const threeDaysAgo = new Date(now);
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  const fourDaysAgo = new Date(now);
  fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);

  const { data: trialJustExpired } = await supabase
    .from('profiles')
    .select('user_id, full_name, phone, created_at')
    .eq('plan', 'free')
    .gte('created_at', new Date(fourDaysAgo.setHours(0,0,0,0)).toISOString())
    .lte('created_at', new Date(threeDaysAgo.setHours(23,59,59,999)).toISOString());

  for (const user of trialJustExpired || []) {
    const { data: existingNotif } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', user.user_id)
      .eq('type', 'trial_expired_promo')
      .single();

    if (existingNotif) continue;

    const nome = user.full_name?.split(' ')[0] || 'Cliente';

    await supabase.from('notifications').insert({
      user_id: user.user_id, type: 'trial_expired_promo',
      title: 'Seu teste acabou - 15% OFF até amanhã',
      message: 'Seu teste grátis acabou, mas temos uma promoção de 15% OFF válida até amanhã!',
      read: false,
    });

    // 📱 WhatsApp promo (instância separada, 10 variações)
    if (user.phone) {
      await sendWhatsAppPromo(user.phone, getPromoMessage(nome));
    }

    // 📧 Email com a mesma oferta
    const { data: authUser } = await supabase.auth.admin.getUserById(user.user_id);
    const email = authUser?.user?.email;
    if (email) {
      const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <h2 style="color:#16a34a;">Seu teste gratis acabou, ${nome}!</h2>
        <p>Mas temos uma boa noticia: esse mes estamos com uma promocao especial.</p>
        <div style="background:#f0fdf4;padding:20px;border-radius:12px;margin:20px 0;text-align:center;">
          <p style="font-size:24px;font-weight:bold;color:#16a34a;margin:0;">15% OFF</p>
          <p style="color:#666;margin:8px 0 0;">Valido ate amanha. Cupom: <strong>VOLTA15</strong></p>
        </div>
        <p>O desconto ja esta aplicado no link abaixo:</p>
        <div style="text-align:center;margin:24px 0;">
          <a href="https://www.jardinei.com/upgrade?cupom=VOLTA15" style="background:#16a34a;color:white;padding:14px 32px;border-radius:25px;text-decoration:none;display:inline-block;font-weight:bold;">Aproveitar 15% OFF</a>
        </div>
        <p style="color:#999;font-size:12px;">Depois de amanha o preco volta ao normal.</p>
      </div>`;
      await sendEmail(email, `${nome}, 15% OFF no JARDINEI - vale ate amanha`, html);
    }

    results.trialPromos = (results.trialPromos || 0) + 1;
  }

  return res.status(200).json({ success: true, job: 'check-plans', results });
}

// ========== PROPOSAL REMINDERS ==========
// 1. Propostas enviadas há 3+ dias sem visualização
// 2. Propostas visualizadas há 3+ dias sem aprovação
async function sendProposalReminders(req, res) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const now = new Date();
  const results = { notViewed: 0, notApproved: 0, skipped: 0 };

  const threeDaysAgo = new Date(now);
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  const fourDaysAgo = new Date(now);
  fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);

  // 1. Propostas NÃO VISUALIZADAS há 3 dias
  const { data: notViewedProposals } = await supabase
    .from('proposals')
    .select('id, user_id, client_name, title, total, sent_at, short_id')
    .eq('status', 'sent')
    .gte('sent_at', fourDaysAgo.toISOString())
    .lte('sent_at', threeDaysAgo.toISOString());

  for (const proposal of notViewedProposals || []) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, phone')
      .eq('user_id', proposal.user_id)
      .single();

    if (!profile?.phone) {
      results.skipped++;
      continue;
    }

    const nome = profile.full_name?.split(' ')[0] || 'Cliente';
    const totalFormatted = formatCurrency(proposal.total || 0);
    const proposalLink = proposal.short_id ? `jardinei.com/p/${proposal.short_id}` : 'jardinei.com/propostas';

    const msg = `📋 *Proposta aguardando resposta*

Olá ${nome},

Sua proposta para *${proposal.client_name}* foi enviada há 3 dias e ainda não foi visualizada.

📋 *${proposal.title}*
💰 ${totalFormatted}

💡 *Dica:* Envie novamente o link ou ligue para o cliente!

👉 Ver: ${proposalLink}

— JARDINEI`;

    const sent = await sendWhatsApp(profile.phone, msg);
    if (sent) {
      results.notViewed++;
      await supabase.from('notifications').insert({
        user_id: proposal.user_id,
        type: 'proposal_reminder',
        title: 'Proposta sem visualização',
        message: `Sua proposta para ${proposal.client_name} ainda não foi visualizada.`,
        metadata: { proposal_id: proposal.id },
        read: false,
      });
    } else {
      results.skipped++;
    }
  }

  // 2. Propostas VISUALIZADAS mas NÃO APROVADAS há 3 dias
  const { data: viewedNotApproved } = await supabase
    .from('proposals')
    .select('id, user_id, client_name, title, total, viewed_at, short_id')
    .eq('status', 'viewed')
    .gte('viewed_at', fourDaysAgo.toISOString())
    .lte('viewed_at', threeDaysAgo.toISOString());

  for (const proposal of viewedNotApproved || []) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, phone')
      .eq('user_id', proposal.user_id)
      .single();

    if (!profile?.phone) {
      results.skipped++;
      continue;
    }

    const nome = profile.full_name?.split(' ')[0] || 'Cliente';
    const totalFormatted = formatCurrency(proposal.total || 0);
    const proposalLink = proposal.short_id ? `jardinei.com/p/${proposal.short_id}` : 'jardinei.com/propostas';

    const msg = `👀 *Cliente viu, mas não respondeu*

Olá ${nome},

*${proposal.client_name}* visualizou sua proposta há 3 dias, mas ainda não aprovou.

📋 *${proposal.title}*
💰 ${totalFormatted}

💡 *Dica:* Esse é o momento de ligar e tirar dúvidas! Clientes que visualizam têm alto interesse.

📞 Entre em contato hoje!

👉 Ver: ${proposalLink}

— JARDINEI`;

    const sent = await sendWhatsApp(profile.phone, msg);
    if (sent) {
      results.notApproved++;
      await supabase.from('notifications').insert({
        user_id: proposal.user_id,
        type: 'proposal_pending_approval',
        title: 'Cliente viu, aguardando resposta',
        message: `${proposal.client_name} visualizou sua proposta mas ainda não aprovou.`,
        metadata: { proposal_id: proposal.id },
        read: false,
      });
    } else {
      results.skipped++;
    }
  }

  return res.status(200).json({ success: true, job: 'proposal-reminders', results });
}

// ========== REENGAGEMENT ==========
// Usuários inativos há 14+ dias
async function sendReengagement(req, res) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const now = new Date();
  const results = { inactive: 0, skipped: 0 };

  // Propostas expiradas - apenas atualizar status, sem enviar WhatsApp
  const { data: expiredProposals } = await supabase
    .from('proposals')
    .select('id')
    .in('status', ['sent', 'viewed'])
    .lt('valid_until', now.toISOString());

  for (const proposal of expiredProposals || []) {
    await supabase.from('proposals').update({ status: 'expired' }).eq('id', proposal.id);
  }

  // Usuários inativos (última proposta há 14+ dias)
  const fourteenDaysAgo = new Date(now);
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  // Buscar usuários que têm propostas mas nenhuma nos últimos 14 dias
  const { data: activeUsers } = await supabase
    .from('proposals')
    .select('user_id')
    .gte('created_at', fourteenDaysAgo.toISOString());

  const activeUserIds = [...new Set((activeUsers || []).map(p => p.user_id))];

  // Buscar usuários com propostas antigas que não estão ativos
  const { data: inactiveUsers } = await supabase
    .from('profiles')
    .select('user_id, full_name, phone, last_reengagement_at')
    .not('user_id', 'in', `(${activeUserIds.length > 0 ? activeUserIds.map(id => `"${id}"`).join(',') : '""'})`)
    .not('phone', 'is', null);

  for (const user of inactiveUsers || []) {
    // Verificar se já enviou reengagement nos últimos 14 dias
    if (user.last_reengagement_at) {
      const lastSent = new Date(user.last_reengagement_at);
      if (now.getTime() - lastSent.getTime() < 14 * 24 * 60 * 60 * 1000) {
        results.skipped++;
        continue;
      }
    }

    // Verificar se usuário tem pelo menos 1 proposta (não é totalmente novo)
    const { count } = await supabase
      .from('proposals')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.user_id);

    if (!count || count === 0) {
      results.skipped++;
      continue;
    }

    const nome = user.full_name?.split(' ')[0] || 'Cliente';

    const msg = `👋 *Sentimos sua falta!*

Olá ${nome}!

Faz tempo que você não cria um orçamento no JARDINEI.

Seus clientes estão esperando propostas profissionais! 📋

👉 Crie uma proposta agora:
jardinei.com/propostas/nova

— JARDINEI`;

    const sent = await sendWhatsApp(user.phone, msg);
    if (sent) {
      results.inactive++;
      // Atualizar última data de reengagement
      await supabase.from('profiles').update({ last_reengagement_at: now.toISOString() }).eq('user_id', user.user_id);
    }
  }

  return res.status(200).json({ success: true, job: 'reengagement', results });
}

// ========== RECURRING PROPOSALS ==========
async function processRecurring(req, res) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const results = { processed: 0, created: 0 };

  const { data: recurring } = await supabase
    .from('proposals')
    .select('*')
    .eq('is_recurring', true)
    .eq('status', 'approved')
    .lte('next_recurrence_date', today);

  for (const proposal of recurring || []) {
    results.processed++;

    let nextDate = new Date(proposal.next_recurrence_date);
    if (proposal.recurring_frequency === 'quarterly') nextDate.setMonth(nextDate.getMonth() + 3);
    else if (proposal.recurring_frequency === 'yearly') nextDate.setFullYear(nextDate.getFullYear() + 1);
    else nextDate.setMonth(nextDate.getMonth() + 1);

    const validUntil = new Date(now);
    validUntil.setDate(validUntil.getDate() + 7);

    const shortId = Math.random().toString(36).substring(2, 8).toUpperCase();

    const { data: created } = await supabase.from('proposals').insert({
      user_id: proposal.user_id,
      short_id: shortId,
      client_name: proposal.client_name,
      client_phone: proposal.client_phone,
      client_email: proposal.client_email,
      title: proposal.title,
      service_type: proposal.service_type,
      total: proposal.total,
      notes: proposal.notes,
      status: 'draft',
      valid_until: validUntil.toISOString(),
      is_recurring: false,
      parent_proposal_id: proposal.id,
    }).select('id').single();

    if (created) {
      await supabase.from('proposals').update({ next_recurrence_date: nextDate.toISOString().split('T')[0] }).eq('id', proposal.id);
      await supabase.from('notifications').insert({
        user_id: proposal.user_id, type: 'recurring_proposal',
        title: 'Nova proposta recorrente 🔄',
        message: `Proposta para ${proposal.client_name} criada automaticamente!`,
        read: false,
      });
      results.created++;
    }
  }

  return res.status(200).json({ success: true, job: 'recurring', results });
}

// ========== MONTHLY REPORT ==========
async function sendMonthlyReport(req, res) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  const monthNames = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const results = { sent: 0, skipped: 0 };

  const { data: users } = await supabase.from('profiles').select('user_id, full_name').or('plan.neq.free,plan.is.null');

  for (const user of users || []) {
    const { data: authUser } = await supabase.auth.admin.getUserById(user.user_id);
    const email = authUser?.user?.email;
    if (!email) { results.skipped++; continue; }

    const { data: proposals } = await supabase
      .from('proposals')
      .select('client_name, total, status')
      .eq('user_id', user.user_id)
      .gte('created_at', lastMonth.toISOString())
      .lte('created_at', lastMonthEnd.toISOString());

    if (!proposals?.length) { results.skipped++; continue; }

    const approved = proposals.filter(p => p.status === 'approved');
    const revenue = approved.reduce((s, p) => s + (p.total || 0), 0);
    const rate = Math.round((approved.length / proposals.length) * 100);
    const name = user.full_name?.split(' ')[0] || 'Cliente';
    const month = monthNames[lastMonth.getMonth()];

    const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
      <h2 style="color:#16a34a">📊 Relatório de ${month}</h2>
      <p>Olá ${name}!</p>
      <div style="background:#f0fdf4;padding:20px;border-radius:12px;margin:20px 0;">
        <p><b>Faturamento:</b> ${formatCurrency(revenue)}</p>
        <p><b>Propostas:</b> ${proposals.length} criadas, ${approved.length} aprovadas</p>
        <p><b>Conversão:</b> ${rate}%</p>
      </div>
      <a href="https://www.jardinei.com/propostas" style="background:#16a34a;color:white;padding:14px 28px;border-radius:25px;text-decoration:none;display:inline-block;">Ver Propostas</a>
    </div>`;

    const sent = await sendEmail(email, `📊 Relatório de ${month} - ${formatCurrency(revenue)}`, html);
    if (sent) results.sent++;
  }

  return res.status(200).json({ success: true, job: 'monthly-report', results });
}
