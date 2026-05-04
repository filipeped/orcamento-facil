-- Ajustar expiração para amanhã às 12:00 (garante que cai no intervalo do cron)
UPDATE profiles
SET plan_expires_at = (CURRENT_DATE + INTERVAL '1 day' + INTERVAL '12 hours')
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'digitalpaisagismo@gmail.com'
);
