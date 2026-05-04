-- =============================================
-- JARDINEI - Supabase Database Schema
-- Execute este SQL no Supabase SQL Editor
-- https://supabase.com/dashboard/project/nnqctrjvtacswjvdgred/sql
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- 1. PROFILES TABLE
-- Armazena dados do perfil do usuário
-- =============================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  company_name TEXT,
  cnpj TEXT,
  address TEXT,
  instagram TEXT,
  bio TEXT,
  logo_url TEXT,
  avatar_url TEXT,
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'essential', 'pro')),
  plan_status TEXT DEFAULT 'active' CHECK (plan_status IN ('active', 'cancelled', 'expired', 'pending')),
  plan_expires_at TIMESTAMPTZ,
  asaas_customer_id TEXT,
  asaas_subscription_id TEXT,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Se a tabela já existe, adiciona a coluna:
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);

-- =============================================
-- 2. PROPOSALS TABLE
-- Armazena propostas/orçamentos
-- =============================================
CREATE TABLE IF NOT EXISTS public.proposals (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  short_id TEXT NOT NULL,
  client_id TEXT,
  client_name TEXT NOT NULL,
  client_email TEXT,
  client_phone TEXT,
  service_type TEXT DEFAULT 'outro' CHECK (service_type IN ('manutencao', 'paisagismo', 'outro')),
  title TEXT NOT NULL,
  description TEXT,
  notes TEXT,
  valid_until TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'viewed', 'approved', 'expired')),
  total DECIMAL(10,2) DEFAULT 0,
  company_name TEXT,
  company_logo TEXT,
  company_phone TEXT,
  company_email TEXT,
  signature TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,

  UNIQUE(user_id, short_id)
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_proposals_user_id ON public.proposals(user_id);
CREATE INDEX IF NOT EXISTS idx_proposals_short_id ON public.proposals(short_id);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON public.proposals(status);
CREATE INDEX IF NOT EXISTS idx_proposals_created_at ON public.proposals(created_at DESC);

-- =============================================
-- 3. PROPOSAL_ITEMS TABLE
-- Itens de cada proposta
-- =============================================
CREATE TABLE IF NOT EXISTS public.proposal_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  quantity INTEGER DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  image_url TEXT,
  photos TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_proposal_items_proposal_id ON public.proposal_items(proposal_id);

-- =============================================
-- 4. NOTIFICATIONS TABLE
-- Notificações do sistema
-- =============================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('proposal_viewed', 'proposal_approved', 'proposal_expired', 'system')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

-- =============================================
-- 5. PROPOSAL_TEMPLATES TABLE (opcional)
-- Templates de proposta salvos
-- =============================================
CREATE TABLE IF NOT EXISTS public.proposal_templates (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  items JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proposal_templates_user_id ON public.proposal_templates(user_id);

-- =============================================
-- 6. PAYMENTS TABLE (histórico de pagamentos)
-- =============================================
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asaas_payment_id TEXT,
  amount DECIMAL(10,2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled', 'refunded')),
  due_date TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  invoice_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- Protege os dados por usuário
-- =============================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (para evitar conflitos)
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own proposals" ON public.proposals;
DROP POLICY IF EXISTS "Users can insert own proposals" ON public.proposals;
DROP POLICY IF EXISTS "Users can update own proposals" ON public.proposals;
DROP POLICY IF EXISTS "Users can delete own proposals" ON public.proposals;
DROP POLICY IF EXISTS "Anyone can view proposals by short_id" ON public.proposals;
DROP POLICY IF EXISTS "Users can manage proposal items" ON public.proposal_items;
DROP POLICY IF EXISTS "Anyone can view proposal items" ON public.proposal_items;
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can insert own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can view own and default templates" ON public.proposal_templates;
DROP POLICY IF EXISTS "Users can insert own templates" ON public.proposal_templates;
DROP POLICY IF EXISTS "Users can update own templates" ON public.proposal_templates;
DROP POLICY IF EXISTS "Users can delete own templates" ON public.proposal_templates;
DROP POLICY IF EXISTS "Users can view own payments" ON public.payments;

-- PROFILES: Users can only access their own profile
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

-- PROPOSALS: Users can access their own + anyone can view by short_id
CREATE POLICY "Users can view own proposals" ON public.proposals
  FOR SELECT USING (auth.uid() = user_id OR short_id IS NOT NULL);

CREATE POLICY "Users can insert own proposals" ON public.proposals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own proposals" ON public.proposals
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own proposals" ON public.proposals
  FOR DELETE USING (auth.uid() = user_id);

-- PROPOSAL_ITEMS: Access through proposal ownership or public view
CREATE POLICY "Users can manage proposal items" ON public.proposal_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.proposals
      WHERE proposals.id = proposal_items.proposal_id
    )
  );

-- NOTIFICATIONS: Users can only access their own notifications
CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notifications" ON public.notifications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- PROPOSAL_TEMPLATES: Users can access their own + default templates
CREATE POLICY "Users can view own and default templates" ON public.proposal_templates
  FOR SELECT USING (auth.uid() = user_id OR is_default = true);

CREATE POLICY "Users can insert own templates" ON public.proposal_templates
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own templates" ON public.proposal_templates
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own templates" ON public.proposal_templates
  FOR DELETE USING (auth.uid() = user_id);

-- PAYMENTS: Users can only view their own payments
CREATE POLICY "Users can view own payments" ON public.payments
  FOR SELECT USING (auth.uid() = user_id);

-- =============================================
-- FUNCTIONS & TRIGGERS
-- =============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for profiles updated_at
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- FIM DO SCHEMA
-- Copie e cole no SQL Editor do Supabase
-- =============================================
