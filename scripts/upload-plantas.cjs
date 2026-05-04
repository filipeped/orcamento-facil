/**
 * Upload imagens de plantas para Supabase Storage (bucket: vegetacoes)
 * e atualizar imagem_principal na tabela plantas
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const IMAGES_DIR = 'C:\\Users\\filip\\OneDrive\\Desktop\\MATERIAL\\PLANTAS-BANCO\\imagens';
const BUCKET = 'vegetacoes';
const BATCH_SIZE = 5; // uploads simultâneos (menor pra estabilidade)

const sb = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Remover acentos e caracteres especiais
function slugify(str) {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-zA-Z0-9._-]/g, '-') // troca especiais por hífen
    .replace(/-+/g, '-') // remove hífens duplos
    .toLowerCase();
}

async function run() {
  // Listar imagens
  const files = fs.readdirSync(IMAGES_DIR).filter(f => /\.(jpg|jpeg|png|webp|gif)$/i.test(f));
  console.log(`📦 ${files.length} imagens encontradas`);

  // Buscar plantas do banco
  const { data: plantas, error } = await sb
    .from('plantas')
    .select('id, nome_popular')
    .order('nome_popular');

  if (error) { console.error('Erro ao buscar plantas:', error); return; }
  console.log(`🌿 ${plantas.length} plantas no banco`);

  // Criar mapa nome -> id (normalizado)
  const plantaMap = {};
  plantas.forEach(p => {
    plantaMap[p.nome_popular.toLowerCase().trim()] = p.id;
  });

  let uploaded = 0;
  let matched = 0;
  let notFound = 0;
  let errors = 0;
  const notFoundList = [];

  // Processar em lotes
  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE);

    await Promise.all(batch.map(async (file) => {
      try {
        const ext = path.extname(file);
        const nameWithoutExt = path.basename(file, ext);
        const filePath = path.join(IMAGES_DIR, file);
        const fileBuffer = fs.readFileSync(filePath);

        // Nome do arquivo no storage (slug sem acentos)
        const storageName = slugify(file);

        // Upload para Supabase Storage
        const { error: uploadError } = await sb.storage
          .from(BUCKET)
          .upload(storageName, fileBuffer, {
            contentType: ext === '.png' ? 'image/png' : 'image/jpeg',
            upsert: true,
          });

        if (uploadError) {
          console.error(`❌ Erro upload ${file}:`, uploadError.message);
          errors++;
          return;
        }

        uploaded++;

        // Gerar URL pública
        const { data: urlData } = sb.storage
          .from(BUCKET)
          .getPublicUrl(storageName);

        const publicUrl = urlData.publicUrl;

        // Procurar planta correspondente
        const plantaId = plantaMap[nameWithoutExt.toLowerCase().trim()];

        if (plantaId) {
          // Atualizar imagem_principal no banco
          const { error: updateError } = await sb
            .from('plantas')
            .update({ imagem_principal: publicUrl })
            .eq('id', plantaId);

          if (updateError) {
            console.error(`❌ Erro update ${nameWithoutExt}:`, updateError.message);
          } else {
            matched++;
          }
        } else {
          notFound++;
          notFoundList.push(nameWithoutExt);
        }

        // Log progresso
        if ((uploaded) % 50 === 0) {
          console.log(`📤 ${uploaded}/${files.length} enviadas | ${matched} atualizadas`);
        }
      } catch (err) {
        console.error(`❌ Erro ${file}:`, err.message);
        errors++;
      }
    }));
  }

  console.log(`\n✅ RESULTADO:`);
  console.log(`📤 ${uploaded} imagens enviadas ao Supabase`);
  console.log(`🔗 ${matched} plantas atualizadas no banco`);
  console.log(`⚠️  ${notFound} imagens sem planta correspondente`);
  console.log(`❌ ${errors} erros`);

  if (notFoundList.length > 0 && notFoundList.length <= 30) {
    console.log(`\n⚠️ Sem correspondência:`, notFoundList.join(', '));
  }
}

run().catch(console.error);
