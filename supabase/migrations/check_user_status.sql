-- Verificar status do usuário digitalpaisagismo@gmail.com
SELECT
  p.full_name,
  p.phone,
  p.plan,
  p.plan_status,
  to_char(p.plan_expires_at, 'DD/MM/YYYY HH24:MI') as expira_em,
  CASE
    WHEN p.plan_expires_at IS NULL THEN 'Sem expiração'
    WHEN p.plan_expires_at < NOW() THEN 'EXPIRADO'
    WHEN p.plan_expires_at < NOW() + INTERVAL '1 day' THEN '⚠️ EXPIRA HOJE'
    WHEN p.plan_expires_at < NOW() + INTERVAL '2 days' THEN '🎁 EXPIRA AMANHÃ - CUPOM FICA10'
    WHEN p.plan_expires_at < NOW() + INTERVAL '4 days' THEN '⏰ EXPIRA EM 3 DIAS'
    ELSE 'OK'
  END as status_cupom
FROM profiles p
JOIN auth.users u ON u.id = p.user_id
WHERE u.email = 'digitalpaisagismo@gmail.com';
