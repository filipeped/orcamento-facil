/**
 * Webhook do Asaas para processar notificações de pagamento
 * URL: https://www.jardinei.com/api/webhook-asaas (compartilhado com FechaAqui)
 *
 * Backend multi-tenant: detecta brand pela descrição do payment.
 *
 * Segurança: Configure ASAAS_WEBHOOK_TOKEN no Vercel e no Asaas
 */

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { sendEmail } from './notifications.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Token de segurança do webhook (configurar no Asaas e Vercel)
const ASAAS_WEBHOOK_TOKEN = process.env.ASAAS_WEBHOOK_TOKEN;

// Configuração do Facebook CAPI
const CAPI_URL = "https://cap.jardinei.com/api/events";
const PIXEL_ID = "888149620416465";

// Configuração do Evolution API (WhatsApp)
// 🚫 KILL SWITCH: Desativado temporariamente para evitar block no WhatsApp
const WHATSAPP_DISABLED = true;

const EVOLUTION_URL = process.env.EVOLUTION_URL || 'https://digitalpaisagismo-evolution.cloudfy.live';
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE || 'jardinei';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;

// Enviar mensagem WhatsApp
async function sendWhatsAppMessage(phone, message) {
  if (WHATSAPP_DISABLED) {
    console.log('⏸️ WhatsApp desativado (kill switch). Msg não enviada para:', phone);
    return false;
  }
  if (!EVOLUTION_API_KEY || !phone) return false;

  try {
    // Formatar número
    let phoneNumber = phone.replace(/\D/g, '');
    if (phoneNumber.length === 11) phoneNumber = '55' + phoneNumber;
    if (phoneNumber.length < 12) return false;

    const response = await fetch(`${EVOLUTION_URL}/message/sendText/${EVOLUTION_INSTANCE}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVOLUTION_API_KEY,
      },
      body: JSON.stringify({
        number: phoneNumber,
        text: message,
      }),
    });

    if (response.ok) {
      console.log('📱 WhatsApp enviado para:', phoneNumber);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Erro ao enviar WhatsApp:', error);
    return false;
  }
}

// Função para hash SHA256 (Meta exige dados hasheados)
function hashSHA256(value) {
  if (!value || typeof value !== 'string') return '';
  try {
    return crypto.createHash('sha256').update(value.toLowerCase().trim()).digest('hex');
  } catch {
    return '';
  }
}

// Gerar event_id determinístico para deduplicação Pixel/CAPI
// Usa payment.id do Asaas para garantir que webhook e PagamentoSucesso gerem o mesmo ID
function generateEventId(paymentId) {
  return `purchase_asaas_${paymentId}`;
}

// Enviar evento Purchase para Facebook CAPI
// Usa event_id determinístico baseado no payment.id para deduplicação com PagamentoSucesso.tsx
// browserData: fbp, fbc, clientIP, userAgent capturados no checkout (tabela checkout_tracking)
async function sendPurchaseToFacebook(userData, paymentData, browserData = {}) {
  try {
    const eventId = generateEventId(paymentData.paymentId);

    // Hashear dados PII
    const hashedEmail = hashSHA256(userData.email);
    // Normalizar telefone: adicionar DDI 55 para números brasileiros
    let phoneDigits = (userData.phone || '').replace(/\D/g, '');
    if (phoneDigits.length === 10 || phoneDigits.length === 11) {
      phoneDigits = '55' + phoneDigits;
    }
    const hashedPhone = hashSHA256(phoneDigits);

    // Extrair primeiro e último nome
    const nameParts = (userData.full_name || '').trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
    const hashedFirstName = hashSHA256(firstName);
    const hashedLastName = hashSHA256(lastName);

    // Preparar user_data - inclui fbp/fbc/IP/UA do browser (checkout_tracking)
    const capiUserData = {
      external_id: hashSHA256(userData.user_id),
      ...(hashedEmail && { em: hashedEmail }),
      ...(hashedPhone && { ph: hashedPhone }),
      ...(hashedFirstName && { fn: hashedFirstName }),
      ...(hashedLastName && { ln: hashedLastName }),
      country: hashSHA256('br'), // Brasil
      ...(browserData.fbp && { fbp: browserData.fbp }),
      ...(browserData.fbc && { fbc: browserData.fbc }),
      ...(browserData.clientIP && { client_ip_address: browserData.clientIP }),
      ...(browserData.userAgent && { client_user_agent: browserData.userAgent }),
    };

    // Preparar custom_data
    const customData = {
      value: paymentData.value,
      currency: 'BRL',
      content_name: paymentData.planName,
      content_category: 'subscription',
      content_type: 'product',
      content_ids: [paymentData.plan],
      order_id: paymentData.paymentId,
    };

    // Payload CAPI
    const payload = {
      data: [{
        event_name: 'Purchase',
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId,
        user_data: capiUserData,
        custom_data: customData,
        event_source_url: browserData.sourceUrl || (paymentData.eventSourceUrl || 'https://www.jardinei.com/upgrade'),
        action_source: 'website'
      }],
      pixel_id: PIXEL_ID
    };

    console.log('🎯 Enviando Purchase para Facebook CAPI:', {
      eventId,
      value: paymentData.value,
      plan: paymentData.plan,
      email: hashedEmail.substring(0, 16) + '...',
      hasFbp: !!browserData.fbp,
      hasFbc: !!browserData.fbc,
      hasRealIp: !!browserData.clientIP,
      hasUserAgent: !!browserData.userAgent,
    });

    // Enviar para CAPI com retry
    let success = false;
    let attempts = 0;
    const maxAttempts = 3;

    while (!success && attempts < maxAttempts) {
      try {
        const response = await fetch(CAPI_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          const result = await response.json();
          console.log('✅ Purchase enviado para Facebook CAPI:', result);
          success = true;
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
      } catch (err) {
        attempts++;
        console.error(`❌ Erro CAPI Purchase (tentativa ${attempts}/${maxAttempts}):`, err.message);
        if (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 500 * attempts));
        }
      }
    }

    return success;
  } catch (error) {
    console.error('❌ Erro ao enviar Purchase para Facebook:', error);
    return false;
  }
}

export default async function handler(req, res) {
  // Apenas POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 🔐 Verificar token de autenticação do Asaas (OBRIGATÓRIO)
  const receivedToken = req.headers['asaas-access-token'] || req.query.token;
  if (!ASAAS_WEBHOOK_TOKEN) {
    console.error('❌ ASAAS_WEBHOOK_TOKEN não configurado! Rejeitando webhook.');
    return res.status(500).json({ error: 'Webhook token not configured' });
  }
  if (receivedToken !== ASAAS_WEBHOOK_TOKEN) {
    console.error('❌ Webhook rejeitado: token inválido');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Conectar ao Supabase para logs
  const supabaseLog = createClient(supabaseUrl, supabaseServiceKey);
  let logId = null;

  try {
    const event = req.body;

    console.log('Webhook Asaas recebido:', event.event, event.payment?.id);

    // 📝 Salvar log do webhook
    const { data: logData } = await supabaseLog
      .from('webhook_logs')
      .insert({
        event_type: event.event || 'UNKNOWN',
        payload: event,
        status: 'processing',
      })
      .select('id')
      .single();

    logId = logData?.id;

    // Tipos de evento do Asaas
    // PAYMENT_CONFIRMED - Pagamento confirmado
    // PAYMENT_RECEIVED - Pagamento recebido
    // PAYMENT_OVERDUE - Pagamento atrasado
    // PAYMENT_DELETED - Pagamento deletado
    // PAYMENT_REFUNDED - Pagamento estornado

    if (event.event === 'PAYMENT_CONFIRMED' || event.event === 'PAYMENT_RECEIVED') {
      const payment = event.payment;

      // Validar que payment existe
      if (!payment) {
        console.error('Webhook sem objeto payment:', event);
        if (logId) {
          await supabaseLog.from('webhook_logs').update({
            status: 'error',
            error_message: 'Webhook sem objeto payment',
          }).eq('id', logId);
        }
        return res.status(200).json({ received: true, warning: 'missing payment object' });
      }

      // Conectar ao Supabase com service role (bypass RLS)
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Idempotência: verificar se este pagamento já foi processado
      const { data: existingPayment } = await supabase
        .from('payment_history')
        .select('id')
        .eq('asaas_payment_id', payment.id)
        .eq('status', 'paid')
        .single();

      if (existingPayment) {
        console.log('⏭️ Pagamento já processado (idempotente):', payment.id);
        return res.status(200).json({ received: true, already_processed: true });
      }

      // Pegar o user_id do externalReference (passado no link de pagamento)
      let userId = payment.externalReference;

      // ⚠️ FALLBACK CRÍTICO: Se Asaas não retornou externalReference,
      // tenta achar o usuário pelo customer_id do Asaas.
      // Asaas reusa o customer por CPF/email, então pode haver N profiles
      // apontando pro mesmo customer_id. Pega o mais recente (updated_at DESC).
      if (!userId && payment.customer) {
        console.warn('⚠️ externalReference vazio, tentando fallback via customer_id:', payment.customer);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, updated_at')
          .eq('asaas_customer_id', payment.customer)
          .order('updated_at', { ascending: false })
          .limit(1);
        if (profiles && profiles.length > 0) {
          userId = profiles[0].user_id;
          console.log('✅ Fallback OK: userId recuperado via customer_id:', userId);
        }
      }

      if (!userId) {
        console.error('❌ FALHA CRÍTICA: userId não encontrado', {
          paymentId: payment.id,
          customerId: payment.customer,
          value: payment.value,
          externalRef: payment.externalReference,
        });
        // Persiste erro pra alerta/retry manual (não bloqueia o webhook)
        try {
          await supabase.from('webhook_logs').insert({
            event_type: event.event,
            payload: event,
            status: 'error',
            error_message: `userId missing — cliente pagou mas plano nao foi atualizado (payment.id=${payment.id})`,
          });
        } catch (logErr) {
          console.error('Erro ao logar falha:', logErr);
        }
        return res.status(200).json({ received: true, error: 'userId missing' });
      }

      console.log('User ID encontrado:', userId);

      // Determinar o plano baseado na descrição (prioridade) e valor (fallback)
      // Aceita sinônimos das gerações antigas (JARDINEI/OrçaFácil) e novas (FechaAqui).
      let plan = 'free';
      const value = payment.value || 0;
      const description = (payment.description || '').toLowerCase();

      // Detectar brand pela descrição. Default JARDINEI (preserva compat).
      const brand = description.includes('fechaqui') || description.includes('fecha aqui')
        ? 'fechaqui'
        : 'jardinei';
      const brandLabel = brand === 'fechaqui' ? 'FechaAqui' : 'JARDINEI';
      const brandHost = brand === 'fechaqui'
        ? (process.env.FECHAQUI_PUBLIC_DOMAIN || 'https://www.fechaqui.com').replace(/^https?:\/\//, '')
        : (process.env.JARDINEI_PUBLIC_DOMAIN || 'https://www.jardinei.com').replace(/^https?:\/\//, '');

      // 1. Detectar pela descrição (mais confiável - funciona com cupons de desconto)
      // Aceita: "FechaAqui Mensal/Anual", "JARDINEI Mensal/Anual", "OrçaFácil Mensal/Anual", "(-15%)" etc.
      if (description.includes('anual') || description.includes('pro')) {
        plan = 'pro';
      } else if (
        description.includes('mensal') ||
        description.includes('essencial') ||
        description.includes('starter')
      ) {
        plan = 'essential';
      }
      // 2. Fallback: detectar pelo valor exato (cobre preço atual + histórico)
      // Atual: 29 (mensal) / 228 (anual). Histórico Jardinei: 97 / 804.
      else if (value === 228 || value === 804) {
        plan = 'pro';
      } else if (value === 29 || value === 97) {
        plan = 'essential';
      }
      // 3. Último fallback: faixa de valor (cobre cupom). >200 é anual mesmo com desconto pesado.
      else if (value > 200) {
        plan = 'pro';
      } else if (value > 0) {
        plan = 'essential';
      }

      // Detectar período (mensal ou anual)
      let planPeriod = 'monthly';
      if (description.includes('anual') || value >= 200) {
        planPeriod = 'annual';
      }

      console.log('Plano detectado:', plan, 'período:', planPeriod, 'valor:', value, 'descrição:', description);

      // Buscar dados do usuário para o Facebook CAPI e verificar se é renovação
      const { data: userData, error: userError } = await supabase
        .from('profiles')
        .select('full_name, phone, plan_status, plan')
        .eq('user_id', userId)
        .single();

      // Buscar email do auth.users
      const { data: authData } = await supabase.auth.admin.getUserById(userId);
      const userEmail = authData?.user?.email || '';

      if (userError) {
        console.error('Erro ao buscar dados do usuário:', userError);
      }

      // Verificar se é primeira compra ou renovação
      // É primeira compra se: plano é free ou status não é active
      const isFirstPurchase = !userData?.plan_status ||
        userData.plan === 'free' ||
        userData.plan_status === 'trial' || // backward compat
        userData.plan_status === 'expired' ||
        userData.plan_status === 'cancelled' ||
        userData.plan_status === 'overdue';

      console.log('Tipo de pagamento:', isFirstPurchase ? 'PRIMEIRA COMPRA' : 'RENOVAÇÃO', 'status atual:', userData?.plan_status);

      // Calcular data de expiração do plano
      const now = new Date();
      const expiresAt = new Date(now);
      if (planPeriod === 'annual') {
        expiresAt.setFullYear(expiresAt.getFullYear() + 1); // +1 ano
      } else {
        expiresAt.setDate(expiresAt.getDate() + 30); // +30 dias
      }

      // Atualizar perfil do usuário diretamente pelo user_id
      const { data: updatedRows, error: updateError } = await supabase
        .from('profiles')
        .update({
          plan: plan,
          plan_status: 'active',
          plan_period: planPeriod,
          plan_started_at: now.toISOString(),
          plan_expires_at: expiresAt.toISOString(),
          plan_overdue_since: null, // Limpar atraso anterior se houver
          updated_at: now.toISOString(),
        })
        .eq('user_id', userId)
        .select('user_id');

      if (updateError) {
        console.error('Erro ao atualizar perfil:', updateError);
        return res.status(500).json({ error: 'Failed to update profile' });
      }

      // ⚠️ Verificação crítica: o UPDATE realmente atualizou uma linha?
      if (!updatedRows || updatedRows.length === 0) {
        console.error('❌ FALHA CRÍTICA: UPDATE nao afetou nenhuma linha', {
          userId,
          paymentId: payment.id,
          plan,
          planPeriod,
        });
        try {
          await supabase.from('webhook_logs').insert({
            event_type: event.event,
            payload: event,
            status: 'error',
            error_message: `UPDATE profile nao encontrou user_id=${userId} (payment.id=${payment.id})`,
          });
        } catch (logErr) {
          console.error('Erro ao logar falha:', logErr);
        }
        return res.status(500).json({ error: 'Profile not found for userId', userId });
      }

      console.log('✅ Perfil atualizado:', userId, '→', plan, planPeriod);

      // Registrar no histórico de pagamentos
      const { error: historyError } = await supabase
        .from('payment_history')
        .insert({
          user_id: userId,
          asaas_payment_id: payment.id,
          amount: value,
          status: 'paid',
          paid_at: now.toISOString(),
          invoice_url: payment.invoiceUrl || null,
        });

      if (historyError) {
        console.error('Erro ao registrar histórico:', historyError);
      }

      console.log('Perfil atualizado com sucesso! User:', userId, 'Plano:', plan);

      // 🔔 Criar notificação de pagamento confirmado
      const planName = plan === 'pro' ? 'Anual' : 'Mensal';
      await supabase.from('notifications').insert({
        user_id: userId,
        type: 'payment_confirmed',
        title: 'Pagamento Confirmado! 🎉',
        message: `Seu plano ${brandLabel} ${planName} foi ativado com sucesso.`,
        metadata: { plan, amount: value },
        read: false,
      });

      // 📧 Enviar email de confirmação via Resend
      if (userEmail) {
        try {
          const emailSent = await sendEmail(userEmail, 'payment_confirmed', {
            name: userData?.full_name?.split(' ')[0] || 'Cliente',
            planName,
            amount: value,
          });
          console.log(emailSent ? '✅ Email enviado:' : '⚠️ Falha ao enviar email:', userEmail);
        } catch (emailErr) {
          console.error('Erro ao enviar email de confirmação:', emailErr);
        }
      }

      // 📱 Enviar WhatsApp de confirmação
      if (userData?.phone) {
        const nome = userData?.full_name?.split(' ')[0] || 'Cliente';
        const valorFormatado = value.toFixed(2).replace('.', ',');
        const dataRenovacao = expiresAt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

        const accessPath = brand === 'fechaqui' ? '/orcamentos' : '/dashboard';
        const whatsappMsg = `✅ *Pagamento Confirmado!*

Olá ${nome}! 🎉

Seu plano *${brandLabel} ${planName}* está ativo.

💰 Valor: R$ ${valorFormatado}
📅 Válido até: ${dataRenovacao}

Agora você tem acesso completo ao plano ${planName}!

👉 Acesse: ${brandHost}${accessPath}

Obrigado por confiar no ${brandLabel}!

— ${brandLabel}`;
        await sendWhatsAppMessage(userData.phone, whatsappMsg);
      }

      // 🎯 FACEBOOK CAPI: Enviar evento Purchase apenas para PRIMEIRA COMPRA
      // Renovações não devem ser contadas como novas conversões
      let fbSuccess = false;
      if (isFirstPurchase) {
        const fbUserData = {
          user_id: userId,
          email: userEmail,
          full_name: userData?.full_name || '',
          phone: userData?.phone || '',
        };

        const fbPaymentData = {
          value: value,
          plan: plan,
          planName: description || `${brandLabel} ${plan}`,
          paymentId: payment.id,
          eventSourceUrl: `https://${brandHost}/upgrade`,
        };

        // 🎯 Buscar dados do browser salvos no checkout (fbp, fbc, IP, UA)
        // Prioridade: payment_id > subscription_id > ultimo do user_id
        let browserData = {};
        try {
          let trackingRow = null;

          // 1. Tenta por payment_id (mais preciso)
          const { data: byPayment } = await supabase
            .from('checkout_tracking')
            .select('fbp, fbc, client_ip, user_agent, event_source_url')
            .eq('asaas_payment_id', payment.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          trackingRow = byPayment;

          // 2. Fallback: subscription_id (payment_id nem sempre bate em recorrencias)
          if (!trackingRow && payment.subscription) {
            const { data: bySub } = await supabase
              .from('checkout_tracking')
              .select('fbp, fbc, client_ip, user_agent, event_source_url')
              .eq('asaas_subscription_id', payment.subscription)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            trackingRow = bySub;
          }

          // 3. Ultimo recurso: ultimo checkout do usuario
          if (!trackingRow) {
            const { data: byUser } = await supabase
              .from('checkout_tracking')
              .select('fbp, fbc, client_ip, user_agent, event_source_url')
              .eq('user_id', userId)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            trackingRow = byUser;
          }

          if (trackingRow) {
            browserData = {
              fbp: trackingRow.fbp || null,
              fbc: trackingRow.fbc || null,
              clientIP: trackingRow.client_ip || null,
              userAgent: trackingRow.user_agent || null,
              sourceUrl: trackingRow.event_source_url || null,
            };
            console.log('📥 checkout_tracking encontrado:', {
              hasFbp: !!browserData.fbp,
              hasFbc: !!browserData.fbc,
              hasIp: !!browserData.clientIP,
              hasUa: !!browserData.userAgent,
            });
          } else {
            console.warn('⚠️ checkout_tracking nao encontrado para payment:', payment.id);
          }
        } catch (trackErr) {
          console.warn('⚠️ Falha ao buscar checkout_tracking:', trackErr);
        }

        fbSuccess = await sendPurchaseToFacebook(fbUserData, fbPaymentData, browserData);
        console.log('🎯 Facebook Purchase (primeira compra):', fbSuccess ? 'enviado com sucesso' : 'falhou');
      } else {
        console.log('⏭️ Facebook Purchase ignorado - é renovação, não primeira compra');
      }

      return res.status(200).json({
        received: true,
        user_id: userId,
        plan: plan,
        status: 'active',
        isFirstPurchase: isFirstPurchase,
        facebook_purchase: fbSuccess,
      });
    }

    // Pagamento atrasado ou cancelado
    if (event.event === 'PAYMENT_OVERDUE' || event.event === 'PAYMENT_DELETED' || event.event === 'PAYMENT_REFUNDED') {
      const payment = event.payment;

      // Validar que payment existe
      if (!payment) {
        console.error('Webhook sem objeto payment:', event);
        if (logId) {
          await supabaseLog.from('webhook_logs').update({
            status: 'error',
            error_message: 'Webhook sem objeto payment',
          }).eq('id', logId);
        }
        return res.status(200).json({ received: true, warning: 'missing payment object' });
      }

      const userId = payment.externalReference;

      if (userId) {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // 🛡️ Guard: ignorar PAYMENT_OVERDUE se plano ainda está válido
        // (Asaas às vezes dispara OVERDUE de cobrança antiga DEPOIS do PAYMENT_RECEIVED do novo ciclo)
        if (event.event === 'PAYMENT_OVERDUE') {
          const { data: currentProfile } = await supabase
            .from('profiles')
            .select('plan_expires_at, plan_status')
            .eq('user_id', userId)
            .single();

          if (currentProfile?.plan_expires_at) {
            const expiresAt = new Date(currentProfile.plan_expires_at);
            if (expiresAt > new Date() && currentProfile.plan_status === 'active') {
              console.log('⏭️ Ignorando PAYMENT_OVERDUE: plano ativo até', expiresAt.toISOString(), 'userId:', userId);
              if (logId) {
                await supabaseLog.from('webhook_logs').update({
                  status: 'success',
                  error_message: 'stale overdue ignored (plan still active)',
                }).eq('id', logId);
              }
              return res.status(200).json({ received: true, ignored: 'stale overdue event' });
            }
          }
        }

        const newStatus = event.event === 'PAYMENT_OVERDUE' ? 'overdue' : 'cancelled';

        // Se é overdue, salvar quando começou a atrasar
        const updateData = {
          plan_status: newStatus,
          updated_at: new Date().toISOString(),
        };

        if (event.event === 'PAYMENT_OVERDUE') {
          updateData.plan_overdue_since = new Date().toISOString();
        }

        // Se cancelado/estornado, rebaixar para free
        if (event.event === 'PAYMENT_DELETED' || event.event === 'PAYMENT_REFUNDED') {
          updateData.plan = 'free';
          updateData.plan_overdue_since = null;
        }

        const { error: overdueUpdateError } = await supabase
          .from('profiles')
          .update(updateData)
          .eq('user_id', userId);

        if (overdueUpdateError) {
          console.error('Erro ao atualizar status overdue:', overdueUpdateError);
        } else {
          console.log('Status atualizado para:', newStatus, 'userId:', userId);
        }

        // 🔔 Criar notificação
        if (event.event === 'PAYMENT_OVERDUE') {
          await supabase.from('notifications').insert({
            user_id: userId,
            type: 'payment_overdue',
            title: 'Pagamento Pendente ⚠️',
            message: 'Seu pagamento está atrasado. Regularize para manter seu plano ativo.',
            metadata: { amount: payment.value },
            read: false,
          });

          // 📱 Enviar WhatsApp de lembrete
          const { data: overdueUser } = await supabase
            .from('profiles')
            .select('full_name, phone')
            .eq('user_id', userId)
            .single();

          if (overdueUser?.phone) {
            const nome = overdueUser?.full_name?.split(' ')[0] || 'Cliente';
            const valorFormatado = payment.value.toFixed(2).replace('.', ',');

            // Detectar brand pelo description do pagamento atrasado
            const overdueDescription = (payment.description || '').toLowerCase();
            const overdueBrand = overdueDescription.includes('fechaqui') || overdueDescription.includes('fecha aqui')
              ? 'fechaqui'
              : 'jardinei';
            const overdueLabel = overdueBrand === 'fechaqui' ? 'FechaAqui' : 'JARDINEI';
            const overdueHost = overdueBrand === 'fechaqui'
              ? (process.env.FECHAQUI_PUBLIC_DOMAIN || 'https://www.fechaqui.com').replace(/^https?:\/\//, '')
              : (process.env.JARDINEI_PUBLIC_DOMAIN || 'https://www.jardinei.com').replace(/^https?:\/\//, '');

            const overdueMsg = `⚠️ *Atenção: Pagamento Pendente*

Olá ${nome},

Não conseguimos processar seu pagamento de *R$ ${valorFormatado}*.

Você tem *7 dias* para regularizar e manter seu plano ativo. Após esse prazo, sua conta volta para o plano Grátis.

🔄 Atualize seus dados de pagamento:
👉 ${overdueHost}/configuracoes?tab=billing

Precisa de ajuda? Responda esta mensagem.

— ${overdueLabel}`;
            await sendWhatsAppMessage(overdueUser.phone, overdueMsg);
          }
        } else if (event.event === 'PAYMENT_REFUNDED') {
          await supabase.from('notifications').insert({
            user_id: userId,
            type: 'system',
            title: 'Pagamento Estornado',
            message: 'Seu pagamento foi estornado. Entre em contato se precisar de ajuda.',
            metadata: { amount: payment.value },
            read: false,
          });
        }

        console.log('Plano atualizado:', userId, event.event);
      }

      return res.status(200).json({ received: true });
    }

    // ✅ Atualizar log como sucesso
    if (logId) {
      await supabaseLog.from('webhook_logs').update({ status: 'success' }).eq('id', logId);
    }

    return res.status(200).json({ received: true });

  } catch (error) {
    console.error('Erro no webhook Asaas:', error);

    // ❌ Atualizar log como erro
    if (logId) {
      await supabaseLog.from('webhook_logs').update({
        status: 'error',
        error_message: error.message || 'Unknown error',
      }).eq('id', logId);
    }

    return res.status(500).json({ error: 'Internal server error' });
  }
}
