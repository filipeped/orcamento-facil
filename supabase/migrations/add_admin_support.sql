-- Migration: Adicionar suporte a admin
-- Execute no Supabase Dashboard > SQL Editor

-- 1. Adicionar campo is_admin na tabela profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- 2. Criar indice para consultas de admin
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON profiles(is_admin) WHERE is_admin = TRUE;

-- 3. Definir seu usuario como admin (substitua pelo seu email)
UPDATE profiles
SET is_admin = TRUE
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'filipegmaciel@gmail.com'
);

-- 4. Criar tabela de cupons se nao existir
CREATE TABLE IF NOT EXISTS coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  discount_percent INTEGER NOT NULL CHECK (discount_percent > 0 AND discount_percent <= 100),
  max_uses INTEGER DEFAULT NULL,
  current_uses INTEGER DEFAULT 0,
  valid_until TIMESTAMPTZ DEFAULT NULL,
  plans TEXT[] DEFAULT ARRAY['essential', 'pro'],
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Criar tabela de webhook_logs se nao existir
CREATE TABLE IF NOT EXISTS webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(20) DEFAULT 'received',
  error_message TEXT DEFAULT NULL,
  processed_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. RLS Policies para admins

-- Profiles: Admin pode ver todos
DROP POLICY IF EXISTS "Admin can view all profiles" ON profiles;
CREATE POLICY "Admin can view all profiles" ON profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid() AND p.is_admin = TRUE
    )
  );

-- Profiles: Admin pode atualizar todos
DROP POLICY IF EXISTS "Admin can update all profiles" ON profiles;
CREATE POLICY "Admin can update all profiles" ON profiles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid() AND p.is_admin = TRUE
    )
  );

-- Coupons: Somente admins podem gerenciar
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access to coupons" ON coupons;
CREATE POLICY "Admin full access to coupons" ON coupons
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid() AND p.is_admin = TRUE
    )
  );

-- Coupons: Usuarios podem verificar cupons ativos (para checkout)
DROP POLICY IF EXISTS "Users can check active coupons" ON coupons;
CREATE POLICY "Users can check active coupons" ON coupons
  FOR SELECT
  USING (active = TRUE);

-- Webhook logs: Somente admins
ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access to webhook_logs" ON webhook_logs;
CREATE POLICY "Admin full access to webhook_logs" ON webhook_logs
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid() AND p.is_admin = TRUE
    )
  );

-- Payments: Admin pode ver todos
DROP POLICY IF EXISTS "Admin can view all payments" ON payments;
CREATE POLICY "Admin can view all payments" ON payments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid() AND p.is_admin = TRUE
    )
  );

-- 7. Funcao para buscar estatisticas de admin
CREATE OR REPLACE FUNCTION get_admin_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  -- Verificar se o usuario e admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_admin = TRUE
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT json_build_object(
    'total_users', (SELECT COUNT(*) FROM profiles),
    'paying_users', (SELECT COUNT(*) FROM profiles WHERE plan IN ('essential', 'pro') AND plan_status = 'active'),
    'new_users_30d', (SELECT COUNT(*) FROM profiles WHERE created_at > NOW() - INTERVAL '30 days'),
    'cancelled_30d', (SELECT COUNT(*) FROM profiles WHERE plan_status = 'cancelled' AND updated_at > NOW() - INTERVAL '30 days'),
    'mrr', (
      SELECT COALESCE(SUM(
        CASE
          WHEN plan = 'essential' THEN 47
          WHEN plan = 'pro' THEN 97
          ELSE 0
        END
      ), 0)
      FROM profiles
      WHERE plan_status = 'active' AND plan IN ('essential', 'pro')
    ),
    'month_revenue', (
      SELECT COALESCE(SUM(amount), 0)
      FROM payments
      WHERE status = 'confirmed' AND created_at >= DATE_TRUNC('month', NOW())
    ),
    'plan_distribution', (
      SELECT json_agg(json_build_object('plan', plan, 'count', cnt))
      FROM (
        SELECT plan, COUNT(*) as cnt
        FROM profiles
        WHERE plan_status = 'active'
        GROUP BY plan
      ) sub
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- 8. Funcao para buscar MRR historico (6 meses)
CREATE OR REPLACE FUNCTION get_mrr_history()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  -- Verificar se o usuario e admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_admin = TRUE
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT json_agg(json_build_object('month', month, 'mrr', mrr))
  INTO result
  FROM (
    SELECT
      TO_CHAR(DATE_TRUNC('month', created_at), 'Mon') as month,
      SUM(CASE
        WHEN plan = 'essential' THEN 47
        WHEN plan = 'pro' THEN 97
        ELSE 0
      END) as mrr
    FROM profiles
    WHERE plan_status = 'active'
      AND plan IN ('essential', 'pro')
      AND created_at >= NOW() - INTERVAL '6 months'
    GROUP BY DATE_TRUNC('month', created_at)
    ORDER BY DATE_TRUNC('month', created_at)
  ) sub;

  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- Comentario final
COMMENT ON COLUMN profiles.is_admin IS 'Define se o usuario tem acesso ao painel administrativo';
