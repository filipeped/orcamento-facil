/**
 * Criar pagamento no Asaas com externalReference (user_id)
 * POST /api/create-payment
 * Body: { plan: "essential" | "pro", period: "monthly" | "annual", userId: "xxx" }
 */

import { createClient } from '@supabase/supabase-js';

const asaasToken = process.env.ASAAS_API_KEY;
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ASAAS_URL = 'https://api.asaas.com/v3';

// Preços dos planos (produção) - SINCRONIZADO COM UPGRADE.TSX
const PLANS = {
  // JARDINEI (legado, em produção)
  essential_monthly: { value: 97, name: 'JARDINEI Mensal', cycle: 'MONTHLY' },
  pro_annual: { value: 804, name: 'JARDINEI Anual', cycle: 'YEARLY' }, // R$67/mês x 12

  // FECHAQUI (novo produto — preços menores)
  fechaqui_essential_monthly: { value: 29, name: 'FechaAqui Mensal', cycle: 'MONTHLY' },
  fechaqui_pro_annual: { value: 228, name: 'FechaAqui Anual', cycle: 'YEARLY' }, // R$19/mês x 12
};

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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      plan, period, userId: userIdFromBody, customerEmail, customerName,
      cpfCnpj: cpfCnpjFromBody, couponCode, discountPercent, trackingData,
      password, phone, // usados quando criando conta + pagamento (registerAndPay)
      brand: brandFromBody, // 'jardinei' (default) ou 'fechaqui'
    } = req.body;

    // Detectar brand: body explicito > origin do request > default jardinei
    const brand = (() => {
      if (brandFromBody === 'fechaqui' || brandFromBody === 'jardinei') return brandFromBody;
      const origin = (req.headers.origin || req.headers.referer || '').toLowerCase();
      if (origin.includes('fechaqui')) return 'fechaqui';
      return 'jardinei'; // default preserva comportamento legado
    })();

    console.log('Criando pagamento:', { plan, period, userId: userIdFromBody, customerEmail, cpfCnpjFromBody, couponCode, registering: !userIdFromBody });

    // IP real do cliente (vem do Vercel como x-forwarded-for) — fallback se trackingData.clientIP falhar
    const resolvedClientIP = trackingData?.clientIP
      || (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
      || req.headers['x-real-ip']
      || null;

    // ========================================================================
    // MODO REGISTER-AND-PAY: sem userId → cria conta + profile antes do pagamento
    // (SEM fazer login no browser — cliente so entra apos pagar e logar manual)
    // ========================================================================
    let userId = userIdFromBody;
    if (!userId) {
      if (!customerEmail || !password || !customerName || !phone || !cpfCnpjFromBody) {
        return res.status(400).json({
          error: 'Pra criar conta sao obrigatorios: customerEmail, password, customerName, phone, cpfCnpj'
        });
      }

      const supabaseReg = createClient(supabaseUrl, supabaseServiceKey);
      const emailClean = customerEmail.trim().toLowerCase();

      // Tenta criar user direto — Supabase retorna erro claro se email ja existe
      // (evita listUsers() que e pesado/paginado em contas grandes)
      const { data: newUser, error: createErr } = await supabaseReg.auth.admin.createUser({
        email: emailClean,
        password,
        email_confirm: true,
        user_metadata: { full_name: customerName },
      });

      if (createErr) {
        const msg = (createErr.message || '').toLowerCase();
        const code = createErr.code || createErr.status;
        const alreadyRegistered =
          msg.includes('already been registered') ||
          msg.includes('already registered') ||
          msg.includes('already exists') ||
          msg.includes('duplicate') ||
          code === 'email_exists' ||
          code === 422;
        if (alreadyRegistered) {
          return res.status(409).json({
            error: 'Este email ja tem cadastro. Faca login pra assinar.',
            alreadyExists: true,
          });
        }
        console.error('Erro ao criar user:', createErr);
        return res.status(500).json({ error: 'Erro ao criar conta. Tenta de novo.' });
      }
      if (!newUser?.user?.id) {
        return res.status(500).json({ error: 'Erro ao criar conta (sem ID).' });
      }
      userId = newUser.user.id;

      // Cria profile
      await supabaseReg.from('profiles').upsert({
        user_id: userId,
        full_name: customerName,
        phone: (phone || '').replace(/\D/g, ''),
        cnpj: (cpfCnpjFromBody || '').replace(/\D/g, ''),
        plan: 'free',
        plan_status: 'trial',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

      console.log('✅ User + profile criados via register-and-pay:', userId);
    }

    if (!plan || !period || !userId) {
      return res.status(400).json({ error: 'Missing required fields: plan, period, userId' });
    }

    // Lookup com prefixo de brand. Jardinei usa keys legados sem prefixo (compat).
    const planKey = brand === 'fechaqui'
      ? `fechaqui_${plan}_${period}`
      : `${plan}_${period}`;
    const planConfig = PLANS[planKey];

    if (!planConfig) {
      return res.status(400).json({ error: 'Invalid plan' });
    }

    // 🎟️ Validar cupom no servidor (segurança)
    let validatedDiscount = 0;
    let couponId = null;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (couponCode) {
      const { data: coupon, error: couponError } = await supabase
        .from('coupons')
        .select('*')
        .eq('code', couponCode.toUpperCase().trim())
        .eq('active', true)
        .single();

      if (!couponError && coupon) {
        // Verificar validade
        const isValid = !coupon.valid_until || new Date(coupon.valid_until) >= new Date();
        const hasUses = !coupon.max_uses || coupon.current_uses < coupon.max_uses;
        const appliesToPlan = !coupon.plans || coupon.plans.length === 0 || coupon.plans.includes(plan);

        if (isValid && hasUses && appliesToPlan) {
          validatedDiscount = coupon.discount_percent;
          couponId = coupon.id;
          console.log('Cupom válido:', couponCode, 'Desconto:', validatedDiscount + '%');
        }
      }
    }

    // Calcular valor com desconto
    let finalValue = planConfig.value;
    if (validatedDiscount > 0) {
      finalValue = Math.round(planConfig.value * (1 - validatedDiscount / 100));
      console.log('Valor original:', planConfig.value, '→ Com desconto:', finalValue);
    }

    // Buscar dados do perfil no Supabase (para pegar CNPJ/CPF)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('full_name, cnpj, phone')
      .eq('user_id', userId)
      .single();

    if (profileError) {
      console.error('Erro ao buscar perfil:', profileError);
    }

    // Usar CPF/CNPJ do body (se veio do formulário) ou do perfil
    const cpfCnpjRaw = cpfCnpjFromBody || profile?.cnpj || null;
    const cpfCnpj = cpfCnpjRaw?.replace(/\D/g, '') || null; // Remove formatação
    // phone do body (register-and-pay) tem prioridade, senao pega do profile
    const phoneClean = (phone || profile?.phone || '').replace(/\D/g, '') || null;
    const fallbackBrandName = brand === 'fechaqui' ? 'FechaAqui' : 'JARDINEI';
    const name = profile?.full_name || customerName || `Cliente ${fallbackBrandName}`;

    console.log('Dados do perfil:', { name, cpfCnpj, phone: phoneClean, cpfCnpjFromBody });

    // Verificar se tem CPF/CNPJ cadastrado
    if (!cpfCnpj) {
      return res.status(400).json({
        error: 'CPF ou CNPJ não cadastrado',
        message: 'Por favor, preencha seu CPF ou CNPJ nas configurações antes de assinar.',
        needsCpfCnpj: true
      });
    }

    // Salvar CPF/CNPJ no perfil do Supabase se veio do formulário (para ter depois)
    if (cpfCnpjFromBody) {
      console.log('Salvando CPF/CNPJ no perfil:', cpfCnpjFromBody);
      await supabase
        .from('profiles')
        .upsert({
          user_id: userId,
          cnpj: cpfCnpjFromBody, // Salva formatado
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
    }

    // 1. Criar ou buscar cliente no Asaas
    let customerId;

    // Buscar cliente pelo email
    const searchResponse = await fetch(`${ASAAS_URL}/customers?email=${encodeURIComponent(customerEmail)}`, {
      headers: { 'access_token': asaasToken },
    });
    const searchData = await searchResponse.json();

    if (searchData.data && searchData.data.length > 0) {
      customerId = searchData.data[0].id;
      console.log('Cliente encontrado por email:', customerId);
    }

    // Fallback: buscar por CPF/CNPJ (caso o cliente exista com outro email)
    if (!customerId && cpfCnpj) {
      const searchByCpfResponse = await fetch(`${ASAAS_URL}/customers?cpfCnpj=${cpfCnpj}`, {
        headers: { 'access_token': asaasToken },
      });
      const searchByCpfData = await searchByCpfResponse.json();

      if (searchByCpfData.data && searchByCpfData.data.length > 0) {
        customerId = searchByCpfData.data[0].id;
        console.log('Cliente encontrado por CPF/CNPJ:', customerId);
      }
    }

    if (customerId) {
      // Atualizar dados do cliente existente
      await fetch(`${ASAAS_URL}/customers/${customerId}`, {
        method: 'PUT',
        headers: {
          'access_token': asaasToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name,
          email: customerEmail,
          ...(cpfCnpj && { cpfCnpj }),
          ...(phoneClean && { phone: phoneClean }),
          externalReference: userId,
        }),
      });
      console.log('Cliente atualizado:', customerId);
    } else {
      // Criar novo cliente
      const createCustomerResponse = await fetch(`${ASAAS_URL}/customers`, {
        method: 'POST',
        headers: {
          'access_token': asaasToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name,
          email: customerEmail,
          cpfCnpj: cpfCnpj,
          phone: phoneClean,
          externalReference: userId,
        }),
      });
      const customerData = await createCustomerResponse.json();

      if (customerData.errors) {
        console.error('Erro ao criar cliente:', JSON.stringify(customerData.errors));
        const asaasError = customerData.errors[0]?.description || '';
        const asaasCode = customerData.errors[0]?.code || '';
        let userMessage = 'Erro ao criar cadastro de pagamento. Tente novamente.';
        if (asaasCode === 'invalid_cpfCnpj' || asaasError.toLowerCase().includes('cpf') || asaasError.toLowerCase().includes('cnpj')) {
          userMessage = 'CPF ou CNPJ inválido. Verifique o número e tente novamente.';
        } else if (asaasError.toLowerCase().includes('email')) {
          userMessage = 'E-mail inválido. Verifique seu e-mail nas configurações.';
        } else if (asaasError.toLowerCase().includes('name') || asaasError.toLowerCase().includes('nome')) {
          userMessage = 'Nome inválido. Preencha seu nome nas configurações.';
        }
        return res.status(400).json({ error: userMessage, details: customerData.errors });
      }

      customerId = customerData.id;
      console.log('Cliente criado:', customerId);
    }

    // 💾 Salvar asaas_customer_id no profile (fallback do webhook se externalReference falhar)
    try {
      await supabase
        .from('profiles')
        .update({ asaas_customer_id: customerId })
        .eq('user_id', userId);
    } catch (err) {
      console.warn('⚠️ Falha ao salvar asaas_customer_id:', err);
    }

    // 2. Criar assinatura com externalReference (callback URL será atualizado depois com payment_id)
    const subscriptionResponse = await fetch(`${ASAAS_URL}/subscriptions`, {
      method: 'POST',
      headers: {
        'access_token': asaasToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customer: customerId,
        billingType: 'UNDEFINED', // PIX, Cartão ou Boleto
        value: finalValue, // Valor com desconto aplicado
        nextDueDate: new Date().toISOString().split('T')[0], // Hoje
        cycle: planConfig.cycle,
        description: validatedDiscount > 0 ? `${planConfig.name} (-${validatedDiscount}%)` : planConfig.name,
        externalReference: userId, // User ID do JARDINEI
      }),
    });

    const subscriptionData = await subscriptionResponse.json();

    if (subscriptionData.errors) {
      console.error('Erro ao criar assinatura:', subscriptionData.errors);
      return res.status(400).json({ error: 'Failed to create subscription', details: subscriptionData.errors });
    }

    console.log('Assinatura criada:', subscriptionData.id);

    // 🎟️ Incrementar uso do cupom
    if (couponId) {
      const { data: couponData } = await supabase
        .from('coupons')
        .select('current_uses')
        .eq('id', couponId)
        .single();

      if (couponData) {
        await supabase
          .from('coupons')
          .update({ current_uses: (couponData.current_uses || 0) + 1 })
          .eq('id', couponId);
        console.log('Uso do cupom incrementado:', couponCode);
      }
    }

    // 3. Buscar o primeiro pagamento da assinatura para pegar a URL e payment_id
    const paymentsResponse = await fetch(`${ASAAS_URL}/subscriptions/${subscriptionData.id}/payments`, {
      headers: { 'access_token': asaasToken },
    });
    const paymentsData = await paymentsResponse.json();

    let paymentUrl = null;
    let paymentId = null;
    if (paymentsData.data && paymentsData.data.length > 0) {
      paymentUrl = paymentsData.data[0].invoiceUrl;
      paymentId = paymentsData.data[0].id;
    }

    // 4. Atualizar assinatura com callback URL incluindo payment_id para deduplicação de tracking
    // Success URL respeita a brand do checkout — Jardinei volta pra jardinei.com, FechaAqui volta pra fechaqui.com
    const successDomain = brand === 'fechaqui'
      ? (process.env.FECHAQUI_PUBLIC_DOMAIN || 'https://www.fechaqui.com')
      : (process.env.JARDINEI_PUBLIC_DOMAIN || 'https://www.jardinei.com');
    const successUrl = `${successDomain}/pagamento-sucesso?plan=${plan}&value=${finalValue}&payment_id=${paymentId}`;
    await fetch(`${ASAAS_URL}/subscriptions/${subscriptionData.id}`, {
      method: 'PUT',
      headers: {
        'access_token': asaasToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        callback: {
          successUrl: successUrl,
          autoRedirect: true,
        },
      }),
    });

    console.log('Callback URL atualizado com payment_id:', paymentId);

    // 🎯 Salvar dados de tracking do browser pro webhook-asaas.js usar no Purchase CAPI
    // Esses dados (fbp, fbc, IP, UA) sao cruciais pra atribuicao de anuncio — sem eles
    // o webhook nao tem como relacionar a compra com o clique no ad.
    if (trackingData || resolvedClientIP) {
      try {
        await supabase.from('checkout_tracking').insert({
          user_id: userId,
          asaas_subscription_id: subscriptionData.id,
          asaas_payment_id: paymentId,
          fbp: trackingData?.fbp || null,
          fbc: trackingData?.fbc || null,
          client_ip: resolvedClientIP,
          user_agent: trackingData?.userAgent || req.headers['user-agent'] || null,
          event_source_url: trackingData?.sourceUrl || null,
        });
        console.log('✅ checkout_tracking salvo:', {
          subscriptionId: subscriptionData.id,
          paymentId,
          hasFbp: !!trackingData?.fbp,
          hasFbc: !!trackingData?.fbc,
          hasIp: !!resolvedClientIP,
        });
      } catch (trackErr) {
        console.warn('⚠️ Falha ao salvar checkout_tracking (nao bloqueia pagamento):', trackErr);
      }
    }

    return res.status(200).json({
      success: true,
      subscriptionId: subscriptionData.id,
      paymentId: paymentId, // Para deduplicação de tracking
      paymentUrl: paymentUrl || `https://www.asaas.com/c/${subscriptionData.id}`,
    });

  } catch (error) {
    console.error('Erro ao criar pagamento:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
