# Database — Schema Postgres / Supabase

Mapeamento de cada tabela usada em produção, suas colunas relevantes, RLS, RPCs e quem escreve nelas. Projeto Supabase: `nnqctrjvtacswjvdgred`.

> O conteúdo abaixo é o estado **atual** observado no código + migrations. Migrations rodaram fora de ordem e algumas colunas foram adicionadas em vários arquivos (`ALTER TABLE … IF NOT EXISTS`). Nem tudo bate exatamente com `00_initial_schema.sql` — usar este doc como referência primária e o código (`src/lib/supabase.ts` para tipos `Db*`) como segunda fonte.

## Convenções gerais

- **Todas** as tabelas de domínio têm `user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE`.
- RLS está ligado em **todas** as tabelas; políticas padrão: `auth.uid() = user_id` para leitura/escrita do dono. Admins têm `EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_admin = TRUE)` em SELECT/UPDATE.
- Funções com `SECURITY DEFINER` validam `is_admin` no corpo antes de retornar dados.
- Service role (server-side, usado pelas APIs Vercel) **bypassa RLS**.
- Timestamps: `TIMESTAMPTZ DEFAULT NOW()` em todas, em UTC.

## Tabelas

### `profiles`

A tabela mais importante — é o "user record" de domínio. `auth.users` guarda só email/senha.

| Coluna                    | Tipo          | Notas                                                                                              |
|---------------------------|---------------|-----------------------------------------------------------------------------------------------------|
| `id`                      | UUID PK       |                                                                                                     |
| `user_id`                 | UUID UNIQUE   | FK `auth.users(id)`. Chave de lookup em todo lugar.                                                 |
| `full_name`               | TEXT          |                                                                                                     |
| `phone`                   | TEXT          | Sem máscara, só dígitos. `phoneVerified` separado.                                                  |
| `phone_verified`          | BOOLEAN       | Gate em `ProtectedRoute` (Google: obrigatório; manual: skip permitido).                             |
| `cnpj`                    | TEXT          | CPF ou CNPJ — Asaas exige um dos dois pra criar customer.                                          |
| `company_name`, `address`, `instagram`, `bio` | TEXT | Mostrados em propostas públicas conforme `proposal_settings.show_*`.            |
| `logo_url`, `avatar_url`  | TEXT          | URLs públicas no Supabase Storage (`logos`/`avatars`).                                              |
| `plan`                    | TEXT          | `free`, `essential`, `pro`. Check constraint do schema inicial; `admin` vem de `is_admin=true`.    |
| `plan_status`             | TEXT          | `active`, `cancelled`, `expired`, `pending`, `overdue`, `trial` (legacy). Ver `docs/billing-asaas.md`.|
| `plan_period`             | TEXT          | `monthly` ou `annual` (escrito pelo webhook).                                                       |
| `plan_started_at`         | TIMESTAMPTZ   | Base do cálculo de trial (`AuthContext.checkIsInTrial`).                                            |
| `plan_expires_at`         | TIMESTAMPTZ   | +30 dias (mensal) ou +1 ano (anual). Usado por cron `check-plans` e RetentionCoupons.              |
| `plan_overdue_since`      | TIMESTAMPTZ   | Quando virou `overdue`. ProposalsContext rebaixa pra `free` após 7 dias.                            |
| `asaas_customer_id`       | TEXT          | Salvo em `create-payment` como fallback do webhook quando `externalReference` falha.               |
| `asaas_subscription_id`   | TEXT          | Existe na coluna mas não é mais escrita rotineiramente — fonte da verdade é o Asaas.               |
| `is_admin`                | BOOLEAN       | Bypassa todos os gates. Único modo de virar admin: UPDATE direto via SQL.                          |
| `onboarding_completed`    | BOOLEAN       | Gate 3 do `ProtectedRoute`.                                                                         |
| `show_tour`               | BOOLEAN       | Tour inicial. Default TRUE pra novos; setado FALSE em users existentes pela migration.             |
| `tour_step`               | INT           | Progresso do tour.                                                                                  |
| `proposals_sent_count`    | INT           | Contador legado — não usado pra gating hoje (cálculo vive em `ProposalsContext.monthlyProposalsCount`). |
| `first_approval_at`       | TIMESTAMPTZ   | Trial original previa "+48h se aprovar"; coluna existe mas não há lógica ativa que escreve.        |
| `trial_ends_at`           | TIMESTAMPTZ   | Idem — coluna pré-calculada que ficou no banco; `isInTrial` é calculado on-the-fly hoje.            |
| `notifications_*`         | BOOLEAN       | Preferências de notif por canal/tipo.                                                              |
| `created_at`, `updated_at`| TIMESTAMPTZ   | Trigger `update_updated_at_column` mantém `updated_at`.                                            |

