-- JARDINEI - Schema para Assinaturas
-- Execute este SQL no Supabase SQL Editor

-- Adicionar campos de assinatura na tabela profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plan_status TEXT DEFAULT 'active';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS mp_subscription_id TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS mp_customer_id TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plan_started_at TIMESTAMP WITH TIME ZONE;

-- Criar tabela de histórico de pagamentos
CREATE TABLE IF NOT EXISTS payment_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  mp_payment_id TEXT,
  mp_subscription_id TEXT,
  amount NUMERIC(10, 2),
  status TEXT NOT NULL, -- approved, pending, rejected, refunded
  plan TEXT,
  payment_type TEXT, -- subscription, one_time
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_profiles_plan ON profiles(plan);
CREATE INDEX IF NOT EXISTS idx_profiles_plan_status ON profiles(plan_status);
CREATE INDEX IF NOT EXISTS idx_profiles_mp_subscription_id ON profiles(mp_subscription_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_user_id ON payment_history(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_mp_subscription_id ON payment_history(mp_subscription_id);

-- RLS para payment_history
ALTER TABLE payment_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own payment history"
  ON payment_history FOR SELECT
  USING (auth.uid() = user_id);

-- Comentários sobre os campos
COMMENT ON COLUMN profiles.plan IS 'Plano atual: free, essential, pro';
COMMENT ON COLUMN profiles.plan_status IS 'Status: active, pending, cancelled, paused, expired';
COMMENT ON COLUMN profiles.mp_subscription_id IS 'ID da assinatura no Mercado Pago';
COMMENT ON COLUMN profiles.mp_customer_id IS 'ID do cliente no Mercado Pago';
COMMENT ON COLUMN profiles.plan_expires_at IS 'Data de expiração do plano (para cobranças atrasadas)';
