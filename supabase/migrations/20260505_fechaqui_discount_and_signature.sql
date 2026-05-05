-- ============================================
-- FechaAqui — colunas aditivas pra desconto e e-signature
-- ============================================
-- TODAS as colunas são NULL/default zero pra não quebrar inserts antigos do Jardinei.
-- O Jardinei nunca seta esses campos; o FechaAqui usa quando o usuário ativa.
-- Tudo idempotente (IF NOT EXISTS) — pode rodar múltiplas vezes.

-- 1. Desconto por item em proposal_items
ALTER TABLE public.proposal_items
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10,2) DEFAULT 0;

ALTER TABLE public.proposal_items
  ADD COLUMN IF NOT EXISTS discount_type TEXT DEFAULT NULL
    CHECK (discount_type IS NULL OR discount_type IN ('fixed', 'percentage'));

COMMENT ON COLUMN public.proposal_items.discount_amount IS 'Desconto por item (FechaAqui). 0 = sem desconto.';
COMMENT ON COLUMN public.proposal_items.discount_type IS 'fixed=R$, percentage=%. NULL quando sem desconto.';

-- 2. E-signature em proposals
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS signature_url TEXT DEFAULT NULL;

ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS signed_ip TEXT DEFAULT NULL;

ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS signed_name TEXT DEFAULT NULL;

COMMENT ON COLUMN public.proposals.signature_url IS 'URL pública da imagem de assinatura no Supabase Storage (FechaAqui).';
COMMENT ON COLUMN public.proposals.signed_at IS 'Timestamp da assinatura digital pelo cliente.';
COMMENT ON COLUMN public.proposals.signed_ip IS 'IP do cliente no momento da assinatura (auditoria).';
COMMENT ON COLUMN public.proposals.signed_name IS 'Nome digitado pelo cliente ao assinar.';

-- 3. Storage bucket pra signatures (idempotente)
INSERT INTO storage.buckets (id, name, public)
VALUES ('signatures', 'signatures', true)
ON CONFLICT (id) DO NOTHING;

-- Policy de upload (autenticado, apenas no próprio prefixo)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'fechaqui_signatures_insert'
  ) THEN
    CREATE POLICY "fechaqui_signatures_insert"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'signatures');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'fechaqui_signatures_select'
  ) THEN
    CREATE POLICY "fechaqui_signatures_select"
      ON storage.objects FOR SELECT
      TO public
      USING (bucket_id = 'signatures');
  END IF;
END $$;
