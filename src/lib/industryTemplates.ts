export type Industry = {
  id: string;
  label: string;
  emoji: string;
  defaultItems: IndustryItemTemplate[];
};

export type IndustryItemTemplate = {
  name: string;
  description?: string;
  price: number;
  unit: string;
  category: string;
};

// Catálogos por nicho — itens prontos pra acelerar criação de orçamento.
// Inspirado no Invoice Fly (tutorial_estimate_items_pt.json) com preços
// adaptados pra realidade brasileira.
export const INDUSTRIES: Industry[] = [
  {
    id: "jardinagem",
    label: "Jardinagem e Paisagismo",
    emoji: "🌿",
    defaultItems: [
      { name: "Manutenção de jardim", description: "Corte de grama, capina e limpeza geral", price: 150, unit: "hr", category: "Serviços" },
      { name: "Poda de árvores e arbustos", description: "Poda de manutenção e formação", price: 200, unit: "serviço", category: "Serviços" },
      { name: "Plantio de mudas", description: "Plantio com correção de solo e adubação inicial", price: 50, unit: "un", category: "Serviços" },
      { name: "Adubação e fertilização", description: "Aplicação de adubo orgânico ou químico", price: 80, unit: "m²", category: "Serviços" },
      { name: "Sistema de irrigação", description: "Instalação de irrigação por gotejamento ou aspersão", price: 120, unit: "m", category: "Serviços" },
      { name: "Plantio de grama", description: "Fornecimento e instalação de grama em rolo", price: 25, unit: "m²", category: "Serviços" },
      { name: "Remoção de vegetação", description: "Remoção de plantas, raízes e descarte", price: 35, unit: "m²", category: "Serviços" },
      { name: "Mão de obra (diária)", price: 250, unit: "dia", category: "Mão de Obra" },
    ],
  },
  {
    id: "eletrica",
    label: "Elétrica",
    emoji: "⚡",
    defaultItems: [
      { name: "Instalação de tomada", description: "Tomada padrão 10A ou 20A com fiação", price: 80, unit: "un", category: "Serviços" },
      { name: "Instalação de tomada GFCI", description: "Tomada com proteção contra choque (banheiros/cozinhas)", price: 120, unit: "un", category: "Serviços" },
      { name: "Troca de disjuntor", description: "Troca de disjuntor monopolar/bipolar no quadro", price: 120, unit: "un", category: "Serviços" },
      { name: "Instalação de luminária", description: "Instalação de luminária de teto ou parede", price: 60, unit: "un", category: "Serviços" },
      { name: "Spot/luminária embutida", description: "Recorte do gesso, fiação e instalação de spot LED", price: 90, unit: "un", category: "Serviços" },
      { name: "Passagem de fiação", description: "Cabeamento elétrico em conduítes existentes", price: 25, unit: "m", category: "Serviços" },
      { name: "Diagnóstico elétrico", description: "Análise da instalação e relatório", price: 150, unit: "serviço", category: "Serviços" },
      { name: "Materiais elétricos", description: "Fios, tomadas, interruptores e caixas", price: 0, unit: "un", category: "Materiais" },
      { name: "Hora técnica eletricista", price: 90, unit: "hr", category: "Mão de Obra" },
    ],
  },
  {
    id: "hidraulica",
    label: "Hidráulica e Encanamento",
    emoji: "🔧",
    defaultItems: [
      { name: "Desentupimento de pia/ralo", description: "Desentupimento mecânico ou químico", price: 150, unit: "serviço", category: "Serviços" },
      { name: "Troca de torneira", description: "Troca incluindo vedação", price: 80, unit: "un", category: "Serviços" },
      { name: "Conserto de vazamento", description: "Localização e reparo de vazamento", price: 200, unit: "serviço", category: "Serviços" },
      { name: "Instalação de chuveiro", description: "Instalação completa com fiação se elétrico", price: 100, unit: "un", category: "Serviços" },
      { name: "Instalação de vaso sanitário", description: "Vaso completo + flange + parafusos", price: 180, unit: "un", category: "Serviços" },
      { name: "Instalação de pia", description: "Pia com sifão, válvula e torneira", price: 220, unit: "un", category: "Serviços" },
      { name: "Materiais hidráulicos", description: "Tubos, conexões, válvulas, vedantes", price: 0, unit: "un", category: "Materiais" },
      { name: "Hora técnica encanador", price: 90, unit: "hr", category: "Mão de Obra" },
    ],
  },
  {
    id: "pintura",
    label: "Pintura",
    emoji: "🎨",
    defaultItems: [
      { name: "Pintura de parede (massa + tinta)", description: "Massa corrida, lixamento e 2 demãos de tinta", price: 35, unit: "m²", category: "Serviços" },
      { name: "Pintura de teto", description: "Pintura branca padrão de teto", price: 30, unit: "m²", category: "Serviços" },
      { name: "Aplicação de massa corrida", description: "Aplicação e lixamento", price: 18, unit: "m²", category: "Serviços" },
      { name: "Lixamento de superfície", description: "Preparação para nova pintura", price: 12, unit: "m²", category: "Serviços" },
      { name: "Pintura de portão/grade", description: "Esmalte sintético sobre ferro", price: 80, unit: "m²", category: "Serviços" },
      { name: "Tinta látex acrílica (lata 18L)", description: "Tinta interior para paredes e tetos", price: 290, unit: "un", category: "Materiais" },
      { name: "Material de pintura", description: "Rolos, pincéis, fita crepe, panos", price: 80, unit: "serviço", category: "Materiais" },
      { name: "Mão de obra pintor (diária)", price: 220, unit: "dia", category: "Mão de Obra" },
    ],
  },
  {
    id: "limpeza",
    label: "Limpeza e Diarista",
    emoji: "🧹",
    defaultItems: [
      { name: "Diária residencial", description: "8h de limpeza geral", price: 180, unit: "dia", category: "Serviços" },
      { name: "Limpeza pós-obra", description: "Remoção de poeira, respingos de tinta, cimento", price: 25, unit: "m²", category: "Serviços" },
      { name: "Limpeza pós-mudança", description: "Limpeza profunda incluindo cozinha, banheiros e janelas", price: 350, unit: "serviço", category: "Serviços" },
      { name: "Limpeza de vidros", description: "Janelas internas e externas", price: 8, unit: "m²", category: "Serviços" },
      { name: "Higienização de estofado", description: "Lavagem a seco de sofá ou cadeira", price: 150, unit: "un", category: "Serviços" },
      { name: "Faxina pesada", description: "Limpeza profunda incluindo armários e geladeira", price: 250, unit: "dia", category: "Serviços" },
      { name: "Materiais de limpeza", description: "Detergentes, panos, sacos de lixo", price: 50, unit: "serviço", category: "Materiais" },
    ],
  },
  {
    id: "reforma",
    label: "Reforma e Construção",
    emoji: "🏗️",
    defaultItems: [
      { name: "Mão de obra (diária pedreiro)", price: 250, unit: "dia", category: "Mão de Obra" },
      { name: "Quebra de parede", description: "Demolição com remoção de entulho", price: 80, unit: "m²", category: "Serviços" },
      { name: "Levante de parede", description: "Alvenaria com tijolos cerâmicos ou blocos", price: 110, unit: "m²", category: "Serviços" },
      { name: "Assentamento de piso", description: "Mão de obra de assentamento (sem material)", price: 45, unit: "m²", category: "Serviços" },
      { name: "Reboco de parede", description: "Massa única ou reboco tradicional", price: 35, unit: "m²", category: "Serviços" },
      { name: "Aluguel de caçamba", description: "Caçamba para descarte de entulho", price: 350, unit: "un", category: "Equipamentos" },
      { name: "Saco de cimento 50kg", price: 38, unit: "un", category: "Materiais" },
    ],
  },
  {
    id: "reforma-banheiro",
    label: "Reforma de Banheiro",
    emoji: "🚿",
    defaultItems: [
      { name: "Demolição completa do banheiro", description: "Remoção de azulejos, louças, móveis e descarte", price: 1200, unit: "serviço", category: "Serviços" },
      { name: "Aluguel de caçamba", description: "Caçamba pequena para entulho", price: 350, unit: "un", category: "Equipamentos" },
      { name: "Impermeabilização (manta líquida)", description: "Aplicação em piso e paredes molháveis", price: 65, unit: "m²", category: "Serviços" },
      { name: "Assentamento de piso e parede", description: "Mão de obra (azulejo/porcelanato)", price: 80, unit: "m²", category: "Serviços" },
      { name: "Vaso sanitário com caixa acoplada", description: "Conjunto completo de louça branca", price: 480, unit: "un", category: "Materiais" },
      { name: "Pia de banheiro com gabinete", description: "Cuba + gabinete + torneira", price: 850, unit: "un", category: "Materiais" },
      { name: "Box de vidro temperado", description: "Box frontal com perfil de alumínio", price: 1200, unit: "un", category: "Materiais" },
      { name: "Chuveiro elétrico ou ducha", description: "Instalação completa", price: 250, unit: "un", category: "Serviços" },
      { name: "Instalação hidráulica completa", description: "Pontos de água quente e fria", price: 1800, unit: "serviço", category: "Serviços" },
      { name: "Instalação elétrica do banheiro", description: "Pontos de tomada GFCI, iluminação e ducha", price: 950, unit: "serviço", category: "Serviços" },
    ],
  },
  {
    id: "reforma-cozinha",
    label: "Reforma de Cozinha",
    emoji: "🍳",
    defaultItems: [
      { name: "Demolição (azulejos, bancadas, armários)", description: "Remoção e descarte de itens existentes", price: 1500, unit: "serviço", category: "Serviços" },
      { name: "Aluguel de caçamba", description: "Caçamba 5m³ para entulho", price: 450, unit: "un", category: "Equipamentos" },
      { name: "Reboco e regularização", description: "Preparação de paredes para azulejo", price: 35, unit: "m²", category: "Serviços" },
      { name: "Instalação de azulejo na parede", description: "Mão de obra de assentamento", price: 65, unit: "m²", category: "Serviços" },
      { name: "Piso de porcelanato 60×60", description: "Material de médio padrão", price: 65, unit: "m²", category: "Materiais" },
      { name: "Bancada de granito", description: "Granito comum, instalado", price: 380, unit: "m²", category: "Materiais" },
      { name: "Bancada de quartzo", description: "Quartzo de médio padrão, instalado", price: 850, unit: "m²", category: "Materiais" },
      { name: "Armários planejados (MDF)", description: "Marcenaria sob medida em MDF", price: 1100, unit: "m²", category: "Serviços" },
      { name: "Pia de cozinha inox", description: "Cuba simples instalada", price: 380, unit: "un", category: "Materiais" },
      { name: "Instalação hidráulica da pia", description: "Sifão, registros, conexões", price: 220, unit: "serviço", category: "Serviços" },
      { name: "Pontos elétricos GFCI", description: "Tomadas com proteção, fiação e disjuntor", price: 180, unit: "un", category: "Serviços" },
      { name: "Iluminação embutida (spots LED)", description: "Spot + recorte + instalação", price: 110, unit: "un", category: "Serviços" },
      { name: "Pintura final", description: "Massa, lixamento e duas demãos", price: 35, unit: "m²", category: "Serviços" },
    ],
  },
  {
    id: "piso",
    label: "Troca de Piso",
    emoji: "🟫",
    defaultItems: [
      { name: "Remoção de piso existente", description: "Quebra e descarte de cerâmica/porcelanato/laminado", price: 35, unit: "m²", category: "Serviços" },
      { name: "Remoção de carpete", description: "Remoção e descarte de carpete e enchimento", price: 18, unit: "m²", category: "Serviços" },
      { name: "Aluguel de caçamba", description: "Caçamba para descarte", price: 350, unit: "un", category: "Equipamentos" },
      { name: "Regularização do contrapiso", description: "Argamassa autonivelante ou tradicional", price: 45, unit: "m²", category: "Serviços" },
      { name: "Piso laminado (instalado)", description: "Laminado clicado de médio padrão", price: 95, unit: "m²", category: "Serviços" },
      { name: "Piso vinílico LVT (instalado)", description: "Vinílico colado", price: 110, unit: "m²", category: "Serviços" },
      { name: "Porcelanato 60×60 (instalado)", description: "Porcelanato esmaltado de médio padrão", price: 130, unit: "m²", category: "Serviços" },
      { name: "Rodapé de MDF (instalado)", description: "Rodapé branco 7cm", price: 22, unit: "m", category: "Serviços" },
      { name: "Mão de obra assentamento", price: 45, unit: "m²", category: "Mão de Obra" },
    ],
  },
  {
    id: "marcenaria",
    label: "Marcenaria",
    emoji: "🪵",
    defaultItems: [
      { name: "Móvel planejado MDF", description: "Marcenaria sob medida em MDF de médio padrão", price: 850, unit: "m²", category: "Serviços" },
      { name: "Armário de banheiro", description: "Armário com gabinete e prateleiras", price: 1200, unit: "un", category: "Serviços" },
      { name: "Painel de TV", description: "Painel ripado ou liso, instalado", price: 1800, unit: "serviço", category: "Serviços" },
      { name: "Conserto de móvel", description: "Reparo de gavetas, dobradiças, ferragens", price: 150, unit: "serviço", category: "Serviços" },
      { name: "Instalação de móvel", description: "Montagem e fixação", price: 100, unit: "un", category: "Serviços" },
      { name: "Hora técnica marcenaria", price: 90, unit: "hr", category: "Mão de Obra" },
    ],
  },
  {
    id: "serralheria",
    label: "Serralheria",
    emoji: "🔩",
    defaultItems: [
      { name: "Portão de ferro", description: "Portão simples instalado", price: 450, unit: "m²", category: "Serviços" },
      { name: "Grade de proteção", description: "Grade em ferro chato ou tubular", price: 280, unit: "m²", category: "Serviços" },
      { name: "Conserto de portão", description: "Reparo de motor, dobradiças ou estrutura", price: 200, unit: "serviço", category: "Serviços" },
      { name: "Instalação de fechadura", description: "Fechadura de embutir ou cilindro", price: 80, unit: "un", category: "Serviços" },
      { name: "Corrimão de escada", description: "Estrutura em ferro com fixação", price: 380, unit: "m", category: "Serviços" },
    ],
  },
  {
    id: "ar-condicionado",
    label: "Ar Condicionado",
    emoji: "❄️",
    defaultItems: [
      { name: "Instalação de split (até 12.000 BTUs)", description: "Instalação completa com 3m de tubulação", price: 450, unit: "un", category: "Serviços" },
      { name: "Instalação de split (18.000+ BTUs)", description: "Instalação completa com 3m de tubulação", price: 650, unit: "un", category: "Serviços" },
      { name: "Higienização de split", description: "Limpeza profunda com produtos específicos", price: 180, unit: "un", category: "Serviços" },
      { name: "Recarga de gás R-410A", description: "Recarga + verificação de vazamentos", price: 250, unit: "serviço", category: "Serviços" },
      { name: "Manutenção preventiva", description: "Limpeza, verificação e teste", price: 120, unit: "un", category: "Serviços" },
      { name: "Conserto de placa eletrônica", description: "Diagnóstico e reparo", price: 280, unit: "serviço", category: "Serviços" },
    ],
  },
  {
    id: "dedetizacao",
    label: "Dedetização",
    emoji: "🪲",
    defaultItems: [
      { name: "Dedetização residencial", description: "Aplicação geral em residência até 100m²", price: 250, unit: "serviço", category: "Serviços" },
      { name: "Descupinização", description: "Tratamento contra cupins (madeira)", price: 350, unit: "serviço", category: "Serviços" },
      { name: "Desratização", description: "Iscas e armadilhas em pontos estratégicos", price: 200, unit: "serviço", category: "Serviços" },
      { name: "Aplicação adicional (m²)", description: "Para áreas além de 100m²", price: 5, unit: "m²", category: "Serviços" },
      { name: "Tratamento contra escorpiões", description: "Aplicação específica focal", price: 280, unit: "serviço", category: "Serviços" },
    ],
  },
  {
    id: "vidraceiro",
    label: "Vidraçaria",
    emoji: "🪟",
    defaultItems: [
      { name: "Box de banheiro", description: "Vidro temperado com perfil de alumínio", price: 380, unit: "m²", category: "Serviços" },
      { name: "Troca de vidro", description: "Vidro liso comum, instalado", price: 220, unit: "m²", category: "Serviços" },
      { name: "Espelho sob medida", description: "Espelho com bisotê opcional", price: 280, unit: "m²", category: "Serviços" },
      { name: "Instalação de janela", description: "Janela de alumínio com vidro", price: 150, unit: "un", category: "Serviços" },
      { name: "Tampo de vidro para mesa", description: "Vidro temperado de 8mm", price: 320, unit: "m²", category: "Serviços" },
    ],
  },
  {
    id: "gesseiro",
    label: "Gesso e Drywall",
    emoji: "🏠",
    defaultItems: [
      { name: "Forro de gesso", description: "Forro liso com acabamento de massa", price: 60, unit: "m²", category: "Serviços" },
      { name: "Sanca em gesso", description: "Sanca aberta ou fechada com iluminação indireta", price: 80, unit: "m", category: "Serviços" },
      { name: "Parede de drywall", description: "Estrutura metálica, placas e acabamento", price: 120, unit: "m²", category: "Serviços" },
      { name: "Reparo em forro", description: "Conserto de buracos ou trincas", price: 200, unit: "serviço", category: "Serviços" },
      { name: "Recorte para spots", description: "Recorte preciso para luminárias embutidas", price: 18, unit: "un", category: "Serviços" },
    ],
  },
  {
    id: "fotografia",
    label: "Fotografia",
    emoji: "📷",
    defaultItems: [
      { name: "Ensaio fotográfico (1 hora)", description: "Sessão com 30 fotos tratadas", price: 400, unit: "serviço", category: "Serviços" },
      { name: "Cobertura de evento (4h)", description: "4h de cobertura + entrega de 200 fotos tratadas", price: 1200, unit: "serviço", category: "Serviços" },
      { name: "Tratamento de imagem", description: "Edição avançada por foto", price: 15, unit: "un", category: "Serviços" },
      { name: "Pacote casamento", description: "Make + cerimônia + festa, ~600 fotos tratadas", price: 4500, unit: "pacote", category: "Pacotes" },
      { name: "Vídeo aftermovie", description: "Vídeo curto editado de 2-3 minutos", price: 1800, unit: "serviço", category: "Serviços" },
    ],
  },
  {
    id: "personal",
    label: "Personal Trainer",
    emoji: "💪",
    defaultItems: [
      { name: "Aula individual", description: "Sessão de 1h com personal", price: 90, unit: "hr", category: "Serviços" },
      { name: "Mensalidade 2x/semana", price: 480, unit: "mês", category: "Pacotes" },
      { name: "Mensalidade 3x/semana", price: 680, unit: "mês", category: "Pacotes" },
      { name: "Avaliação física", description: "Bioimpedância + medidas + plano", price: 150, unit: "serviço", category: "Serviços" },
      { name: "Plano de treino personalizado", description: "Treino mensal customizado", price: 250, unit: "mês", category: "Serviços" },
    ],
  },
  {
    id: "consultoria",
    label: "Consultoria",
    emoji: "💼",
    defaultItems: [
      { name: "Hora de consultoria", price: 250, unit: "hr", category: "Serviços" },
      { name: "Diagnóstico inicial", description: "Análise de cenário e relatório", price: 800, unit: "serviço", category: "Serviços" },
      { name: "Pacote mensal de acompanhamento", description: "Reuniões semanais + plano", price: 2500, unit: "mês", category: "Pacotes" },
      { name: "Treinamento in-company (dia)", description: "Treinamento presencial 8h", price: 3500, unit: "dia", category: "Serviços" },
    ],
  },
  {
    id: "design",
    label: "Design Gráfico",
    emoji: "🎨",
    defaultItems: [
      { name: "Logo + identidade visual", description: "Logo + manual de marca + paleta", price: 1500, unit: "serviço", category: "Serviços" },
      { name: "Post para redes sociais", description: "Criação por post", price: 80, unit: "un", category: "Serviços" },
      { name: "Cartão de visita (criação)", description: "Layout + arte final", price: 180, unit: "serviço", category: "Serviços" },
      { name: "Hora de design", price: 120, unit: "hr", category: "Serviços" },
      { name: "Banner para evento", description: "Arte para impressão grande", price: 220, unit: "un", category: "Serviços" },
    ],
  },
  {
    id: "ti",
    label: "TI e Tecnologia",
    emoji: "💻",
    defaultItems: [
      { name: "Hora técnica de desenvolvimento", price: 180, unit: "hr", category: "Serviços" },
      { name: "Manutenção de computador", description: "Limpeza, formatação, drivers", price: 150, unit: "serviço", category: "Serviços" },
      { name: "Configuração de rede", description: "Rede local com Wi-Fi", price: 250, unit: "serviço", category: "Serviços" },
      { name: "Suporte mensal (até 10h)", price: 1500, unit: "mês", category: "Pacotes" },
      { name: "Recuperação de dados", description: "HD ou SSD com defeito", price: 380, unit: "serviço", category: "Serviços" },
    ],
  },
  {
    id: "eventos",
    label: "Eventos",
    emoji: "🎉",
    defaultItems: [
      { name: "Decoração de festa", description: "Decoração temática completa", price: 1500, unit: "serviço", category: "Serviços" },
      { name: "Buffet por pessoa", description: "Cardápio padrão com bebidas", price: 65, unit: "un", category: "Serviços" },
      { name: "DJ (4 horas)", description: "Som, iluminação e DJ", price: 1200, unit: "serviço", category: "Serviços" },
      { name: "Locação de mesa e cadeira", description: "Por convidado", price: 25, unit: "un", category: "Locação" },
      { name: "Garçom (4h)", description: "Por garçom", price: 220, unit: "un", category: "Serviços" },
    ],
  },
  {
    id: "beleza",
    label: "Beleza e Estética",
    emoji: "💅",
    defaultItems: [
      { name: "Manicure + Pedicure", price: 80, unit: "serviço", category: "Serviços" },
      { name: "Corte de cabelo feminino", price: 120, unit: "serviço", category: "Serviços" },
      { name: "Limpeza de pele", description: "Limpeza completa com extração", price: 180, unit: "serviço", category: "Serviços" },
      { name: "Pacote noiva", description: "Make + cabelo + maquiagem prova", price: 850, unit: "pacote", category: "Pacotes" },
      { name: "Massagem relaxante", description: "Sessão de 60 minutos", price: 150, unit: "serviço", category: "Serviços" },
    ],
  },
  {
    id: "pet",
    label: "Pet (Banho e Tosa)",
    emoji: "🐶",
    defaultItems: [
      { name: "Banho cão pequeno", price: 60, unit: "serviço", category: "Serviços" },
      { name: "Banho cão médio", price: 80, unit: "serviço", category: "Serviços" },
      { name: "Banho cão grande", price: 100, unit: "serviço", category: "Serviços" },
      { name: "Tosa higiênica", price: 70, unit: "serviço", category: "Serviços" },
      { name: "Tosa completa", price: 120, unit: "serviço", category: "Serviços" },
      { name: "Hidratação de pelagem", description: "Tratamento profissional", price: 50, unit: "serviço", category: "Serviços" },
    ],
  },
  {
    id: "transporte",
    label: "Transporte e Frete",
    emoji: "🚚",
    defaultItems: [
      { name: "Frete local", description: "Até 10km com 1 ajudante", price: 150, unit: "serviço", category: "Serviços" },
      { name: "Mudança residencial", description: "Pequena ou média até 50m³", price: 800, unit: "serviço", category: "Serviços" },
      { name: "Hora parada", description: "Cobrança por hora extra de espera", price: 50, unit: "hr", category: "Serviços" },
      { name: "Carregador (diária)", price: 200, unit: "dia", category: "Mão de Obra" },
      { name: "Embalagem e proteção", description: "Plástico bolha, papelão e etiquetas", price: 180, unit: "serviço", category: "Materiais" },
    ],
  },
  {
    id: "outro",
    label: "Outro",
    emoji: "🛠️",
    defaultItems: [
      { name: "Serviço prestado", price: 0, unit: "serviço", category: "Serviços" },
      { name: "Mão de obra", price: 0, unit: "hr", category: "Mão de Obra" },
      { name: "Material", price: 0, unit: "un", category: "Materiais" },
      { name: "Deslocamento", price: 0, unit: "serviço", category: "Deslocamento" },
    ],
  },
];

export const UNITS = [
  { value: "un", label: "Unidade" },
  { value: "hr", label: "Hora" },
  { value: "dia", label: "Dia" },
  { value: "mês", label: "Mês" },
  { value: "m", label: "Metro" },
  { value: "m²", label: "Metro quadrado" },
  { value: "m³", label: "Metro cúbico" },
  { value: "kg", label: "Quilograma" },
  { value: "L", label: "Litro" },
  { value: "serviço", label: "Serviço" },
  { value: "pacote", label: "Pacote" },
];

export const ITEM_CATEGORIES = [
  "Serviços",
  "Mão de Obra",
  "Materiais",
  "Equipamentos",
  "Deslocamento",
  "Locação",
  "Pacotes",
  "Outros",
];

export function getIndustryById(id: string | null | undefined): Industry | undefined {
  if (!id) return undefined;
  return INDUSTRIES.find((i) => i.id === id);
}
