-- =============================================
-- VERIFICAR E CRIAR BUCKET DE AVATARS
-- Execute este SQL no Supabase SQL Editor
-- =============================================

-- 1. Verificar buckets existentes
SELECT id, name, public, created_at
FROM storage.buckets;

-- 2. Criar bucket "avatars" se não existir
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Criar bucket "logos" se não existir (para logo da empresa)
INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;

-- 4. Política para permitir upload de avatars (usuários autenticados)
CREATE POLICY IF NOT EXISTS "Usuarios podem fazer upload de avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars');

-- 5. Política para permitir visualização pública de avatars
CREATE POLICY IF NOT EXISTS "Avatars são públicos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- 6. Política para permitir update/delete do próprio avatar
CREATE POLICY IF NOT EXISTS "Usuarios podem atualizar proprio avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY IF NOT EXISTS "Usuarios podem deletar proprio avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 7. Mesmas políticas para logos
CREATE POLICY IF NOT EXISTS "Usuarios podem fazer upload de logo"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'logos');

CREATE POLICY IF NOT EXISTS "Logos são públicos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'logos');

CREATE POLICY IF NOT EXISTS "Usuarios podem atualizar proprio logo"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'logos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY IF NOT EXISTS "Usuarios podem deletar proprio logo"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'logos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 8. Verificar se as políticas foram criadas
SELECT policyname, tablename, cmd
FROM pg_policies
WHERE schemaname = 'storage';
