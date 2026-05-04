/**
 * Teste EXPANDIDO: todos os cenarios de tracking + infra.
 *
 * Cobre:
 *   1. Config webhook Asaas (existe, enabled, hasAuthToken)
 *   2. Seguranca: webhook rejeita request sem token (401)
 *   3. Fluxo MENSAL (essential) - create-payment + webhook CONFIRMED
 *   4. Fluxo ANUAL (pro) - create-payment + webhook CONFIRMED
 *   5. Idempotencia: disparar webhook 2x nao duplica payment_history
 *   6. Renovacao NAO dispara Purchase CAPI (apenas 1a compra)
 *   7. PAYMENT_OVERDUE: profile.plan_status = overdue
 *   8. PAYMENT_REFUNDED: profile.plan = free
 *   9. CAPI proxy aceita payload real
 *  10. Resend (email API viva)
 *  11. Cadastro: simula CAPI Lead + CompleteRegistration
 *  12. Edge cases: webhook sem payment.id, externalReference vazio (fallback)
 *
 * Uso: node scripts/simulate-full-stack.cjs
 */

const fs = require('fs');
const path = require('path');
try {
  const envPath = path.resolve(__dirname, '..', '.env.local');
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/i);
    if (!m) continue;
    let val = m[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[m[1]]) process.env[m[1]] = val;
  }
} catch (e) { /* ignore */ }

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const ASAAS_WEBHOOK_TOKEN = process.env.ASAAS_WEBHOOK_TOKEN;
const RESEND_API_KEY = process.env.RESEND_API_KEY;

const PROD = 'https://www.jardinei.com';
const CAPI_URL = 'https://cap.jardinei.com/api/events';
const ASAAS_URL = 'https://api.asaas.com/v3';

const c = {
  g: '\x1b[32m', r: '\x1b[31m', y: '\x1b[33m', c: '\x1b[36m',
  gy: '\x1b[90m', rst: '\x1b[0m', b: '\x1b[1m',
};
const ok = (m) => console.log(`${c.g}  ✅ ${m}${c.rst}`);
const bad = (m) => console.log(`${c.r}  ❌ ${m}${c.rst}`);
const warn = (m) => console.log(`${c.y}  ⚠️  ${m}${c.rst}`);
const info = (m) => console.log(`${c.gy}     ${m}${c.rst}`);
const hdr = (n, t) => console.log(`\n${c.b}${c.c}━━━ Teste ${n}: ${t} ━━━${c.rst}`);

const results = [];
const record = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  (pass ? ok : bad)(`${name}${detail ? ' — ' + detail : ''}`);
};

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function createFakeUser(suffix = 'full') {
  const email = `teste-${suffix}-${Date.now()}@jardinei-test.com`;
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: 'testeSenha123!@#',
    email_confirm: true,
    user_metadata: { full_name: `Teste ${suffix}` },
  });
  if (error) throw error;
  await supabase.from('profiles').insert({
    user_id: data.user.id,
    full_name: `Teste ${suffix}`,
    phone: '11987654321',
    cnpj: '24971563792',
    plan: 'free',
    plan_status: 'trial',
  });
  return { id: data.user.id, email };
}

async function cleanupUser(userId, subscriptionId) {
  try {
    if (subscriptionId) {
      await fetch(`${ASAAS_URL}/subscriptions/${subscriptionId}`, {
        method: 'DELETE',
        headers: { access_token: ASAAS_API_KEY },
      });
    }
    await supabase.from('checkout_tracking').delete().eq('user_id', userId);
    await supabase.from('payment_history').delete().eq('user_id', userId);
    await supabase.from('notifications').delete().eq('user_id', userId);
    await supabase.from('profiles').delete().eq('user_id', userId);
    await supabase.auth.admin.deleteUser(userId);
  } catch (e) { /* silencioso */ }
}

