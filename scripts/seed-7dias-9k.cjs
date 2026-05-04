/**
 * Adiciona propostas APROVADAS nos ultimos 7 dias:
 *  - Hoje (2026-04-19): R$ 1.500
 *  - Ultimos 7 dias total: R$ 9.000
 *  => Outros 4 dias somam R$ 7.500
 */
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://nnqctrjvtacswjvdgred.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ucWN0cmp2dGFjc3dqdmRncmVkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODUyMDk3MCwiZXhwIjoyMDg0MDk2OTcwfQ.R7dDcFqYV_r5w-A32S6hu0HogtKnwKBz0pIyk5dkLes'
);
const USER_ID = '51e74412-2cbc-486a-9666-dff8e80c4985';
const COMPANY = { name: 'Digital Paisagismo', email: 'digitalpaisagismo@gmail.com', phone: '' };

function shortId() {
  const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += c[Math.floor(Math.random() * c.length)];
  return s;
}
function slug(s) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

const PROPOSTAS = [
  // HOJE - R$ 1.500
  {
    nome: 'Camila Moretti',
    email: 'camila.moretti@gmail.com',
    phone: '(47) 99812-4430',
    service: 'manutencao',
    title: 'Manutencao Mensal - Camila',
    createdAt: '2026-04-19T11:30:00Z',
    total: 1500,
    items: [
      { name: 'Manutencao Mensal de Jardim', description: 'Visita semanal com poda, limpeza e irrigacao', quantity: 1, unit_price: 850 },
      { name: 'Poda de Manutencao', description: 'Poda de formacao em arbustos e arvores', quantity: 1, unit_price: 450 },
      { name: 'Adubacao Organica', description: 'Humus de minhoca + correcao do solo por m2', quantity: 10, unit_price: 20 },
    ],
  },
  // DIA 13 - R$ 2.500
  {
    nome: 'Rodrigo Albuquerque',
    email: 'rodrigo.albuquerque@hotmail.com',
    phone: '(48) 99127-8821',
    service: 'paisagismo',
    title: 'Paisagismo Frontal - Rodrigo',
    createdAt: '2026-04-13T14:15:00Z',
    total: 2500,
    items: [
      { name: 'Projeto Paisagistico Completo', description: 'Projeto 3D, planta baixa e memorial descritivo', quantity: 1, unit_price: 1200 },
      { name: 'Grama Esmeralda em Placas', description: 'Fornecimento e instalacao por m2', quantity: 30, unit_price: 25 },
      { name: 'Buxinho para Cerca Viva', description: 'Mudas formadas - unidade', quantity: 20, unit_price: 12 },
      { name: 'Palmeira Areca Bambu', description: 'Touceira adulta', quantity: 2, unit_price: 155 },
    ],
  },
  // DIA 15 - R$ 3.200
  {
    nome: 'Larissa Prado',
    email: 'larissa.prado@outlook.com',
    phone: '(11) 98745-3312',
    service: 'paisagismo',
    title: 'Jardim Vertical - Larissa',
    createdAt: '2026-04-15T10:40:00Z',
    total: 3200,
    items: [
      { name: 'Jardim Vertical', description: 'Estrutura metalica + substrato + plantas', quantity: 1, unit_price: 2200 },
      { name: 'Iluminacao Solar - Balizadores', description: 'Kit com 4 balizadores solares LED', quantity: 1, unit_price: 420 },
      { name: 'Substrato Vegetal - 50L', description: 'Saco de substrato premium', quantity: 6, unit_price: 40 },
      { name: 'Mao de Obra - Jardineiro (diaria)', description: '8h de trabalho', quantity: 2, unit_price: 170 },
    ],
  },
  // DIA 17 - R$ 1.800
  {
    nome: 'Thiago Barreto',
    email: 'thiago.barreto@gmail.com',
    phone: '(41) 99345-2211',
    service: 'manutencao',
    title: 'Servico de Poda - Thiago',
    createdAt: '2026-04-17T16:20:00Z',
    total: 1800,
    items: [
      { name: 'Poda de Manutencao', description: 'Poda de formacao em arbustos e arvores', quantity: 1, unit_price: 750 },
      { name: 'Limpeza Geral do Jardim', description: 'Remocao de ervas daninhas e material descartavel', quantity: 1, unit_price: 550 },
      { name: 'Mao de Obra - Jardineiro (diaria)', description: '8h de trabalho', quantity: 2, unit_price: 250 },
    ],
  },
];

async function main() {
  const proposals = [];
  const itemsMap = {};

  for (const p of PROPOSTAS) {
    const sum = p.items.reduce((s, it) => s + it.quantity * it.unit_price, 0);
    if (sum !== p.total) {
      console.error(`Total divergente em ${p.nome}: esperado ${p.total}, calculado ${sum}`);
      process.exit(1);
    }
    const sid = `${shortId()}/${slug(p.nome.split(' ')[0])}`;
    const created = new Date(p.createdAt);
    const sentAt = new Date(created.getTime() + 25 * 60 * 1000);
    const viewedAt = new Date(sentAt.getTime() + 2 * 3600 * 1000);
    const approvedAt = new Date(viewedAt.getTime() + 5 * 3600 * 1000);
    const validUntil = new Date(created.getTime() + 20 * 24 * 3600 * 1000);

    proposals.push({
      user_id: USER_ID,
      short_id: sid,
      client_id: null,
      client_name: p.nome,
      client_email: p.email,
      client_phone: p.phone,
      service_type: p.service,
      title: p.title,
      description: '',
      notes: '',
      valid_until: validUntil.toISOString(),
      status: 'approved',
      total: p.total,
      company_name: COMPANY.name,
      company_phone: COMPANY.phone,
      company_email: COMPANY.email,
      created_at: created.toISOString(),
      sent_at: sentAt.toISOString(),
      viewed_at: viewedAt.toISOString(),
      approved_at: approvedAt.toISOString(),
    });
    itemsMap[sid] = p.items;
  }

  const { data: inserted, error } = await supabase.from('proposals').insert(proposals).select('id, short_id');
  if (error) { console.error(error); process.exit(1); }

  const allItems = [];
  for (const row of inserted) {
    for (const it of itemsMap[row.short_id]) {
      allItems.push({ proposal_id: row.id, ...it });
    }
  }
  const { error: ie } = await supabase.from('proposal_items').insert(allItems);
  if (ie) { console.error(ie); process.exit(1); }

  const hoje = proposals.filter(p => p.created_at.startsWith('2026-04-19')).reduce((s, p) => s + p.total, 0);
  const soma = proposals.reduce((s, p) => s + p.total, 0);
  console.log(`Inseridas ${proposals.length} propostas approved.`);
  console.log(`Hoje (2026-04-19): R$ ${hoje.toLocaleString('pt-BR')}`);
  console.log(`Ultimos 7 dias: R$ ${soma.toLocaleString('pt-BR')}`);
  proposals.forEach(p => console.log(' -', p.created_at.substring(0, 10), '| R$', p.total.toString().padStart(5), '|', p.title));
}
main();
