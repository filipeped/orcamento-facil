# V3 — Plataforma robusta multi-vertical (paridade com Invoice Fly)

**Data:** 2026-05-05
**Status:** rascunho aguardando aprovação. Foco: tirar **TODO o cheiro de jardineiro/paisagismo** e construir a base que permite competir frente-a-frente com o Invoice Fly no mercado BR.

## Diagnóstico — o que vimos no Invoice Fly

### Stack e estrutura
- **Flutter Android** (`io.labhouse.invoicesapp`, v2.27.0, Labhouse)
- Backend: Firebase + RevenueCat + Intercom + AppsFlyer
- Pagamento: Stripe + PayPal (sem PIX nativo — vantagem nossa)
- Multi-idioma: PT, EN, ES, FR, DE, IT (tutorial em 6 idiomas)
- 6 fontes (Bebas Neue, DM Serif, Italianno, Lato, Plus Jakarta Sans, Roboto, SF) — tipografia rica
- Lottie animations dedicadas a paywall e ai_assistant

### Bottombar (navegação principal — 6 abas)
1. **Invoices** — faturas
2. **Estimates** — orçamentos
3. **Clients** — clientes
4. **Tools** — ferramentas (AI, conversores, time tracking)
5. **Reports** — relatórios financeiros
6. **Settings** — configurações

### O que vimos nas imagens-chave
- `carousel_payer_view/step_3.png`: invoice com **header gradient laranja-rosa** (template3 do Invoice Fly), valor IVA por linha, comentários, **assinatura desenhada**. Polish absurdo.
- `industry.jpeg`: foto de ferramentas de marceneiro/eletricista no onboarding — mensagem visual "isso aqui é pra QUALQUER prestador, não nicho específico"
- 6 templates de PDF (atual: clássico, moderno, minimalista, premium, com sidebar, etc)
- Paywall com vídeo (`paywall.mp4` + `paywall-dark.mp4`)
- Tutorial de despesas com vídeo (`expenses-tutorial.mp4`)
- AI Assistant: ferramentas tipo "ask-pdf", "ask-youtube", "audio-to-text", "image-to-text", "ocr", "logo-ideas"
- Templates por nicho: bathroomRemodel, kitchenRemodel, landscaping, interiorPainting, moveOutCleaning, replaceFlooring (já roubamos pro nosso `industryTemplates.ts`)

### Estrutura de dados (do JSON)
Cada item tem: `id, name, description, quantity, price, daysHoursType (none/hours/days), taxable, taxRate, discount {amount, type}`

Nós já temos: `name, description, quantity, unitPrice, unit, discount`. **Falta:** `taxable, taxRate, daysHoursType` (mas é simples adicionar).

## Auditoria do FechaAqui hoje

### O que está pronto pós-V2 (commits anteriores)
- ✅ Brand FechaAqui completo (cores marinho + verde, logo, copy)
- ✅ 270 ocorrências de cores antigas refatoradas
- ✅ Aba "Plantas" condicional ao nicho
- ✅ Doc Types: Orçamento + Fatura + Recibo (rotas, conversão, PDF dinâmico)
- ✅ Numeração sequencial #0001
- ✅ Desconto por item
- ✅ E-signature
- ✅ 3 templates de PDF
- ✅ Import CSV de itens
- ✅ 24 nichos com 150+ itens em PT-BR
- ✅ Backend multi-tenant (Jardinei intacto)

### O que ainda é fraco
1. **Visual:** ainda há referências sutis a jardim (logo placeholder de item nos PDFs ainda é folha SVG, alguns gradientes verdes não-brand)
2. **Onboarding:** texto/imagens ainda neutras demais — falta foto de impacto tipo `industry.jpeg`
3. **Bottombar:** atual usa sidebar única. Invoice Fly tem 6 abas com ícones Lottie animados. Mobile poderia ter bottom nav.
4. **Tipografia:** só Inter + Poppins. Invoice Fly mistura fontes pra dar caráter (display serifa, mono, etc)
5. **Tools:** não temos aba dedicada com utilities (calculadora de markup, conversor m²↔m, etc)
6. **Reports:** tem `Relatorios.tsx` mas é básico. Invoice Fly tem aging, MRR, growth, etc.
7. **Despesas:** já temos (`/despesas`), mas localStorage-only. Precisa Supabase + categorias robustas + vídeo tutorial.
8. **Tax/IVA:** não suportamos por item. Invoice Fly sim.
9. **Time tracking:** schema tem `unit: 'hr'` mas não tem timer in-app.
10. **PWA installation prompt:** não temos UX que incentive instalar
11. **Tutorial em vídeo:** zero vídeos, só texto
12. **Multi-currency:** não temos (não-prioridade BR)
13. **Recurring billing:** não temos

