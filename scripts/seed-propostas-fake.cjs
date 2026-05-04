/**
 * Seed de 50 propostas fake para conta de demonstracao
 * User: digitalpaisagismo@gmail.com
 * Distribuicao: ultimos 5 meses (2025-11-19 ate 2026-04-19)
 */
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://nnqctrjvtacswjvdgred.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ucWN0cmp2dGFjc3dqdmRncmVkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODUyMDk3MCwiZXhwIjoyMDg0MDk2OTcwfQ.R7dDcFqYV_r5w-A32S6hu0HogtKnwKBz0pIyk5dkLes';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const USER_ID = '51e74412-2cbc-486a-9666-dff8e80c4985';
const COMPANY_NAME = 'Digital Paisagismo';
const COMPANY_PHONE = '';
const COMPANY_EMAIL = 'digitalpaisagismo@gmail.com';

const PRIMEIRO_NOMES = [
  'Ana', 'Beatriz', 'Carla', 'Daniela', 'Eduarda', 'Fernanda', 'Gabriela', 'Helena',
  'Isabela', 'Juliana', 'Karina', 'Larissa', 'Mariana', 'Natalia', 'Patricia',
  'Renata', 'Simone', 'Tatiana', 'Vanessa',
  'Alexandre', 'Bruno', 'Carlos', 'Diego', 'Eduardo', 'Felipe', 'Gustavo', 'Henrique',
  'Igor', 'Joao', 'Kleber', 'Leonardo', 'Marcelo', 'Nicolas', 'Otavio',
  'Paulo', 'Rafael', 'Rodrigo', 'Thiago', 'Vinicius', 'William'
];

const SOBRENOMES = [
  'Silva', 'Santos', 'Oliveira', 'Souza', 'Pereira', 'Lima', 'Gomes', 'Ribeiro',
  'Carvalho', 'Almeida', 'Martins', 'Rocha', 'Cardoso', 'Moreira', 'Dias',
  'Nascimento', 'Araujo', 'Correia', 'Monteiro', 'Fernandes', 'Vieira', 'Costa',
  'Barbosa', 'Mendes', 'Teixeira', 'Freitas'
];

const DOMINIOS = ['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com.br', 'uol.com.br'];

const SERVICOS = ['manutencao', 'paisagismo', 'outro'];

// Catalogo realista de itens de paisagismo BR
const ITENS_PAISAGISMO = [
  { name: 'Projeto Paisagistico Completo', desc: 'Projeto 3D, planta baixa e memorial descritivo', price: [1200, 3500] },
  { name: 'Execucao de Jardim - Area Frontal', desc: 'Preparo do solo, plantio e adubacao', price: [1800, 4500] },
  { name: 'Jardim Vertical', desc: 'Estrutura metalica + substrato + plantas', price: [800, 2800] },
  { name: 'Grama Esmeralda em Placas', desc: 'Fornecimento e instalacao por m2', price: [18, 28] },
  { name: 'Grama Sao Carlos em Placas', desc: 'Fornecimento e instalacao por m2', price: [22, 32] },
  { name: 'Palmeira Rafis (muda media)', desc: 'Planta adulta 1.5m', price: [180, 280] },
  { name: 'Palmeira Areca Bambu', desc: 'Touceira adulta', price: [120, 220] },
  { name: 'Buxinho para Cerca Viva', desc: 'Mudas formadas - unidade', price: [8, 15] },
  { name: 'Moreia Variegata', desc: 'Touceira pequena', price: [12, 22] },
  { name: 'Iresine - Planta Vermelha', desc: 'Para composicao de canteiros', price: [5, 10] },
  { name: 'Tapete de Grama Amendoim', desc: 'Forracao ornamental por m2', price: [35, 55] },
  { name: 'Pedra Sao Tome', desc: 'Fornecimento e assentamento por m2', price: [120, 180] },
  { name: 'Iluminacao Solar - Balizadores', desc: 'Kit com 4 balizadores solares LED', price: [280, 480] },
  { name: 'Sistema de Irrigacao Automatica', desc: 'Gotejamento + timer + instalacao', price: [650, 1800] },
  { name: 'Mao de Obra - Jardineiro (diaria)', desc: '8h de trabalho', price: [180, 280] },
  { name: 'Adubacao Organica', desc: 'Humus de minhoca + correcao do solo por m2', price: [15, 25] },
  { name: 'Poda de Manutencao', desc: 'Poda de formacao em arbustos e arvores', price: [350, 850] },
  { name: 'Limpeza Geral do Jardim', desc: 'Remocao de ervas daninhas e material descartavel', price: [250, 650] },
  { name: 'Aplicacao de Casca de Pinus', desc: 'Por m2 - decorativo e protetor do solo', price: [22, 35] },
  { name: 'Mudas de Lavanda', desc: 'Unidade - planta aromatica', price: [18, 32] },
  { name: 'Agapanto Azul', desc: 'Touceira - floracao em verao', price: [25, 45] },
  { name: 'Azaleia Branca', desc: 'Arbusto floral unidade', price: [35, 65] },
  { name: 'Hibisco Rosa', desc: 'Arbusto floral unidade', price: [45, 85] },
  { name: 'Manutencao Mensal de Jardim', desc: 'Visita semanal com poda, limpeza e irrigacao', price: [450, 1200] },
  { name: 'Substrato Vegetal - 50L', desc: 'Saco de substrato premium', price: [35, 55] },
  { name: 'Vaso Concreto Decorativo Grande', desc: 'Vaso 60cm + planta + substrato', price: [380, 680] },
  { name: 'Deck de Madeira para Jardim', desc: 'Cumaru - por m2 com instalacao', price: [380, 580] },
  { name: 'Treliça de Madeira Tratada', desc: 'Para plantas trepadeiras', price: [180, 380] },
  { name: 'Primavera Trepadeira', desc: 'Muda adulta - floracao abundante', price: [35, 75] },
  { name: 'Jasmim Manga', desc: 'Arbusto perfumado', price: [40, 80] },
];

