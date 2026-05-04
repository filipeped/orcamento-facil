/**
 * API para aprovar proposta (página pública)
 * POST /api/approve-proposal
 * Body: { proposalId: "xxx", clientName: "João" }
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Evolution API (WhatsApp)
// 🚫 KILL SWITCH: Desativado temporariamente para evitar block no WhatsApp
const WHATSAPP_DISABLED = true;

const EVOLUTION_URL = process.env.EVOLUTION_URL || 'https://digitalpaisagismo-evolution.cloudfy.live';
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE || 'jardinei';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;

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

  try {
    const { proposalId, clientName } = req.body;

    if (!proposalId) {
      return res.status(400).json({ error: 'proposalId é obrigatório' });
    }

    console.log('Aprovando proposta:', proposalId, 'por:', clientName);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Buscar dados da proposta
    const { data: proposal, error: fetchError } = await supabase
      .from('proposals')
      .select('id, user_id, title, client_name, status, total, short_id')
      .eq('id', proposalId)
      .single();

    if (fetchError || !proposal) {
      console.error('Proposta não encontrada:', fetchError);
      return res.status(404).json({ error: 'Proposta não encontrada' });
    }

    // Verificar se já está aprovada
    if (proposal.status === 'approved') {
      return res.status(200).json({
        success: true,
        message: 'Proposta já estava aprovada',
        alreadyApproved: true
      });
    }

    // 2. Atualizar status para aprovado (com WHERE status != 'approved' para evitar race condition)
    const { data: updated, error: updateError } = await supabase
      .from('proposals')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        signature: clientName || proposal.client_name,
      })
      .eq('id', proposalId)
      .neq('status', 'approved')
      .select('id');

    if (updateError) {
      console.error('Erro ao atualizar proposta:', updateError);
      return res.status(500).json({ error: 'Erro ao aprovar proposta' });
    }

    // Se não atualizou nenhuma row, outra request já aprovou (race condition)
    if (!updated || updated.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'Proposta já estava aprovada',
        alreadyApproved: true
      });
    }

    // 3. Criar notificação para o dono da proposta
    if (proposal.user_id) {
      await supabase.from('notifications').insert({
        user_id: proposal.user_id,
        type: 'proposal_approved',
        title: '🎉 Proposta aprovada!',
        message: `${proposal.client_name} aprovou a proposta "${proposal.title}"`,
        metadata: {
          proposal_id: proposalId,
          client_name: proposal.client_name,
        },
        read: false,
      });

      // 4. Buscar telefone do dono para enviar WhatsApp
      const { data: profile } = await supabase
        .from('profiles')
        .select('phone, full_name')
        .eq('user_id', proposal.user_id)
        .single();

      if (profile?.phone && EVOLUTION_API_KEY && !WHATSAPP_DISABLED) {
        let phoneNumber = profile.phone.replace(/\D/g, '');
        if (phoneNumber.length === 11) phoneNumber = '55' + phoneNumber;

        const nomeDono = profile.full_name?.split(' ')[0] || '';
        const totalFormatado = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(proposal.total || 0);
        const proposalLink = proposal.short_id ? `jardinei.com/p/${proposal.short_id}` : 'jardinei.com/propostas';

        const message = `🎉 *Proposta Aprovada!*

Parabéns${nomeDono ? ` ${nomeDono}` : ''}! 🏆

O cliente *${proposal.client_name}* aprovou sua proposta:

📋 *${proposal.title}*
💰 *${totalFormatado}*

✅ Fechamento confirmado!

👉 Ver: ${proposalLink}

Bom trabalho! 💪

— JARDINEI`;

        try {
          await fetch(`${EVOLUTION_URL}/message/sendText/${EVOLUTION_INSTANCE}`, {
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
          console.log('WhatsApp enviado para:', phoneNumber);
        } catch (whatsappError) {
          console.error('Erro ao enviar WhatsApp:', whatsappError);
        }
      }
    }

    console.log('Proposta aprovada com sucesso!');

    return res.status(200).json({
      success: true,
      message: 'Proposta aprovada com sucesso',
    });

  } catch (error) {
    console.error('Erro ao aprovar proposta:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}