## Plano V3 — em 7 fases

### Fase A — Erradicar TODO traço de jardim (½-1 dia) [BLOQUEADORA]

Foco cirúrgico: cada pixel do app tem que servir pra eletricista, encanador, fotógrafo, faxineira, jardineiro indistintamente.

**A.1 — Auditoria visual zero-tolerance**
- Varredura `Sprout|Leaf|🌿|🌱|jardin|planta|paisagism|verde-jardim` em src/
- Substituir SVG placeholder de item nos PDFs (`generatePDF.ts` ainda tem path SVG de folha como fallback) → caixa de pacote ou doc neutro
- `LandingV2`: mock de proposta exibe item planta — trocar por item genérico ("Mão de obra", "Material") sem nome científico
- `OnboardingWizard`: imagem de fundo neutra (ferramentas tipo `industry.jpeg`) — adquirir/gerar imagem
- `index.html` Schema.org/OG: confere se ainda tem keyword "jardim/planta"

**A.2 — Empty states ilustrados (não jardim)**
- `EmptyState` já existe. Aplicar em:
  - `/orcamentos` vazio → "Nenhum orçamento ainda" + CTA novo
  - `/clientes` vazio → idem
  - `/meus-itens` vazio → "Importar do nicho [X]" baseado em `userIndustry`
  - `/despesas` vazio → "Anote suas despesas pra ver lucro real"
  - `/agenda` vazia → "Sem compromissos hoje"

**A.3 — Onboarding com foto de impacto**
- Step "industry" ganha uma imagem hero (tipo `industry.jpeg`) que mostra ferramentas
- Texto "Pra qual área você presta serviço?" com 24 nichos em grid visual
- Adicionar 2-3 nichos faltantes que peguei das fotos: marceneiro, fotógrafo (já tem)

**A.4 — Header navigation em mobile**
- Atualmente `DashboardLayout` tem sidebar lateral. Em mobile vira drawer.
- **Nova proposta:** bottombar fixa com 5 abas: Orçamentos, Faturas, Clientes, Relatórios, Mais (drawer com Itens, Despesas, Agenda, Config)
- Desktop continua com sidebar

**Esforço:** 6-10h. Risco BAIXO.

### Fase B — Bottombar + navegação reformulada (1-1.5 dias)

**B.1 — Componente `BottomNav.tsx`**
- 5 abas em mobile: Orçamentos, Faturas, Clientes, Relatórios, Mais
- Ícones Lucide com badge de contagem (ex: 3 propostas pendentes)
- Active state com cor accent + animação
- Esconde em desktop (`hidden md:hidden`)

**B.2 — Sidebar refinada (desktop)**
- Logo no topo
- 8-10 itens de menu com ícone + label
- Section "Documentos" agrupa Orçamentos/Faturas/Recibos
- Section "Gestão" agrupa Clientes/Itens/Despesas
- Section "Insights" agrupa Relatórios/Agenda

**B.3 — Header global**
- Search global (placeholder pra ⌘K na fase E)
- Bell de notificações com badge
- Avatar com dropdown de configurações

**Esforço:** 8-12h. Risco MÉDIO (afeta layout em todas as páginas).

### Fase C — Tools tab (diferenciação clara) (1-2 dias)

Aba dedicada `/ferramentas` com utilitários práticos pra prestador BR:

**C.1 — Calculadora de Markup**
- Input: custo, margem desejada, impostos
- Output: preço de venda recomendado
- "Salvar como item no catálogo"

**C.2 — Conversor de medidas**
- m² ↔ m, kg ↔ g, hora ↔ minuto
- Útil pra orçamento de pintura/piso/etc