const SERVICE_TYPE_TITULOS = {
  manutencao: [
    'Manutencao Mensal',
    'Manutencao Jardim',
    'Servico de Poda',
    'Limpeza e Poda',
    'Manutencao Preventiva',
  ],
  paisagismo: [
    'Projeto Paisagistico',
    'Reforma de Jardim',
    'Paisagismo Residencial',
    'Jardim Frontal',
    'Paisagismo Completo',
  ],
  outro: [
    'Orcamento',
    'Servico Especial',
    'Consultoria',
  ],
};

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick(arr) { return arr[randInt(0, arr.length - 1)]; }

function slugify(s) {
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 30);
}

function genShortId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[randInt(0, chars.length - 1)];
  return s;
}

function genTelefone() {
  const ddd = pick(['47', '48', '11', '21', '31', '41', '51', '61', '62']);
  return `(${ddd}) 9${randInt(1000, 9999)}-${randInt(1000, 9999)}`;
}

function genCliente() {
  const primeiro = pick(PRIMEIRO_NOMES);
  const sobrenome = pick(SOBRENOMES);
  const nomeCompleto = `${primeiro} ${sobrenome}`;
  const email = `${slugify(primeiro)}.${slugify(sobrenome)}${randInt(1, 99)}@${pick(DOMINIOS)}`;
  return { nome: nomeCompleto, email, telefone: genTelefone() };
}

function genItens() {
  const qtd = randInt(2, 6);
  const usados = new Set();
  const itens = [];
  while (itens.length < qtd) {
    const idx = randInt(0, ITENS_PAISAGISMO.length - 1);
    if (usados.has(idx)) continue;
    usados.add(idx);
    const tpl = ITENS_PAISAGISMO[idx];
    const priceBase = randInt(tpl.price[0], tpl.price[1]);
    // arredonda pra multiplo de 5 pra parecer mais natural
    const unitPrice = Math.round(priceBase / 5) * 5;
    const isGrama = /grama|pedra|deck|adubacao|casca|forracao/i.test(tpl.name);
    const isBuxinho = /buxinho|moreia|iresine|mudas|agapanto|azaleia/i.test(tpl.name);
    const quantity = isGrama ? randInt(15, 120) : isBuxinho ? randInt(8, 40) : randInt(1, 3);
    itens.push({
      name: tpl.name,
      description: tpl.desc,
      quantity,
      unit_price: unitPrice,
    });
  }
  return itens;
}

// Distribui n datas entre start e end (ms)
function spreadDates(n, startMs, endMs) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const jitter = (Math.random() - 0.5) * 0.15; // ruido
    const frac = Math.max(0, Math.min(1, (i + 0.5) / n + jitter));
    const t = startMs + frac * (endMs - startMs);
    out.push(new Date(t));
  }
  return out.sort((a, b) => a - b);
}

