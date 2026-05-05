/**
 * Notificar dono da proposta via WhatsApp
 * POST /api/notify-proposal
 * Body: { proposalId: "xxx", type: "viewed" | "approved", clientName: "João" }
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// 🚫 KILL SWITCH: Desativado temporariamente para evitar block no WhatsApp
const WHATSAPP_DISABLED = true;

const EVOLUTION_URL = process.env.EVOLUTION_URL || 'https://digitalpaisagismo-evolution.cloudfy.live';
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE || 'jardinei';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;

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
    const { proposalId, type, clientName, clientSignature } = req.body;

    if (!proposalId || !type) {
      return res.status(400).json({ error: 'proposalId e type são obrigatórios' });
    }

    console.log('Notificando proposta:', { proposalId, type, clientName });

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Buscar proposta
    const { data: proposal, error: proposalError } = await supabase
      .from('proposals')
      .select('id, user_id, client_name, title, total, short_id')
      .eq('id', proposalId)
      .single();

    if (proposalError || !proposal) {
      console.error('Proposta não encontrada:', proposalError);
      return res.status(404).json({ error: 'Proposta não encontrada' });
    }

    // Buscar perfil do dono
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('phone, full_name')
      .eq('user_id', proposal.user_id)
      .single();

    if (profileError || !profile || !profile.phone) {
      console.error('Perfil não encontrado ou sem telefone:', profileError);
      return res.status(400).json({ error: 'Dono da proposta não tem telefone cadastrado' });
    }

    // Formatar número
    let phoneNumber = profile.phone.replace(/\D/g, '');
    if (phoneNumber.length === 11 || phoneNumber.length === 10) {
      phoneNumber = '55' + phoneNumber;
    }

    // Formatar valor
    const totalFormatted = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(proposal.total || 0);

    // Montar mensagem
    const nomeCliente = clientName || proposal.client_name;
    const nomeDono = profile.full_name?.split(' ')[0] || '';
    // Detectar brand pelo origin/referer do request; default JARDINEI (legado).
    const reqOrigin = (req.headers.origin || req.headers.referer || '').toLowerCase();
    const brand = reqOrigin.includes('fechaqui') ? 'fechaqui' : 'jardinei';
    const brandLabel = brand === 'fechaqui' ? 'FechaAqui' : 'JARDINEI';
    const brandHost = brand === 'fechaqui'
      ? (process.env.FECHAQUI_PUBLIC_DOMAIN || 'https://www.fechaqui.com').replace(/^https?:\/\//, '')
      : (process.env.JARDINEI_PUBLIC_DOMAIN || 'https://www.jardinei.com').replace(/^https?:\/\//, '');
    const propostasPath = brand === 'fechaqui' ? '/orcamentos' : '/propostas';
    const proposalLink = proposal.short_id ? `${brandHost}/p/${proposal.short_id}` : `${brandHost}${propostasPath}`;

    // Apenas tipo "approved" é suportado (viewed removido - não precisa de WhatsApp)
    if (type !== 'approved') {
      return res.status(400).json({ error: 'Tipo inválido. Use apenas: approved' });
    }

    const message = `🎉 *Proposta Aprovada!*

Parabéns${nomeDono ? ` ${nomeDono}` : ''}! 🏆

O cliente *${nomeCliente}* aprovou sua proposta:

📋 *${proposal.title}*
💰 *${totalFormatted}*

✅ Fechamento confirmado!

👉 Ver: ${proposalLink}

Bom trabalho! 💪

— ${brandLabel}`;

    console.log('Enviando WhatsApp para:', phoneNumber);

    // Kill switch ativo - não enviar
    if (WHATSAPP_DISABLED) {
      console.log('⏸️ WhatsApp desativado (kill switch). Msg não enviada para:', phoneNumber);
      return res.status(200).json({ success: true, message: 'WhatsApp desativado (kill switch)' });
    }

    // Enviar via Evolution API
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

    const data = await response.json();

    if (!response.ok) {
      console.error('Erro Evolution API:', data);
      return res.status(400).json({ error: 'Erro ao enviar WhatsApp', details: data });
    }

    console.log('WhatsApp enviado com sucesso!');

    return res.status(200).json({
      success: true,
      message: 'Notificação enviada com sucesso',
    });

  } catch (error) {
    console.error('Erro ao notificar:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}
