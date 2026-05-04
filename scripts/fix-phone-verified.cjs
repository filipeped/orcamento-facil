const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function fixPhoneVerified() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });

  try {
    await client.connect();
    console.log('Conectado ao banco!');

    // Buscar perfis com telefone mas phone_verified = false
    const result = await client.query(`
      UPDATE profiles
      SET phone_verified = true
      WHERE phone IS NOT NULL
        AND phone != ''
        AND (phone_verified = false OR phone_verified IS NULL)
      RETURNING user_id, phone, phone_verified
    `);

    console.log('\n✅ ' + result.rowCount + ' perfil(is) atualizado(s):');
    result.rows.forEach(row => {
      console.log('  - User: ' + row.user_id.substring(0, 8) + '... | Phone: ' + row.phone + ' | Verified: ' + row.phone_verified);
    });

  } catch (error) {
    console.error('Erro:', error.message);
  } finally {
    await client.end();
  }
}

fixPhoneVerified();
