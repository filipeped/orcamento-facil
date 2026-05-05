/**
 * API de gerenciamento de links e dados do Asaas + Admin
 * POST /api/manage-asaas?action=get-payment-link|get-subscription|list-payments|delete-user|validate-coupon
 */

import { createClient } from '@supabase/supabase-js';

const asaasToken = process.env.ASAAS_API_KEY;
const ASAAS_URL = 'https://api.asaas.com/v3';
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Domínios permitidos
const ALLOWED_ORIGINS = [
  'https://www.fechaqui.com',
  'https://fechaqui.com',
  'https://www.jardinei.com',
  'https://jardinei.com',
  'https://www.orcafacil.com',
  'https://orcafacil.com',
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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action } = req.query;

  try {
    switch (action) {
      case 'get-payment-link':
        return await handleGetPaymentLink(req, res);
      case 'get-subscription':
        return await handleGetSubscription(req, res);
      case 'list-payments':
        return await handleListPayments(req, res);
      case 'delete-user':
        return await handleDeleteUser(req, res);
      case 'validate-coupon':
        return await handleValidateCoupon(req, res);
      case 'admin-payments':
        return await handleAdminPayments(req, res);
      default:
        return res.status(400).json({ error: 'Action inválida' });
    }
  } catch (error) {
    console.error('Erro na API manage-asaas:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

// ========== GET PAYMENT LINK ==========
// Retorna o link de pagamento para o próximo pagamento pendente
async function handleGetPaymentLink(req, res) {
  const { userId, userEmail } = req.body;

  if (!userId && !userEmail) {
    return res.status(400).json({ error: 'userId ou userEmail é obrigatório' });
  }

  // Buscar assinatura por userId ou email
  let subscription = null;

  if (userId) {
    const searchByRef = await fetch(
      `${ASAAS_URL}/subscriptions?externalReference=${userId}&status=ACTIVE`,
      { headers: { 'access_token': asaasToken } }
    );
    const refData = await searchByRef.json();
    if (refData.data && refData.data.length > 0) {
      subscription = refData.data[0];
    }
  }

  if (!subscription && userEmail) {
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
        subscription = custData.data[0];
      }
    }
  }

  if (!subscription) {
    return res.status(404).json({ error: 'Nenhuma assinatura ativa encontrada' });
  }

  // Buscar pagamentos pendentes da assinatura
  const paymentsResponse = await fetch(
    `${ASAAS_URL}/subscriptions/${subscription.id}/payments?status=PENDING`,
    { headers: { 'access_token': asaasToken } }
  );
  const paymentsData = await paymentsResponse.json();

  if (!paymentsData.data || paymentsData.data.length === 0) {
    // Se não tem pendente, buscar o mais recente
    const allPaymentsResponse = await fetch(
      `${ASAAS_URL}/subscriptions/${subscription.id}/payments`,
      { headers: { 'access_token': asaasToken } }
    );
    const allPaymentsData = await allPaymentsResponse.json();

    if (allPaymentsData.data && allPaymentsData.data.length > 0) {
      const latestPayment = allPaymentsData.data[0];
      return res.status(200).json({
        success: true,
        paymentUrl: latestPayment.invoiceUrl,
        status: latestPayment.status,
        dueDate: latestPayment.dueDate,
        value: latestPayment.value,
      });
    }

    return res.status(404).json({ error: 'Nenhum pagamento encontrado' });
  }

  const pendingPayment = paymentsData.data[0];
  return res.status(200).json({
    success: true,
    paymentUrl: pendingPayment.invoiceUrl,
    status: pendingPayment.status,
    dueDate: pendingPayment.dueDate,
    value: pendingPayment.value,
  });
}

