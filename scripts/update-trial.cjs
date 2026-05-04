const { Client } = require('pg');
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();

  console.log('\n📊 ANTES:');
  const antes = await client.query(`
    SELECT
      p.full_name,
      p.plan,
      to_char(p.created_at, 'DD/MM/YYYY') as cadastro,
      EXTRACT(DAY FROM NOW() - p.created_at)::int as dias_trial
    FROM profiles p
    JOIN auth.users u ON u.id = p.user_id
    WHERE u.email = 'digitalpaisagismo@gmail.com'
  `);
  console.table(antes.rows);

  console.log('\n🔄 Atualizando para 6 dias de trial...');
  await client.query(`
    UPDATE profiles
    SET created_at = NOW() - INTERVAL '6 days'
    WHERE user_id = (SELECT id FROM auth.users WHERE email = 'digitalpaisagismo@gmail.com')
  `);

  console.log('\n📊 DEPOIS:');
  const depois = await client.query(`
    SELECT
      p.full_name,
      p.plan,
      to_char(p.created_at, 'DD/MM/YYYY') as cadastro,
      EXTRACT(DAY FROM NOW() - p.created_at)::int as dias_trial
    FROM profiles p
    JOIN auth.users u ON u.id = p.user_id
    WHERE u.email = 'digitalpaisagismo@gmail.com'
  `);
  console.table(depois.rows);

  await client.end();
}
run();
