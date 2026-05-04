/**
 * API para criar pagamento de uma proposta via Asaas
 * POST /api/create-proposal-payment
 *
 * Gera um link de pagamento PIX/Boleto/Cartão para o cliente pagar a proposta
 */

import { createClient } from '@supabase/supabase-js';

const asaasToken = process.env.ASAAS_API_KEY;
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ASAAS_URL = 'https://api.asaas.com/v3';

// Domínios permitidos (inclui onde propostas públicas são visualizadas)
const ALLOWED_ORIGINS = [
  'https://www.jardinei.com',
  'https://jardinei.com',
  'https://verproposta.online',
  'https://www.verproposta.online',
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

  const { proposalId, clientName, clientEmail, clientCpfCnpj, amount, description } = req.body;

  if (!proposalId || !clientName || !amount) {
    return res.status(400).json({ error: 'proposalId, clientName e amount são obrigatórios' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Buscar proposta para pegar dados do vendedor
    const { data: proposal, error: proposalError } = await supabase
      .from('proposals')
      .select('id, user_id, total, client_name, short_id')
      .eq('id', proposalId)
      .single();

    if (proposalError || !proposal) {
      return res.status(404).json({ error: 'Proposta não encontrada' });
    }

    // Buscar configurações de pagamento do vendedor
    const { data: sellerProfile } = await supabase
      .from('profiles')
      .select('full_name, company_name, cnpj, asaas_customer_id')
      .eq('user_id', proposal.user_id)
      .single();

    // 1. Criar ou buscar cliente no Asaas
    let customerId;
    const customerEmail = clientEmail || `cliente_${proposalId.slice(-8)}@temp.jardinei.com`;

    // Buscar cliente pelo email
    const searchResponse = await fetch(`${ASAAS_URL}/customers?email=${encodeURIComponent(customerEmail)}`, {
      headers: { 'access_token': asaasToken },
    });
    const searchData = await searchResponse.json();

    if (searchData.data && searchData.data.length > 0) {
      customerId = searchData.data[0].id;
    } else {
      // Criar novo cliente
      const createCustomerResponse = await fetch(`${ASAAS_URL}/customers`, {
        method: 'POST',
        headers: {
          'access_token': asaasToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: clientName,
          email: customerEmail,
          cpfCnpj: clientCpfCnpj?.replace(/\D/g, '') || null,
          externalReference: `proposal_${proposalId}`,
        }),
      });
      const customerData = await createCustomerResponse.json();

      if (customerData.errors) {
        console.error('Erro ao criar cliente:', customerData.errors);
        return res.status(400).json({ error: 'Erro ao criar cliente', details: customerData.errors });
      }

      customerId = customerData.id;
    }

    // 2. Criar cobrança (não recorrente)
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7); // Vencimento em 7 dias

    const paymentResponse = await fetch(`${ASAAS_URL}/payments`, {
      method: 'POST',
      headers: {
        'access_token': asaasToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customer: customerId,
        billingType: 'UNDEFINED', // Cliente escolhe: PIX, Boleto ou Cartão
        value: amount,
        dueDate: dueDate.toISOString().split('T')[0],
        description: description || `Proposta #${proposal.short_id || proposalId.slice(-6).toUpperCase()}`,
        externalReference: `proposal_payment_${proposalId}`,
      }),
    });

    const paymentData = await paymentResponse.json();

    if (paymentData.errors) {
      console.error('Erro ao criar pagamento:', paymentData.errors);
      return res.status(400).json({ error: 'Erro ao criar pagamento', details: paymentData.errors });
    }

    console.log('Pagamento criado:', paymentData.id);

    // 3. Salvar referência do pagamento na proposta
    await supabase
      .from('proposals')
      .update({
        payment_id: paymentData.id,
        payment_url: paymentData.invoiceUrl,
        payment_status: 'pending',
        updated_at: new Date().toISOString(),
      })
      .eq('id', proposalId);

    return res.status(200).json({
      success: true,
      paymentId: paymentData.id,
      paymentUrl: paymentData.invoiceUrl,
      bankSlipUrl: paymentData.bankSlipUrl,
      pixQrCode: paymentData.pixQrCodeUrl,
      dueDate: paymentData.dueDate,
    });

  } catch (error) {
    console.error('Erro ao criar pagamento da proposta:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
