# V2 — Multi-vertical + Padronização visual + Paridade com Invoice Fly

**Data:** 2026-05-05
**Status:** rascunho aguardando aprovação. Nada implementado ainda.
**Objetivo:** transformar o FechaAqui de "app que parece de jardineiro mas serve outros" em "app de qualquer prestador de serviço" + visual profissional consistente + features que faltam pra competir com o Invoice Fly.

## Diagnóstico do estado atual

Pós-rebrand, o app ainda carrega DNA de jardinagem:

### 1. Catálogo bipolar Plantas vs Tudo Mais
`Catalogo.tsx` tem **abas Plantas / Serviços e Materiais**. Quem é eletricista, encanador, faxineira não tem nada a ver com "Plantas" — mas vê a aba lá assim mesmo. `CatalogContext` carrega 800 plantas do Supabase mesmo pra esses nichos (já filtrei pra carregar só pra nicho jardinagem/paisagismo, mas a UI continua mostrando a aba).

### 2. Ícones de jardim em todo lugar
- `Leaf`, `Sprout` em DashboardLayout, LandingV2, Catalogo, PropostaPublica, NovaProposta
- Fallback de imagem de item é folha verde (`generatePDF.ts`, várias páginas)
- Empty states com tema jardim

### 3. 270 ocorrências de verdes/emerald antigos
Apesar de termos redefinido `--primary: marinho` e `--accent: verde brand`, muitos arquivos usam classes Tailwind hardcoded:
- `text-emerald-500`, `text-emerald-600`, `bg-emerald-50`, `bg-emerald-600/90`
- `verde-50` … `verde-900` (definidos como tokens, mas usados com semântica de "jardim")
- Hex hardcoded: `#16a34a`, `#10b981`, `#16a34a` em SVGs, watermarks, gradientes

Isso quebra a consistência marinho-azul-com-verde-accent: o user vê verde "jardim" em vez do azul-marinho-corporativo + verde-success.

### 4. Empty states / placeholders / copy
- "Catálogo de plantas" mencionado em emails de boas-vindas
- Placeholders de bio falam de "anos de experiência em paisagismo" em alguns lugares
- LandingV2 mock de proposta exibe item planta com nome científico

### 5. Faturas é stub
Rota `/faturas*` aponta pra `FaturasStub` — não tem feature. Invoice Fly tem invoice + estimate + receipt como tipos de documento separados. Pra competir é um diferencial claro.

### 6. Funcionalidades-chave faltando vs Invoice Fly
| Feature Invoice Fly | FechaAqui hoje |
|---|---|
| Estimates ≠ Invoices ≠ Receipts | Tudo é "proposta", `/faturas` é stub |
| 6 templates PDF | 3 (recém-adicionados) |
| Numeração sequencial #INV0001 | Tem `shortId` aleatório |
| PO Number | Não |
| Histórico financeiro por cliente | Não |
| Aging report (inadimplência) | Não |
| Tags em clientes | Não |
| Time tracking | Tem `unit: 'hr'` mas não há registro de horas |
| Receipt scanner / OCR | Não |
| Pagamento online direto pelo cliente | Tem (botão pagar Asaas no link público) |
| Aba dedicada "Tools" | Não |

## Decisões padrão (mude se discordar)