// ========== GET SUBSCRIPTION ==========
// Retorna detalhes da assinatura
async function handleGetSubscription(req, res) {
  const { userId, userEmail } = req.body;

  if (!userId && !userEmail) {
    return res.status(400).json({ error: 'userId ou userEmail é obrigatório' });
  }

  let subscription = null;
  let customerId = null;

  // Buscar por userId
  if (userId) {
    const searchByRef = await fetch(
      `${ASAAS_URL}/subscriptions?externalReference=${userId}`,
      { headers: { 'access_token': asaasToken } }
    );
    const refData = await searchByRef.json();
    if (refData.data && refData.data.length > 0) {
      subscription = refData.data[0];
    }
  }

  // Buscar por email
  if (!subscription && userEmail) {
    const customerSearch = await fetch(
      `${ASAAS_URL}/customers?email=${encodeURIComponent(userEmail)}`,
      { headers: { 'access_token': asaasToken } }
    );
    const customerData = await customerSearch.json();

    if (customerData.data && customerData.data.length > 0) {
      customerId = customerData.data[0].id;
      const searchByCust = await fetch(
        `${ASAAS_URL}/subscriptions?customer=${customerId}`,
        { headers: { 'access_token': asaasToken } }
      );
      const custData = await searchByCust.json();
      if (custData.data && custData.data.length > 0) {
        subscription = custData.data[0];
      }
    }
  }

  if (!subscription) {
    return res.status(404).json({ error: 'Nenhuma assinatura encontrada' });
  }

  return res.status(200).json({
    success: true,
    subscription: {
      id: subscription.id,
      status: subscription.status,
      value: subscription.value,
      cycle: subscription.cycle,
      description: subscription.description,
      nextDueDate: subscription.nextDueDate,
      billingType: subscription.billingType,
      dateCreated: subscription.dateCreated,
    },
  });
}

// ========== LIST PAYMENTS ==========
// Lista histórico de pagamentos do cliente
async function handleListPayments(req, res) {
  const { userId, userEmail, limit = 10 } = req.body;

  if (!userId && !userEmail) {
    return res.status(400).json({ error: 'userId ou userEmail é obrigatório' });
  }

  let customerId = null;

  // Buscar cliente por userId via assinatura
  if (userId) {
    const searchByRef = await fetch(
      `${ASAAS_URL}/subscriptions?externalReference=${userId}`,
      { headers: { 'access_token': asaasToken } }
    );
    const refData = await searchByRef.json();
    if (refData.data && refData.data.length > 0) {
      customerId = refData.data[0].customer;
    }
  }

  // Buscar cliente por email
  if (!customerId && userEmail) {
    const customerSearch = await fetch(
      `${ASAAS_URL}/customers?email=${encodeURIComponent(userEmail)}`,
      { headers: { 'access_token': asaasToken } }
    );
    const customerData = await customerSearch.json();
    if (customerData.data && customerData.data.length > 0) {
      customerId = customerData.data[0].id;
    }
  }

  if (!customerId) {
    return res.status(404).json({ error: 'Cliente não encontrado no Asaas' });
  }

  // Buscar pagamentos do cliente
  const paymentsResponse = await fetch(
    `${ASAAS_URL}/payments?customer=${customerId}&limit=${limit}`,
    { headers: { 'access_token': asaasToken } }
  );
  const paymentsData = await paymentsResponse.json();

  if (!paymentsData.data || paymentsData.data.length === 0) {
    return res.status(200).json({
      success: true,
      payments: [],
      message: 'Nenhum pagamento encontrado',
    });
  }

  const payments = paymentsData.data.map((p) => ({
    id: p.id,
    status: p.status,
    value: p.value,
    dueDate: p.dueDate,
    paymentDate: p.paymentDate,
    billingType: p.billingType,
    description: p.description,
    invoiceUrl: p.invoiceUrl,
  }));

  return res.status(200).json({
    success: true,
    payments,
    total: paymentsData.totalCount || payments.length,
  });
}

