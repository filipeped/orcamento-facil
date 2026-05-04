const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://nnqctrjvtacswjvdgred.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ucWN0cmp2dGFjc3dqdmRncmVkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODUyMDk3MCwiZXhwIjoyMDg0MDk2OTcwfQ.R7dDcFqYV_r5w-A32S6hu0HogtKnwKBz0pIyk5dkLes'
);
const USER_ID = '51e74412-2cbc-486a-9666-dff8e80c4985';

(async () => {
  const hoje = new Date('2026-04-19T23:59:59Z');
  const seteDiasAtras = new Date(hoje.getTime() - 7 * 24 * 3600 * 1000);
  console.log('Janela:', seteDiasAtras.toISOString(), '->', hoje.toISOString());

  const { data } = await supabase
    .from('proposals')
    .select('id, short_id, title, status, total, created_at, approved_at')
    .eq('user_id', USER_ID)
    .gte('created_at', seteDiasAtras.toISOString())
    .order('created_at', { ascending: true });

  console.log('Total nos ultimos 7 dias:', data.length);
  const approved = data.filter(p => p.status === 'approved');
  console.log('Approved nos ultimos 7 dias:', approved.length);
  const soma = approved.reduce((s, p) => s + Number(p.total), 0);
  console.log('Soma approved 7 dias: R$', soma.toLocaleString('pt-BR'));
  console.log('---');
  data.forEach(p => console.log(p.created_at.substring(0,10), '|', p.status.padEnd(9), '| R$', String(p.total).padStart(8), '|', p.title));
})();
