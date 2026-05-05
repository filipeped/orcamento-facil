# Plano de migração — OrçaFácil → FechaAqui

**Data:** 2026-05-05
**Status:** rascunho aguardando aprovação. Nada implementado ainda.
**Decisões fechadas com o usuário:**
1. Nome final: **FechaAqui** (domínio `fechaaqui.com`). Substitui "Jardinei" E "OrçaFácil".
2. Onboarding com seletor de indústria continua. Tabela `plantas` só é carregada quando nicho ∈ {jardinagem, paisagismo}.
3. Reaproveitar Supabase atual (`nnqctrjvtacswjvdgred`). Só `ALTER TABLE` pra campos novos.

**Decisões padrão tomadas pelo Claude (modo "faz tudo melhor possível"):**
4. CAPI proxy: mantém `cap.jardinei.com` durante migração (zero downtime de tracking). Migra subdomain depois.
5. Pricing: **Opção A** — R$29/mês, R$228/ano. Trial 7 dias com plano `essential` ativo (relaxa o gate de pagamento).
6. Pixel Facebook: mantém `888149620416465` (preserva attribution).
7. Domínio: assume `fechaaqui.com`. CSP/CORS adiciona já. Comprar/apontar DNS é responsabilidade do usuário.
8. Logo: ícone "A com check verde", paleta azul-marinho + verde + branco (ver seção "Identidade visual" abaixo).
9. v2 adiados: XLSX, recibos, tags em clientes, histórico financeiro por cliente.

## Identidade visual

Logos fornecidos em `logo/logo 1.jpg` (símbolo) e `logo/logo 2.jpg` (wordmark). Copiados pra `public/brand/icon-source.jpg` e `public/brand/wordmark-source.jpg`.

**Paleta** (estimada visualmente — refinar amostrando hex exato dos JPGs antes de finalizar):
| Cor              | Hex aproximado | Uso                                                                |
|------------------|----------------|--------------------------------------------------------------------|
| Azul-marinho     | `#0E2A5C`      | Primary. Background de hero, header, botões secundários, footer.   |
| Verde accent     | `#22C55E`      | CTAs, check da assinatura, success states, highlights.             |
| Branco           | `#FFFFFF`      | Texto sobre azul-marinho, cards.                                   |

**Decisão sobre prefixo CSS:** atual é `--jd-*` (verde + gold). Pra evitar refator gigante durante o rebrand:
- Estratégia: redefinir os tokens existentes (`--jd-primary`, `--jd-accent`, etc.) com os novos valores em `src/index.css` e `tailwind.config.ts`. Classes existentes (`bg-jd-primary`, etc.) continuam funcionando. Refator de prefixo `jd → fq` fica como Fase 6 opcional.
- Se algum token novo for necessário (ex: `--fq-marine`), adicionar em paralelo sem remover os antigos.

**Assets a gerar** (pendentes — Claude não gera imagem; user/designer entrega):
- [ ] `public/favicon.ico` — multi-resolução a partir do icon-source.jpg
- [ ] `public/icon-192.png`, `public/icon-512.png` — PWA, fundo transparente recomendado
- [ ] `public/og-image.png` — 1200×630, pode usar wordmark-source.jpg como base
- [ ] `public/brand/icon.svg` — SVG limpo do "A com check" (retracejar; JPG é raster com ruído)
- [ ] `public/brand/wordmark.svg` — wordmark "FechaAqui" como SVG

**Uso de cada logo:**
- **Símbolo** (icon-source.jpg / icon.svg): favicon, ícones PWA, OG, avatar default, headers compactos no mobile.
- **Wordmark** (wordmark-source.jpg / wordmark.svg): header desktop, footer, emails, login/cadastro.

## Resultado da Fase 0

Auditoria realizada (não código de produção, só leitura):

