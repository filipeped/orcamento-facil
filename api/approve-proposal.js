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
  'https://www.fechaaqui.com',
  'https://fechaaqui.com',
  'https://www.jardinei.com',
  'https://jardinei.com',
  'https://www.orcafacil.com',
  'https://orcafacil.com',
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
    const { proposalId, clientName, signatureDataUrl, signedName } = req.body;

    if (!proposalId) {
      return res.status(400).json({ error: 'proposalId é obrigatório' });
    }

    console.log('Aprovando proposta:', proposalId, 'por:', clientName, signatureDataUrl ? '(com assinatura)' : '');

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

    // 1.5. Upload da assinatura (se enviada — feature FechaAqui, opcional)
    let signatureUrl = null;
    if (signatureDataUrl && typeof signatureDataUrl === 'string' && signatureDataUrl.startsWith('data:image/')) {
      try {
        // Converter dataURL → buffer
        const base64Data = signatureDataUrl.split(',')[1];
        const buffer = Buffer.from(base64Data, 'base64');
        const filePath = `${proposal.user_id}/${proposalId}.png`;

        const { error: uploadError } = await supabase.storage
          .from('signatures')
          .upload(filePath, buffer, {
            contentType: 'image/png',
            upsert: true,
          });

        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('signatures').getPublicUrl(filePath);
          signatureUrl = urlData?.publicUrl || null;
          console.log('✅ Assinatura salva:', signatureUrl);
        } else {
          console.warn('⚠️ Falha upload assinatura (não bloqueia):', uploadError.message);
        }
      } catch (sigErr) {
        console.warn('⚠️ Erro ao processar assinatura (não bloqueia):', sigErr);
      }
    }

    // 2. Atualizar status para aprovado (com WHERE status != 'approved' para evitar race condition)
    const clientIp = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.headers['x-real-ip'] || null;
    const updatePayload = {
      status: 'approved',
      approved_at: new Date().toISOString(),
      signature: clientName || proposal.client_name,
    };
    // Campos novos (FechaAqui) — só setam se a coluna existir no banco; se não existir, Supabase ignora silencioso? Não, gera erro.
    // Solução: só inclui se signatureUrl foi gerada (ou seja, bucket/coluna existem).
    if (signatureUrl) {
      updatePayload.signature_url = signatureUrl;
      updatePayload.signed_at = new Date().toISOString();
      updatePayload.signed_ip = clientIp;
      updatePayload.signed_name = signedName || clientName || proposal.client_name;
    }

    const { data: updated, error: updateError } = await supabase
      .from('proposals')
      .update(updatePayload)
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
        // Detectar brand: client manda na header origin/referer; default JARDINEI (legado).
        const reqOrigin = (req.headers.origin || req.headers.referer || '').toLowerCase();
        const brand = reqOrigin.includes('fechaaqui') ? 'fechaaqui' : 'jardinei';
        const brandLabel = brand === 'fechaaqui' ? 'FechaAqui' : 'JARDINEI';
        const brandHost = brand === 'fechaaqui'
          ? (process.env.FECHAQUI_PUBLIC_DOMAIN || 'https://www.fechaaqui.com').replace(/^https?:\/\//, '')
          : (process.env.JARDINEI_PUBLIC_DOMAIN || 'https://www.jardinei.com').replace(/^https?:\/\//, '');
        const propostasPath = brand === 'fechaaqui' ? '/orcamentos' : '/propostas';
        const proposalLink = proposal.short_id ? `${brandHost}/p/${proposal.short_id}` : `${brandHost}${propostasPath}`;

        const message = `🎉 *Proposta Aprovada!*

Parabéns${nomeDono ? ` ${nomeDono}` : ''}! 🏆

O cliente *${proposal.client_name}* aprovou sua proposta:

📋 *${proposal.title}*
💰 *${totalFormatado}*

✅ Fechamento confirmado!

👉 Ver: ${proposalLink}

Bom trabalho! 💪

— ${brandLabel}`;

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
