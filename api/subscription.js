/**
 * API unificada de gerenciamento de assinatura
 * POST /api/subscription?action=cancel|reactivate|update-payment
 */

import { createClient } from '@supabase/supabase-js';

const asaasToken = process.env.ASAAS_API_KEY;
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ASAAS_URL = 'https://api.asaas.com/v3';

// Preços dos planos - SINCRONIZADO COM CREATE-PAYMENT.JS E UPGRADE.TSX
const PLANS = {
  essential_monthly: { value: 97, name: 'JARDINEI Mensal', cycle: 'MONTHLY' },
  pro_annual: { value: 804, name: 'JARDINEI Anual', cycle: 'YEARLY' }, // R$67/mês x 12
};

// Domínios permitidos
const ALLOWED_ORIGINS = [
  'https://www.jardinei.com',
  'https://jardinei.com',
  'https://verdepro-proposals.vercel.app',
  'http://localhost:8080',
  'http://localhost:3000',
];

export default async function handler(req, res) {
  // CORS restrito
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

  const { action } = req.query;

  try {
    switch (action) {
      case 'cancel':
        return await handleCancel(req, res);
      case 'reactivate':
        return await handleReactivate(req, res);
      case 'update-payment':
        return await handleUpdatePayment(req, res);
      default:
        return res.status(400).json({ error: 'Action inválida. Use: cancel, reactivate, update-payment' });
    }
  } catch (error) {
    console.error('Erro na API subscription:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

// ========== CANCEL ==========
async function handleCancel(req, res) {
  const { userId, userEmail } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  console.log('Cancelando assinatura para user:', userId, 'email:', userEmail);

  let subscriptionsToCancel = [];

  // 1. Buscar por externalReference (userId)
  const searchByRef = await fetch(
    `${ASAAS_URL}/subscriptions?externalReference=${userId}&status=ACTIVE`,
    { headers: { 'access_token': asaasToken } }
  );
  const refData = await searchByRef.json();

  if (refData.data && refData.data.length > 0) {
    subscriptionsToCancel = refData.data;
  }

  // 2. Se não encontrou e tem email, buscar pelo cliente
  if (subscriptionsToCancel.length === 0 && userEmail) {
    const customerSearch = await fetch(
      `${ASAAS_URL}/customers?email=${encodeURIComponent(userEmail)}`,
      { headers: { 'access_token': asaasToken } }
    );
    const customerData = await customerSearch.json();

    if (customerData.data && customerData.data.length > 0) {
      const customerId = customerData.data[0].id;
      const searchByCust = await fetch(
        `${ASAAS_URL}/subscriptions?customer=${customerId}&status=ACTIVE`,
        { headers: { 'access_token': asaasToken } }
      );
      const custData = await searchByCust.json();

      if (custData.data && custData.data.length > 0) {
        subscriptionsToCancel = custData.data;
      }
    }
  }

  // Cancelar assinaturas encontradas
  for (const subscription of subscriptionsToCancel) {
    console.log('Cancelando assinatura no Asaas:', subscription.id);
    await fetch(`${ASAAS_URL}/subscriptions/${subscription.id}`, {
      method: 'DELETE',
      headers: { 'access_token': asaasToken },
    });
  }

  // Calcular data de expiração
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan_started_at, plan_period')
    .eq('user_id', userId)
    .single();

  let planExpiresAt = new Date();
  if (profile?.plan_started_at) {
    const startDate = new Date(profile.plan_started_at);
    planExpiresAt = new Date(startDate);
    const isAnnual = profile.plan_period === 'annual' || profile.plan_period === 'yearly';
    if (isAnnual) {
      planExpiresAt.setFullYear(planExpiresAt.getFullYear() + 1);
    } else {
      planExpiresAt.setMonth(planExpiresAt.getMonth() + 1);
    }
  } else {
    planExpiresAt.setDate(planExpiresAt.getDate() + 30);
  }

  await supabase
    .from('profiles')
    .update({
      plan_status: 'cancelled',
      plan_expires_at: planExpiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  return res.status(200).json({
    success: true,
    message: 'Assinatura cancelada com sucesso',
    planExpiresAt: planExpiresAt.toISOString(),
  });
}

// ========== REACTIVATE ==========
async function handleReactivate(req, res) {
  const { userId, plan, period, customerEmail } = req.body;

  if (!userId || !plan || !period) {
    return res.status(400).json({ error: 'userId, plan e period são obrigatórios' });
  }

  const planKey = `${plan}_${period}`;
  const planConfig = PLANS[planKey];

  if (!planConfig) {
    return res.status(400).json({ error: 'Plano inválido' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Verificar se ainda está dentro do período pago
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan_status, plan_expires_at, full_name, cnpj, phone')
    .eq('user_id', userId)
    .single();

  const now = new Date();
  const expiresAt = profile?.plan_expires_at ? new Date(profile.plan_expires_at) : null;

  // Se ainda tem tempo de plano, só reativar sem cobrar
  if (expiresAt && expiresAt > now) {
    await supabase
      .from('profiles')
      .update({
        plan_status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    return res.status(200).json({
      success: true,
      reactivated: true,
      message: 'Assinatura reativada com sucesso!',
      expiresAt: expiresAt.toISOString(),
    });
  }

  // Buscar cliente existente no Asaas
  const searchResponse = await fetch(`${ASAAS_URL}/customers?email=${encodeURIComponent(customerEmail)}`, {
    headers: { 'access_token': asaasToken },
  });
  const searchData = await searchResponse.json();

  let customerId;

  if (searchData.data && searchData.data.length > 0) {
    customerId = searchData.data[0].id;
  } else {
    const cpfCnpj = profile?.cnpj?.replace(/\D/g, '') || null;
    if (!cpfCnpj) {
      return res.status(400).json({ error: 'CPF/CNPJ não cadastrado', needsCpfCnpj: true });
    }

    const createResponse = await fetch(`${ASAAS_URL}/customers`, {
      method: 'POST',
      headers: {
        'access_token': asaasToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: profile?.full_name || 'Cliente JARDINEI',
        email: customerEmail,
        cpfCnpj: cpfCnpj,
        phone: profile?.phone?.replace(/\D/g, '') || null,
        externalReference: userId,
      }),
    });
    const customerData = await createResponse.json();

    if (customerData.errors) {
      return res.status(400).json({ error: 'Erro ao criar cliente', details: customerData.errors });
    }
    customerId = customerData.id;
  }

  // Criar nova assinatura
  const subscriptionResponse = await fetch(`${ASAAS_URL}/subscriptions`, {
    method: 'POST',
    headers: {
      'access_token': asaasToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      customer: customerId,
      billingType: 'UNDEFINED',
      value: planConfig.value,
      nextDueDate: new Date().toISOString().split('T')[0],
      cycle: planConfig.cycle,
      description: planConfig.name,
      externalReference: userId,
    }),
  });

  const subscriptionData = await subscriptionResponse.json();

  if (subscriptionData.errors) {
    return res.status(400).json({ error: 'Erro ao criar assinatura', details: subscriptionData.errors });
  }

  // Buscar URL de pagamento
  const paymentsResponse = await fetch(`${ASAAS_URL}/subscriptions/${subscriptionData.id}/payments`, {
    headers: { 'access_token': asaasToken },
  });
  const paymentsData = await paymentsResponse.json();

  let paymentUrl = null;
  if (paymentsData.data && paymentsData.data.length > 0) {
    paymentUrl = paymentsData.data[0].invoiceUrl;
  }

  await supabase
    .from('profiles')
    .update({
      plan_status: 'pending',
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  return res.status(200).json({
    success: true,
    paymentUrl: paymentUrl,
    subscriptionId: subscriptionData.id,
  });
}

// ========== UPDATE PAYMENT ==========
async function handleUpdatePayment(req, res) {
  const { userId, billingType } = req.body;

  if (!userId || !billingType) {
    return res.status(400).json({ error: 'userId e billingType são obrigatórios' });
  }

  const validTypes = ['PIX', 'BOLETO', 'CREDIT_CARD', 'UNDEFINED'];
  if (!validTypes.includes(billingType)) {
    return res.status(400).json({ error: 'billingType inválido' });
  }

  const searchResponse = await fetch(
    `${ASAAS_URL}/subscriptions?externalReference=${userId}&status=ACTIVE`,
    { headers: { 'access_token': asaasToken } }
  );
  const searchData = await searchResponse.json();

  if (!searchData.data || searchData.data.length === 0) {
    return res.status(404).json({ error: 'Nenhuma assinatura ativa encontrada' });
  }

  const subscription = searchData.data[0];

  const updateResponse = await fetch(`${ASAAS_URL}/subscriptions/${subscription.id}`, {
    method: 'PUT',
    headers: {
      'access_token': asaasToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ billingType }),
  });

  const updateData = await updateResponse.json();

  if (updateData.errors) {
    return res.status(400).json({ error: 'Erro ao atualizar forma de pagamento', details: updateData.errors });
  }

  return res.status(200).json({
    success: true,
    message: 'Forma de pagamento atualizada com sucesso',
    billingType: billingType,
  });
}