**Quem escreve:**
- Client: `AuthContext` (criação inicial, phone do metadata), `ProtectedRoute` (gate downgrade), `OnboardingWizard` (company info), `Configuracoes` (perfil completo, logo/avatar), `PhoneVerification`, `ProductTour`.
- Server: `webhook-asaas.js` (plan/plan_status/plan_*), `create-payment.js` (cnpj, asaas_customer_id, register-and-pay creation), `cron.js`, `delete-account.js`.

### `proposals`

| Coluna                                                | Tipo        | Notas                                                                  |
|-------------------------------------------------------|-------------|------------------------------------------------------------------------|
| `id`                                                  | UUID PK     |                                                                        |
| `user_id`                                             | UUID FK     |                                                                        |
| `short_id`                                            | TEXT        | UNIQUE `(user_id, short_id)`. Usado em URL pública `/p/:short_id/:slug`. |
| `client_id`                                           | TEXT        | Referência opcional para `clients.id` (não FK formal).                 |
| `client_name`, `client_email`, `client_phone`         | TEXT        | Snapshot — não muda se o cliente atualizar dados depois.               |
| `service_type`                                        | TEXT        | `servico`, `manutencao`, `instalacao`, `reparo`, `consultoria`, `paisagismo`, `outro` (TS), mas check no schema inicial era restrito a `manutencao`/`paisagismo`/`outro` — confirmar antes de adicionar. |
| `title`, `description`, `notes`                       | TEXT        |                                                                        |
| `valid_until`                                         | TIMESTAMPTZ | Mostrado no PDF; status vira `expired` no cron.                        |
| `status`                                              | TEXT        | `draft → sent → viewed → approved` (ou `expired`).                     |
| `total`                                               | NUMERIC(10,2)| Calculado client-side em `calculateTotal` no momento de criar/atualizar. |
| `company_name`, `company_logo`, `company_phone`, `company_email` | TEXT | Snapshot dos dados de empresa no momento do envio (denormalizado de proposito — se o user trocar logo depois, propostas antigas mantêm o original). |
| `signature`                                           | TEXT        | Base64 PNG do `SignaturePad` quando aprovada.                          |
| `sent_at`, `viewed_at`, `approved_at`                 | TIMESTAMPTZ | `markAsSent/markAsViewed/markAsApproved` no `ProposalsContext`.        |

**Política especial:** `SELECT` permite `auth.uid() = user_id OR short_id IS NOT NULL` — qualquer um com link público (`/p/:short_id/:slug`) consegue ler. A página `PropostaPublica` faz busca pelo `short_id` (ou `id` se UUID) sem auth.

### `proposal_items`

| Coluna           | Tipo           | Notas                                            |
|------------------|----------------|--------------------------------------------------|
| `id`             | UUID PK        |                                                  |
| `proposal_id`    | UUID FK CASCADE| FK pra `proposals(id)`.                          |
| `name`           | TEXT NOT NULL  |                                                  |
| `description`    | TEXT           |                                                  |
| `quantity`       | INT            | Default 1.                                       |
| `unit_price`     | NUMERIC(10,2)  |                                                  |
| `image_url`      | TEXT           |                                                  |
| `photos`         | TEXT[]         | Galeria adicional. Default `'{}'`.               |
| `unit`           | TEXT           | `un`, `m`, `m²`, `kg`, `dia`, `hr`, etc.         |
| `nome_cientifico`| TEXT           | Específico de plantas (legado de jardinagem).    |

RLS: leitura/escrita via `EXISTS proposals` — quem tem acesso à proposta pai tem aos itens.

`ProposalsContext.updateProposal` faz **delete-all + insert** ao alterar items (linha 598/614) — não merge incremental. Implicação: IDs de items mudam a cada update.

### `clients`

| Coluna   | Tipo   | Notas                  |
|----------|--------|------------------------|
| `id`     | UUID PK|                        |
| `user_id`| UUID FK|                        |
| `name`, `email`, `phone`, `address` | TEXT |  |

Catálogo pessoal de clientes do user. Não há FK formal `proposals.client_id → clients.id` — proposals guarda snapshot do nome/email/phone.

### `catalog_items`

