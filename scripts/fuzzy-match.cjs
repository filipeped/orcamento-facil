const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const IMAGES_DIR = 'C:\\Users\\filip\\OneDrive\\Desktop\\MATERIAL\\PLANTAS-BANCO\\imagens';
const BUCKET = 'vegetacoes';

function normalize(str) {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
}

function slugify(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-').toLowerCase();
}

async function run() {
  const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  // Plantas sem imagem Supabase
  const { data: semImagem } = await sb
    .from('plantas')
    .select('id, nome_popular, imagem_principal')
    .or('imagem_principal.is.null,imagem_principal.like.%jardineiro.net%')
    .order('nome_popular');

  console.log('Plantas sem imagem: ' + semImagem.length + '\n');

  // Arquivos disponíveis
  const files = fs.readdirSync(IMAGES_DIR).filter(f => /\.(jpg|jpeg|png|webp|gif)$/i.test(f));
  const fileMapNorm = {};
  files.forEach(f => {
    const name = path.basename(f, path.extname(f));
    fileMapNorm[normalize(name)] = f;
  });

  let fixed = 0;
  const stillMissing = [];

  for (const p of semImagem) {
    const normName = normalize(p.nome_popular);
    const matchedFile = fileMapNorm[normName];

    if (matchedFile) {
      // Upload e atualizar
      const filePath = path.join(IMAGES_DIR, matchedFile);
      const fileBuffer = fs.readFileSync(filePath);
      const ext = path.extname(matchedFile);
      const storageName = slugify(matchedFile);

      const { error: uploadError } = await sb.storage
        .from(BUCKET)
        .upload(storageName, fileBuffer, { contentType: ext === '.png' ? 'image/png' : 'image/jpeg', upsert: true });

      if (!uploadError) {
        const { data: urlData } = sb.storage.from(BUCKET).getPublicUrl(storageName);
        await sb.from('plantas').update({ imagem_principal: urlData.publicUrl }).eq('id', p.id);
        console.log('CORRIGIDA: "' + p.nome_popular + '" => ' + matchedFile);
        fixed++;
      } else {
        console.log('ERRO: "' + p.nome_popular + '" => ' + uploadError.message);
      }
    } else {
      // Tentar match parcial
      const words = normName.split(/(?=[A-Z])/);
      let partialMatch = null;
      for (const [key, file] of Object.entries(fileMapNorm)) {
        if (key.includes(normName) || normName.includes(key)) {
          partialMatch = file;
          break;
        }
      }

      if (partialMatch) {
        const filePath = path.join(IMAGES_DIR, partialMatch);
        const fileBuffer = fs.readFileSync(filePath);
        const ext = path.extname(partialMatch);
        const storageName = slugify(partialMatch);

        const { error: uploadError } = await sb.storage
          .from(BUCKET)
          .upload(storageName, fileBuffer, { contentType: ext === '.png' ? 'image/png' : 'image/jpeg', upsert: true });

        if (!uploadError) {
          const { data: urlData } = sb.storage.from(BUCKET).getPublicUrl(storageName);
          await sb.from('plantas').update({ imagem_principal: urlData.publicUrl }).eq('id', p.id);
          console.log('PARCIAL: "' + p.nome_popular + '" => ' + partialMatch);
          fixed++;
        }
      } else {
        stillMissing.push(p.nome_popular);
      }
    }
  }

  console.log('\n=== RESULTADO ===');
  console.log('Corrigidas: ' + fixed);
  console.log('Sem imagem definitivo: ' + stillMissing.length);
  if (stillMissing.length > 0) {
    console.log('\nPlantas sem imagem (definitivo):');
    stillMissing.forEach(n => console.log('  - ' + n));
  }
}

run().catch(console.error);
