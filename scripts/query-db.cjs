/**
 * Script para executar queries e mostrar resultados
 */

const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL não definida');
  process.exit(1);
}

async function runQuery() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    const result = await client.query(`
      SELECT
        p.full_name,
        p.phone,
        p.plan,
        p.plan_status,
        to_char(p.plan_expires_at, 'DD/MM/YYYY HH24:MI') as expira_em,
        CASE
          WHEN p.plan_expires_at IS NULL THEN 'Sem expiracao'
          WHEN p.plan_expires_at < NOW() THEN 'EXPIRADO'
          WHEN p.plan_expires_at < NOW() + INTERVAL '1 day' THEN '⚠️ EXPIRA HOJE'
          WHEN p.plan_expires_at < NOW() + INTERVAL '2 days' THEN '🎁 EXPIRA AMANHA - CUPOM FICA10'
          WHEN p.plan_expires_at < NOW() + INTERVAL '4 days' THEN '⏰ EXPIRA EM 3 DIAS'
          ELSE 'OK'
        END as status_cupom
      FROM profiles p
      JOIN auth.users u ON u.id = p.user_id
      WHERE u.email = 'digitalpaisagismo@gmail.com'
    `);

    console.log('\n📊 STATUS DO USUÁRIO:\n');
    console.table(result.rows);

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await client.end();
  }
}

runQuery();