| Coluna           | Tipo          | Notas                                                                |
|------------------|---------------|----------------------------------------------------------------------|
| `id`             | UUID PK       |                                                                       |
| `user_id`        | UUID FK       |                                                                       |
| `item_id`        | INT or TEXT   | "ID lógico" — usado pra matchear customizações com `defaultServices`. |
| `name`           | VARCHAR(255)  |                                                                       |
| `nome_cientifico`| TEXT          |                                                                       |
| `descricao`      | TEXT          |                                                                       |
| `category`       | VARCHAR(50)   | Default 'Plantas' (legado).                                          |
| `image`          | TEXT          | Emoji.                                                                |
| `image_url`      | TEXT          |                                                                       |
| `default_price`  | NUMERIC(10,2) |                                                                       |
| `price_p`, `price_m`, `price_g` ou `size_prices` | DECIMAL/JSONB | Preços por tamanho (P/M/G). Schema final usa `size_prices` JSONB. |
| `unit`           | VARCHAR(20)   |                                                                       |
| `is_custom`      | BOOLEAN       | TRUE = item criado pelo user. FALSE = customização de default.       |
| `is_hidden`      | BOOLEAN       | User ocultou item do catálogo padrão.                                |

Limite por plano em `CATALOG_LIMITS` (`free`: 0, `essential`: 20, `pro`/`admin`: ∞). Conta apenas `is_custom && !is_hidden`.

### `plantas`

Tabela **global** (não tem `user_id`) com 800+ plantas pré-cadastradas. Lida pelo `CatalogContext.loadPlantasFromDb` para popular o catálogo de jardinagem. Colunas: `id`, `nome_popular`, `nome_cientifico`, `descricao`, `imagem_principal`, `todas_imagens` (JSON ou array), `categorias`, `preco`, `unidade`. RLS: leitura pública.

Quando expandir pra outras verticais (elétrica, hidráulica), considerar tabelas globais análogas ou apenas usar `industryTemplates.ts` no client.

### `notifications`

| Coluna    | Tipo  | Notas                                                                                |
|-----------|-------|--------------------------------------------------------------------------------------|
| `id`      | UUID  |                                                                                       |
| `user_id` | UUID  |                                                                                       |
| `type`    | TEXT  | `proposal_viewed`, `proposal_approved`, `proposal_expired`, `payment_confirmed`, `payment_overdue`, `plan_expired`, `plan_upgraded`, `plan_downgraded`, `coupon_*`, `system`. **Schema inicial tinha CHECK restrito** — migration `20260129_add_coupon_notification_types.sql` ampliou. Ao adicionar tipo novo, conferir se ainda há CHECK ativo. |
| `title`, `message` | TEXT |                                                                          |
| `metadata`| JSONB | Dados arbitrários (plan, amount, propostaId, etc.).                                  |
| `read`    | BOOL  |                                                                                       |

INSERT: política `WITH CHECK (true)` (sistema pode inserir pra qualquer user). UPDATE/SELECT: dono.

### `payment_history`

| Coluna             | Tipo          | Notas                                                       |
|--------------------|---------------|-------------------------------------------------------------|
| `id`               | UUID PK       |                                                              |
| `user_id`          | UUID FK       |                                                              |
| `asaas_payment_id` | TEXT          | Chave de idempotência do webhook.                           |
| `mp_payment_id`    | TEXT          | Legado (Mercado Pago, antes do Asaas).                      |
| `amount`           | NUMERIC(10,2) |                                                              |
| `status`           | TEXT          | `paid`, `pending`, `overdue`, `cancelled`, `refunded`.      |
| `paid_at`          | TIMESTAMPTZ   |                                                              |
| `invoice_url`      | TEXT          | Link Asaas (boleto/fatura).                                 |
| `created_at`       | TIMESTAMPTZ   |                                                              |

Idempotência do webhook: `WHERE asaas_payment_id = $1 AND status = 'paid'`.

### `coupons`

| Coluna             | Tipo            | Notas                                                            |
|--------------------|-----------------|------------------------------------------------------------------|
| `code`             | VARCHAR(50) UNIQUE | Sempre uppercase ao buscar (`code.toUpperCase().trim()`).      |
| `discount_percent` | INT 1..100      |                                                                  |
| `max_uses`         | INT NULL        | NULL = ilimitado.                                                |
| `current_uses`     | INT             | Incrementado em `create-payment` após criar subscription.        |
| `valid_until`      | TIMESTAMPTZ NULL| NULL = sem expiração.                                            |
| `plans`            | TEXT[]          | Array de planos aplicáveis. NULL/vazio = todos. Migration `add_plans_column_to_coupons.sql` adicionou. |
| `active`           | BOOLEAN         |                                                                  |