1. **Cores**: marinho `#0E2A5C` primary + verde brand `#22C55E` accent + neutro slate. Eliminar todo verde-jardim residual (`emerald-500/600`, `#16a34a`) — substituir por accent ou verde brand. Manter gold como warning isolado.
2. **Ícones**: Leaf/Sprout viram FileText/Briefcase/Receipt conforme contexto. Empty states usam ilustração neutra (FileText pontilhado).
3. **Catálogo**: aba "Plantas" só aparece quando `nicho ∈ {jardinagem, paisagismo}`. Pra outros nichos, aba única "Meus Itens" sem subdivisão.
4. **Faturas**: implementar como tipo de documento real (não-stub). Schema aditivo: coluna `proposals.doc_type ENUM('orcamento','fatura','recibo')` com default `'orcamento'`. UI lista cada tipo numa rota dedicada.
5. **Numeração**: sequencial por user (#0001, #0002...) em vez de shortId aleatório. Coluna nova aditiva.
6. **Template PDF 4-6**: pulado — temos 3, suficiente por enquanto.
7. **Receipt scanner / OCR**: pula. Custo alto (precisa API), valor relativo baixo no MVP.

## Plano em 5 fases

### Fase 1 — Padronização visual (1-2 dias) [BLOQUEADORA]

Foco: eliminar inconsistência. Sem isso, qualquer feature nova entra com dívida visual.

**1.1 — Auditoria automática de hex/classes obsoletos**
- Listar todas as 270 ocorrências
- Criar mapa de substituição:
  - `text-emerald-500` → `text-accent` (verde brand)
  - `text-emerald-600` → `text-accent` (verde brand)
  - `bg-emerald-600` → `bg-accent`
  - `bg-emerald-50` → `bg-accent/10`
  - `verde-50/100/200` → `accent/10`, `accent/20`, `accent/30`
  - `verde-600/700` → `accent`, `accent/90`
  - `#16a34a` → `var(--accent)` (verde brand) ou hex `#22C55E`
  - `#10b981` → mesma coisa
  - Gradientes verde-only → marinho→verde

**1.2 — Header e navegação**
- DashboardLayout sidebar usa `bg-jd-marine` ou `bg-primary`
- Header active state com `text-accent` (verde) sobre fundo marinho
- Logo aparece em wordmark "FechaAqui" (já tá)

**1.3 — Trocar ícones jardim**
- DashboardLayout: substituir Leaf/Sprout por ícones contextuais
- Empty states: trocar Sprout por FileText
- generatePDF placeholder de item: trocar SVG folha por SVG genérico (caixa de pacote)
- Logo wordmark: já está OK

**1.4 — Landing**
- LandingV2 mock de proposta: trocar item "Buxinho" por item genérico ("Mão de obra", "Material") com ícone neutro
- Hero: já é genérico
- ForWho: já lista 10+ profissões

**1.5 — Loading states + cores funcionais**
- Spinners usam `border-accent` (verde) ou `border-primary` (marinho)
- Alerts: success=accent, warning=gold, error=red, info=marinho
- Pills (`pill-sent`, `pill-viewed`, `pill-accepted`): refazer com paleta nova

**1.6 — PDFs**
- `generatePDF.ts`: imagem placeholder neutra
- `generateContract.ts`: header com cores do template ativo
- Watermark: usa accent (verde) atual em vez de emerald

**Critério de aceitação:** abrir 5 páginas (Landing, Login, Catalogo, Propostas, NovaProposta) — toda cor verde no DOM tem que ser do brand verde (`#22C55E`) ou tons dele, não emerald antigo.

**Esforço:** 8-12h. Risco BAIXO (só CSS).

### Fase 2 — Generalização real do catálogo (½ dia)

**2.1 — Aba "Plantas" condicional**
- `Catalogo.tsx`: lê `localStorage.fechaaqui_user_industry`
- Se nicho ∉ {jardinagem, paisagismo}: esconde aba "Plantas", remove filtro de categoria, mostra apenas grid plano de itens custom + serviços padrão
- Header: "Catálogo" → "Meus Itens" (mais genérico)

**2.2 — Categorias dinâmicas**
- Em vez de hardcoded "Plantas", "Serviços", "Materiais" — derivar do `category` dos itens existentes
- Sugestões pré-prontas vem do nicho (já tem em `industryTemplates.ts`)

**2.3 — Empty state por nicho**
- "Você ainda não tem itens. Quer copiar 12 itens prontos do nicho [Elétrica]? [Sim, copiar]"
- Botão dispara seed dos `defaultItems` do nicho selecionado no onboarding

**Esforço:** 4h. Risco BAIXO.

### Fase 3 — Tipos de documento (Orçamento / Fatura / Recibo) (2-3 dias)

Maior diferencial da Fase. Hoje `FaturasStub` é placeholder.

**3.1 — Schema aditivo no Supabase**
Migration nova:
```sql
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS doc_type TEXT DEFAULT 'orcamento'
  CHECK (doc_type IN ('orcamento', 'fatura', 'recibo'));
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS sequence_number INT;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS po_number TEXT;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS payment_status TEXT
  CHECK (payment_status IN ('pendente', 'parcial', 'pago', 'cancelado'));
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(10,2) DEFAULT 0;
```
Tudo NULL/default — Jardinei nunca lê esses campos, segue intacto.

**3.2 — Numeração sequencial por user**
- Trigger no Postgres ou cálculo no INSERT (lê maior `sequence_number` do user e incrementa)
- Display: `#0001`, `#0042` em vez de `XYZAB1`

**3.3 — Conversão Orçamento → Fatura**
- Botão "Converter em Fatura" em PropostaDetalhe quando `status === 'approved'`
- Cria nova proposal com `doc_type='fatura'` referenciando a original
- Header do PDF muda: "ORÇAMENTO" → "FATURA"
- Adiciona campo "Vencimento" e "Status de pagamento"

**3.4 — Recibos**
- Botão "Gerar Recibo" em fatura paga
- PDF simples confirmando o pagamento

**3.5 — Implementar `FaturasStub`**
- Renomeia pra `Faturas.tsx`
- Filtra `proposals` onde `doc_type='fatura'`
- Mesmo grid/lista que Propostas

**3.6 — Routing**
- `/faturas` → lista
- `/faturas/nova` → criar do zero
- `/faturas/:id` → detalhe (igual proposta mas com vencimento)
- `/recibos` (nova rota) → lista de recibos

**Esforço:** 16-20h. Risco MÉDIO (toca schema aditivo + cria fluxo novo).

### Fase 4 — Histórico por cliente + Tags (1 dia)

**4.1 — Tags em clientes**
- Migration aditiva: `clients.tags TEXT[] DEFAULT '{}'`
- UI em Clientes.tsx: chips coloridos editáveis
- Filtro por tag

**4.2 — Histórico financeiro por cliente**
- Em ClienteDetalhe (criar se não existir): aba Financeiro
- Lista propostas/faturas/recibos
- Total faturado, pendente, recebido
- Última atividade

**Esforço:** 6-8h. Risco BAIXO.

### Fase 5 — Polish UX (1-2 dias)

**5.1 — Animações suaves**
- Page transitions (fade-in já tem, padronizar)
- Botão press feedback (já tem `.btn-press`)
- Skeleton loaders em listas (substituir spinners genéricos)

**5.2 — Empty states ilustrados**
- "Nenhuma proposta ainda" com SVG + CTA específico
- "Nenhum cliente" idem
- "Catálogo vazio" com botão "Importar do nicho [Elétrica]"

**5.3 — Onboarding rico**
- Após onboarding, oferecer: "Quer 1ª proposta de exemplo?" — cria proposta dummy editável
- Tour mais visual com setas pisca-pisca

**5.4 — Search global**
- Atalho ⌘K / Ctrl+K abre command palette pra buscar propostas/clientes/itens

**5.5 — Notificações in-app refinadas**
- Bell icon no header com badge
- Já existe NotificationsContext — só polir display

**Esforço:** 8-12h. Risco BAIXO.

## Cronograma sugerido

| Fase | Esforço | Dependências | Risco |
|------|---------|--------------|-------|
| 1 — Visual | 1-2 dias | - | Baixo |
| 2 — Catálogo | ½ dia | Fase 1 | Baixo |
| 3 — Doc types | 2-3 dias | Fase 1 | Médio |
| 4 — Histórico+Tags | 1 dia | Fase 3 (recomendado) | Baixo |
| 5 — Polish | 1-2 dias | Todas | Baixo |
| **Total** | **6-9 dias** | | |

## Backlog (não-prioridade, fica pra v3)

- Time tracking real (timer in-app pra ranking de horas)
- Receipt scanner / OCR via API (Mindee, Veryfi)
- AI Assistant integrado (logo maker, etc)
- Multi-currency
- Recurring billing
- Aging report avançado
- Export Excel/CSV
- Importar contatos do celular (PWA Web Contacts API)

## Comparativo final FechaAqui v2 vs Invoice Fly

| Categoria | FechaAqui v2 | Invoice Fly | Vantagem |
|---|---|---|---|
| Tipos de documento | Orçamento + Fatura + Recibo | Estimate + Invoice + Quote + Receipt | Empate |
| Templates PDF | 3 | 6 | Invoice Fly |
| Multi-vertical | 24 nichos com 150+ itens prontos em PT-BR | Genérico US | **FechaAqui** (nichos PT-BR) |
| Pagamento BR | Asaas (PIX, cartão, boleto) | Stripe + PayPal | **FechaAqui** (PIX nativo) |
| WhatsApp nativo | Sim | Não | **FechaAqui** |
| Catálogo de plantas | Sim (800+) | Não | **FechaAqui** (nicho jardinagem) |
| Web/responsivo | Sim (link público) | Só app instalado | **FechaAqui** |
| AI Assistant | Não | Sim | Invoice Fly |
| Histórico por cliente | Sim (Fase 4) | Sim | Empate |
| Receipt scanner | Não | Sim | Invoice Fly |
| Tags em clientes | Sim (Fase 4) | Sim | Empate |
| Idioma | PT-BR nativo | Multi (PT só tradução) | **FechaAqui** |
| Preço | R$29-228/ano | US$8.99-79.99/mês | **FechaAqui** (mais barato) |

**Posicionamento:** "O Invoice Fly do Brasil — pra quem fecha negócio pelo WhatsApp." Foco em prestadores autônomos e pequenas empresas BR (eletricistas, encanadores, jardineiros, faxineiras, fotógrafos, personal trainers, etc).

## Decisões pendentes

1. **Receipts/Recibos como doc separado** ou aba dentro de Faturas? Recomendo separado.
2. **Numeração sequencial**: por user (`user_42 #0001`) ou por doc_type (`orçamento #0001`, `fatura #0001`)? Recomendo por user (simples).
3. **Tags em clientes**: cores fixas predefinidas ou usuário escolhe cor? Recomendo predefinidas (5-6 cores).
4. **Histórico por cliente**: rota nova `/clientes/:id` ou modal? Recomendo rota (mais espaço).
5. **Tour novo**: refaço inteiro ou só atualizo? Recomendo só atualizar (já tem ProductTour).

## Ordem de execução sugerida

Começar pela **Fase 1** (visual) porque destrava todas as outras visualmente. Depois Fase 2 (catálogo) que é rápida. Fase 3 (doc types) é o maior diferencial competitivo — fazer com calma. Fase 4 polish e Fase 5 features extras.

**Próximo passo:** sua aprovação. Confirma os 5 pontos das "Decisões pendentes" + qual fase começa primeiro.
