const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;

async function checkTimezone() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    // Verificar timezone e datas
    const result = await client.query(`
      SELECT
        NOW() as agora_banco,
        NOW() AT TIME ZONE 'America/Sao_Paulo' as agora_brasil,
        CURRENT_DATE as hoje,
        CURRENT_DATE + INTERVAL '1 day' as amanha,
        (CURRENT_DATE + INTERVAL '1 day')::timestamp as amanha_00h,
        (CURRENT_DATE + INTERVAL '1 day' + INTERVAL '23 hours 59 minutes 59 seconds')::timestamp as amanha_23h59,
        p.plan_expires_at,
        p.plan_expires_at AT TIME ZONE 'UTC' as expira_utc
      FROM profiles p
      JOIN auth.users u ON u.id = p.user_id
      WHERE u.email = 'digitalpaisagismo@gmail.com'
    `);

    console.log('\n🕐 ANÁLISE DE TIMEZONE:\n');
    console.table(result.rows);

  } catch (error) {
    console.error('Erro:', error.message);
  } finally {
    await client.end();
  }
}

checkTimezone();