// ========== DELETE USER (ADMIN) ==========
// Deleta usuário completamente do sistema (todas as tabelas e storage)
async function handleDeleteUser(req, res) {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'userId é obrigatório' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Verificar admin via JWT (não confiar no body)
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Authorization header required' });
  }
  const token = authHeader.replace('Bearer ', '');
  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authUser) {
    return res.status(401).json({ error: 'Token inválido' });
  }

  const { data: adminData, error: adminError } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('user_id', authUser.id)
    .single();

  if (adminError || !adminData?.is_admin) {
    return res.status(403).json({ error: 'Acesso não autorizado' });
  }

  try {
    // 0. Cancelar assinatura no Asaas antes de deletar dados
    try {
      // Buscar por externalReference (userId)
      const searchByRef = await fetch(
        `${ASAAS_URL}/subscriptions?externalReference=${userId}&status=ACTIVE`,
        { headers: { 'access_token': asaasToken } }
      );
      const refData = await searchByRef.json();
      if (refData.data && refData.data.length > 0) {
        for (const sub of refData.data) {
          await fetch(`${ASAAS_URL}/subscriptions/${sub.id}`, {
            method: 'DELETE',
            headers: { 'access_token': asaasToken },
          });
          console.log('Assinatura cancelada no Asaas:', sub.id);
        }
      }

      // Buscar email do usuário para cancelar por customer também
      const { data: authData } = await supabase.auth.admin.getUserById(userId);
      const userEmail = authData?.user?.email;
      if (userEmail) {
        const customerSearch = await fetch(
          `${ASAAS_URL}/customers?email=${encodeURIComponent(userEmail)}`,
          { headers: { 'access_token': asaasToken } }
        );
        const customerData = await customerSearch.json();
        if (customerData.data && customerData.data.length > 0) {
          const custId = customerData.data[0].id;
          const custSubs = await fetch(
            `${ASAAS_URL}/subscriptions?customer=${custId}&status=ACTIVE`,
            { headers: { 'access_token': asaasToken } }
          );
          const custSubsData = await custSubs.json();
          if (custSubsData.data && custSubsData.data.length > 0) {
            for (const sub of custSubsData.data) {
              await fetch(`${ASAAS_URL}/subscriptions/${sub.id}`, {
                method: 'DELETE',
                headers: { 'access_token': asaasToken },
              });
              console.log('Assinatura cancelada (por email):', sub.id);
            }
          }
        }
      }
    } catch (asaasErr) {
      console.log('Erro ao cancelar assinatura Asaas (continuando):', asaasErr.message);
    }

    // Buscar IDs das propostas do usuario para deletar proposal_items
    const { data: proposals } = await supabase
      .from('proposals')
      .select('id')
      .eq('user_id', userId);

    const proposalIds = proposals?.map(p => p.id) || [];

    // ========== TABELAS ==========

    // 1. Deletar itens das propostas (precisa dos IDs das propostas)
    if (proposalIds.length > 0) {
      await supabase.from('proposal_items').delete().in('proposal_id', proposalIds);
    }

    // 2. Deletar propostas
    await supabase.from('proposals').delete().eq('user_id', userId);

    // 3. Deletar clientes
    await supabase.from('clients').delete().eq('user_id', userId);

    // 4. Deletar itens do catálogo
    await supabase.from('catalog_items').delete().eq('user_id', userId);

    // 5. Deletar notificações
    await supabase.from('notifications').delete().eq('user_id', userId);

    // 6. Deletar histórico de pagamentos
    await supabase.from('payment_history').delete().eq('user_id', userId);

    // 7. Deletar configurações de proposta
    await supabase.from('proposal_settings').delete().eq('user_id', userId);

    // 8. Deletar templates de proposta
    await supabase.from('proposal_templates').delete().eq('user_id', userId);

    // 9. Deletar contratos
    await supabase.from('contracts').delete().eq('user_id', userId);

    // ========== STORAGE ==========

    // 10. Deletar logo
    const { data: logoFiles } = await supabase.storage.from('logos').list(userId);
    if (logoFiles?.length > 0) {
      const logoPaths = logoFiles.map(f => `${userId}/${f.name}`);
      await supabase.storage.from('logos').remove(logoPaths);
    }

    // 11. Deletar avatar
    const { data: avatarFiles } = await supabase.storage.from('avatars').list(userId);
    if (avatarFiles?.length > 0) {
      const avatarPaths = avatarFiles.map(f => `${userId}/${f.name}`);
      await supabase.storage.from('avatars').remove(avatarPaths);
    }

    // 12. Deletar imagens gerais
    const { data: imageFiles } = await supabase.storage.from('images').list(userId);
    if (imageFiles?.length > 0) {
      const imagePaths = imageFiles.map(f => `${userId}/${f.name}`);
      await supabase.storage.from('images').remove(imagePaths);
    }

    // 13. Deletar fotos de propostas
    const { data: proposalPhotos } = await supabase.storage.from('proposal-photos').list(userId);
    if (proposalPhotos?.length > 0) {
      const photoPaths = proposalPhotos.map(f => `${userId}/${f.name}`);
      await supabase.storage.from('proposal-photos').remove(photoPaths);
    }

    // ========== PROFILE E AUTH ==========

    // 14. Deletar profile
    await supabase.from('profiles').delete().eq('user_id', userId);

    // 15. Deletar do auth.users (precisa de service_role)
    const { error: authError } = await supabase.auth.admin.deleteUser(userId);

    if (authError) {
      console.error('Erro ao deletar do auth:', authError);
      return res.status(500).json({ error: 'Erro ao deletar usuário da autenticação' });
    }

    console.log('Usuário deletado completamente (todas as tabelas e storage):', userId);

    return res.status(200).json({ success: true, message: 'Usuário deletado completamente' });
  } catch (error) {
    console.error('Erro ao deletar usuário:', error);
    return res.status(500).json({ error: 'Erro ao deletar usuário: ' + error.message });
  }
}

