-- =============================================
-- TABELA DE ITENS DO CATÁLOGO
-- Execute cada bloco separadamente no Supabase SQL Editor
-- =============================================

-- 1. Criar tabela de itens do catálogo
CREATE TABLE IF NOT EXISTS catalog_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL DEFAULT 'Plantas',
  image_url TEXT,
  default_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  price_p DECIMAL(10,2),
  price_m DECIMAL(10,2),
  price_g DECIMAL(10,2),
  unit VARCHAR(20),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
