-- Migration: Criar view para admin ver email real dos usuários
-- Esta view faz JOIN entre profiles e auth.users para obter o email

-- Primeiro, criar uma função segura que só admins podem usar
CREATE OR REPLACE FUNCTION get_user_email(user_uuid UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email TEXT;
BEGIN
  -- Verificar se o usuário atual é admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid()
    AND is_admin = true
  ) THEN
    RETURN NULL;
  END IF;

  -- Buscar email do usuário
  SELECT email INTO user_email
  FROM auth.users
  WHERE id = user_uuid;

  RETURN user_email;
END;
$$;

-- Criar view para listar usuários com email (apenas para admins)
CREATE OR REPLACE VIEW admin_users_view AS
SELECT
  p.id,
  p.user_id,
  p.full_name,
  p.company_name,
  p.phone,
  p.plan,
  p.plan_status,
  p.created_at,
  p.updated_at,
  p.plan_started_at,
  p.plan_expires_at,
  p.asaas_customer_id,
  p.asaas_subscription_id,
  get_user_email(p.user_id) as email
FROM profiles p;

-- Dar permissão de SELECT na view para usuários autenticados
-- (a função get_user_email já verifica se é admin)
GRANT SELECT ON admin_users_view TO authenticated;

-- Criar função RPC alternativa para buscar usuários com email
-- (útil se a view não funcionar bem com RLS)
CREATE OR REPLACE FUNCTION get_admin_users()
RETURNS TABLE (
  id UUID,
  user_id UUID,
  full_name TEXT,
  company_name TEXT,
  phone TEXT,
  email TEXT,
  plan TEXT,
  plan_status TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  plan_started_at TIMESTAMPTZ,
  plan_expires_at TIMESTAMPTZ,
  asaas_customer_id TEXT,
  asaas_subscription_id TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verificar se o usuário atual é admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'Acesso negado: usuário não é admin';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.user_id,
    p.full_name,
    p.company_name,
    p.phone,
    u.email,
    p.plan,
    p.plan_status,
    p.created_at,
    p.updated_at,
    p.plan_started_at,
    p.plan_expires_at,
    p.asaas_customer_id,
    p.asaas_subscription_id
  FROM profiles p
  LEFT JOIN auth.users u ON u.id = p.user_id
  ORDER BY p.created_at DESC;
END;
$$;

-- Comentário explicativo
COMMENT ON FUNCTION get_admin_users() IS 'Retorna lista de usuários com email para o painel admin. Apenas admins podem usar.';
COMMENT ON FUNCTION get_user_email(UUID) IS 'Retorna email de um usuário específico. Apenas admins podem usar.';
