-- Marcar phone_verified = true para usuarios que ja tem telefone cadastrado
-- (usuarios antigos que se cadastraram antes da verificacao WhatsApp)
UPDATE profiles
SET phone_verified = true
WHERE phone IS NOT NULL
  AND phone != ''
  AND phone_verified = false;
