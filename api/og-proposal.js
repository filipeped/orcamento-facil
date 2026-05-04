import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Debug: verificar se as variáveis estão definidas
if (!supabaseUrl || !supabaseKey) {
  console.error('Missing env vars:', {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseKey
  });
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Escapar caracteres HTML para evitar XSS em meta tags
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export default async function handler(req, res) {
  const { id, name } = req.query;

  if (!id) {
    return res.status(400).send('ID da proposta não informado');
  }

  try {
    // Reconstruir o short_id completo
    // Pode vir como "B1CMGO/lucas" no id, ou id="B1CMGO" + name="lucas" (vindo do rewrite)
    const fullShortId = name ? `${id}/${name}` : id;
    // Também prepara variante sem barra (UUID ou short_id simples)
    const codeOnly = String(id).split('/')[0];

    // 1. Tenta pelo short_id completo (formato novo: CODE/nome-cliente)
    let { data: proposal } = await supabase
      .from('proposals')
      .select('*')
      .eq('short_id', fullShortId)
      .single();

    // 2. Fallback: busca por short_id que comece com o code (caso URL tenha só CODE)
    if (!proposal) {
      const { data } = await supabase
        .from('proposals')
        .select('*')
        .ilike('short_id', `${codeOnly}/%`)
        .limit(1)
        .single();
      proposal = data;
    }

    // 3. Último fallback: busca por UUID
    if (!proposal) {
      const { data } = await supabase
        .from('proposals')
        .select('*')
        .eq('id', codeOnly)
        .single();
      proposal = data;
    }

    if (!proposal) {
      console.error('Proposta não encontrada:', { fullShortId, codeOnly });
      return res.status(404).send('Proposta não encontrada');
    }

    // Buscar perfil do JARDINEIRO (dono da proposta) com mais dados
    const { data: profile } = await supabase
      .from('profiles')
      .select('company_name, full_name, logo_url, bio')
      .eq('user_id', proposal.user_id)
      .single();

    // 🎯 DADOS DA EMPRESA DO JARDINEIRO (nunca do Jardinei SaaS)
    const companyName = escapeHtml(
      proposal.company_name || profile?.company_name || profile?.full_name || 'Orçamento'
    );
    const clientName = escapeHtml(proposal.client_name || 'Cliente');
    const bio = escapeHtml(profile?.bio || '');
    const total = proposal.total || 0;
    // Logo: preferência pelo logo do jardineiro; se ele nao tem, usa placeholder neutro (NUNCA logo do Jardinei SaaS)
    const logoUrl = proposal.company_logo ||
                    profile?.logo_url ||
                    'https://verproposta.online/icons/icon-512x512.png';

    const formattedTotal = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(total);

    // Título e descrição: 100% focados na empresa do jardineiro
    const title = `${companyName} — Orçamento para ${clientName}`;
    const description = bio
      ? `${bio} · Orçamento de ${formattedTotal}`
      : `Orçamento no valor de ${formattedTotal}. Clique para ver os detalhes.`;
    const url = `https://verproposta.online/p/${escapeHtml(id)}`;

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <meta name="description" content="${description}">

  <!-- Open Graph / Facebook / WhatsApp -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="${url}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${logoUrl}">
  <meta property="og:image:width" content="800">
  <meta property="og:image:height" content="800">
  <meta property="og:site_name" content="${companyName}">
  <meta property="og:locale" content="pt_BR">

  <!-- Twitter -->
  <meta name="twitter:card" content="summary">
  <meta name="twitter:url" content="${url}">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${logoUrl}">

  <!-- Redirect para a página real (humanos que caem aqui por algum motivo) -->
  <meta http-equiv="refresh" content="0;url=${url}">
  <script>window.location.href = "${url}";</script>
</head>
<body>
  <p>Redirecionando para <a href="${url}">${title}</a>...</p>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    return res.status(200).send(html);

  } catch (error) {
    console.error('Erro ao buscar proposta:', error);
    return res.status(500).send('Erro interno');
  }
}
