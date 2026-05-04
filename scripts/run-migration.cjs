/**
 * Script para executar migrations no Supabase
 * Uso: node scripts/run-migration.js [arquivo.sql]
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Connection string do Supabase (definir via DATABASE_URL no ambiente ou .env.local)
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL não definida. Configure a variável de ambiente.');
  console.error('   Exemplo: DATABASE_URL=postgresql://postgres:SENHA@db.XXX.supabase.co:5432/postgres');
  process.exit(1);
}

async function runMigration(sqlFile) {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔌 Conectando ao Supabase...');
    await client.connect();
    console.log('✅ Conectado!');

    // Ler arquivo SQL
    const sqlPath = path.resolve(sqlFile);
    console.log(`📄 Lendo: ${sqlPath}`);
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('🚀 Executando SQL...');
    await client.query(sql);
    console.log('✅ Migration executada com sucesso!');

  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  } finally {
    await client.end();
    console.log('🔌 Conexão encerrada.');
  }
}

// Pegar arquivo da linha de comando ou usar padrão
const sqlFile = process.argv[2] || 'supabase/migrations/20260128_verification_codes.sql';
runMigration(sqlFile);