- **`api/cron.js` job `proposal-reminders`** — IMPLEMENTADO. Dispara WhatsApp pra prestador em 2 cenários: (a) proposta enviada e não vista há 3 dias; (b) proposta vista mas não aprovada há 3 dias. Cria notificação de tipo `proposal_reminder` ou `proposal_pending_approval`. Mensagens hardcodadas com "JARDINEI" e link `jardinei.com/p/...` — entram na lista de strings da Fase 1.
- **`SignaturePad`** — componente solto em `src/components/SignaturePad.tsx`. **NÃO está integrado** em `PropostaPublica.tsx` — o botão "Aprovar" ali chama `/api/approve-proposal` direto sem coletar assinatura. **Feature 3.3 é trabalho real**, não polish.
- **`duplicateProposal`** — JÁ TEM BOTÃO na UI (`PropostaDetalhe.tsx:220`). **Feature 3.1 do plano já está pronta** — riscar do escopo.
- **Migration `service_type` CHECK** — SQL criado em `supabase/migrations/20260505_expand_service_type_check.sql`. **PENDENTE aplicar:** `DATABASE_URL` não está no `.env.local` deste ambiente. Aplicar manualmente quando configurar a credencial:
  ```bash
  npx dotenv -e .env.local -- node scripts/run-migration.cjs supabase/migrations/20260505_expand_service_type_check.sql
  ```

## Diff entre o plano enviado e o estado real do repo

Antes de planejar trabalho novo, alinhar o que **já está pronto** ou **parcialmente feito** — pra não refazer e não contradizer decisões recentes.

| Item do plano                                | Estado real                                                                 |
|----------------------------------------------|------------------------------------------------------------------------------|
| Rebrand "Jardinei" → "X"                     | Parcial. Brand atual é **OrçaFácil** (`src/lib/brand.ts`, `package.json: orcamento-facil`). Commit `fcdbc90` removeu várias copys de "jardineiro". Migração real é OrçaFácil → FechaAqui, com strings residuais "Jardinei" em emails, WhatsApp, watermark de PDF, e em chaves de localStorage. |
| ServiceTypes expandido                       | Já está em 7 valores no TS (`servico`, `manutencao`, `instalacao`, `reparo`, `consultoria`, `paisagismo`, `outro`). **Mas o CHECK do Postgres só aceita `manutencao/paisagismo/outro`** — bug latente. |
| Seletor de indústria no onboarding           | **Pronto.** `src/lib/industryTemplates.ts` + `OnboardingWizard.tsx` step `industry`. Inclui jardinagem, elétrica, hidráulica, pintura. Falta: link com `nicho` no profile pra condicionar carga de plantas. |
| Catálogo de plantas condicional              | A fazer. Hoje `CatalogContext.loadPlantasFromDb` carrega sempre (e tem retry de 3x). |
| Duplicar proposta                            | Função `duplicateProposal` já existe em `ProposalsContext`. Conferir se botão na UI existe. |
| E-signature                                   | Componente `src/components/SignaturePad.tsx` foi adicionado em `1bc4cfe`. Conferir se está integrado em `PropostaPublica.tsx` e se grava `proposal.signature` (já existe na tabela). Pode estar parcialmente implementado. |
| Lembretes automáticos                        | Cron `proposal-reminders` já agendado em `vercel.json` (14h diário). Precisa abrir `api/cron.js` pra ver se está implementado ou stub. |
| Templates de PDF                             | A fazer. Hoje `generatePDF.ts` tem um template único. |
| Desconto por item                            | A fazer. `ProposalItem` não tem campo `discount`. |
| Tags em clientes                             | A fazer. Tabela `clients` não tem `tags`. |
| Histórico financeiro por cliente             | A fazer. |
| Export XLSX/CSV                              | A fazer. `xlsx` (SheetJS) **não está nas dependências** — adicionar em `package.json`. |
| Converter proposta → recibo                  | A fazer. Existe `FaturasStub` (rotas `/faturas*`) aguardando backend `doc_type` — esse é o caminho. |
| Trial 7 dias ilimitado                       | Hoje 3 dias / 5 propostas enviadas, com PLAN_LIMITS.free=0/mês. **Atenção:** o `ProtectedRoute` (linhas 132-141) bloqueia qualquer plano não-pago/não-admin pra `/upgrade`. Mudar trial pra "ilimitado por 7 dias" exige relaxar esse gate ou trocar plano default pra `essential` durante trial. |
| Precificação 97/804                          | Hardcoded em `api/create-payment.js`, `Upgrade.tsx`, `Checkout.tsx`. Webhook detecta plano por valor (`>500=pro, <500=essential`) — **vai quebrar** se preços novos forem 29/228. |
| MRR hardcoded em RPC                         | Bug pré-existente: `get_admin_stats` e `get_mrr_history` usam `essential=47, pro=97`. Já errado hoje, vai continuar errado se não corrigir. |

