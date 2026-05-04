-- Tabela de Pagamentos/Assinaturas
-- Execute este SQL no Supabase SQL Editor

CREATE TABLE IF NOT EXISTS payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('paid', 'pending', 'failed', 'refunded')),
  plan_name TEXT NOT NULL,
  period TEXT CHECK (period IN ('monthly', 'annual')),
  payment_method TEXT,
  external_id TEXT, -- ID do Mercado Pago ou outro gateway
  invoice_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
);

-- Tabela de Assinaturas Ativas
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  plan TEXT NOT NULL CHECK (plan IN ('free', 'essential', 'pro')) DEFAULT 'free',
  status TEXT NOT NULL CHECK (status IN ('active', 'canceled', 'paused', 'expired')) DEFAULT 'active',
  period TEXT CHECK (period IN ('monthly', 'annual')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  external_subscription_id TEXT, -- ID da assinatura no Mercado Pago
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(user_id, status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);

-- RLS (Row Level Security)
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Políticas para payments
CREATE POLICY "Users can view own payments"
  ON payments
  FOR SELECT
  USING (auth.uid() = user_id);

-- Políticas para subscriptions
CREATE POLICY "Users can view own subscription"
  ON subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Política para inserção de pagamentos (via webhook do Mercado Pago)
CREATE POLICY "System can insert payments"
  ON payments
  FOR INSERT
  WITH CHECK (true);

-- Política para atualização de assinaturas (via webhook)
CREATE POLICY "System can update subscriptions"
  ON subscriptions
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para subscriptions
DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER update_subscriptions_updated_at
    BEFORE UPDATE ON subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Inserir assinatura free padrão para usuários existentes
-- (Descomente se quiser criar assinaturas para usuários existentes)
-- INSERT INTO subscriptions (user_id, plan, status)
-- SELECT id, 'free', 'active' FROM auth.users
-- ON CONFLICT (user_id) DO NOTHING;
