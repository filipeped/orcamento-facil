const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://nnqctrjvtacswjvdgred.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ucWN0cmp2dGFjc3dqdmRncmVkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODUyMDk3MCwiZXhwIjoyMDg0MDk2OTcwfQ.R7dDcFqYV_r5w-A32S6hu0HogtKnwKBz0pIyk5dkLes';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

(async () => {
  const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (error) { console.error(error); process.exit(1); }
  const matches = data.users.filter(u => (u.email || '').toLowerCase().includes('digitalpaisagismo'));
  matches.forEach(u => console.log(u.id, '|', u.email, '|', u.created_at));
})();
