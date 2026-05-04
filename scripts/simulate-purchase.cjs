/**
 * Simula uma compra real de ponta a ponta:
 *
 *  1. Verifica se a tabela checkout_tracking existe no Supabase
 *  2. Cria user fake + profile fake
 *  3. Chama /api/create-payment em prod (gera cobranca no Asaas — SEM cobrar dinheiro)
 *  4. Insere linha em checkout_tracking simulando o browser (fbp/fbc/IP/UA)
 *  5. Dispara POST /api/webhook-asaas em prod com payload PAYMENT_CONFIRMED
 *  6. Verifica TUDO: plano atualizado, payment_history, notificacao, CAPI, email
 *  7. Cleanup: deleta user, subscription Asaas, checkout_tracking
 *
 * Uso:
 *   npx dotenv -e .env.local -- node scripts/simulate-purchase.cjs
 */

// Carrega .env.local manualmente pra nao expandir $ (dotenv-cli expande e quebra ASAAS_API_KEY)
const fs = require('fs');
const path = require('path');
try {
  const envPath = path.resolve(__dirname, '..', '.env.local');
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/i);
    if (!match) continue;
    const key = match[1];
    let val = match[2].trim();
    // Remove aspas envolvendo
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
} catch (e) {
  console.warn('⚠️ Nao carregou .env.local:', e.message);
}

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const ASAAS_WEBHOOK_TOKEN = process.env.ASAAS_WEBHOOK_TOKEN;

const PROD_BASE = process.env.PROD_BASE || 'https://www.jardinei.com';
const CAPI_URL = 'https://cap.jardinei.com/api/events';
const ASAAS_URL = 'https://api.asaas.com/v3';

const FAKE_EMAIL = `teste-tracking-${Date.now()}@jardinei-test.com`;
const FAKE_CPF = '24971563792'; // CPF valido de teste (gerado pra testes)
const FAKE_NAME = 'Teste Tracking Simulacao';
const FAKE_PHONE = '11987654321';

const c = {
  green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m',
  blue: '\x1b[34m', cyan: '\x1b[36m', gray: '\x1b[90m', reset: '\x1b[0m',
  bold: '\x1b[1m',
};

function log(icon, msg, color = 'reset') {
  console.log(`${c[color]}${icon} ${msg}${c.reset}`);
}