RLS: usuários podem `SELECT WHERE active = TRUE`. Admin: `FOR ALL`.

`retention_coupons` — tabela separada criada em `20260129_create_retention_coupons.sql`. Cupons fixos: `FICA10` (10% — plano expirando), `VOLTA15` (15% — plano expirado).

### `webhook_logs`

Auditoria de cada chamada de webhook do Asaas.

| Coluna          | Tipo       | Notas                                       |
|-----------------|------------|---------------------------------------------|
| `event_type`    | VARCHAR(100)| Ex: `PAYMENT_RECEIVED`.                    |
| `payload`       | JSONB      | Body inteiro do webhook.                    |
| `status`        | VARCHAR(20)| `processing`, `success`, `error`.           |
| `error_message` | TEXT       |                                             |
| `processed_at`  | TIMESTAMPTZ|                                             |
| `created_at`    | TIMESTAMPTZ|                                             |

Acesso: admin only.

### `checkout_tracking`

Bridge browser → webhook para Meta CAPI. Sem este registro, o webhook envia Purchase sem fbp/fbc/IP/UA → score do Meta cai.

| Coluna                  | Tipo  | Notas                                              |
|-------------------------|-------|----------------------------------------------------|
| `user_id`               | UUID  |                                                    |
| `asaas_subscription_id` | TEXT  |                                                    |
| `asaas_payment_id`      | TEXT  |                                                    |
| `fbp`, `fbc`            | TEXT  | Cookies do Meta Pixel.                             |
| `client_ip`             | TEXT  | IP real do cliente (de `x-forwarded-for`).        |
| `user_agent`            | TEXT  |                                                    |
| `event_source_url`      | TEXT  |                                                    |

Index em `asaas_payment_id`, `asaas_subscription_id`, `(user_id, created_at DESC)` — webhook busca em ordem.

RLS: user vê só os seus (debug). Service role escreve.

### `verification_codes`

Códigos de verificação de WhatsApp (6 dígitos, expira em 5 min).

| Coluna               | Tipo        | Notas                                          |
|----------------------|-------------|------------------------------------------------|
| `phone`              | TEXT        | Formato `55XXXXXXXXXXX`.                       |
| `code`               | TEXT        | 6 dígitos.                                     |
| `expires_at`         | TIMESTAMPTZ | +5 minutos do create.                          |
| `used`               | BOOLEAN     |                                                |
| `attempts`           | INT         | Tenta 3 vezes antes de bloquear.               |
| `verification_token` | TEXT        | Token de continuação (cadastro pós-verificação).|
| `type`               | TEXT        | Adicionado em `20260130_add_type_to_verification_codes.sql` (signup vs reset). |

RLS apenas service role. `api/verify-phone.js` faz toda a manipulação.

### `proposal_settings`

Customização visual das propostas públicas, **uma linha por user_id**.

| Coluna                | Tipo    | Notas                                                                                        |
|-----------------------|---------|-----------------------------------------------------------------------------------------------|
| `user_id`             | UUID    | Único.                                                                                        |
| `show_logo`, `show_cnpj`, `show_address`, `show_instagram`, `show_bio` | BOOL | Toggles do PDF/página pública. |
| `primary_color`       | TEXT    | Cor accent. Default `#16a34a` (página pública), `#10b981` (configurações). Inconsistente — fallback diferente em `PropostaPublica.tsx` vs `Configuracoes.tsx`. |
| `footer_text`         | TEXT    | Rodapé customizado (ainda preserva watermark `BRAND.watermarkFooter` se vazio).              |
| `payment_terms`       | TEXT    | Default em migration `20260124190943_…`: 50/50, transferência ou dinheiro.                   |
| `general_terms`       | TEXT    | Default em migration: garantia 30d, materiais inclusos, prazo a combinar.                    |

### `proposal_templates`

| Coluna       | Tipo    | Notas                                                                       |
|--------------|---------|------------------------------------------------------------------------------|
| `user_id`    | UUID    | Pode ser NULL (templates globais).                                          |
| `name`       | TEXT    |                                                                              |
| `is_default` | BOOLEAN | TRUE = template global visível pra todos.                                   |
| `items`      | JSONB   | Array de items pré-preenchidos.                                             |

Política: `SELECT WHERE auth.uid() = user_id OR is_default = true`. UPDATE/INSERT/DELETE só do dono.

