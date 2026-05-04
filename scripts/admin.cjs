/**
 * Script de Admin para JARDINEI
 *
 * Uso: node scripts/admin.js [comando]
 *
 * Comandos:
 *   dashboard  - Ver resumo geral
 *   users      - Listar usuários
 *   payments   - Ver pagamentos
 *   logs       - Ver logs de webhook
 *   coupons    - Ver cupons
 *   set-plan   - Alterar plano de usuário
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://nnqctrjvtacswjvdgred.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ucWN0cmp2dGFjc3dqdmRncmVkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODUyMDk3MCwiZXhwIjoyMDg0MDk2OTcwfQ.R7dDcFqYV_r5w-A32S6hu0HogtKnwKBz0pIyk5dkLes';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const commands = {
  async dashboard() {
    console.log('\n╔═══════════════════════════════════════════════════╗');
    console.log('║         DASHBOARD ADMIN - JARDINEI                ║');
    console.log('╚═══════════════════════════════════════════════════╝\n');

    // Usuários por plano
    const { data: users } = await supabase.from('profiles').select('plan');
    const planCounts = { free: 0, essential: 0, pro: 0 };
    users?.forEach(u => planCounts[u.plan] = (planCounts[u.plan] || 0) + 1);

    console.log('👥 USUÁRIOS POR PLANO:');
    console.log(`   Basic: ${planCounts.free} | Start: ${planCounts.essential} | Pro: ${planCounts.pro}`);
    console.log(`   Total: ${users?.length || 0}\n`);

    // Pagamentos
    const { count: paymentCount } = await supabase.from('payment_history').select('*', { count: 'exact', head: true });
    const { data: revenue } = await supabase.from('payment_history').select('amount').eq('status', 'paid');
    const totalRevenue = revenue?.reduce((sum, p) => sum + p.amount, 0) || 0;

    console.log('💰 RECEITA:');
    console.log(`   Pagamentos: ${paymentCount || 0}`);
    console.log(`   Total: R$ ${totalRevenue.toFixed(2).replace('.', ',')}\n`);

    // Cupons usados
    const { data: coupons } = await supabase.from('coupons').select('code, current_uses');
    const totalCouponUses = coupons?.reduce((sum, c) => sum + c.current_uses, 0) || 0;

    console.log('🎟️  CUPONS:');
    console.log(`   Usos: ${totalCouponUses}\n`);

    // Webhook logs
    const { count: successLogs } = await supabase.from('webhook_logs').select('*', { count: 'exact', head: true }).eq('status', 'success');
    const { count: errorLogs } = await supabase.from('webhook_logs').select('*', { count: 'exact', head: true }).eq('status', 'error');

    console.log('📝 WEBHOOKS:');
    console.log(`   Sucesso: ${successLogs || 0} | Erro: ${errorLogs || 0}\n`);
  },

  async users() {
    console.log('\n👥 USUÁRIOS:\n');
    const { data } = await supabase
      .from('profiles')
      .select('full_name, plan, plan_status, created_at')
      .order('created_at', { ascending: false });

    data?.forEach(u => {
      const plan = u.plan === 'pro' ? '🟢 Pro' : u.plan === 'essential' ? '🟡 Start' : '⚪ Basic';
      console.log(`${plan} ${u.full_name} (${u.plan_status})`);
    });
    console.log(`\nTotal: ${data?.length || 0}`);
  },

  async payments() {
    console.log('\n💳 PAGAMENTOS:\n');
    const { data } = await supabase
      .from('payment_history')
      .select('*, profiles(full_name)')
      .order('created_at', { ascending: false })
      .limit(20);

    if (!data?.length) {
      console.log('Nenhum pagamento registrado');
      return;
    }

    data.forEach(p => {
      const status = p.status === 'paid' ? '✅' : '⏳';
      console.log(`${status} R$ ${p.amount} - ${p.profiles?.full_name || 'N/A'} - ${new Date(p.created_at).toLocaleString('pt-BR')}`);
    });
  },

  async logs() {
    console.log('\n📝 WEBHOOK LOGS:\n');
    const { data } = await supabase
      .from('webhook_logs')
      .select('event_type, status, error_message, created_at')
      .order('created_at', { ascending: false })
      .limit(20);

    if (!data?.length) {
      console.log('Nenhum log ainda');
      return;
    }

    data.forEach(l => {
      const status = l.status === 'success' ? '✅' : l.status === 'error' ? '❌' : '⏳';
      console.log(`${status} ${l.event_type} - ${new Date(l.created_at).toLocaleString('pt-BR')}`);
      if (l.error_message) console.log(`   Erro: ${l.error_message}`);
    });
  },

  async coupons() {
    console.log('\n🎟️  CUPONS:\n');
    const { data } = await supabase.from('coupons').select('*');

    data?.forEach(c => {
      const status = c.is_active ? '✅' : '❌';
      const expires = c.valid_until ? new Date(c.valid_until).toLocaleDateString('pt-BR') : 'Sem validade';
      console.log(`${status} ${c.code} - ${c.discount_percent}% off`);
      console.log(`   Usos: ${c.current_uses}/${c.max_uses || '∞'} | Expira: ${expires}`);
      console.log(`   Planos: ${c.applicable_plans?.join(', ') || 'todos'}\n`);
    });
  },

  async 'set-plan'() {
    console.log('\n⚙️  ALTERAR PLANO:\n');
    console.log('Uso: node scripts/admin.js set-plan <email> <plan>');
    console.log('Planos: free, essential, pro\n');
    console.log('Exemplo: node scripts/admin.js set-plan user@email.com pro');
  },

  async help() {
    console.log(`
╔═══════════════════════════════════════════════════╗
║              ADMIN JARDINEI - AJUDA               ║
╚═══════════════════════════════════════════════════╝

Comandos disponíveis:

  node scripts/admin.js dashboard  - Ver resumo geral
  node scripts/admin.js users      - Listar usuários
  node scripts/admin.js payments   - Ver pagamentos
  node scripts/admin.js logs       - Ver logs de webhook
  node scripts/admin.js coupons    - Ver cupons

`);
  }
};

// Main
const command = process.argv[2] || 'dashboard';

if (commands[command]) {
  commands[command]().catch(console.error);
} else {
  console.log('Comando não encontrado. Use: node scripts/admin.js help');
}
