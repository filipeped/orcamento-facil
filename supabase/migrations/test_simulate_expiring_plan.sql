-- SIMULAÇÃO: Configurar usuário com plano expirando AMANHÃ
-- Usuário: digitalpaisagismo@gmail.com

-- 1. Buscar o user_id pelo email na tabela auth.users
-- 2. Atualizar o profile para simular plano expirando amanhã

-- Primeiro, vamos ver o usuário atual
SELECT
  p.user_id,
  p.full_name,
  p.phone,
  p.plan,
  p.plan_status,
  p.plan_expires_at,
  u.email
FROM profiles p
JOIN auth.users u ON u.id = p.user_id
WHERE u.email = 'digitalpaisagismo@gmail.com';

-- Agora, simular que ele tem plano Start expirando AMANHÃ
UPDATE profiles
SET
  plan = 'essential',
  plan_status = 'active',
  plan_expires_at = NOW() + INTERVAL '1 day'
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'digitalpaisagismo@gmail.com'
);

-- Verificar como ficou
SELECT
  p.full_name,
  p.phone,
  p.plan,
  p.plan_status,
  p.plan_expires_at,
  p.plan_expires_at - NOW() as tempo_restante
FROM profiles p
JOIN auth.users u ON u.id = p.user_id
WHERE u.email = 'digitalpaisagismo@gmail.com';