`NovaProposta.tsx` busca via `.or('user_id.eq.${user.id},is_default.eq.true')`.

### `contracts`

Gerados a partir de propostas aprovadas (`generateContract.ts`).

| Coluna        | Tipo          | Notas                  |
|---------------|---------------|------------------------|
| `proposal_id` | UUID          |                        |
| `client_name` | TEXT          |                        |
| `total_value` | NUMERIC       |                        |
| `status`      | TEXT          | Default `active`.      |

### Tabelas legacy / pouco usadas

- `payments` (≠ `payment_history`) — schema inicial criou com colunas similares mas códido novo escreve só em `payment_history`. RPCs admin usam `payments` em alguns lugares (ex.: `get_admin_stats` em `add_admin_support.sql` lê `payments`). **Conferir antes de migrar/remover** — pode haver leitura ativa.
- `mp_*` (Mercado Pago) — colunas antigas de quando o gateway era MP. Não escrever nelas; manter por compatibilidade até confirmar.

## Storage buckets

Todos públicos pra leitura, autenticado pra escrita. Layout por user: `<bucket>/<user_id>/<arquivo>`.

| Bucket            | Usado por                                                                            |
|-------------------|--------------------------------------------------------------------------------------|
| `avatars`         | `Configuracoes` (foto do dono).                                                      |
| `logos`           | `OnboardingWizard`, `Configuracoes` (logo da empresa).                               |
| `images`          | `lib/storage.ts` — imagens gerais (catálogo, propostas).                            |
| `proposal-photos` | Galeria adicional de items (`proposal_items.photos`).                                |

Política UPDATE/DELETE: `auth.uid()::text = (storage.foldername(name))[1]` — só edita arquivos no próprio prefixo.

`manage-asaas?action=delete-user` faz cleanup explícito de todos os buckets (ver implementação para lista exata).

## Funções (RPC)

### `get_admin_stats() → JSON`

Lê `profiles` + `payments`. Retorna `total_users`, `paying_users`, `new_users_30d`, `cancelled_30d`, `mrr`, `month_revenue`, `plan_distribution`. **MRR hardcoded com preços antigos (essential=47, pro=97)** — fora de sync com os preços atuais (97/804). Atualizar antes de confiar nesses dados.

### `get_mrr_history() → JSON`

Idem, com hardcoded `essential=47, pro=97`. **Mesmo bug.**

### `get_admin_users() → SETOF`

JOIN `profiles + auth.users`. Usado pelos painéis admin pra listar users com email. `SECURITY DEFINER`, valida `is_admin` no corpo. Existe duas versões dela (`04_admin_users_rpc.sql` e `admin_users_view.sql`) — a segunda é a corrente.

### `get_user_email(user_uuid) → TEXT`

Helper SECURITY DEFINER pra resolver email só pra admin.

### `update_updated_at_column()` (trigger)

Genérico. Atrelado a `profiles.updated_at`.

## Migrations — ordem real ≠ ordem alfabética

Os arquivos têm prefixos misturados (`00_…`, `01_…`, depois `add_admin_support.sql`, depois `20260124_…`). Ordem cronológica real deve ser inferida pelo timestamp ou pelo conteúdo (algumas são auditorias, outras são one-off seeds tipo `test_simulate_expiring_plan.sql`). Não rodar nada manualmente sem ler o conteúdo.

`scripts/run-migration.cjs` aplica um arquivo por vez via `pg` lib + `DATABASE_URL` em `.env.local`.

## Onde adicionar coisas

- **Coluna nova em `profiles`:** ALTER em arquivo novo `supabase/migrations/<TIMESTAMP>_<nome>.sql` usando `ADD COLUMN IF NOT EXISTS`. Atualizar `DbProfile` em `src/lib/supabase.ts`. Onde escreve: AuthContext (criação), Configuracoes (update), webhook se for billing.
- **Nova tabela:** Criar com RLS habilitado e políticas `auth.uid() = user_id`. Adicionar índice em `user_id`. Atualizar `manage-asaas?action=delete-user` pra apagar no cascade lógico.
- **Novo tipo de notification:** Conferir se existe CHECK constraint ainda em `notifications.type` (antigo) — migration `20260129_add_coupon_notification_types.sql` deveria ter removido. Se persistir, expandir o check antes.
- **Permissão admin nova:** Se for SELECT/UPDATE em tabela existente, adicionar política `Admin can …` com mesmo padrão `EXISTS (… is_admin = TRUE)`. Se for RPC, `SECURITY DEFINER` com gate explícito no corpo.
