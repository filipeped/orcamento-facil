/**
 * Deletar conta do usuário completamente
 * POST /api/delete-account
 * Body: { userId: "xxx" }
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const asaasToken = process.env.ASAAS_API_KEY;
const ASAAS_URL = 'https://api.asaas.com/v3';

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

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId, userEmail } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validar identidade: o usuário só pode deletar a própria conta
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Authorization header required' });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authUser) {
      return res.status(401).json({ error: 'Token inválido' });
    }
    // Verificar se é o próprio usuário OU admin
    if (authUser.id !== userId) {
      const { data: callerProfile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('user_id', authUser.id)
        .single();
      if (!callerProfile?.is_admin) {
        return res.status(403).json({ error: 'Você só pode deletar sua própria conta' });
      }
    }

    console.log('Deletando conta para user:', userId, '(por:', authUser.id, ')');

    // 1. Cancelar assinatura no Asaas se existir
    try {
      // Buscar por externalReference (userId)
      const searchByRef = await fetch(
        `${ASAAS_URL}/subscriptions?externalReference=${userId}&status=ACTIVE`,
        { headers: { 'access_token': asaasToken } }
      );
      const refData = await searchByRef.json();

      if (refData.data && refData.data.length > 0) {
        for (const subscription of refData.data) {
          await fetch(`${ASAAS_URL}/subscriptions/${subscription.id}`, {
            method: 'DELETE',
            headers: { 'access_token': asaasToken },
          });
          console.log('Assinatura cancelada no Asaas:', subscription.id);
        }
      }

      // Buscar também por email
      if (userEmail) {
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
            for (const subscription of custData.data) {
              await fetch(`${ASAAS_URL}/subscriptions/${subscription.id}`, {
                method: 'DELETE',
                headers: { 'access_token': asaasToken },
              });
              console.log('Assinatura cancelada no Asaas:', subscription.id);
            }
          }
        }
      }
    } catch (asaasError) {
      console.log('Erro ao cancelar assinatura (continuando):', asaasError);
    }

    // 2. Deletar arquivos do storage
    try {
      // Logos
      await supabase.storage.from('logos').remove([
        `${userId}/logo.png`, `${userId}/logo.jpg`, `${userId}/logo.jpeg`, `${userId}/logo.webp`
      ]);
      // Avatars
      await supabase.storage.from('avatars').remove([
        `${userId}/avatar.png`, `${userId}/avatar.jpg`, `${userId}/avatar.jpeg`, `${userId}/avatar.webp`
      ]);
      // Catalog
      const { data: catalogFiles } = await supabase.storage.from('catalog').list(userId);
      if (catalogFiles && catalogFiles.length > 0) {
        await supabase.storage.from('catalog').remove(catalogFiles.map(f => `${userId}/${f.name}`));
      }
      // Images
      const { data: imageFiles } = await supabase.storage.from('images').list(userId);
      if (imageFiles && imageFiles.length > 0) {
        await supabase.storage.from('images').remove(imageFiles.map(f => `${userId}/${f.name}`));
      }
      // Proposal photos
      const { data: proposalPhotos } = await supabase.storage.from('proposal-photos').list(userId);
      if (proposalPhotos && proposalPhotos.length > 0) {
        await supabase.storage.from('proposal-photos').remove(proposalPhotos.map(f => `${userId}/${f.name}`));
      }
      console.log('Storage limpo');
    } catch (storageError) {
      console.log('Erro ao limpar storage (continuando):', storageError);
    }

    // 3. Deletar dados das tabelas
    try {
      // Primeiro pegar IDs das proposals para deletar proposal_items
      const { data: proposals } = await supabase.from('proposals').select('id').eq('user_id', userId);
      const proposalIds = proposals?.map(p => p.id) || [];

      if (proposalIds.length > 0) {
        await supabase.from('proposal_items').delete().in('proposal_id', proposalIds);
      }

      await supabase.from('notifications').delete().eq('user_id', userId);
      await supabase.from('contracts').delete().eq('user_id', userId);
      await supabase.from('proposals').delete().eq('user_id', userId);
      await supabase.from('proposal_settings').delete().eq('user_id', userId);
      await supabase.from('proposal_templates').delete().eq('user_id', userId);
      await supabase.from('payments').delete().eq('user_id', userId);
      await supabase.from('payment_history').delete().eq('user_id', userId);
      await supabase.from('clients').delete().eq('user_id', userId);
      await supabase.from('profiles').delete().eq('user_id', userId);
      console.log('Dados das tabelas deletados');
    } catch (dbError) {
      console.log('Erro ao deletar dados (continuando):', dbError);
    }

    // 4. Deletar usuário do Auth (usando admin API)
    const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);

    if (deleteError) {
      console.error('Erro ao deletar usuário do Auth:', deleteError);
      return res.status(500).json({ error: 'Erro ao deletar usuário da autenticação' });
    }

    console.log('Usuário deletado do Auth com sucesso');

    return res.status(200).json({
      success: true,
      message: 'Conta deletada com sucesso',
    });

  } catch (error) {
    console.error('Erro ao deletar conta:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}