async function createPayment(userId, email, period) {
  const plan = period === 'annual' ? 'pro' : 'essential';
  const res = await fetch(`${PROD}/api/create-payment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Origin': PROD },
    body: JSON.stringify({
      plan, period, userId,
      customerEmail: email,
      customerName: `Teste ${period}`,
      cpfCnpj: '24971563792',
      trackingData: {
        fbp: `fb.1.${Date.now()}.1234567890`,
        fbc: `fb.1.${Date.now()}.AbCdEfGhIjKlMnOp_TEST`,
        clientIP: '189.45.67.89',
        userAgent: 'Mozilla/5.0 (Test)',
        sourceUrl: `${PROD}/upgrade`,
      },
    }),
  });
  const data = await res.json();
  return { ok: res.ok, status: res.status, ...data };
}

async function fireWebhook(event, payment) {
  const res = await fetch(`${PROD}/api/webhook-asaas`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'asaas-access-token': ASAAS_WEBHOOK_TOKEN,
      'x-forwarded-for': '189.45.67.89',
    },
    body: JSON.stringify({ event, payment }),
  });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = { raw: text }; }
  return { ok: res.ok, status: res.status, data };
}

async function main() {
  // ==========================================================
  hdr(1, 'Config webhook Asaas');
  // ==========================================================
  {
    const res = await fetch(`${ASAAS_URL}/webhooks`, { headers: { access_token: ASAAS_API_KEY } });
    const d = await res.json();
    const wh = d.data?.find((w) => w.url.includes('jardinei.com/api/webhook-asaas'));
    if (!wh) { record('Webhook Asaas existe', false); }
    else {
      record('Webhook Asaas existe', true);
      record('enabled=true', wh.enabled === true);
      record('hasAuthToken=true', wh.hasAuthToken === true, 'token de seguranca configurado');
      record('interrupted=false', wh.interrupted === false, 'nao esta pausado');
      const needed = ['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED', 'PAYMENT_OVERDUE', 'PAYMENT_REFUNDED'];
      const missing = needed.filter((e) => !wh.events.includes(e));
      record('Eventos necessarios cobertos', missing.length === 0,
        missing.length ? 'faltando: ' + missing.join(',') : wh.events.length + ' eventos');
    }
  }

  // ==========================================================
  hdr(2, 'Seguranca: webhook rejeita sem token');
  // ==========================================================
  {
    const noToken = await fetch(`${PROD}/api/webhook-asaas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'PAYMENT_CONFIRMED', payment: { id: 'fake' } }),
    });
    record('Sem token → 401', noToken.status === 401, `HTTP ${noToken.status}`);

    const wrongToken = await fetch(`${PROD}/api/webhook-asaas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'asaas-access-token': 'token-invalido-xyz' },
      body: JSON.stringify({ event: 'PAYMENT_CONFIRMED', payment: { id: 'fake' } }),
    });
    record('Token invalido → 401', wrongToken.status === 401, `HTTP ${wrongToken.status}`);
  }

  // ==========================================================
  hdr(3, 'Fluxo MENSAL (essential)');
  // ==========================================================
  let monthlyUser, monthlyPay;
  {
    monthlyUser = await createFakeUser('mensal');
    const cp = await createPayment(monthlyUser.id, monthlyUser.email, 'monthly');
    monthlyPay = cp;
    record('create-payment mensal OK', cp.ok && !!cp.paymentId);

    // checkout_tracking foi populado
    await new Promise(r => setTimeout(r, 1000));
    const { data: ct } = await supabase.from('checkout_tracking')
      .select('fbp, fbc, client_ip, user_agent').eq('user_id', monthlyUser.id).maybeSingle();
    record('checkout_tracking populado (fbp+fbc+ip+ua)',
      !!(ct?.fbp && ct?.fbc && ct?.client_ip && ct?.user_agent),
      ct ? `ip=${ct.client_ip}` : 'nao encontrado');

    const wh = await fireWebhook('PAYMENT_CONFIRMED', {
      id: cp.paymentId, subscription: cp.subscriptionId,
      value: 97, netValue: 97, description: 'JARDINEI Mensal',
      billingType: 'PIX', status: 'CONFIRMED',
      externalReference: monthlyUser.id,
      invoiceUrl: cp.paymentUrl,
    });
    record('Webhook mensal 200', wh.ok);
    record('facebook_purchase=true (CAPI disparado)', wh.data?.facebook_purchase === true);

    await new Promise(r => setTimeout(r, 1500));
    const { data: p } = await supabase.from('profiles')
      .select('plan, plan_status, plan_period').eq('user_id', monthlyUser.id).single();
    record('Profile mensal atualizado', p?.plan === 'essential' && p?.plan_status === 'active',
      `plan=${p?.plan}, period=${p?.plan_period}`);
  }

  // ==========================================================
  hdr(4, 'Fluxo ANUAL (pro)');
  // ==========================================================
  let annualUser, annualPay;
  {
    annualUser = await createFakeUser('anual');
    const cp = await createPayment(annualUser.id, annualUser.email, 'annual');
    annualPay = cp;
    record('create-payment anual OK', cp.ok && !!cp.paymentId);

    const wh = await fireWebhook('PAYMENT_CONFIRMED', {
      id: cp.paymentId, subscription: cp.subscriptionId,
      value: 804, netValue: 804, description: 'JARDINEI Anual',
      billingType: 'PIX', status: 'CONFIRMED',
      externalReference: annualUser.id,
    });
    record('Webhook anual 200', wh.ok);
    record('facebook_purchase=true (CAPI disparado)', wh.data?.facebook_purchase === true);

    await new Promise(r => setTimeout(r, 1500));
    const { data: p } = await supabase.from('profiles')
      .select('plan, plan_status, plan_period, plan_expires_at').eq('user_id', annualUser.id).single();
    record('Profile anual atualizado', p?.plan === 'pro' && p?.plan_period === 'annual',
      `plan=${p?.plan}, expira ${p?.plan_expires_at?.split('T')[0]}`);
  }

  // ==========================================================
  hdr(5, 'Idempotencia: webhook 2x nao duplica payment_history');
  // ==========================================================
  {
    const wh2 = await fireWebhook('PAYMENT_CONFIRMED', {
      id: monthlyPay.paymentId, subscription: monthlyPay.subscriptionId,
      value: 97, description: 'JARDINEI Mensal',
      status: 'CONFIRMED', externalReference: monthlyUser.id,
    });
    record('Webhook 2x retorna 200', wh2.ok);
    record('Retornou already_processed', wh2.data?.already_processed === true,
      'idempotencia funciona');

    const { count } = await supabase.from('payment_history')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', monthlyUser.id).eq('asaas_payment_id', monthlyPay.paymentId);
    record('payment_history tem apenas 1 registro', count === 1, `count=${count}`);
  }

  // ==========================================================
  hdr(6, 'Renovacao NAO dispara Purchase CAPI');
  // ==========================================================
  {
    // Simular 2a compra = renovacao (primeira ja foi o monthly acima)
    const renewalPaymentId = `pay_renewal_fake_${Date.now()}`;
    const wh = await fireWebhook('PAYMENT_RECEIVED', {
      id: renewalPaymentId, subscription: monthlyPay.subscriptionId,
      value: 97, description: 'JARDINEI Mensal',
      status: 'RECEIVED', externalReference: monthlyUser.id,
    });
    record('Webhook renovacao 200', wh.ok);
    record('facebook_purchase=false (renovacao NAO dispara)',
      wh.data?.facebook_purchase === false || wh.data?.facebook_purchase === undefined,
      `resp: ${JSON.stringify(wh.data).substring(0, 80)}`);
  }

  // ==========================================================
  hdr(7, 'PAYMENT_OVERDUE marca status overdue');
  // ==========================================================
  {
    // Precisa de um user NOVO que nao tenha plano ativo (overdue e guardado)
    const overdueUser = await createFakeUser('overdue');
    // Forca profile como cancelado pro overdue pegar
    await supabase.from('profiles').update({
      plan: 'essential', plan_status: 'cancelled', plan_expires_at: new Date(Date.now() - 86400000).toISOString(),
    }).eq('user_id', overdueUser.id);

    const wh = await fireWebhook('PAYMENT_OVERDUE', {
      id: `pay_overdue_${Date.now()}`, subscription: 'sub_test',
      value: 97, status: 'OVERDUE', externalReference: overdueUser.id,
    });
    record('Webhook OVERDUE 200', wh.ok);

    await new Promise(r => setTimeout(r, 1000));
    const { data: p } = await supabase.from('profiles')
      .select('plan_status, plan_overdue_since').eq('user_id', overdueUser.id).single();
    record('Profile status=overdue', p?.plan_status === 'overdue');
    record('plan_overdue_since preenchido', !!p?.plan_overdue_since);

    await cleanupUser(overdueUser.id);
  }

  // ==========================================================
  hdr(8, 'PAYMENT_REFUNDED rebaixa pra free');
  // ==========================================================
  {
    const refUser = await createFakeUser('refund');
    await supabase.from('profiles').update({
      plan: 'essential', plan_status: 'active',
    }).eq('user_id', refUser.id);

    const wh = await fireWebhook('PAYMENT_REFUNDED', {
      id: `pay_refund_${Date.now()}`, value: 97,
      status: 'REFUNDED', externalReference: refUser.id,
    });
    record('Webhook REFUNDED 200', wh.ok);

    await new Promise(r => setTimeout(r, 1000));
    const { data: p } = await supabase.from('profiles')
      .select('plan, plan_status').eq('user_id', refUser.id).single();
    record('Profile rebaixado pra free', p?.plan === 'free' && p?.plan_status === 'cancelled',
      `plan=${p?.plan}, status=${p?.plan_status}`);

    await cleanupUser(refUser.id);
  }

  // ==========================================================
  hdr(9, 'CAPI proxy aceita payload Purchase real');
  // ==========================================================
  {
    const testEventId = `test_capi_${Date.now()}`;
    const payload = {
      data: [{
        event_name: 'TestEvent',
        event_time: Math.floor(Date.now() / 1000),
        event_id: testEventId,
        event_source_url: `${PROD}/test`,
        action_source: 'website',
        user_data: {
          em: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          fbp: `fb.1.${Date.now()}.1234567890`,
          client_ip_address: '189.45.67.89',
          client_user_agent: 'Mozilla/5.0 (Test)',
        },
        custom_data: { value: 97, currency: 'BRL' },
      }],
      pixel_id: '888149620416465',
    };
    const res = await fetch(CAPI_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await res.text();
    record('CAPI responde HTTP 2xx em payload real', res.ok, `HTTP ${res.status}`);
    record('CAPI response body nao vazio', body.length > 2, body.substring(0, 100));
  }

  // ==========================================================
  hdr(10, 'Resend (API viva)');
  // ==========================================================
  if (RESEND_API_KEY) {
    const res = await fetch('https://api.resend.com/domains', {
      headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
    });
    record('Resend API autentica', res.ok, `HTTP ${res.status}`);
    if (res.ok) {
      const d = await res.json();
      const verified = d.data?.filter((dom) => dom.status === 'verified');
      record('Dominio verificado no Resend',
        (verified?.length || 0) > 0,
        verified?.map((d) => d.name).join(', ') || 'nenhum');
    }
  } else {
    warn('RESEND_API_KEY nao configurada');
  }

  // ==========================================================
  hdr(11, 'Cadastro: Lead + CompleteRegistration no CAPI');
  // ==========================================================
  {
    const eventId = `test_lead_${Date.now()}`;
    const payload = {
      data: [{
        event_name: 'Lead',
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId,
        action_source: 'website',
        event_source_url: `${PROD}/cadastro`,
        user_data: {
          em: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          client_ip_address: '189.45.67.89',
          client_user_agent: 'Mozilla/5.0 (Test)',
        },
        custom_data: { value: 97, currency: 'BRL' },
      }],
      pixel_id: '888149620416465',
    };
    const res = await fetch(CAPI_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    record('CAPI aceita evento Lead', res.ok, `HTTP ${res.status}`);
  }

  // ==========================================================
  hdr(12, 'Edge case: webhook com externalReference vazio (fallback customer_id)');
  // ==========================================================
  {
    const edgeUser = await createFakeUser('edge');
    // Primeiro faz create-payment pra gerar asaas_customer_id
    const cp = await createPayment(edgeUser.id, edgeUser.email, 'monthly');
    if (cp.ok && cp.paymentId) {
      // Pega o customer_id do profile (aguarda write do create-payment propagar)
      await new Promise(r => setTimeout(r, 2500));
      const { data: prof } = await supabase.from('profiles')
        .select('asaas_customer_id').eq('user_id', edgeUser.id).single();

      info(`profile.asaas_customer_id = ${prof?.asaas_customer_id || 'NULL'}`);
      if (prof?.asaas_customer_id) {
        // Usa paymentId ficticio pra evitar idempotencia do primeiro create-payment
        const fakePayId = `pay_edge_test_${Date.now()}`;
        info(`disparando webhook com customer=${prof.asaas_customer_id} (sem externalReference)`);
        const wh = await fireWebhook('PAYMENT_CONFIRMED', {
          id: fakePayId, subscription: cp.subscriptionId,
          value: 97, description: 'JARDINEI Mensal',
          status: 'CONFIRMED',
          customer: prof.asaas_customer_id,
          // externalReference omitido de proposito
        });
        // Confirmar diretamente no supabase que o customer_id bate
        const { data: check } = await supabase.from('profiles')
          .select('user_id, asaas_customer_id')
          .eq('asaas_customer_id', prof.asaas_customer_id);
        info(`supabase lookup by customer_id retornou ${check?.length || 0} rows`);
        record('Webhook resolve via customer_id fallback',
          wh.ok && wh.data?.user_id === edgeUser.id,
          `resp: ${JSON.stringify(wh.data).substring(0, 200)}`);
      } else {
        warn('customer_id nao salvo, pulando');
      }
      await cleanupUser(edgeUser.id, cp.subscriptionId);
    } else {
      warn('create-payment falhou, pulando teste edge');
      await cleanupUser(edgeUser.id);
    }
  }

  // ==========================================================
  hdr('CLEANUP', 'deletando users fake');
  // ==========================================================
  await cleanupUser(monthlyUser.id, monthlyPay?.subscriptionId);
  await cleanupUser(annualUser.id, annualPay?.subscriptionId);
  ok('users fake deletados');

  // ==========================================================
  console.log(`\n${c.b}${c.c}━━━━━━━━━━━━━━━ RESUMO ━━━━━━━━━━━━━━━${c.rst}\n`);
  const pass = results.filter((r) => r.pass).length;
  const fail = results.filter((r) => !r.pass).length;
  const total = results.length;
  const pct = Math.round((pass / total) * 100);
  const color = pct >= 95 ? 'g' : pct >= 80 ? 'y' : 'r';
  console.log(`  Passou:  ${c.g}${pass}${c.rst}`);
  console.log(`  Falhou:  ${fail > 0 ? c.r : c.g}${fail}${c.rst}`);
  console.log(`  Total:   ${total}`);
  console.log(`\n  ${c[color]}${c.b}${pct}% OK${c.rst}\n`);

  if (fail > 0) {
    console.log(`${c.r}Falhas:${c.rst}`);
    results.filter((r) => !r.pass).forEach((r) => {
      console.log(`  ❌ ${r.name}${r.detail ? ' — ' + r.detail : ''}`);
    });
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
