const { createClient } = require('@supabase/supabase-js');

async function run() {
  const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  // Buscar todas as plantas
  const { data: plantas, error } = await sb
    .from('plantas')
    .select('id, nome_popular, nome_cientifico, imagem_principal')
    .order('nome_popular');

  if (error) {
    console.error('Erro:', error);
    process.exit(1);
  }

  console.log('Total de plantas:', plantas.length);

  // Agrupar por nome_popular (normalizado)
  const groups = {};
  for (const p of plantas) {
    const key = (p.nome_popular || '').toLowerCase().trim();
    if (!groups[key]) groups[key] = [];
    groups[key].push(p);
  }

  // Encontrar duplicatas
  const duplicates = Object.entries(groups).filter(([_, items]) => items.length > 1);

  if (duplicates.length === 0) {
    console.log('\nNenhuma planta duplicada encontrada!');
    return;
  }

  console.log('\nPlantas duplicadas:', duplicates.length);
  let removed = 0;

  for (const [name, items] of duplicates) {
    console.log('\n--- "' + name + '" (' + items.length + ' entradas) ---');

    // Manter a que tem imagem (preferencialmente Supabase), remover as outras
    const withSupabaseImg = items.filter(i => i.imagem_principal && i.imagem_principal.includes('supabase'));
    const withAnyImg = items.filter(i => i.imagem_principal);
    const keep = withSupabaseImg[0] || withAnyImg[0] || items[0];

    console.log('  Mantendo: id=' + keep.id + ' (img: ' + (keep.imagem_principal ? 'sim' : 'nao') + ')');

    const toDelete = items.filter(i => i.id !== keep.id);
    for (const del of toDelete) {
      console.log('  Removendo: id=' + del.id + ' (img: ' + (del.imagem_principal ? 'sim' : 'nao') + ')');
      const { error: delError } = await sb.from('plantas').delete().eq('id', del.id);
      if (delError) {
        console.log('    ERRO ao remover: ' + delError.message);
      } else {
        removed++;
      }
    }
  }

  console.log('\n=== RESULTADO ===');
  console.log('Duplicatas encontradas: ' + duplicates.length + ' nomes');
  console.log('Registros removidos: ' + removed);

  // Contagem final
  const { count } = await sb.from('plantas').select('*', { count: 'exact', head: true });
  console.log('Total de plantas agora: ' + count);
}

run().catch(console.error);