**C.3 — Calculadora de horas**
- "Trabalhei das 8h às 17h com 1h de almoço" → 8h
- "Quanto cobro a hora pra ganhar R$5k/mês?" → R$25/h em 200h

**C.4 — Gerador de PIX QR Code**
- Input: chave PIX + valor
- Output: QR code copiável
- "Anexar ao próximo orçamento aprovado"

**C.5 — (Opcional) AI Assistant simples**
- "Reescrever descrição de serviço de forma mais profissional" (chamada Claude API server-side)
- "Sugerir preço pra serviço X em Y bairro" (placeholder)
- **Decisão pendente:** investe em IA agora ou v4? Recomendo v4 (custa OpenAI/Anthropic).

**Esforço:** 10-16h sem IA, +6h com. Risco BAIXO.

### Fase D — Despesas robustas + Migração pra Supabase (1 dia)

`ExpensesContext` hoje é localStorage. Pra funcionar multi-device:

**D.1 — Migration aditiva**
```sql
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  description TEXT,
  category TEXT,
  date DATE NOT NULL,
  receipt_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own expenses" ON expenses FOR ALL USING (auth.uid() = user_id);
```

**D.2 — Migrar `ExpensesContext` pra Supabase com fallback localStorage**
- Lê do banco se autenticado, fallback localStorage se sem internet
- Migra automaticamente dados antigos do localStorage pro banco (1x)

**D.3 — Categorias por nicho**
- Eletricista: Materiais, Combustível, Ferramentas, Cursos
- Faxineira: Produtos de limpeza, Transporte, Equipamentos
- Já tem 10 categorias genéricas — expandir por nicho

**D.4 — Receipt scanner (foto → texto via OCR)**
- Botão "Tirar foto do recibo"
- Upload da imagem
- (V4) chamar API OCR pra extrair valor automaticamente. Por enquanto, só salva imagem.

**Esforço:** 6-8h sem OCR. Risco BAIXO.

### Fase E — Polish final (1-2 dias)

**E.1 — Command palette ⌘K**
- Componente `CommandPalette` (cmdk lib já instalada — `command.tsx` no shadcn)
- Indexa: propostas, faturas, clientes, itens, ações ("nova proposta", "configurações")
- Atalho ⌘K / Ctrl+K abre overlay
- Fuzzy search

**E.2 — Bell de notificações**
- Adicionar no header do DashboardLayout
- Lê do `NotificationsContext`
- Badge com contagem de não lidas
- Dropdown ao clicar

**E.3 — Skeleton loaders nas listas**
- Substitui spinners genéricos em Propostas, Clientes, Catálogo, Despesas
- Usa `<Skeleton>` (já existe)

**E.4 — Animações suaves**
- Page transitions (fade-in/slide-up)
- Card hover lift
- Click feedback (.btn-press já existe)
- Padronizar em todos os botões

**E.5 — PWA install prompt**
- Capturar `beforeinstallprompt`
- Banner sutil "Instale o FechaAqui no celular" após N visitas
- Iconografia + benefícios (offline, mais rápido, atalho na tela)

**E.6 — Tipografia rica**
- Adicionar Plus Jakarta Sans (já vi no Invoice Fly) ou DM Serif pra títulos
- Aplicar em headings de página
- Manter Inter pra body

**Esforço:** 10-14h. Risco BAIXO.

### Fase F — Reports profissionais (1 dia)

**F.1 — Cards de KPI no Dashboard**
- Receita do mês
- Propostas aprovadas vs enviadas (taxa de fechamento)
- Ticket médio
- Inadimplência (faturas em atraso)

**F.2 — Gráfico de receita 12 meses**
- Bar chart com `recharts` (já instalado)
- Comparativo MoM, YoY

**F.3 — Aging report (faturas em atraso)**
- 0-30 dias, 31-60, 61-90, 90+
- Lista de faturas em cada faixa

**F.4 — Top clientes por receita**
- Lista 10 clientes que mais faturaram

**F.5 — Export CSV/XLSX**
- Botão "Exportar" em Propostas, Despesas, Relatórios
- Lib `xlsx` (SheetJS) — adicionar dep

**Esforço:** 8-12h. Risco BAIXO.

### Fase G — Tax/IVA por item + Time tracking (1 dia)

