-- Adicionar coluna type para diferenciar códigos de cadastro e recuperação
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'verification_codes' AND column_name = 'type'
  ) THEN
    ALTER TABLE verification_codes ADD COLUMN type TEXT DEFAULT 'signup';
  END IF;
END $$;

COMMENT ON COLUMN verification_codes.type IS 'Tipo do código: signup (cadastro) ou recovery (recuperação de senha)';
