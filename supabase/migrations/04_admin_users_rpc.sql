-- Função RPC para admin buscar usuários com email
-- Execute no SQL Editor do Supabase

-- Dropar função antiga se existir
DROP FUNCTION IF EXISTS get_admin_users();

-- Criar função que retorna profiles com email do auth.users
CREATE OR REPLACE FUNCTION get_admin_users()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  email text,
  full_name text,
  plan text,
  plan_status text,
  created_at timestamptz,
  plan_started_at timestamptz,
  plan_expires_at timestamptz,
  asaas_customer_id text,
  asaas_subscription_id text,
  company_name text,
  phone text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verificar se o usuário é admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid()
    AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'Acesso não autorizado';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.user_id,
    COALESCE(u.email, p.full_name || '@email.com') as email,
    p.full_name,
    p.plan,
    p.plan_status,
    p.created_at,
    p.plan_started_at,
    p.plan_expires_at,
    p.asaas_customer_id,
    p.asaas_subscription_id,
    p.company_name,
    p.phone
  FROM profiles p
  LEFT JOIN auth.users u ON p.user_id = u.id
  ORDER BY p.created_at DESC;
END;
$$;

-- Grant para usuários autenticados poderem chamar
GRANT EXECUTE ON FUNCTION get_admin_users() TO authenticated;