## Riscos / decisões pendentes

1. **Webhook detection pós-mudança de preço.** `webhook-asaas.js` usa heurística por valor (`>500=pro`). Com R$228 anual, isso quebra. Solução: detectar SEMPRE pela descrição (`"FECHAQUI Mensal"` / `"FECHAQUI Anual"`) e remover fallback por valor, OU passar `plan` no `externalReference` (mais robusto).

2. **Histórico Asaas com descrição "JARDINEI ..."** Subscriptions já criadas no Asaas têm `description: "JARDINEI Mensal"`. Renomear customer/subscription no Asaas é externo e não tem ROI. Estratégia: webhook continua aceitando "jardinei" + "fechaaqui" + "essencial" + "anual" / "mensal" como sinônimos. Novas assinaturas usam o nome novo.

3. **Asaas painel — webhook URL.** Precisa atualizar manualmente em https://www.asaas.com/conta/webhooks pra apontar pra `https://fechaaqui.com/api/webhook-asaas` quando o domínio virar. ⚠️ **Esse passo NÃO é código** — é manual no painel do Asaas.

4. **Pixel + CAPI proxy.** `cap.jardinei.com` é um servidor proxy hospedado fora deste repo. Decisões:
   - (a) Criar `cap.fechaaqui.com` (novo proxy) — mais limpo mas trabalho extra
   - (b) Apontar diretamente pra `https://graph.facebook.com/v18.0/{pixel_id}/events` (sem proxy) — perde a vantagem do proxy (ofuscação contra adblocker)
   - (c) Reusar `cap.jardinei.com` (preserva tracking continuity) e migrar o subdomain do servidor proxy depois
   Recomendo **(c)**: zero downtime de tracking, troca do nome do subdomain depois sem urgência.

5. **PWA cache invalidation.** Trocar `CACHE_NAME` no `sw.js` força clientes a baixarem o bundle novo. Sem isso, users com app instalado ficam vendo "OrçaFácil" por dias até cache expirar. **Obrigatório** trocar.

6. **localStorage keys.** Várias chaves `jardinei_*` e `orcafacil_*` (ex: `orcafacil_expenses_v1`, `jardinei_profile_tracking`, `jardinei_checkout_draft`). Trocar pra `fechaaqui_*`:
   - **Despesas**: `ExpensesContext` é localStorage-only — trocar a key faz users perderem o histórico de despesas. Decisão: aceitar perda OU fazer migration (ler key antiga, escrever nova, deletar antiga). Sugiro migration silenciosa (10 linhas em `ExpensesContext`).
   - **Outras keys** (cache de plan, draft de checkout, profile tracking): aceitar perda — não tem dado crítico.

7. **CSP em `vercel.json`.** Hardcoded `https://cap.jardinei.com` e `https://*.jardinei.com` em `connect-src`. Adicionar `https://*.fechaaqui.com` e `https://cap.fechaaqui.com` (mesmo se ainda não existirem). Manter os antigos durante transição.

8. **CORS allowlists em `api/*.js`.** Adicionar `https://fechaaqui.com`, `https://www.fechaaqui.com`. Manter `jardinei.com` e `orcafacil.com` durante transição (URLs antigas em emails/WhatsApp já enviados continuam clicáveis).

9. **MRR RPCs com preço errado.** Já corrigir junto com a troca de pricing.

10. **service_type CHECK.** Migration pra expandir CHECK do Postgres pra os 7 valores do TS antes de qualquer coisa nova que use `instalacao/reparo/consultoria/servico`.

## Plano em fases

### Fase 0 — Preparação (½ dia, baixo risco)

Foco: ground truth do que existe hoje + correções latentes. Sem rebrand ainda.

- [ ] Ler `api/cron.js` e mapear o que `proposal-reminders` faz hoje (stub vs implementado)
- [ ] Conferir se `SignaturePad` está integrado em `PropostaPublica` ou só componente solto
- [ ] Conferir se `duplicateProposal` tem botão na UI (PropostaDetalhe / Propostas)
- [ ] Migration: expandir CHECK de `proposals.service_type` pra aceitar os 7 valores do TS
- [ ] Migration: corrigir RPCs `get_admin_stats` e `get_mrr_history` pra ler preços de uma `plans_config` table OU CASE atualizado (essential=97, pro=804 hoje, mudará na fase 4)
- [ ] Migration: limpar coluna `plans` em `coupons` se houver dados ruins (já tem `add_plans_column_to_coupons.sql`)

