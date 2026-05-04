-- Criar tabela de cupons de desconto
CREATE TABLE IF NOT EXISTS coupons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  discount_percent INTEGER NOT NULL CHECK (discount_percent > 0 AND discount_percent <= 100),
  max_uses INTEGER DEFAULT NULL,
  current_uses INTEGER DEFAULT 0,
  valid_until TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  plans TEXT[] DEFAULT ARRAY['essential', 'pro'],
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índice para busca rápida por código
CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupons_active ON coupons(active);

-- RLS: Habilitar
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;

-- Policy: Admins podem fazer tudo
CREATE POLICY "Admins can manage coupons" ON coupons
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Policy: APIs podem ler cupons ativos (para validação)
CREATE POLICY "Service role can read coupons" ON coupons
  FOR SELECT
  TO service_role
  USING (true);

-- Policy: Permitir leitura de cupons ativos para validação no frontend
CREATE POLICY "Anyone can read active coupons" ON coupons
  FOR SELECT
  TO authenticated
  USING (active = true);

-- Comentário
COMMENT ON TABLE coupons IS 'Cupons de desconto para assinaturas';
