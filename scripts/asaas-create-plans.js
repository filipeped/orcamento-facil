/**
 * Criar planos de assinatura no Asaas
 * Execute: node scripts/asaas-create-plans.js
 */

const ASAAS_API_KEY = '$aact_prod_000MzkwODA2MWY2OGM3MWRlMDU2NWM3MzJlNzZmNGZhZGY6OmQzMTBlOGU1LWJhNTMtNDFiYi1hM2VkLTRhNmJjMzUwYzcxYjo6JGFhY2hfMWJhNjRkY2YtZmJhMy00MmJlLWE5YjMtNDA5ZDk2ZDA0OGNm';
const ASAAS_URL = 'https://api.asaas.com/v3';

async function createPaymentLink(data) {
  const response = await fetch(`${ASAAS_URL}/paymentLinks`, {
    method: 'POST',
    headers: {
      'access_token': ASAAS_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  return await response.json();
}

async function main() {
  console.log('Criando links de pagamento no Asaas...\n');

  // Essencial Mensal - R$ 5,00 (TESTE - mínimo do Asaas)
  const essentialMonthly = await createPaymentLink({
    name: 'JARDINEI Essencial - Mensal',
    description: 'Plano Essencial do JARDINEI - Cobrança mensal',
    value: 5.00,
    billingType: 'UNDEFINED', // Permite PIX, Cartão, Boleto
    chargeType: 'RECURRENT',
    dueDateLimitDays: 10,
    subscriptionCycle: 'MONTHLY',
    maxInstallmentCount: 1,
    notificationEnabled: true,
    endDate: null,
  });
  console.log('Essencial Mensal:', essentialMonthly.url || essentialMonthly);

  // Essencial Anual - R$ 6,00 (TESTE)
  const essentialAnnual = await createPaymentLink({
    name: 'JARDINEI Essencial - Anual',
    description: 'Plano Essencial do JARDINEI - Cobrança anual',
    value: 6.00,
    billingType: 'UNDEFINED',
    chargeType: 'RECURRENT',
    dueDateLimitDays: 10,
    subscriptionCycle: 'YEARLY',
    maxInstallmentCount: 1,
    notificationEnabled: true,
  });
  console.log('Essencial Anual:', essentialAnnual.url || essentialAnnual);

  // Pro Mensal - R$ 7,00 (TESTE)
  const proMonthly = await createPaymentLink({
    name: 'JARDINEI Pro - Mensal',
    description: 'Plano Profissional do JARDINEI - Cobrança mensal',
    value: 7.00,
    billingType: 'UNDEFINED',
    chargeType: 'RECURRENT',
    dueDateLimitDays: 10,
    subscriptionCycle: 'MONTHLY',
    maxInstallmentCount: 1,
    notificationEnabled: true,
  });
  console.log('Pro Mensal:', proMonthly.url || proMonthly);

  // Pro Anual - R$ 8,00 (TESTE)
  const proAnnual = await createPaymentLink({
    name: 'JARDINEI Pro - Anual',
    description: 'Plano Profissional do JARDINEI - Cobrança anual',
    value: 8.00,
    billingType: 'UNDEFINED',
    chargeType: 'RECURRENT',
    dueDateLimitDays: 10,
    subscriptionCycle: 'YEARLY',
    maxInstallmentCount: 1,
    notificationEnabled: true,
  });
  console.log('Pro Anual:', proAnnual.url || proAnnual);

  console.log('\n=== LINKS PARA O VERCEL ===\n');
  if (essentialMonthly.url) console.log('VITE_ASAAS_ESSENTIAL_MONTHLY=' + essentialMonthly.url);
  if (essentialAnnual.url) console.log('VITE_ASAAS_ESSENTIAL_ANNUAL=' + essentialAnnual.url);
  if (proMonthly.url) console.log('VITE_ASAAS_PRO_MONTHLY=' + proMonthly.url);
  if (proAnnual.url) console.log('VITE_ASAAS_PRO_ANNUAL=' + proAnnual.url);
}

main().catch(console.error);
