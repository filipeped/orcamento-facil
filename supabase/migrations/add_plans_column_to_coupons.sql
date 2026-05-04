-- Adicionar coluna plans na tabela coupons (se não existir)
ALTER TABLE coupons
ADD COLUMN IF NOT EXISTS plans TEXT[] DEFAULT ARRAY['essential', 'pro'];

-- Comentário
COMMENT ON COLUMN coupons.plans IS 'Array de planos onde o cupom é válido (essential, pro)';