async function main() {
  const TOTAL = 50;
  const HOJE = new Date('2026-04-18T20:00:00Z');
  const CINCO_MESES_ATRAS = new Date('2025-11-19T12:00:00Z');

  const datas = spreadDates(TOTAL, CINCO_MESES_ATRAS.getTime(), HOJE.getTime());

  // Distribuicao de status:
  // 30 approved, 8 viewed, 8 sent, 4 expired
  const statusPool = [
    ...Array(30).fill('approved'),
    ...Array(8).fill('viewed'),
    ...Array(8).fill('sent'),
    ...Array(4).fill('expired'),
  ];
  // embaralha mas mantem as mais antigas mais propensas a approved/expired
  statusPool.sort(() => Math.random() - 0.5);

  const proposals = [];
  const itemsByShortId = {};

  for (let i = 0; i < TOTAL; i++) {
    const createdAt = datas[i];
    const status = statusPool[i];
    const serviceType = pick(SERVICOS);
    const cliente = genCliente();
    const itens = genItens();
    const total = itens.reduce((s, it) => s + it.quantity * it.unit_price, 0);

    const tituloBase = pick(SERVICE_TYPE_TITULOS[serviceType]);
    const title = `${tituloBase} - ${cliente.nome.split(' ')[0]}`;

    const shortBase = genShortId();
    const shortId = `${shortBase}/${slugify(cliente.nome.split(' ')[0])}`;

    // validUntil: 15-30 dias apos criacao
    const validUntil = new Date(createdAt.getTime() + randInt(15, 30) * 24 * 3600 * 1000);

    // timestamps derivados do status
    let sent_at = null, viewed_at = null, approved_at = null;
    if (status === 'sent' || status === 'viewed' || status === 'approved' || status === 'expired') {
      sent_at = new Date(createdAt.getTime() + randInt(10, 120) * 60 * 1000).toISOString();
    }
    if (status === 'viewed' || status === 'approved') {
      viewed_at = new Date(new Date(sent_at).getTime() + randInt(30, 72) * 3600 * 1000).toISOString();
    }
    if (status === 'approved') {
      approved_at = new Date(new Date(viewed_at).getTime() + randInt(1, 96) * 3600 * 1000).toISOString();
    }

    proposals.push({
      user_id: USER_ID,
      short_id: shortId,
      client_id: null,
      client_name: cliente.nome,
      client_email: cliente.email,
      client_phone: cliente.telefone,
      service_type: serviceType,
      title,
      description: '',
      notes: '',
      valid_until: validUntil.toISOString(),
      status,
      total,
      company_name: COMPANY_NAME,
      company_phone: COMPANY_PHONE,
      company_email: COMPANY_EMAIL,
      created_at: createdAt.toISOString(),
      sent_at,
      viewed_at,
      approved_at,
    });
    itemsByShortId[shortId] = itens;
  }

  console.log(`Inserindo ${proposals.length} propostas...`);
  const { data: inserted, error: insErr } = await supabase
    .from('proposals')
    .insert(proposals)
    .select('id, short_id');

  if (insErr) {
    console.error('Erro inserindo propostas:', insErr);
    process.exit(1);
  }

  console.log(`${inserted.length} propostas inseridas. Inserindo items...`);

  const allItems = [];
  for (const row of inserted) {
    const list = itemsByShortId[row.short_id];
    for (const it of list) {
      allItems.push({ proposal_id: row.id, ...it });
    }
  }

  const { error: itemErr } = await supabase.from('proposal_items').insert(allItems);
  if (itemErr) {
    console.error('Erro inserindo items:', itemErr);
    process.exit(1);
  }

  console.log(`${allItems.length} items inseridos.`);

  // resumo
  const counts = proposals.reduce((acc, p) => { acc[p.status] = (acc[p.status] || 0) + 1; return acc; }, {});
  console.log('\nResumo por status:', counts);

  const totalFaturado = proposals.filter(p => p.status === 'approved').reduce((s, p) => s + p.total, 0);
  console.log('Total "faturado" (approved):', `R$ ${totalFaturado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);

  const primeiro = proposals[0].created_at;
  const ultimo = proposals[proposals.length - 1].created_at;
  console.log(`Periodo: ${primeiro} -> ${ultimo}`);
}

main().catch(e => { console.error(e); process.exit(1); });
