-- ============================================
-- FechaAqui v2 — Doc Types (Orçamento / Fatura / Recibo)
-- ============================================
-- Aditiva: NULL/default safe, Jardinei nunca lê esses campos.
-- Idempotente.

-- 1. doc_type — distingue orçamento (default), fatura e recibo
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS doc_type TEXT DEFAULT 'orcamento'
    CHECK (doc_type IN ('orcamento', 'fatura', 'recibo'));

COMMENT ON COLUMN public.proposals.doc_type IS 'FechaAqui v2. Tipo de documento: orcamento (default, compat Jardinei), fatura, recibo.';

-- 2. sequence_number — numeração sequencial por user
-- Calculado client-side no momento do INSERT (busca MAX e +1).
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS sequence_number INT DEFAULT NULL;

COMMENT ON COLUMN public.proposals.sequence_number IS 'FechaAqui v2. Número sequencial 0001, 0002... por user_id. NULL nas propostas legadas Jardinei.';

CREATE INDEX IF NOT EXISTS idx_proposals_user_seq
  ON public.proposals (user_id, sequence_number DESC);

-- 3. po_number — número de ordem de compra (referência cliente)
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS po_number TEXT DEFAULT NULL;

-- 4. payment_status — pra faturas
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT NULL
    CHECK (payment_status IS NULL OR payment_status IN ('pendente', 'parcial', 'pago', 'cancelado'));

-- 5. amount_paid — valor já pago (pra cálculo de saldo devedor)
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(10,2) DEFAULT 0;

-- 6. due_date — data de vencimento (faturas)
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ DEFAULT NULL;

-- 7. parent_proposal_id — referência ao orçamento que originou a fatura/recibo
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS parent_proposal_id UUID DEFAULT NULL
    REFERENCES public.proposals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_proposals_parent
  ON public.proposals (parent_proposal_id);

-- 8. clients — tags pra segmentação
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

COMMENT ON COLUMN public.clients.tags IS 'FechaAqui v2. Tags para segmentação. Default vazio.';
