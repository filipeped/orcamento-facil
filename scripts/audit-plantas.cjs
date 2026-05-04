const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const IMAGES_DIR = 'C:\\Users\\filip\\OneDrive\\Desktop\\MATERIAL\\PLANTAS-BANCO\\imagens';
const BUCKET = 'vegetacoes';

function slugify(str) {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase();
}

async function run() {
  const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  // Plantas sem imagem Supabase
  const { data: semImagem } = await sb
    .from('plantas')
    .select('id, nome_popular, imagem_principal')
    .or('imagem_principal.is.null,imagem_principal.like.%jardineiro.net%')
    .order('nome_popular');

  console.log('=== PLANTAS SEM IMAGEM SUPABASE: ' + semImagem.length + ' ===\n');

  // Listar arquivos
  const files = fs.readdirSync(IMAGES_DIR).filter(f => /\.(jpg|jpeg|png|webp|gif)$/i.test(f));

  // Mapa normalizado: slugify do nome -> arquivo original
  const fileMapSlug = {};
  files.forEach(f => {
    const name = path.basename(f, path.extname(f));
    fileMapSlug[slugify(name)] = f;
  });

  let fixed = 0;
  let noFile = 0;
  const noFileList = [];

  for (const p of semImagem) {
    const slugName = slugify(p.nome_popular);
    const matchedFile = fileMapSlug[slugName];

    if (matchedFile) {
      // Upload e atualizar
      const filePath = path.join(IMAGES_DIR, matchedFile);
      const fileBuffer = fs.readFileSync(filePath);
      const ext = path.extname(matchedFile);
      const storageName = slugify(matchedFile);

      const { error: uploadError } = await sb.storage
        .from(BUCKET)
        .upload(storageName, fileBuffer, {
          contentType: ext === '.png' ? 'image/png' : 'image/jpeg',
          upsert: true,
        });

      if (uploadError) {
        console.log('ERRO UPLOAD: "' + p.nome_popular + '" => ' + uploadError.message);
        continue;
      }

      const { data: urlData } = sb.storage.from(BUCKET).getPublicUrl(storageName);

      const { error: updateError } = await sb
        .from('plantas')
        .update({ imagem_principal: urlData.publicUrl })
        .eq('id', p.id);

      if (updateError) {
        console.log('ERRO UPDATE: "' + p.nome_popular + '" => ' + updateError.message);
      } else {
        console.log('CORRIGIDA: "' + p.nome_popular + '" => ' + storageName);
        fixed++;
      }
    } else {
      noFile++;
      noFileList.push(p.nome_popular);
    }
  }

  console.log('\n=== RESULTADO ===');
  console.log('Corrigidas agora: ' + fixed);
  console.log('Sem arquivo disponivel: ' + noFile);
  if (noFileList.length > 0) {
    console.log('\nPlantas sem imagem:');
    noFileList.forEach(n => console.log('  - ' + n));
  }
}

run().catch(console.error);
