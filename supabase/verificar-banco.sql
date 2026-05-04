-- =============================================
-- SCRIPT DE VERIFICAÇÃO E CORREÇÃO DO BANCO
-- JARDINEI - Supabase
-- =============================================

-- =============================================
-- TABELA: profiles
-- =============================================
-- Campos que DEVEM existir:

-- Campos básicos
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cnpj TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS address TEXT;

-- Empresa
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Plano e assinatura
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free'; -- free, essential, pro
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plan_status TEXT DEFAULT 'active'; -- active, cancelled, expired, overdue
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plan_period TEXT; -- monthly, annual
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plan_started_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plan_overdue_since TIMESTAMPTZ;

-- Onboarding e tour
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS show_tour BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tour_step INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS checklist_dismissed BOOLEAN DEFAULT false;

-- Notificações
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notifications_email BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notifications_whatsapp BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notifications_proposal_viewed BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notifications_proposal_approved BOOLEAN DEFAULT true;

-- Timestamps
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();


-- =============================================
-- TABELA: proposals
-- =============================================

ALTER TABLE proposals ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS short_id TEXT; -- Slug amigável (ex: joao-silva)
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS client_id UUID;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS client_name TEXT NOT NULL;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS client_email TEXT;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS client_phone TEXT;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS service_type TEXT DEFAULT 'outro';
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS title TEXT NOT NULL;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS valid_until DATE;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft'; -- draft, sent, viewed, approved, expired
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS total DECIMAL(10,2) DEFAULT 0;

-- Timestamps de status
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMPTZ;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS signature TEXT; -- Assinatura base64

-- Dados da empresa (snapshot no momento da criação)
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS company_logo TEXT;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS company_phone TEXT;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS company_email TEXT;

-- Propostas recorrentes (NOVO)
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS recurring_frequency TEXT; -- monthly, quarterly, yearly
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS next_recurrence_date DATE;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS parent_proposal_id UUID REFERENCES proposals(id);

-- Pagamento da proposta (NOVO)
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS payment_id TEXT; -- ID do pagamento no Asaas
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS payment_url TEXT; -- URL de pagamento
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS payment_status TEXT; -- pending, paid, etc

-- Timestamps
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Índice para short_id (busca rápida)
CREATE INDEX IF NOT EXISTS idx_proposals_short_id ON proposals(short_id);
CREATE INDEX IF NOT EXISTS idx_proposals_user_id ON proposals(user_id);


-- =============================================
-- TABELA: proposal_items
-- =============================================

ALTER TABLE proposal_items ADD COLUMN IF NOT EXISTS proposal_id UUID REFERENCES proposals(id) ON DELETE CASCADE;
ALTER TABLE proposal_items ADD COLUMN IF NOT EXISTS name TEXT NOT NULL;
ALTER TABLE proposal_items ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE proposal_items ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1;
ALTER TABLE proposal_items ADD COLUMN IF NOT EXISTS unit_price DECIMAL(10,2) DEFAULT 0;
ALTER TABLE proposal_items ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE proposal_items ADD COLUMN IF NOT EXISTS photos TEXT[] DEFAULT '{}'; -- Galeria de fotos
ALTER TABLE proposal_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();


-- =============================================
-- TABELA: clients
-- =============================================

CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clients_user_id ON clients(user_id);


-- =============================================
-- TABELA: catalog_items
-- =============================================

CREATE TABLE IF NOT EXISTS catalog_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT,
  description TEXT,
  image_url TEXT,
  prices JSONB DEFAULT '{}', -- {"default": 100, "P": 80, "M": 100, "G": 120}
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_catalog_items_user_id ON catalog_items(user_id);


-- =============================================
-- TABELA: notifications
-- =============================================

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- proposal_viewed, proposal_approved, payment_confirmed, etc
  title TEXT NOT NULL,
  message TEXT,
  metadata JSONB DEFAULT '{}',
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, read);


-- =============================================
-- TABELA: coupons
-- =============================================

CREATE TABLE IF NOT EXISTS coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  discount_percent INTEGER NOT NULL, -- 10, 20, 50, etc
  max_uses INTEGER, -- NULL = ilimitado
  current_uses INTEGER DEFAULT 0,
  valid_until DATE,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inserir cupom padrão se não existir
INSERT INTO coupons (code, discount_percent, max_uses, valid_until, active)
VALUES ('BEMVINDO', 20, NULL, '2025-12-31', true)
ON CONFLICT (code) DO NOTHING;


