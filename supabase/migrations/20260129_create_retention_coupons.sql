-- Cupons de retenção para usuários com plano expirando

-- FICA10: 10% OFF para quem está com plano expirando (1 dia antes)
INSERT INTO coupons (code, discount_percent, max_uses, valid_until, plans, active)
VALUES ('FICA10', 10, NULL, '2027-12-31 23:59:59', ARRAY['essential', 'pro'], true)
ON CONFLICT (code) DO UPDATE SET
  discount_percent = 10,
  active = true;

-- VOLTA15: 15% OFF para quem já deixou o plano expirar
INSERT INTO coupons (code, discount_percent, max_uses, valid_until, plans, active)
VALUES ('VOLTA15', 15, NULL, '2027-12-31 23:59:59', ARRAY['essential', 'pro'], true)
ON CONFLICT (code) DO UPDATE SET
  discount_percent = 15,
  active = true;