**G.1 — Tax por item**
- Migration: `proposal_items.tax_rate NUMERIC DEFAULT 0`, `proposal_items.taxable BOOLEAN DEFAULT false`
- UI: toggle "Tributável" + input "Alíquota %"
- Cálculo no total: subtotal + (subtotal × taxRate / 100) por item
- PDF mostra coluna "IVA" igual o Invoice Fly

**G.2 — Time tracking simples**
- Botão "Iniciar timer" em uma proposta
- Timer roda em background (localStorage timestamp)
- Pausar/parar/salvar como item de horas

**G.3 — Daily/hourly toggle no item**
- Hoje campo `unit` aceita "hr" e "dia"
- Adicionar UI mais clara: switch "Cobrança por hora / dia / unidade"
- Salva em `unit` que já existe

**Esforço:** 6-10h. Risco BAIXO.

## Cronograma sugerido

| Fase | Esforço | Pré-requisito | Prioridade |
|------|---------|---------------|-----------|
| A — Erradicar jardim | 1 dia | - | 🔴 Alta |
| B — Bottombar + nav | 1.5 dias | A | 🔴 Alta |
| C — Tools tab | 1-2 dias | B | 🟡 Média |
| D — Despesas Supabase | 1 dia | - | 🟡 Média |
| E — Polish final | 1-2 dias | A,B,C,D | 🔴 Alta (perceived quality) |
| F — Reports | 1 dia | - | 🟡 Média |
| G — Tax/Time | 1 dia | - | 🟢 Baixa (BR specifc) |
| **Total** | **7-10 dias** | | |

## Decisões padrão (mude se discordar)

1. **AI Assistant:** v4. Custos de API + complexidade não compensam no MVP.
2. **Multi-currency:** não fazer. BR-only.
3. **Recurring billing:** v4 (Asaas suporta — só falta UI).
4. **PDF templates 4-6:** ficam como temos (3). Se quiser completar pra paridade, +1 dia.
5. **Tipografia:** adicionar Plus Jakarta Sans pra headings.
6. **Bottombar:** mobile only (5 abas). Desktop usa sidebar refinada.
7. **Tools tab:** começar com 4 utilities (markup, conversor, horas, PIX QR). IA depois.
8. **Despesas:** migrar pra Supabase agora — sem multi-device é dor.
9. **Tax/IVA:** Fase G mas low priority. Maioria dos prestadores BR não emite NF.
10. **Time tracking:** sim, simples. Diferencial pra hourly billers (advogado, consultor, designer).

## Posicionamento atualizado

**FechaAqui v3 = Invoice Fly do Brasil**, com 5 vantagens claras:

| Onde ganhamos | Por quê |
|---|---|
| **PIX nativo** | Asaas integrado, gera QR direto |
| **WhatsApp first** | Link público compartilhável vs app instalado |
| **24 nichos PT-BR** | 150+ itens prontos em português |
| **Web responsivo** | Cliente abre sem instalar nada |
| **Preço** | R$29-228/ano vs US$8.99/mês ($107.88/ano) |

**Onde Invoice Fly ainda ganha:** AI Assistant, Receipt OCR, 6 templates PDF, multi-idioma, mobile native polish.

**Estratégia:** ser o **melhor app de proposta + fatura PT-BR** e crescer organicamente via WhatsApp boca-a-boca + ads Meta direcionados.

## Métricas de sucesso pós-V3

- Time-to-first-proposal < 5 min (do cadastro até a 1ª proposta enviada)
- Taxa de cadastro → primeira proposta > 60%
- NPS dos primeiros 100 usuários > 40
- Sem nenhum feedback "parece app de jardineiro"

## Próximos passos

1. **Aplicar migrations pendentes:**
   - `20260505_fechaqui_discount_and_signature.sql` (desconto + e-sign)
   - `20260505_fechaaqui_doc_types.sql` (doc types + tags)
   - `20260505_fechaaqui_expenses.sql` (criar — Fase D)
2. Você confirma decisões 1-10 acima OU sobrescreve
3. Começar pela **Fase A** (erradicar jardim) que é bloqueadora visual
4. Em sequência B → C → D → E → F → G

**Estimativa pra plataforma robusta nível Invoice Fly: 7-10 dias de execução focada.**
