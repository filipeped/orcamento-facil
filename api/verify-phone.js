/**
 * API de verificação de telefone via WhatsApp
 * POST /api/verify-phone
 *
 * Actions:
 * - send: Envia código de verificação via WhatsApp
 * - verify: Verifica se o código está correto
 * - check: Verifica se telefone já está cadastrado
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Evolution API (WhatsApp)
const EVOLUTION_URL = process.env.EVOLUTION_URL || 'https://digitalpaisagismo-evolution.cloudfy.live';
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE || 'jardinei';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;

// CORS
const ALLOWED_ORIGINS = [
  'https://www.fechaqui.com',
  'https://fechaqui.com',
  'https://www.jardinei.com',
  'https://jardinei.com',
  'https://jardinei-com.vercel.app',
  'https://www.orcafacil.com',
  'https://orcafacil.com',
  'http://localhost:8080',
  'http://localhost:3000',
];

// Gerar código de 4 dígitos
function generateCode() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// Formatar telefone para padrão internacional
// Aceita: 4789136827, 47989136827, 554789136827, 5547989136827
function formatPhone(phone) {
  let cleaned = phone.replace(/\D/g, '');

  // Remover 55 se presente para normalizar
  if (cleaned.startsWith('55') && cleaned.length >= 12) {
    cleaned = cleaned.slice(2);
  }

  // Se tem 10 dígitos (sem o 9), adicionar o 9 após DDD
  // Ex: 4789136827 -> 47989136827
  if (cleaned.length === 10) {
    cleaned = cleaned.slice(0, 2) + '9' + cleaned.slice(2);
  }

  // Adicionar 55 na frente
  if (cleaned.length === 11) {
    cleaned = '55' + cleaned;
  }

  return cleaned;
}

// Gerar variações do telefone para busca no banco
// Retorna array com todas as possíveis formas de salvar o telefone
function getPhoneVariations(phone) {
  let cleaned = phone.replace(/\D/g, '');

  // Remover 55 se presente
  if (cleaned.startsWith('55') && cleaned.length >= 12) {
    cleaned = cleaned.slice(2);
  }

  const variations = [];

  // Se tem 10 dígitos (sem o 9)
  if (cleaned.length === 10) {
    const withNine = cleaned.slice(0, 2) + '9' + cleaned.slice(2);
    variations.push(
      cleaned,                    // 4789136827 (10 dígitos)
      '55' + cleaned,             // 554789136827 (12 dígitos)
      withNine,                   // 47989136827 (11 dígitos)
      '55' + withNine             // 5547989136827 (13 dígitos)
    );
  }
  // Se tem 11 dígitos (com o 9)
  else if (cleaned.length === 11) {
    const withoutNine = cleaned.slice(0, 2) + cleaned.slice(3);
    variations.push(
      cleaned,                    // 47989136827 (11 dígitos)
      '55' + cleaned,             // 5547989136827 (13 dígitos)
      withoutNine,                // 4789136827 (10 dígitos)
      '55' + withoutNine          // 554789136827 (12 dígitos)
    );
  }
  // Outros casos
  else {
    variations.push(cleaned);
    if (!cleaned.startsWith('55')) {
      variations.push('55' + cleaned);
    }
  }

  return [...new Set(variations)]; // Remove duplicatas
}

// Enviar código via WhatsApp
async function sendWhatsAppCode(phone, code, brand = 'jardinei') {
  if (!EVOLUTION_API_KEY) {
    console.error('❌ EVOLUTION_API_KEY não configurada');
    return false;
  }

  const brandLabel = brand === 'fechaqui' ? 'FechaAqui' : 'JARDINEI';
  const phoneNumber = formatPhone(phone);
  const message = `${brand === 'jardinei' ? '🌱 ' : ''}*${brandLabel}*

Seu código de verificação: *${code}*

Válido por 5 minutos.

Se você não solicitou este código, ignore esta mensagem.`;

  try {
    const response = await fetch(`${EVOLUTION_URL}/message/sendText/${EVOLUTION_INSTANCE}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVOLUTION_API_KEY,
      },
      body: JSON.stringify({ number: phoneNumber, text: message }),
    });

    const result = await response.json();
    console.log('📱 Código enviado para:', phoneNumber, '| Status:', response.ok);
    return response.ok;
  } catch (error) {
    console.error('❌ Erro ao enviar WhatsApp:', error);
    return false;
  }
}

// Enviar mensagem de boas-vindas após cadastro
async function sendWelcomeMessage(phone, userName, brand = 'jardinei') {
  if (!EVOLUTION_API_KEY) {
    console.error('❌ EVOLUTION_API_KEY não configurada');
    return false;
  }

  const phoneNumber = formatPhone(phone);
  const firstName = userName ? userName.split(' ')[0] : (brand === 'jardinei' ? 'Jardineiro' : '');

  const message = brand === 'fechaqui'
    ? `*Bem-vindo ao FechaAqui${firstName ? ', ' + firstName : ''}!* 🎉

Sua conta foi criada com sucesso!

Com o FechaAqui você pode:
✅ Criar propostas profissionais em minutos
✅ Gerenciar seus clientes
✅ Enviar por link ou PDF
✅ Acompanhar status (visto / aprovado)

🚀 *Comece agora:* ${process.env.FECHAQUI_PUBLIC_DOMAIN || 'https://www.fechaqui.com'}/orcamentos

Precisa de ajuda? Responda esta mensagem que nosso suporte vai te atender!

_Equipe FechaAqui_`
    : `🌿 *Bem-vindo ao JARDINEI, ${firstName}!* 🎉

Sua conta foi criada com sucesso!

Com o Jardinei você pode:
✅ Criar propostas profissionais em minutos
✅ Gerenciar seus clientes
✅ Acessar catálogo com +800 plantas
✅ Acompanhar seus orçamentos

🚀 *Comece agora:* ${process.env.JARDINEI_PUBLIC_DOMAIN || 'https://www.jardinei.com'}/propostas

Precisa de ajuda? Responda esta mensagem que nosso suporte vai te atender!

_Equipe Jardinei_ 🌱`;

  try {
    const response = await fetch(`${EVOLUTION_URL}/message/sendText/${EVOLUTION_INSTANCE}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVOLUTION_API_KEY,
      },
      body: JSON.stringify({ number: phoneNumber, text: message }),
    });

    console.log('🎉 Mensagem de boas-vindas enviada para:', phoneNumber, '| Status:', response.ok);
    return response.ok;
  } catch (error) {
    console.error('❌ Erro ao enviar boas-vindas:', error);
    return false;
  }
}

export default async function handler(req, res) {
  // CORS
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

  // Detecta brand pelo origin/referer; default JARDINEI (legado)
  const reqOrigin = (req.headers.origin || req.headers.referer || '').toLowerCase();
  const brand = reqOrigin.includes('fechaqui') ? 'fechaqui' : 'jardinei';

  const { action, phone, code } = req.body;

  if (!phone) {
    return res.status(400).json({ error: 'Telefone é obrigatório' });
  }

  const formattedPhone = formatPhone(phone);
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // ============================================
  // ACTION: CHECK - Verifica se telefone já existe
  // ============================================
  if (action === 'check') {
    try {
      // Buscar todas as variações possíveis do telefone
      const variations = getPhoneVariations(phone);
      const orConditions = variations.map(v => `phone.eq.${v}`).join(',');

      const { data: existingProfile, error } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .or(orConditions)
        .limit(1)
        .single();

      if (existingProfile) {
        return res.status(200).json({
          exists: true,
          message: 'Este WhatsApp já está cadastrado. Faça login ou recupere sua senha.'
        });
      }

      return res.status(200).json({ exists: false });
    } catch (error) {
      console.error('Erro ao verificar telefone:', error);
      return res.status(500).json({ error: 'Erro ao verificar telefone' });
    }
  }

  // ============================================
  // ACTION: SEND - Envia código de verificação
  // ============================================
  if (action === 'send') {
    try {
      // Verificar se telefone já existe (todas as variações)
      const variations = getPhoneVariations(phone);
      const orConditions = variations.map(v => `phone.eq.${v}`).join(',');

      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('user_id')
        .or(orConditions)
        .limit(1)
        .single();

      if (existingProfile) {
        return res.status(400).json({
          error: 'Este WhatsApp já está cadastrado',
          exists: true
        });
      }

      // Verificar rate limit (max 8 códigos por hora por telefone)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data: recentCodes, error: countError } = await supabase
        .from('verification_codes')
        .select('id')
        .eq('phone', formattedPhone)
        .gte('created_at', oneHourAgo);

      if (recentCodes && recentCodes.length >= 8) {
        return res.status(429).json({
          error: 'Muitas tentativas. Aguarde 1 hora.'
        });
      }

      // Gerar código
      const verificationCode = generateCode();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutos

      // Salvar código no banco
      const { error: insertError } = await supabase
        .from('verification_codes')
        .insert({
          phone: formattedPhone,
          code: verificationCode,
          expires_at: expiresAt,
          attempts: 0,
        });

      if (insertError) {
        console.error('Erro ao salvar código:', insertError);
        return res.status(500).json({ error: 'Erro ao gerar código' });
      }

      // Enviar via WhatsApp
      const sent = await sendWhatsAppCode(formattedPhone, verificationCode, brand);

      if (!sent) {
        return res.status(500).json({
          error: 'Não foi possível enviar o código. Verifique se o número tem WhatsApp.'
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Código enviado via WhatsApp',
        expiresIn: 300 // 5 minutos em segundos
      });

    } catch (error) {
      console.error('Erro ao enviar código:', error);
      return res.status(500).json({ error: 'Erro ao enviar código' });
    }
  }

  // ============================================
  // ACTION: VERIFY - Verifica código
  // ============================================
  if (action === 'verify') {
    if (!code) {
      return res.status(400).json({ error: 'Código é obrigatório' });
    }

    try {
      // Buscar código válido mais recente
      const { data: verificationData, error: fetchError } = await supabase
        .from('verification_codes')
        .select('*')
        .eq('phone', formattedPhone)
        .eq('code', code)
        .eq('used', false)
        .gte('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (fetchError || !verificationData) {
        // Incrementar tentativas do código mais recente
        const { data: latestCode } = await supabase
          .from('verification_codes')
          .select('id, attempts')
          .eq('phone', formattedPhone)
          .eq('used', false)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (latestCode) {
          await supabase
            .from('verification_codes')
            .update({ attempts: latestCode.attempts + 1 })
            .eq('id', latestCode.id);

          if (latestCode.attempts >= 7) {
            return res.status(400).json({
              error: 'Código incorreto. Solicite um novo código.',
              maxAttempts: true
            });
          }
        }

        return res.status(400).json({ error: 'Código inválido ou expirado' });
      }

      // Marcar código como usado
      await supabase
        .from('verification_codes')
        .update({ used: true })
        .eq('id', verificationData.id);

      // Gerar token de verificação (válido por 10 minutos para completar cadastro)
      const verificationToken = `vt_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;

      // Salvar token
      await supabase
        .from('verification_codes')
        .update({ verification_token: verificationToken })
        .eq('id', verificationData.id);

      // NÃO envia boas-vindas aqui - o usuário ainda não completou o cadastro
      // A mensagem será enviada após o cadastro completo (action: confirm-user ou send-welcome)

      return res.status(200).json({
        success: true,
        verified: true,
        verificationToken,
        phone: formattedPhone
      });

    } catch (error) {
      console.error('Erro ao verificar código:', error);
      return res.status(500).json({ error: 'Erro ao verificar código' });
    }
  }

  // ============================================
  // ACTION: CONFIRM-USER - Auto-confirma email do usuario
  // (usado quando o telefone já foi verificado via WhatsApp)
  // ============================================
  if (action === 'confirm-user') {
    const { email } = req.body;

    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Email inválido' });
    }

    try {
      // Aguardar um pouco para garantir que o usuário foi criado no banco
      await new Promise(resolve => setTimeout(resolve, 500));

      // Buscar usuario pelo email (com paginação para ser mais eficiente)
      let user = null;
      let page = 1;
      const perPage = 100;

      // Tentar encontrar o usuário nas primeiras páginas
      while (!user && page <= 5) {
        const { data: { users }, error: listError } = await supabase.auth.admin.listUsers({
          page,
          perPage,
        });

        if (listError) {
          console.error('Erro ao listar usuarios (página ' + page + '):', listError);
          break;
        }

        user = users.find(u => u.email === email);

        if (users.length < perPage) break; // Última página
        page++;
      }

      if (!user) {
        console.error('Usuário não encontrado após busca:', email);
        return res.status(404).json({ error: 'Usuário não encontrado. Tente fazer login.' });
      }

      // Auto-confirmar email
      const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
        email_confirm: true,
      });

      if (updateError) {
        console.error('Erro ao confirmar usuario:', updateError);
        return res.status(500).json({ error: 'Erro ao confirmar' });
      }

      // Marcar telefone como verificado no perfil (upsert para garantir que funciona mesmo se perfil não existe)
      const userName = user.user_metadata?.full_name || user.user_metadata?.name || '';
      await supabase
        .from('profiles')
        .upsert({
          user_id: user.id,
          full_name: userName,
          phone_verified: true,
          phone: formattedPhone
        }, { onConflict: 'user_id' });

      // Enviar mensagem de boas-vindas via WhatsApp
      sendWelcomeMessage(formattedPhone, userName, brand); // Não aguarda para não atrasar o cadastro

      console.log('✅ Email auto-confirmado para:', email, '| Phone:', formattedPhone);
      return res.status(200).json({ success: true, userId: user.id });
    } catch (error) {
      console.error('Erro ao confirmar usuario:', error);
      return res.status(500).json({ error: 'Erro ao confirmar' });
    }
  }

  // ============================================
  // ACTION: SEND-WELCOME - Envia mensagem de boas-vindas
  // ============================================
  if (action === 'send-welcome') {
    const { name } = req.body;

    try {
      await sendWelcomeMessage(formattedPhone, name || '', brand);
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Erro ao enviar boas-vindas:', error);
      return res.status(500).json({ error: 'Erro ao enviar mensagem' });
    }
  }

  // ============================================
  // ACTION: SEND-RECOVERY - Envia código para recuperar senha (telefone deve existir)
  // ============================================
  if (action === 'send-recovery') {
    try {
      // Verificar se telefone EXISTE (todas as variações)
      const variations = getPhoneVariations(phone);
      const orConditions = variations.map(v => `phone.eq.${v}`).join(',');
      console.log('🔍 Buscando telefone com variações:', variations);

      const { data: existingProfile, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, full_name, phone')
        .or(orConditions)
        .limit(1)
        .single();

      if (profileError || !existingProfile) {
        return res.status(404).json({
          error: 'WhatsApp não encontrado. Verifique o número ou crie uma conta.',
          notFound: true
        });
      }

      // Verificar rate limit (max 8 códigos por hora por telefone)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data: recentCodes } = await supabase
        .from('verification_codes')
        .select('id')
        .eq('phone', formattedPhone)
        .gte('created_at', oneHourAgo);

      if (recentCodes && recentCodes.length >= 8) {
        return res.status(429).json({
          error: 'Muitas tentativas. Aguarde 1 hora.'
        });
      }

      // Gerar código
      const verificationCode = generateCode();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutos

      // Salvar código no banco
      const { error: insertError } = await supabase
        .from('verification_codes')
        .insert({
          phone: formattedPhone,
          code: verificationCode,
          expires_at: expiresAt,
          attempts: 0,
        });

      if (insertError) {
        console.error('Erro ao salvar código:', insertError);
        return res.status(500).json({ error: 'Erro ao gerar código' });
      }

      // Mensagem customizada para recuperação (parametrizada por brand)
      const brandLabel = brand === 'fechaqui' ? 'FechaAqui' : 'JARDINEI';
      const messagePrefix = brand === 'jardinei' ? '🌱 ' : '';
      const message = `${messagePrefix}*${brandLabel}*

Seu código para recuperar a senha: *${verificationCode}*

Válido por 5 minutos.

Se você não solicitou, ignore esta mensagem.`;

      const phoneNumber = formatPhone(phone);
      const response = await fetch(`${EVOLUTION_URL}/message/sendText/${EVOLUTION_INSTANCE}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': EVOLUTION_API_KEY,
        },
        body: JSON.stringify({ number: phoneNumber, text: message }),
      });

      if (!response.ok) {
        return res.status(500).json({
          error: 'Não foi possível enviar o código. Verifique se o número tem WhatsApp.'
        });
      }

      console.log('📱 Código de recuperação enviado para:', phoneNumber);
      return res.status(200).json({
        success: true,
        message: 'Código enviado via WhatsApp',
        expiresIn: 300,
        userId: existingProfile.user_id // Para usar no reset
      });

    } catch (error) {
      console.error('Erro ao enviar código de recuperação:', error);
      return res.status(500).json({ error: 'Erro ao enviar código' });
    }
  }

  // ============================================
  // ACTION: VERIFY-RECOVERY - Verifica código de recuperação
  // ============================================
  if (action === 'verify-recovery') {
    if (!code) {
      return res.status(400).json({ error: 'Código é obrigatório' });
    }

    try {
      // Buscar código válido mais recente (tipo recovery)
      const { data: verificationData, error: fetchError } = await supabase
        .from('verification_codes')
        .select('*')
        .eq('phone', formattedPhone)
        .eq('code', code)
        .eq('used', false)
        .gte('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (fetchError || !verificationData) {
        // Incrementar tentativas
        const { data: latestCode } = await supabase
          .from('verification_codes')
          .select('id, attempts')
          .eq('phone', formattedPhone)
          .eq('used', false)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (latestCode) {
          await supabase
            .from('verification_codes')
            .update({ attempts: latestCode.attempts + 1 })
            .eq('id', latestCode.id);

          if (latestCode.attempts >= 7) {
            return res.status(400).json({
              error: 'Código incorreto. Solicite um novo código.',
              maxAttempts: true
            });
          }
        }

        return res.status(400).json({ error: 'Código inválido ou expirado' });
      }

      // Marcar código como usado
      await supabase
        .from('verification_codes')
        .update({ used: true })
        .eq('id', verificationData.id);

      // Buscar user_id pelo telefone (todas as variações)
      const profileVariations = getPhoneVariations(phone);
      const profileOrConditions = profileVariations.map(v => `phone.eq.${v}`).join(',');

      const { data: profile } = await supabase
        .from('profiles')
        .select('user_id')
        .or(profileOrConditions)
        .limit(1)
        .single();

      if (!profile) {
        return res.status(404).json({ error: 'Conta não encontrada' });
      }

      // Gerar token de reset (válido por 10 minutos)
      const resetToken = `rt_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;

      // Salvar token no banco
      await supabase
        .from('verification_codes')
        .update({ verification_token: resetToken })
        .eq('id', verificationData.id);

      console.log('✅ Código de recuperação verificado para:', formattedPhone);
      return res.status(200).json({
        success: true,
        verified: true,
        resetToken,
        userId: profile.user_id
      });

    } catch (error) {
      console.error('Erro ao verificar código de recuperação:', error);
      return res.status(500).json({ error: 'Erro ao verificar código' });
    }
  }

  // ============================================
  // ACTION: RESET-PASSWORD - Troca a senha do usuário
  // ============================================
  if (action === 'reset-password') {
    const { newPassword, userId, resetToken } = req.body;

    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'Senha deve ter pelo menos 8 caracteres' });
    }

    if (!userId) {
      return res.status(400).json({ error: 'Usuário inválido' });
    }

    try {
      // Verificar se o token de reset é válido
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const { data: tokenData, error: tokenError } = await supabase
        .from('verification_codes')
        .select('id')
        .eq('verification_token', resetToken)
        .eq('used', true)
        .gte('created_at', tenMinutesAgo)
        .limit(1)
        .single();

      if (tokenError || !tokenData) {
        return res.status(400).json({ error: 'Token expirado. Solicite um novo código.' });
      }

      // Atualizar senha via Admin API
      const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
        password: newPassword,
      });

      if (updateError) {
        console.error('Erro ao atualizar senha:', updateError);
        return res.status(500).json({ error: 'Erro ao atualizar senha' });
      }

      // Invalidar o token usado
      await supabase
        .from('verification_codes')
        .update({ verification_token: null })
        .eq('id', tokenData.id);

      console.log('✅ Senha atualizada para user:', userId);
      return res.status(200).json({ success: true });

    } catch (error) {
      console.error('Erro ao resetar senha:', error);
      return res.status(500).json({ error: 'Erro ao atualizar senha' });
    }
  }

  // ============================================
  // ACTION: ADMIN-RESET-PASSWORD - Admin redefine senha do usuário
  // Gera senha aleatória de 6 dígitos e retorna para o admin
  // ============================================
  if (action === 'admin-reset-password') {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId é obrigatório' });
    }

    // Verificar se Service Role Key está configurada
    if (!supabaseServiceKey) {
      console.error('❌ SUPABASE_SERVICE_ROLE_KEY não configurada!');
      return res.status(500).json({ error: 'Configuração do servidor incompleta (SERVICE_ROLE_KEY)' });
    }

    try {
      // Verificar admin via JWT (não confiar no body)
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: 'Authorization header required' });
      }
      const token = authHeader.replace('Bearer ', '');
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !authUser) {
        return res.status(401).json({ error: 'Token inválido' });
      }

      const { data: adminProfile, error: adminError } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('user_id', authUser.id)
        .single();

      if (adminError || !adminProfile?.is_admin) {
        return res.status(403).json({ error: 'Apenas administradores podem redefinir senhas' });
      }

      // Gerar senha aleatória de 6 dígitos numéricos
      const newPassword = Math.floor(100000 + Math.random() * 900000).toString();

      console.log('🔑 Admin resetando senha para user:', userId);

      // Atualizar senha via Admin API
      const { data: updateData, error: updateError } = await supabase.auth.admin.updateUserById(userId, {
        password: newPassword,
      });

      if (updateError) {
        console.error('❌ Erro ao atualizar senha:', updateError);
        return res.status(500).json({ error: 'Erro ao atualizar senha: ' + updateError.message });
      }

      console.log('✅ Senha redefinida pelo admin para user:', userId, '| Resposta:', JSON.stringify(updateData));
      return res.status(200).json({
        success: true,
        newPassword, // Retorna para o admin mostrar/copiar
      });

    } catch (error) {
      console.error('Erro ao resetar senha (admin):', error);
      return res.status(500).json({ error: 'Erro ao atualizar senha' });
    }
  }

  // ============================================
  // ACTION: FIND-EMAIL-BY-PHONE - Busca email real pelo telefone (para login)
  // ============================================
  if (action === 'find-email-by-phone') {
    try {
      // Buscar todas as variações possíveis do telefone
      const variations = getPhoneVariations(phone);
      const orConditions = variations.map(v => `phone.eq.${v}`).join(',');

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('user_id')
        .or(orConditions)
        .limit(1)
        .single();

      if (profileError || !profile) {
        return res.status(404).json({ error: 'Telefone não encontrado' });
      }

      // Buscar email real do usuário no auth
      const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(profile.user_id);

      if (userError || !user) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
      }

      // Retornar o email real (não o telefone@fechaqui.app placeholder)
      console.log('📱 Email encontrado pelo telefone:', user.email);
      return res.status(200).json({
        success: true,
        email: user.email
      });

    } catch (error) {
      console.error('Erro ao buscar email por telefone:', error);
      return res.status(500).json({ error: 'Erro ao buscar email' });
    }
  }

  return res.status(400).json({ error: 'Action inválida' });
}
