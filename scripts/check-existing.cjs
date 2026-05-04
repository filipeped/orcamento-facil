const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://nnqctrjvtacswjvdgred.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ucWN0cmp2dGFjc3dqdmRncmVkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODUyMDk3MCwiZXhwIjoyMDg0MDk2OTcwfQ.R7dDcFqYV_r5w-A32S6hu0HogtKnwKBz0pIyk5dkLes';

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const USER_ID = '51e74412-2cbc-486a-9666-dff8e80c4985';

(async () => {
  const { data: profile } = await supabase.from('profiles').select('full_name, company_name, plan, plan_status').eq('user_id', USER_ID).single();
  console.log('Profile:', profile);

  const { count } = await supabase.from('proposals').select('*', { count: 'exact', head: true }).eq('user_id', USER_ID);
  console.log('Propostas existentes:', count);

  const { data: sample } = await supabase.from('proposals').select('short_id, title, status, total, created_at').eq('user_id', USER_ID).order('created_at', { ascending: false }).limit(5);
  console.log('Amostra:', sample);
})();