// ========== VALIDATE COUPON ==========
// Valida cupom de desconto
async function handleValidateCoupon(req, res) {
  const { code, plan } = req.body;

  if (!code) {
    return res.status(400).json({ valid: false, error: 'Código do cupom é obrigatório' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Buscar cupom
  const { data: coupon, error } = await supabase
    .from('coupons')
    .select('*')
    .eq('code', code.toUpperCase().trim())
    .eq('active', true)
    .single();

  if (error || !coupon) {
    return res.status(200).json({ valid: false, error: 'Cupom inválido ou expirado' });
  }

  // Verificar validade
  if (coupon.valid_until && new Date(coupon.valid_until) < new Date()) {
    return res.status(200).json({ valid: false, error: 'Cupom expirado' });
  }

  // Verificar limite de usos
  if (coupon.max_uses && coupon.current_uses >= coupon.max_uses) {
    return res.status(200).json({ valid: false, error: 'Cupom esgotado' });
  }

  // Verificar se aplica ao plano (coluna "plans" é um array)
  if (plan && coupon.plans && coupon.plans.length > 0 && !coupon.plans.includes(plan)) {
    return res.status(200).json({ valid: false, error: 'Cupom não válido para este plano' });
  }

  return res.status(200).json({
    valid: true,
    discount_percent: coupon.discount_percent,
    code: coupon.code,
  });
}

// ========== ADMIN PAYMENTS (GET) ==========
// Retorna todos os pagamentos do payment_history (bypass RLS)
async function handleAdminPayments(req, res) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Verificar admin via token JWT
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('user_id', user.id)
    .single();

  if (!profile?.is_admin) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const days = parseInt(req.query.days) || 30;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data: payments, error } = await supabase
    .from('payment_history')
    .select('id, user_id, amount, status, paid_at, created_at, asaas_payment_id, invoice_url')
    .gte('paid_at', startDate.toISOString())
    .order('paid_at', { ascending: false });

  if (error) {
    console.error('Erro ao buscar pagamentos:', error);
    return res.status(500).json({ error: 'Database error' });
  }

  return res.status(200).json({ payments: payments || [] });
}
