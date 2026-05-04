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

export const INDUSTRIES: Industry[] = [
  {
    id: "jardinagem",
    label: "Jardinagem e Paisagismo",
    emoji: "🌿",
    defaultItems: [
      { name: "Manutenção de jardim", price: 150, unit: "hr", category: "Serviços" },
      { name: "Poda de árvores e arbustos", price: 200, unit: "serviço", category: "Serviços" },
      { name: "Plantio de mudas", price: 50, unit: "un", category: "Serviços" },
      { name: "Adubação e fertilização", price: 80, unit: "m²", category: "Serviços" },
      { name: "Mão de obra (diária)", price: 250, unit: "dia", category: "Mão de Obra" },
    ],
  },
  {
    id: "eletrica",
    label: "Elétrica",
    emoji: "⚡",
    defaultItems: [
      { name: "Instalação de tomada", price: 80, unit: "un", category: "Serviços" },
      { name: "Troca de disjuntor", price: 120, unit: "un", category: "Serviços" },
      { name: "Instalação de luminária", price: 60, unit: "un", category: "Serviços" },
      { name: "Passagem de fiação", price: 25, unit: "m", category: "Serviços" },
      { name: "Diagnóstico elétrico", price: 150, unit: "serviço", category: "Serviços" },
    ],
  },
  {
    id: "hidraulica",
    label: "Hidráulica e Encanamento",
    emoji: "🔧",
    defaultItems: [
      { name: "Desentupimento de pia/ralo", price: 150, unit: "serviço", category: "Serviços" },
      { name: "Troca de torneira", price: 80, unit: "un", category: "Serviços" },
      { name: "Conserto de vazamento", price: 200, unit: "serviço", category: "Serviços" },
      { name: "Instalação de chuveiro", price: 100, unit: "un", category: "Serviços" },
      { name: "Hora técnica", price: 120, unit: "hr", category: "Mão de Obra" },
    ],
  },
  {
    id: "pintura",
    label: "Pintura",
    emoji: "🎨",
    defaultItems: [
      { name: "Pintura de parede (massa + tinta)", price: 35, unit: "m²", category: "Serviços" },
      { name: "Pintura de teto", price: 30, unit: "m²", category: "Serviços" },
      { name: "Aplicação de massa corrida", price: 18, unit: "m²", category: "Serviços" },
      { name: "Lixamento de superfície", price: 12, unit: "m²", category: "Serviços" },
      { name: "Pintura de portão/grade", price: 80, unit: "m²", category: "Serviços" },
    ],
  },
  {
    id: "limpeza",
    label: "Limpeza e Diarista",
    emoji: "🧹",
    defaultItems: [
      { name: "Diária residencial", price: 180, unit: "dia", category: "Serviços" },
      { name: "Limpeza pós-obra", price: 25, unit: "m²", category: "Serviços" },
      { name: "Limpeza de vidros", price: 8, unit: "m²", category: "Serviços" },
      { name: "Higienização de estofado", price: 150, unit: "un", category: "Serviços" },
      { name: "Faxina pesada", price: 250, unit: "dia", category: "Serviços" },
    ],
  },
  {
    id: "reforma",
    label: "Reforma e Construção",
    emoji: "🏗️",
    defaultItems: [
      { name: "Mão de obra (diária pedreiro)", price: 250, unit: "dia", category: "Mão de Obra" },
      { name: "Quebra de parede", price: 80, unit: "m²", category: "Serviços" },
      { name: "Assentamento de piso", price: 45, unit: "m²", category: "Serviços" },
      { name: "Reboco de parede", price: 35, unit: "m²", category: "Serviços" },
      { name: "Material (saco de cimento 50kg)", price: 38, unit: "un", category: "Materiais" },
    ],
  },
  {
    id: "marcenaria",
    label: "Marcenaria",
    emoji: "🪵",
    defaultItems: [
      { name: "Móvel planejado MDF", price: 850, unit: "m²", category: "Serviços" },
      { name: "Conserto de móvel", price: 150, unit: "serviço", category: "Serviços" },
      { name: "Instalação de móvel", price: 100, unit: "un", category: "Serviços" },
      { name: "Hora técnica marcenaria", price: 90, unit: "hr", category: "Mão de Obra" },
    ],
  },
  {
    id: "serralheria",
    label: "Serralheria",
    emoji: "🔩",
    defaultItems: [
      { name: "Portão de ferro", price: 450, unit: "m²", category: "Serviços" },
      { name: "Grade de proteção", price: 280, unit: "m²", category: "Serviços" },
      { name: "Conserto de portão", price: 200, unit: "serviço", category: "Serviços" },
      { name: "Instalação de fechadura", price: 80, unit: "un", category: "Serviços" },
    ],
  },
  {
    id: "ar-condicionado",
    label: "Ar Condicionado",
    emoji: "❄️",
    defaultItems: [
      { name: "Instalação de split (até 12.000 BTUs)", price: 450, unit: "un", category: "Serviços" },
      { name: "Higienização de split", price: 180, unit: "un", category: "Serviços" },
      { name: "Recarga de gás R-410A", price: 250, unit: "serviço", category: "Serviços" },
      { name: "Manutenção preventiva", price: 120, unit: "un", category: "Serviços" },
    ],
  },
  {
    id: "dedetizacao",
    label: "Dedetização",
    emoji: "🪲",
    defaultItems: [
      { name: "Dedetização residencial", price: 250, unit: "serviço", category: "Serviços" },
      { name: "Descupinização", price: 350, unit: "serviço", category: "Serviços" },
      { name: "Desratização", price: 200, unit: "serviço", category: "Serviços" },
      { name: "Aplicação adicional (m²)", price: 5, unit: "m²", category: "Serviços" },
    ],
  },
  {
    id: "vidraceiro",
    label: "Vidraçaria",
    emoji: "🪟",
    defaultItems: [
      { name: "Box de banheiro", price: 380, unit: "m²", category: "Serviços" },
      { name: "Troca de vidro", price: 220, unit: "m²", category: "Serviços" },
      { name: "Espelho sob medida", price: 280, unit: "m²", category: "Serviços" },
      { name: "Instalação de janela", price: 150, unit: "un", category: "Serviços" },
    ],
  },
  {
    id: "gesseiro",
    label: "Gesso e Drywall",
    emoji: "🏠",
    defaultItems: [
      { name: "Forro de gesso", price: 60, unit: "m²", category: "Serviços" },
      { name: "Sanca em gesso", price: 80, unit: "m", category: "Serviços" },
      { name: "Parede de drywall", price: 120, unit: "m²", category: "Serviços" },
      { name: "Reparo em forro", price: 200, unit: "serviço", category: "Serviços" },
    ],
  },
  {
    id: "fotografia",
    label: "Fotografia",
    emoji: "📷",
    defaultItems: [
      { name: "Ensaio fotográfico (1 hora)", price: 400, unit: "serviço", category: "Serviços" },
      { name: "Cobertura de evento (4h)", price: 1200, unit: "serviço", category: "Serviços" },
      { name: "Tratamento de imagem", price: 15, unit: "un", category: "Serviços" },
      { name: "Pacote casamento", price: 4500, unit: "pacote", category: "Pacotes" },
    ],
  },
  {
    id: "personal",
    label: "Personal Trainer",
    emoji: "💪",
    defaultItems: [
      { name: "Aula individual", price: 90, unit: "hr", category: "Serviços" },
      { name: "Mensalidade 2x/semana", price: 480, unit: "mês", category: "Pacotes" },
      { name: "Mensalidade 3x/semana", price: 680, unit: "mês", category: "Pacotes" },
      { name: "Avaliação física", price: 150, unit: "serviço", category: "Serviços" },
    ],
  },
  {
    id: "consultoria",
    label: "Consultoria",
    emoji: "💼",
    defaultItems: [
      { name: "Hora de consultoria", price: 250, unit: "hr", category: "Serviços" },
      { name: "Diagnóstico inicial", price: 800, unit: "serviço", category: "Serviços" },
      { name: "Pacote mensal de acompanhamento", price: 2500, unit: "mês", category: "Pacotes" },
      { name: "Treinamento in-company (dia)", price: 3500, unit: "dia", category: "Serviços" },
    ],
  },
  {
    id: "design",
    label: "Design Gráfico",
    emoji: "🎨",
    defaultItems: [
      { name: "Logo + identidade visual", price: 1500, unit: "serviço", category: "Serviços" },
      { name: "Post para redes sociais", price: 80, unit: "un", category: "Serviços" },
      { name: "Cartão de visita (criação)", price: 180, unit: "serviço", category: "Serviços" },
      { name: "Hora de design", price: 120, unit: "hr", category: "Serviços" },
    ],
  },
  {
    id: "ti",
    label: "TI e Tecnologia",
    emoji: "💻",
    defaultItems: [
      { name: "Hora técnica de desenvolvimento", price: 180, unit: "hr", category: "Serviços" },
      { name: "Manutenção de computador", price: 150, unit: "serviço", category: "Serviços" },
      { name: "Configuração de rede", price: 250, unit: "serviço", category: "Serviços" },
      { name: "Suporte mensal (até 10h)", price: 1500, unit: "mês", category: "Pacotes" },
    ],
  },
  {
    id: "eventos",
    label: "Eventos",
    emoji: "🎉",
    defaultItems: [
      { name: "Decoração de festa", price: 1500, unit: "serviço", category: "Serviços" },
      { name: "Buffet por pessoa", price: 65, unit: "un", category: "Serviços" },
      { name: "DJ (4 horas)", price: 1200, unit: "serviço", category: "Serviços" },
      { name: "Locação de mesa e cadeira", price: 25, unit: "un", category: "Locação" },
    ],
  },
  {
    id: "beleza",
    label: "Beleza e Estética",
    emoji: "💅",
    defaultItems: [
      { name: "Manicure + Pedicure", price: 80, unit: "serviço", category: "Serviços" },
      { name: "Corte de cabelo feminino", price: 120, unit: "serviço", category: "Serviços" },
      { name: "Limpeza de pele", price: 180, unit: "serviço", category: "Serviços" },
      { name: "Pacote noiva", price: 850, unit: "pacote", category: "Pacotes" },
    ],
  },
  {
    id: "pet",
    label: "Pet (Banho e Tosa)",
    emoji: "🐶",
    defaultItems: [
      { name: "Banho cão pequeno", price: 60, unit: "serviço", category: "Serviços" },
      { name: "Banho cão grande", price: 100, unit: "serviço", category: "Serviços" },
      { name: "Tosa higiênica", price: 70, unit: "serviço", category: "Serviços" },
      { name: "Tosa completa", price: 120, unit: "serviço", category: "Serviços" },
    ],
  },
  {
    id: "transporte",
    label: "Transporte e Frete",
    emoji: "🚚",
    defaultItems: [
      { name: "Frete local", price: 150, unit: "serviço", category: "Serviços" },
      { name: "Mudança residencial", price: 800, unit: "serviço", category: "Serviços" },
      { name: "Hora parada", price: 50, unit: "hr", category: "Serviços" },
      { name: "Carregador (diária)", price: 200, unit: "dia", category: "Mão de Obra" },
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