-- =============================================
-- TABELA: proposal_templates (NOVO)
-- =============================================

CREATE TABLE IF NOT EXISTS proposal_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  service_type TEXT,
  description TEXT,
  items JSONB DEFAULT '[]', -- Array de itens do template
  is_default BOOLEAN DEFAULT false, -- Templates do sistema
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proposal_templates_user_id ON proposal_templates(user_id);


-- =============================================
-- TABELA: agenda_items / events
-- =============================================

CREATE TABLE IF NOT EXISTS agenda_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  client TEXT,
  client_id UUID REFERENCES clients(id),
  date DATE NOT NULL,
  time TIME,
  location TEXT,
  type TEXT DEFAULT 'service', -- service, visit, meeting
  notes TEXT,
  completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agenda_items_user_id ON agenda_items(user_id);
CREATE INDEX IF NOT EXISTS idx_agenda_items_date ON agenda_items(date);


-- =============================================
-- TABELA: webhook_logs (para debug)
-- =============================================

CREATE TABLE IF NOT EXISTS webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT,
  payload JSONB,
  status TEXT DEFAULT 'pending',
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- =============================================
-- TABELA: contracts (contratos gerados)
-- =============================================

CREATE TABLE IF NOT EXISTS contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID REFERENCES proposals(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT, -- HTML do contrato
  signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- =============================================
-- RLS (Row Level Security) - IMPORTANTE!
-- =============================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;

-- Políticas para profiles
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Políticas para proposals
DROP POLICY IF EXISTS "Users can view own proposals" ON proposals;
CREATE POLICY "Users can view own proposals" ON proposals FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own proposals" ON proposals;
CREATE POLICY "Users can insert own proposals" ON proposals FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own proposals" ON proposals;
CREATE POLICY "Users can update own proposals" ON proposals FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own proposals" ON proposals;
CREATE POLICY "Users can delete own proposals" ON proposals FOR DELETE USING (auth.uid() = user_id);

-- Política para proposta pública (qualquer um pode ver pelo short_id)
DROP POLICY IF EXISTS "Anyone can view proposals by short_id" ON proposals;
CREATE POLICY "Anyone can view proposals by short_id" ON proposals FOR SELECT USING (true);

-- Políticas para proposal_items
DROP POLICY IF EXISTS "Users can manage proposal items" ON proposal_items;
CREATE POLICY "Users can manage proposal items" ON proposal_items FOR ALL
USING (EXISTS (SELECT 1 FROM proposals WHERE proposals.id = proposal_items.proposal_id AND proposals.user_id = auth.uid()));

-- Política pública para items
DROP POLICY IF EXISTS "Anyone can view proposal items" ON proposal_items;
CREATE POLICY "Anyone can view proposal items" ON proposal_items FOR SELECT USING (true);

-- Políticas para clients
DROP POLICY IF EXISTS "Users can manage own clients" ON clients;
CREATE POLICY "Users can manage own clients" ON clients FOR ALL USING (auth.uid() = user_id);

-- Políticas para catalog_items
DROP POLICY IF EXISTS "Users can manage own catalog" ON catalog_items;
CREATE POLICY "Users can manage own catalog" ON catalog_items FOR ALL USING (auth.uid() = user_id);

-- Políticas para notifications
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE USING (auth.uid() = user_id);

-- Políticas para proposal_templates
DROP POLICY IF EXISTS "Users can manage own templates" ON proposal_templates;
CREATE POLICY "Users can manage own templates" ON proposal_templates FOR ALL USING (auth.uid() = user_id OR is_default = true);

-- Políticas para agenda_items
DROP POLICY IF EXISTS "Users can manage own agenda" ON agenda_items;
CREATE POLICY "Users can manage own agenda" ON agenda_items FOR ALL USING (auth.uid() = user_id);

-- Políticas para contracts
DROP POLICY IF EXISTS "Users can manage own contracts" ON contracts;
CREATE POLICY "Users can manage own contracts" ON contracts FOR ALL USING (auth.uid() = user_id);


-- =============================================
-- FUNÇÃO: Criar profile automaticamente
-- =============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Novo usuário: plano Basic (free) grátis pra sempre
  INSERT INTO public.profiles (user_id, full_name, email, plan, plan_status, plan_started_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    NEW.email,
    'free',
    'active',
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para criar profile
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- =============================================
-- VERIFICAÇÃO FINAL
-- =============================================

-- Listar todas as tabelas criadas
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Verificar colunas da tabela profiles
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'profiles'
ORDER BY ordinal_position;
