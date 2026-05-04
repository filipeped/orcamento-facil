const EVOLUTION_URL = process.env.EVOLUTION_URL || 'https://digitalpaisagismo-evolution.cloudfy.live';
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE || 'jardinei';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;

async function sendWhatsApp() {
  const phone = '5547988303482';
  const nome = 'filipe';

  const msg = `🎁 *Oferta especial pra você!*

Olá ${nome}!

Seu *teste grátis* do JARDINEI acaba *AMANHÃ*!

Você já criou propostas profissionais e viu como funciona. Agora é hora de dar o próximo passo!

🏷️ *10% de desconto* já aplicado no link:

👉 jardinei.com/upgrade?cupom=FICA10

Assine agora e continue fechando mais orçamentos!

— JARDINEI`;

  console.log('📱 Enviando WhatsApp para:', phone);
  console.log('URL:', EVOLUTION_URL);
  console.log('Instance:', EVOLUTION_INSTANCE);
  console.log('API Key:', EVOLUTION_API_KEY ? '✅ OK' : '❌ MISSING');

  try {
    const response = await fetch(`${EVOLUTION_URL}/message/sendText/${EVOLUTION_INSTANCE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_API_KEY },
      body: JSON.stringify({ number: phone, text: msg }),
    });

    const result = await response.text();
    console.log('\n📨 Resposta:', response.status);
    console.log(result);
  } catch (err) {
    console.error('❌ Erro:', err.message);
  }
}

sendWhatsApp();