### Fase 1 — Rebrand de strings (1-1,5 dia, baixo risco, não-funcional)

Substituições mecânicas. Não muda comportamento, só copy/labels/keys.

**1.1 Brand source-of-truth**
- [ ] Atualizar `src/lib/brand.ts` (`name`, `nameUpper`, `domain`, `email`, `whatsapp`, `watermarkText`, `watermarkFooter`)
- [ ] Atualizar `package.json` `name: "fechaaqui"`

**1.2 Logo + identidade visual**
- [ ] `src/components/Logo.tsx`: trocar wordmark, escolher ícone novo (Handshake, FileCheck, ou manter atual)
- [ ] `public/favicon.ico`, ícones PWA 192/512, OG image 1200×630 (gerar)

**1.3 Frontend (`src/`)**
- [ ] `src/pages/LandingV2.tsx` — copy completo (já parcialmente generalizado em `fcdbc90`, finalizar)
- [ ] `src/pages/Termos.tsx`, `src/pages/Privacidade.tsx` — reescrever genérico + emails
- [ ] `src/pages/Checkout.tsx` — DRAFT_KEY, mensagens de email já cadastrado, nomes de plano
- [ ] `src/pages/PagamentoSucesso.tsx`, `src/pages/Upgrade.tsx`, `src/pages/Configuracoes.tsx`, `src/pages/Relatorios.tsx`, `src/pages/Cadastro.tsx`, `src/pages/AuthCallback.tsx`, `src/pages/Login.tsx`
- [ ] `src/components/OnboardingWizard.tsx`, `OnboardingChecklist.tsx`, `PrimeirosPassos.tsx`, `DashboardLayout.tsx`, `PhoneVerification.tsx`, `ProtectedRoute.tsx`, `admin/*.tsx`
- [ ] `src/contexts/AuthContext.tsx`, `ProposalsContext.tsx`, `ExpensesContext.tsx` (migration silenciosa de localStorage)
- [ ] `src/services/metaPixel.ts` — EVENT_SOURCE_URL + PROXY_URL (decisão risco #4)
- [ ] `src/tracking/providers/RealCAPIProvider.ts` — CAPI_URL + domain checks
- [ ] `src/tracking/events/LeadTracker.ts`
- [ ] `src/lib/sentry.ts` — `app: "fechaaqui"`
- [ ] `src/lib/generatePDF.ts` — watermark (depende de `brand.ts`, deveria virar automático)
- [ ] `src/index.css` — comentários (manter prefixo `--jd-*` por enquanto, refator opcional na Fase 6)

**1.4 Backend (`api/`)**
- [ ] CORS allowlist em todos os 12 arquivos (adicionar `fechaaqui.com`, manter `jardinei.com`/`orcafacil.com`)
- [ ] Nomes de plano em `create-payment.js` linhas 16-17 e `subscription.js` 15-16 → `"FECHAQUI Mensal"` / `"FECHAQUI Anual"`
- [ ] Detecção de plano em `webhook-asaas.js` — aceitar "jardinei" OU "fechaaqui" OU "orcafacil" + "mensal/anual/essencial" como sinônimos. **Ignorar** detecção por valor (será inconfiável após Fase 4).
- [ ] Mensagens de WhatsApp e email em `webhook-asaas.js`, `notifications.js`, `cron.js`, `verify-phone.js`, `notify-proposal.js`, `approve-proposal.js`
- [ ] `successUrl` hardcoded em `create-payment.js` linha 359 (`https://www.jardinei.com/pagamento-sucesso`) — usar variável de env `PUBLIC_DOMAIN` ou `BRAND.domain`
- [ ] CAPI URL em `webhook-asaas.js` linha 19 (decisão #4)
- [ ] Evolution `EVOLUTION_INSTANCE` default — não trocar até criar instance nova; manter `jardinei` por enquanto

**1.5 Infraestrutura**
- [ ] `index.html` — `<title>`, meta description, OG, Twitter, Schema.org JSON-LD, scripts inline com URLs
- [ ] `public/manifest.json` — name, short_name, ícones
- [ ] `public/sw.js` — `CACHE_NAME: 'fechaaqui-v1'`, hostname check
- [ ] `public/offline.html` — title
- [ ] `vercel.json` — CSP `connect-src` (adicionar fechaaqui.com, manter jardinei.com)

**Critério de aceitação Fase 1:** `npm run build` passa, `npm run dev` abre, login/cadastro funcionam, copy mostra "FechaAqui", tracking continua disparando (verificar Network tab no Pixel/CAPI).

### Fase 2 — Generalização (1 dia, baixo risco)

Já parcialmente feito. Foco em arrumar o que sobrou.

- [ ] `CatalogContext.tsx`: condicional na carga de plantas. Adicionar coluna `nicho` em `profiles` se ainda não existir (verificar migrations). `loadPlantasFromDb` só roda se `profile.nicho ∈ ['jardinagem', 'paisagismo']`.
- [ ] Trocar `defaultServices` em `CatalogContext` pra serviços genéricos (já tá relativamente genérico hoje: Mão de Obra, Hora Técnica, Deslocamento, Material).
- [ ] Placeholders de bio em `Configuracoes.tsx` linhas 932 e 1183 — texto genérico.
- [ ] Expandir `industryTemplates.ts` com mais nichos se desejado (já tem 4: jardinagem, elétrica, hidráulica, pintura).

### Fase 3 — Features novas (3-5 dias, médio risco)

**3.1 Duplicar proposta** (½ dia)
- Verificar se `duplicateProposal` já tem trigger UI
- Adicionar botão "Duplicar" em `PropostaDetalhe.tsx` se faltar
- Garantir que abre como rascunho com cliente vazio

**3.2 Desconto por item** (1 dia)
- Migration: `proposal_items` ganha colunas `discount_amount NUMERIC`, `discount_type TEXT CHECK ('fixed','percentage')`
- TS: expandir `ProposalItem` com `discount?: { amount, type }`
- Form: toggle + input em `NovaProposta`/`EditarProposta`
- Cálculo: ajustar `calculateTotal` em `ProposalsContext` pra aplicar desconto antes de somar
- PDF: mostrar preço original riscado + final em `generatePDF.ts`

**3.3 E-signature** (1-1,5 dia, depende do estado atual)
- Auditar o que `1bc4cfe` deixou: componente existe, integração em `PropostaPublica` provável mas precisa conferir
- Migration: `proposals` ganha `signature_url TEXT`, `signed_at TIMESTAMPTZ`, `signed_ip TEXT`, `signed_name TEXT`
- Storage bucket `signatures/<user_id>/<proposal_id>.png` (público leitura, autenticado escrita)
- `PropostaPublica`: substituir botão "Aprovar" por "Assinar e Aprovar" → abre modal SignaturePad → salva PNG → marca proposta `approved` com signature
- `generatePDF`: embed signature image na seção de aprovação

**3.4 Templates de PDF** (1,5 dia)
- 3 templates pra começar (não 6 — escopo): Clássico (atual), Moderno, Minimalista
- `proposal_settings.default_template TEXT DEFAULT 'classic'`
- Seletor em `Configuracoes` aba "Aparência"
- `generatePDF.ts` vira switch por template — extrair template atual pra função `renderClassic`, criar `renderModern`, `renderMinimal`
- 6 templates fica pra v2

**3.5 Lembretes automáticos** (½ dia, se cron já estiver implementado)
- Auditar `api/cron.js` job `proposal-reminders`
- Adicionar configuração: `profiles.reminders_enabled BOOLEAN DEFAULT TRUE`, `profiles.reminders_interval_days INT DEFAULT 3`
- UI em `Configuracoes` aba "Notificações"

**Adiados pra v2** (não na Fase 3): histórico financeiro por cliente, tags, export XLSX, recibo. Marcar como issues/TODOs.

### Fase 4 — Precificação (½ dia, alto risco)

**Decisão pendente**: Opção A (29/228), B (39/69 + 468), C (semanal). Recomendação: **A** — simplicidade.

- [ ] Trocar `PLANS` em `api/create-payment.js` e `api/subscription.js`
- [ ] Atualizar `Upgrade.tsx`, `Checkout.tsx`, `LandingV2.tsx` (seção Offer)
- [ ] **Não mexer** em `PLAN_LIMITS` se a estrutura de plano for a mesma (`essential`/`pro`)
- [ ] Atualizar webhook `webhook-asaas.js` — confirmar que detecção por descrição funciona (pré-requisito da Fase 1.4)
- [ ] Trial 7 dias ilimitado: requer redesign do gate em `ProtectedRoute`. Sugestão: durante trial setar `plan='essential'`+`plan_status='trial_active'` ao criar profile. Webhook ao confirmar pagamento sobrescreve. Ao expirar trial sem pagar (cron `check-plans`), volta pra `free`+`active`. Isso permite trial usar a plataforma. **Esta mudança merece um doc próprio antes de implementar.**
- [ ] Atualizar RPCs MRR (preços hardcoded)

### Fase 5 — Infraestrutura externa (1 dia, requer ação manual)

- [ ] Registrar domínio `fechaaqui.com` (e .com.br)
- [ ] Adicionar custom domain no Vercel (SSL automático)
- [ ] DNS: apontar A/CNAME pro Vercel
- [ ] Decidir #4 (CAPI proxy) e configurar `cap.fechaaqui.com` se aplicável
- [ ] Asaas: atualizar webhook URL no painel pra `https://fechaaqui.com/api/webhook-asaas`
- [ ] Asaas: cadastrar `successUrl` novo se houver redirect customizado configurado
- [ ] Evolution API: criar instance "fechaaqui" (manter "jardinei" ativo durante transição)
- [ ] Sentry: criar projeto "fechaaqui" + atualizar DSN
- [ ] Pixel Facebook: decidir se cria pixel novo (zera histórico de attribution) ou mantém `888149620416465`. **Recomendo manter** — attribution continua, troca só do nome no painel.
- [ ] Vercel env vars: atualizar `PUBLIC_DOMAIN`, novos DSNs, etc.

### Fase 6 — Polish + Lançamento (1-2 dias)

- [ ] Refator opcional: prefixo CSS `--jd-*` → `--fq-*` (afeta MUITAS classes — ROI baixo, deixar pra depois)
- [ ] Smoke test manual do fluxo completo: cadastro → onboarding → criar proposta → enviar → cliente abre link público → assina → aprovado → email/WhatsApp dispara
- [ ] Smoke test do checkout: criar conta nova, pagar PIX, conferir webhook, conferir Purchase no Pixel/CAPI
- [ ] Verificar `e2e/` Playwright (BASE_URL precisa virar `https://fechaaqui.com` em `playwright.config.ts`)
- [ ] Conferir landing.spec, auth.spec, proposta-publica.spec, upgrade.spec
- [ ] Atualizar Instagram / redes sociais
- [ ] Anúncios novos com landing nova

## Estimativa revisada

| Fase | Esforço         | Risco          |
|------|-----------------|----------------|
| 0    | ½ dia           | Baixo          |
| 1    | 1-1,5 dia       | Baixo (mecânico)|
| 2    | 1 dia           | Baixo          |
| 3    | 3,5 dias (sem 3 features adiadas) | Médio |
| 4    | ½ dia + decisão sobre trial = 1 dia | **Alto** (toca billing crítico)|
| 5    | 1 dia (manual)  | Médio (depende de externos) |
| 6    | 1-2 dias        | Baixo          |

**Total: 9-11 dias** (próximo ao plano original; reduz com features v2 adiadas).

## O que precisa ser respondido antes de começar

1. **CAPI proxy** — opção (a), (b) ou (c) do risco #4? Recomendo (c).
2. **Pricing** — Opção A (29/228), B ou C? Recomendo A.
3. **Trial 7 dias ilimitado** — implementar agora (Fase 4) ou deixar 3 dias / 5 propostas?
4. **Express XLSX, recibos, tags, histórico financeiro** — confirmar que vão pra v2 (não bloqueiam o lançamento).
5. **Pixel Facebook** — manter `888149620416465` ou criar novo?
6. **Domínio** — `fechaaqui.com` está disponível? Já comprou?

Quando você responder, eu refino o plano e a gente começa pela Fase 0.
