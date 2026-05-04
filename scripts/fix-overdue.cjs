const { createClient } = require('@supabase/supabase-js');

(async () => {
  const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const nowIso = new Date().toISOString();

  const { data: stuck, error: selErr } = await supabase
    .from('profiles')
    .select('user_id, full_name, plan, plan_expires_at, plan_overdue_since')
    .eq('plan_status', 'overdue')
    .gt('plan_expires_at', nowIso);

  if (selErr) { console.error('select:', selErr); process.exit(1); }
  console.log(`Encontrados ${stuck.length} travados em overdue com vencimento futuro:`);
  for (const u of stuck) console.log(' -', u.user_id, u.full_name, '->', u.plan_expires_at);

  if (!stuck.length) { console.log('Nada pra corrigir.'); return; }

  const { data: upd, error: updErr } = await supabase
    .from('profiles')
    .update({ plan_status: 'active', plan_overdue_since: null, updated_at: nowIso })
    .eq('plan_status', 'overdue')
    .gt('plan_expires_at', nowIso)
    .select('user_id, full_name, plan_status, plan_expires_at');

  if (updErr) { console.error('update:', updErr); process.exit(1); }
  console.log(`\nAtualizados ${upd.length} perfis pra active ✅`);
})();
