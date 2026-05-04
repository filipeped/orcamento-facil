-- Tabela para códigos de verificação de telefone
CREATE TABLE IF NOT EXISTS verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  attempts INTEGER DEFAULT 0,
  verification_token TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index para buscar por telefone e código
CREATE INDEX IF NOT EXISTS idx_verification_codes_phone ON verification_codes(phone);
CREATE INDEX IF NOT EXISTS idx_verification_codes_phone_code ON verification_codes(phone, code);

-- Index para limpar códigos expirados
CREATE INDEX IF NOT EXISTS idx_verification_codes_expires ON verification_codes(expires_at);

-- RLS: Permitir apenas service_role (API) acessar
ALTER TABLE verification_codes ENABLE ROW LEVEL SECURITY;

-- Limpar códigos expirados automaticamente (job diário opcional)
-- DELETE FROM verification_codes WHERE expires_at < NOW() - INTERVAL '1 day';

-- Adicionar coluna phone_verified na tabela profiles (se não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'phone_verified'
  ) THEN
    ALTER TABLE profiles ADD COLUMN phone_verified BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Adicionar coluna proposals_sent_count para contar propostas enviadas (trial)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'proposals_sent_count'
  ) THEN
    ALTER TABLE profiles ADD COLUMN proposals_sent_count INTEGER DEFAULT 0;
  END IF;
END $$;

-- Adicionar coluna first_approval_at para saber quando teve primeira aprovação
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'first_approval_at'
  ) THEN
    ALTER TABLE profiles ADD COLUMN first_approval_at TIMESTAMPTZ;
  END IF;
END $$;

-- Adicionar coluna trial_ends_at para controlar fim do trial
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'trial_ends_at'
  ) THEN
    ALTER TABLE profiles ADD COLUMN trial_ends_at TIMESTAMPTZ;
  END IF;
END $$;

COMMENT ON TABLE verification_codes IS 'Códigos de verificação de telefone via WhatsApp';
COMMENT ON COLUMN verification_codes.phone IS 'Telefone no formato 55XXXXXXXXXXX';
COMMENT ON COLUMN verification_codes.code IS 'Código de 6 dígitos';
COMMENT ON COLUMN verification_codes.expires_at IS 'Expira em 5 minutos';
COMMENT ON COLUMN verification_codes.used IS 'Se o código já foi usado';
COMMENT ON COLUMN verification_codes.attempts IS 'Tentativas de verificação';
COMMENT ON COLUMN verification_codes.verification_token IS 'Token para completar cadastro após verificar';
