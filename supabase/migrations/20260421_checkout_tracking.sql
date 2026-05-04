-- Tabela pra guardar dados do browser (fbp, fbc, IP, UA) no momento do checkout
-- O webhook-asaas.js recupera esses dados na hora de disparar Purchase pro Meta CAPI
-- Isso melhora o Data Quality Score porque o webhook (server-to-server) nao tem acesso
-- aos cookies/IP/UA do cliente.

CREATE TABLE IF NOT EXISTS checkout_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asaas_subscription_id text,
  asaas_payment_id text,
  fbp text,
  fbc text,
  client_ip text,
  user_agent text,
  event_source_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_checkout_tracking_payment
  ON checkout_tracking (asaas_payment_id);

CREATE INDEX IF NOT EXISTS idx_checkout_tracking_subscription
  ON checkout_tracking (asaas_subscription_id);

CREATE INDEX IF NOT EXISTS idx_checkout_tracking_user_created
  ON checkout_tracking (user_id, created_at DESC);

-- RLS: apenas service_role usa (via webhook e create-payment)
ALTER TABLE checkout_tracking ENABLE ROW LEVEL SECURITY;

-- Politica: usuario pode ver apenas seus proprios (debug eventual)
CREATE POLICY "Users can view own checkout tracking"
  ON checkout_tracking FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