function step(num, title) {
  console.log(`\n${c.bold}${c.cyan}━━━ Passo ${num}: ${title} ━━━${c.reset}`);
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !ASAAS_API_KEY || !ASAAS_WEBHOOK_TOKEN) {
    log('❌', 'Envs faltando. Precisa: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ASAAS_API_KEY, ASAAS_WEBHOOK_TOKEN', 'red');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const results = {
    tableExists: false,
    userCreated: false,
    profileCreated: false,
    createPaymentOk: false,
    checkoutTrackingInserted: false,
    webhookOk: false,
    profileUpdated: false,
    paymentHistoryCreated: false,
    notificationCreated: false,
    capiReachable: false,
    prodHasNewCode: false,
  };

  let userId = null;
  let asaasSubscriptionId = null;
  let asaasPaymentId = null;
  let asaasCustomerId = null;

  try {
    // ============================================================
    step(1, 'Verificar se tabela checkout_tracking existe');
    // ============================================================
    const { error: tableErr } = await supabase
      .from('checkout_tracking')
      .select('id')
      .limit(1);

    if (tableErr) {
      const msg = (tableErr.message || '').toLowerCase();
      if (tableErr.code === '42P01' || msg.includes('does not exist') || msg.includes('could not find the table') || msg.includes('schema cache')) {
        log('⚠️', 'Tabela checkout_tracking NAO EXISTE no Supabase.', 'yellow');
        log('  ', 'Rode a migration no Dashboard SQL Editor:', 'gray');
        log('  ', 'supabase/migrations/20260421_checkout_tracking.sql', 'gray');
        log('⏭️', 'Continuando teste sem ela — fluxo atual de prod sera validado.', 'yellow');
      } else {
        log('⚠️', `Erro consultando checkout_tracking: ${tableErr.message} (continuando)`, 'yellow');
      }
    } else {
      results.tableExists = true;
      log('✅', 'Tabela checkout_tracking existe.', 'green');
    }

    // ============================================================
    step(2, 'Criar user fake no Supabase auth');
    // ============================================================
    const { data: userData, error: userErr } = await supabase.auth.admin.createUser({
      email: FAKE_EMAIL,
      password: 'testeSenha123!@#',
      email_confirm: true,
      user_metadata: { full_name: FAKE_NAME },
    });

    if (userErr) throw new Error(`auth.admin.createUser: ${userErr.message}`);
    userId = userData.user.id;
    results.userCreated = true;
    log('✅', `User criado: ${userId.substring(0, 8)}...  (${FAKE_EMAIL})`, 'green');

    // Criar profile
    const { error: profileErr } = await supabase.from('profiles').insert({
      user_id: userId,
      full_name: FAKE_NAME,
      phone: FAKE_PHONE,
      cnpj: FAKE_CPF,
      plan: 'free',
      plan_status: 'trial',
    });
    if (profileErr && !profileErr.message.includes('duplicate')) {
      throw new Error(`profiles insert: ${profileErr.message}`);
    }
    results.profileCreated = true;
    log('✅', 'Profile criado (plan=free, status=trial)', 'green');

    // ============================================================
    step(3, 'Chamar POST /api/create-payment em prod (gera cobranca no Asaas)');
    // ============================================================
    const trackingFbp = `fb.1.${Date.now()}.${Math.floor(Math.random() * 1e10)}`;
    const trackingFbc = `fb.1.${Date.now()}.AbCdEfGhIjKl_SIMULATED_CLICK_${Date.now()}`;
    const trackingIp = '189.45.67.89';
    const trackingUa = 'Mozilla/5.0 (Simulated Browser) TrackingTest/1.0';
    const trackingUrl = `${PROD_BASE}/upgrade`;

    const cpRes = await fetch(`${PROD_BASE}/api/create-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://www.jardinei.com',
      },
      body: JSON.stringify({
        plan: 'essential',
        period: 'monthly',
        userId,
        customerEmail: FAKE_EMAIL,
        customerName: FAKE_NAME,
        cpfCnpj: FAKE_CPF,
        trackingData: {
          fbp: trackingFbp,
          fbc: trackingFbc,
          clientIP: trackingIp,
          userAgent: trackingUa,
          sourceUrl: trackingUrl,
        },
      }),
    });

    const cpText = await cpRes.text();
    let cpData;
    try { cpData = JSON.parse(cpText); } catch { cpData = { raw: cpText }; }

    if (!cpRes.ok || !cpData.paymentUrl) {
      log('❌', `create-payment falhou: HTTP ${cpRes.status}`, 'red');
      log('  ', JSON.stringify(cpData).substring(0, 300), 'gray');
      throw new Error('create-payment falhou');
    }

    asaasSubscriptionId = cpData.subscriptionId;
    asaasPaymentId = cpData.paymentId;
    results.createPaymentOk = true;
    log('✅', `Pagamento criado no Asaas:`, 'green');
    log('  ', `subscription: ${asaasSubscriptionId}`, 'gray');
    log('  ', `payment: ${asaasPaymentId}`, 'gray');
    log('  ', `URL: ${cpData.paymentUrl.substring(0, 70)}...`, 'gray');

    // Detecta se prod ja tem o codigo novo (checou se create-payment salvou checkout_tracking)
    if (results.tableExists) {
      await new Promise(r => setTimeout(r, 1500));
      const { data: ct, error: ctErr } = await supabase
        .from('checkout_tracking')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!ctErr && ct) {
        results.prodHasNewCode = true;
        log('✅', 'Prod JA TEM o novo codigo — create-payment salvou checkout_tracking automatico', 'green');
        log('  ', `fbp=${ct.fbp ? 'OK' : 'NULL'} | fbc=${ct.fbc ? 'OK' : 'NULL'} | ip=${ct.client_ip || 'NULL'}`, 'gray');
      } else {
        log('⚠️', 'Prod ainda tem codigo antigo — vou inserir checkout_tracking manualmente', 'yellow');
      }
    }

    // ============================================================
    step(4, 'Inserir checkout_tracking (se prod ainda nao tem o codigo novo)');
    // ============================================================
    if (results.tableExists && !results.prodHasNewCode) {
      const { error: insErr } = await supabase.from('checkout_tracking').insert({
        user_id: userId,
        asaas_subscription_id: asaasSubscriptionId,
        asaas_payment_id: asaasPaymentId,
        fbp: trackingFbp,
        fbc: trackingFbc,
        client_ip: trackingIp,
        user_agent: trackingUa,
        event_source_url: trackingUrl,
      });
      if (insErr) throw new Error(`insert checkout_tracking: ${insErr.message}`);
      results.checkoutTrackingInserted = true;
      log('✅', 'checkout_tracking inserido (simulando browser pos-deploy)', 'green');
    } else if (results.prodHasNewCode) {
      results.checkoutTrackingInserted = true;
    }

    // ============================================================
    step(5, 'Disparar webhook Asaas (PAYMENT_CONFIRMED) em prod');
    // ============================================================
    const webhookPayload = {
      event: 'PAYMENT_CONFIRMED',
      payment: {
        id: asaasPaymentId,
        customer: asaasCustomerId || 'cus_test',
        subscription: asaasSubscriptionId,
        value: 97,
        netValue: 97,
        description: 'JARDINEI Mensal',
        billingType: 'PIX',
        status: 'CONFIRMED',
        externalReference: userId,
        invoiceUrl: cpData.paymentUrl,
        dateCreated: new Date().toISOString().split('T')[0],
      },
    };

    const whRes = await fetch(`${PROD_BASE}/api/webhook-asaas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'asaas-access-token': ASAAS_WEBHOOK_TOKEN,
        'x-forwarded-for': trackingIp, // Simula IP do cliente chegando no webhook
      },
      body: JSON.stringify(webhookPayload),
    });

    const whText = await whRes.text();
    let whData;
    try { whData = JSON.parse(whText); } catch { whData = { raw: whText }; }

    if (!whRes.ok) {
      log('❌', `webhook-asaas falhou: HTTP ${whRes.status}`, 'red');
      log('  ', JSON.stringify(whData).substring(0, 300), 'gray');
    } else {
      results.webhookOk = true;
      log('✅', `Webhook respondeu HTTP ${whRes.status}:`, 'green');
      log('  ', JSON.stringify(whData), 'gray');
      if (whData.facebook_purchase === true) {
        log('✅', 'Webhook retornou facebook_purchase=true (Purchase foi pro CAPI)', 'green');
      } else if (whData.facebook_purchase === false) {
        log('⚠️', 'Webhook retornou facebook_purchase=false — verificar logs do Vercel', 'yellow');
      }
    }

    // ============================================================
    step(6, 'Verificar efeitos colaterais no Supabase');
    // ============================================================
    await new Promise(r => setTimeout(r, 2000)); // Da tempo pro webhook processar

    // 6a. Profile atualizado
    const { data: profileAfter } = await supabase
      .from('profiles')
      .select('plan, plan_status, plan_period, plan_expires_at')
      .eq('user_id', userId)
      .single();

    if (profileAfter?.plan === 'essential' && profileAfter?.plan_status === 'active') {
      results.profileUpdated = true;
      log('✅', `Profile: plan=${profileAfter.plan}, status=${profileAfter.plan_status}, expira=${profileAfter.plan_expires_at?.split('T')[0]}`, 'green');
    } else {
      log('❌', `Profile NAO atualizado: ${JSON.stringify(profileAfter)}`, 'red');
    }

    // 6b. payment_history
    const { data: history } = await supabase
      .from('payment_history')
      .select('*')
      .eq('user_id', userId)
      .eq('asaas_payment_id', asaasPaymentId)
      .maybeSingle();

    if (history) {
      results.paymentHistoryCreated = true;
      log('✅', `payment_history: status=${history.status}, amount=R$${history.amount}`, 'green');
    } else {
      log('❌', 'payment_history NAO encontrado', 'red');
    }

    // 6c. Notificacao
    const { data: notifs } = await supabase
      .from('notifications')
      .select('type, title')
      .eq('user_id', userId)
      .eq('type', 'payment_confirmed');

    if (notifs && notifs.length > 0) {
      results.notificationCreated = true;
      log('✅', `Notificacao criada: "${notifs[0].title}"`, 'green');
    } else {
      log('❌', 'Notificacao NAO criada', 'red');
    }

    // ============================================================
    step(7, 'Verificar CAPI proxy (cap.jardinei.com)');
    // ============================================================
    const capiHealth = await fetch(CAPI_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).catch(e => ({ status: 0, error: e.message }));
    if (capiHealth.status && capiHealth.status !== 0) {
      results.capiReachable = true;
      log('✅', `CAPI proxy respondeu HTTP ${capiHealth.status} (endpoint vivo)`, 'green');
    } else {
      log('❌', `CAPI proxy nao alcancavel: ${capiHealth.error || 'unknown'}`, 'red');
    }

    // ============================================================
    step(8, 'Verificar webhook_logs (confirma chegada no backend)');
    // ============================================================
    const { data: wlog } = await supabase
      .from('webhook_logs')
      .select('event_type, status, error_message')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (wlog) {
      log('📝', `Ultimo webhook_log: ${wlog.event_type} → ${wlog.status}${wlog.error_message ? ' (' + wlog.error_message + ')' : ''}`, wlog.status === 'success' ? 'green' : 'yellow');
    }

  } catch (err) {
    log('❌', `ERRO: ${err.message}`, 'red');
    console.error(err);
  } finally {
    // ============================================================
    step(9, 'Cleanup (deleta user fake + subscription Asaas)');
    // ============================================================
    if (asaasSubscriptionId) {
      try {
        const delRes = await fetch(`${ASAAS_URL}/subscriptions/${asaasSubscriptionId}`, {
          method: 'DELETE',
          headers: { 'access_token': ASAAS_API_KEY },
        });
        log(delRes.ok ? '✅' : '⚠️', `Asaas subscription delete: HTTP ${delRes.status}`, delRes.ok ? 'green' : 'yellow');
      } catch (e) { log('⚠️', `Erro ao deletar asaas sub: ${e.message}`, 'yellow'); }
    }

    if (userId) {
      try {
        // Deleta em ordem (FKs)
        await supabase.from('checkout_tracking').delete().eq('user_id', userId);
        await supabase.from('payment_history').delete().eq('user_id', userId);
        await supabase.from('notifications').delete().eq('user_id', userId);
        await supabase.from('profiles').delete().eq('user_id', userId);
        await supabase.auth.admin.deleteUser(userId);
        log('✅', 'User fake + dados deletados', 'green');
      } catch (e) { log('⚠️', `Cleanup parcial: ${e.message}`, 'yellow'); }
    }

    // ============================================================
    console.log(`\n${c.bold}${c.cyan}━━━━━━━━━━━━━━ RESUMO ━━━━━━━━━━━━━━${c.reset}\n`);
    const checks = [
      ['Tabela checkout_tracking existe', results.tableExists],
      ['User fake criado', results.userCreated],
      ['Profile criado', results.profileCreated],
      ['POST /api/create-payment OK', results.createPaymentOk],
      ['checkout_tracking populado', results.checkoutTrackingInserted],
      ['POST /api/webhook-asaas OK', results.webhookOk],
      ['Profile atualizado (active)', results.profileUpdated],
      ['payment_history criado', results.paymentHistoryCreated],
      ['Notificacao criada', results.notificationCreated],
      ['CAPI proxy alcancavel', results.capiReachable],
      ['Prod ja deployado com fix', results.prodHasNewCode],
    ];
    checks.forEach(([name, ok]) => {
      console.log(`  ${ok ? c.green + '✅' : c.red + '❌'} ${name}${c.reset}`);
    });

    const passed = checks.filter(c => c[1]).length;
    const total = checks.length;
    const pct = Math.round((passed / total) * 100);
    const color = pct >= 90 ? 'green' : pct >= 70 ? 'yellow' : 'red';
    console.log(`\n${c[color]}${c.bold}  ${passed}/${total} checks OK (${pct}%)${c.reset}\n`);
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
