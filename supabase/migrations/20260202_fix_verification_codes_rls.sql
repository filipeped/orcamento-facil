-- Corrigir RLS da tabela verification_codes
-- O service_role precisa de permissão para acessar

-- Criar política para permitir service_role (usado pelas APIs serverless)
DROP POLICY IF EXISTS "Service role can manage verification_codes" ON verification_codes;
CREATE POLICY "Service role can manage verification_codes"
ON verification_codes
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Também permitir que APIs com anon key possam ler (para verificar códigos)
DROP POLICY IF EXISTS "API can read verification_codes" ON verification_codes;
CREATE POLICY "API can read verification_codes"
ON verification_codes
FOR SELECT
TO anon
USING (true);

-- Permitir inserção para envio de códigos
DROP POLICY IF EXISTS "API can insert verification_codes" ON verification_codes;
CREATE POLICY "API can insert verification_codes"
ON verification_codes
FOR INSERT
TO anon
WITH CHECK (true);

-- Permitir atualização para marcar códigos como usados
DROP POLICY IF EXISTS "API can update verification_codes" ON verification_codes;
CREATE POLICY "API can update verification_codes"
ON verification_codes
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);
