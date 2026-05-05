# Billing — Integração Asaas

Fluxo completo de cobrança recorrente, máquina de estados de plano e pontos onde bugs costumam aparecer.

> Antes de mexer em qualquer coisa de billing, leia este arquivo inteiro. Quase todo bug aqui tem origem em assumir que um pedaço do fluxo se comporta de forma diferente do que de fato se comporta.

## Visão geral

Asaas é o gateway. A gente cria **assinaturas recorrentes** (não cobranças únicas) com `cycle: MONTHLY` ou `YEARLY`. O Asaas gera o pagamento; o pagamento é confirmado via **webhook**; o webhook atualiza `profiles.plan_status` e libera a plataforma.

```
Frontend (Upgrade.tsx)
   │  POST /api/create-payment
   ▼
api/create-payment.js  ──►  Asaas (cria customer + subscription)
   │                        │
   │                        ▼
   │                    Cliente paga (PIX/Cartão/Boleto)
   │                        │
   ▼                        ▼
Salva checkout_tracking  Asaas webhook
   (fbp/fbc/IP/UA pra CAPI)   │
                              ▼
                       api/webhook-asaas.js
                              │
                              ├─► UPDATE profiles (plan, plan_status, plan_expires_at)
                              ├─► INSERT payment_history
                              ├─► INSERT notifications
                              ├─► sendEmail (Resend)
                              ├─► sendWhatsAppMessage (Evolution — KILL SWITCH)
                              └─► Facebook CAPI Purchase (só primeira compra)
```

## Planos e preços

`api/create-payment.js` linhas 15-18 — fonte da verdade no servidor:

| Key                | Plan        | Period   | Value | Cycle    |
|--------------------|-------------|----------|-------|----------|
| `essential_monthly`| `essential` | mensal   | R$97  | `MONTHLY`|
| `pro_annual`       | `pro`       | anual    | R$804 | `YEARLY` |

`Upgrade.tsx` precisa exibir os mesmos valores (sincronizado manualmente — não há fonte única).

`PLAN_LIMITS` em `src/contexts/ProposalsContext.tsx` traduz o plano em limites:
- `free` → 0 propostas/mês, 30 dias de histórico
- `essential` → 30 propostas/mês, 90 dias de histórico
- `pro` → ilimitado
- `admin` → ilimitado (não é plano comercial, vem de `profiles.is_admin`)

## Trial

`TRIAL_DAYS = 3` (`AuthContext.tsx`), `TRIAL_SENT_LIMIT = 5` (`ProposalsContext.tsx`).

- Trial só aplica pra `plan === 'free'`. Quem tem plano pago nunca está em trial.
- Janela: 3 dias contados de `plan_started_at` (fallback `created_at`).
- Limite: 5 propostas **enviadas** durante o trial (não criadas — `status !== 'draft'`).
- `monthlyProposalsCount` durante trial conta TODAS as enviadas desde o início, não só do mês.
- Após trial: cai pra limite normal do plano (`free` = 0/mês ⇒ não cria mais nada, força upgrade).

`isInTrial` é calculado no client (`AuthContext.checkIsInTrial`). Não existe job que "encerra trial" — ele simplesmente passa a retornar `false` quando `now >= trialEndDate`.

## Máquina de estados — `profiles.plan_status`

Estados possíveis: `active`, `trial` (legacy), `expired`, `cancelled`, `overdue`.

Transições:

| De → Para               | Quem dispara                                      | O que acontece                                                                                          |
|-------------------------|---------------------------------------------------|----------------------------------------------------------------------------------------------------------|
| (novo) → `active`+free  | `AuthContext.checkSession`                        | Usuário recém-cadastrado: `plan='free'`, `plan_status='active'`, `plan_started_at=now`, `show_tour=true` |
| → `active`+pago         | `webhook-asaas` em `PAYMENT_CONFIRMED`/`RECEIVED` | Seta `plan` (essential/pro), `plan_period`, `plan_started_at`, `plan_expires_at`, limpa `plan_overdue_since` |
| `active` → `overdue`    | `webhook-asaas` em `PAYMENT_OVERDUE`              | Seta `plan_overdue_since=now`. Não rebaixa o plano — usuário ainda tem 7 dias de graça.                  |
| `overdue` → `free`+`active` | `ProposalsContext.fetchUserPlan` (client-side) | Após 7 dias de overdue, rebaixa pra `free` automaticamente E cria notificação `plan_downgraded`.        |
| → `cancelled`           | `webhook-asaas` em `PAYMENT_DELETED`              | Rebaixa `plan='free'`, limpa `plan_overdue_since`.                                                       |
| → `cancelled`           | `webhook-asaas` em `PAYMENT_REFUNDED`             | Rebaixa `plan='free'`, limpa `plan_overdue_since`. Cria notificação `system`.                           |
| `trial` → `free`+`active`| `ProposalsContext.fetchUserPlan`                 | Backward compat: usuários antigos com `plan_status='trial'` viram `free`+`active` na primeira vez que abrem o app. |

**Estados terminais visíveis pela UI:**
- `expired`: trata como `free` mas não bloqueia. (não escrito mais hoje, só lido por compat.)
- `cancelled` com `plan_expires_at` futuro: usuário mantém acesso ao plano pago até a data.
- `cancelled` com `plan_expires_at` passado: trata como `free`.

## Gate de pagamento (ProtectedRoute)

`src/components/ProtectedRoute.tsx` linhas 132-141: **plano ativo pago é obrigatório pra entrar na plataforma**.

```ts
const hasActivePaidPlan = data?.plan_status === "active" && data?.plan && data.plan !== "free";
if (!isAdmin && planActive === false) → redirect /upgrade
```

Exceções (não passam pelo gate):
- `is_admin === true`
- Rotas `/upgrade` e `/pagamento-sucesso` (cliente recém-cadastrado precisa pagar antes de ter plano ativo)

**Implicação:** durante o trial de 3 dias o usuário FREE **não consegue acessar** /orcamentos. Confere o código pra ver se isso é o desejado — atualmente o gate manda pra /upgrade independente de trial. Se for pra mudar, ajuste aqui.

## Webhook — pontos críticos

### Autenticação

`webhook-asaas.js` exige header `asaas-access-token` ou query `?token=` igual à env `ASAAS_WEBHOOK_TOKEN`. Sem isso ou com mismatch: 401.

### Idempotência

```ts
SELECT id FROM payment_history WHERE asaas_payment_id = $1 AND status = 'paid'
```

Se já existe, retorna 200 sem reprocessar. Asaas reentrega webhook em retry — não é seguro processar duas vezes (cria duplicatas em `payment_history`, dispara CAPI duplicado, etc.).

### Resolvendo `userId`

Tenta nessa ordem:
1. `payment.externalReference` (passado em `create-payment` ao criar a subscription)
2. **Fallback** via `payment.customer` → busca `profiles.asaas_customer_id` mais recente (`updated_at DESC LIMIT 1`)

O fallback existe porque o Asaas reusa `customer_id` por CPF/email. Pode haver N profiles apontando pro mesmo customer (raro, mas acontece em conta de teste). Pegar o mais recente é heurística — registra erro em `webhook_logs` se falhar e retorna 200 (não é erro do Asaas).

### Detecção de plano

Na ordem (primeira que bate, vence):
1. **Descrição** (`payment.description`): "anual" → `pro`, "mensal"/"essencial" → `essential`. Funciona com cupons (descrição vira ex. "JARDINEI Anual (-15%)").
2. **Valor exato**: `804` → `pro`, `97` → `essential`.
3. **Faixa**: `>500` → `pro`, `>0` → `essential`.

Período: descrição contém "anual" OU valor ≥ 500 → `annual`, senão `monthly`.

### Guard de `PAYMENT_OVERDUE` "stale"

Asaas às vezes dispara `PAYMENT_OVERDUE` de uma cobrança antiga DEPOIS do `PAYMENT_RECEIVED` do novo ciclo. Sem o guard, o usuário que acabou de renovar volta pra `overdue`.

```ts
if (event === 'PAYMENT_OVERDUE' && profile.plan_expires_at > now && profile.plan_status === 'active') {
  // ignora — log "stale overdue ignored"
}
```

### Cálculo de `plan_expires_at`

- Annual: `now + 1 year`
- Monthly: `now + 30 days`

### Retorno sempre 200

Mesmo em erro de userId não encontrado, ou payment object faltando, retorna `200 { received: true, error/warning }` — Asaas não pode tentar de novo (já processamos o que dava). Erro vai pra `webhook_logs.status = 'error'` pra alerta manual.

## Tracking — Facebook CAPI Purchase

Só dispara em **primeira compra** (renovação não conta como conversão nova).

Define-se "primeira compra" como qualquer um:
- `userData.plan_status` é vazio
- `userData.plan === 'free'`
- `userData.plan_status` em `['trial', 'expired', 'cancelled', 'overdue']`

Browser data (fbp, fbc, IP real, user-agent) vem da tabela `checkout_tracking` (preenchida em `create-payment.js`). Busca em ordem:
1. Por `asaas_payment_id`
2. Por `asaas_subscription_id`
3. Último checkout do user

`event_id = "purchase_asaas_${payment.id}"` — determinístico, dedup com `PagamentoSucesso.tsx` que dispara o Pixel client-side com o mesmo ID.

CAPI endpoint: `https://cap.jardinei.com/api/events`, pixel `888149620416465`. Retry: 3 tentativas com backoff.

## Cupons

Tabela `coupons`: `code` (UPPERCASE), `discount_percent`, `valid_until`, `max_uses`, `current_uses`, `active`, `plans` (array de planos aplicáveis — vazio = todos).

**Validação dupla** (frontend + servidor):
- Frontend valida via `manage-asaas?action=validate-coupon` pra UX (mostrar desconto antes de pagar)
- `create-payment.js` **revalida no servidor** antes de aplicar — não confiar no `discountPercent` do body

Aplicação: `finalValue = Math.round(planConfig.value * (1 - discount/100))`. Incrementa `current_uses` só após criação bem-sucedida da subscription.

`retention_coupons` é tabela separada (cupons oferecidos quando o user clica em cancelar) — ver migration `20260129_create_retention_coupons.sql`.

## Cancelamento

Não tem ação dedicada `cancel-subscription` mais — o admin/user usa `manage-asaas?action=delete-user` (que cancela todas as subs ativas no Asaas via `DELETE /subscriptions/:id` e em seguida apaga tudo em cascade).

Pra cancelamento "soft" (manter plano até expirar) o user vai pelo painel do Asaas direto (callback URL volta pra `/pagamento-sucesso`). Quando o Asaas cancela a sub, dispara `PAYMENT_DELETED` e o webhook rebaixa pra `free`.

## Register-and-pay

`create-payment.js` aceita `userId` vazio se vier `customerEmail`, `password`, `customerName`, `phone`, `cpfCnpj` no body.

- Cria `auth.users` via `supabase.auth.admin.createUser({ email_confirm: true })` — não loga no browser.
- Cria `profiles` com `plan='free'`, `plan_status='trial'` (sim, escreve trial — mas o webhook subsequente vai sobrescrever pra `active` ao confirmar pagamento).
- Email duplicado: retorna `409 { alreadyExists: true }`.

Cliente paga ANTES de logar. Após pagamento, `/pagamento-sucesso` é público (não passa por ProtectedRoute) e instrui o user a fazer login pra primeira vez.

## Cron jobs (`vercel.json`)

Todos hitam `/api/cron?job=…`:

| Schedule (UTC) | Job                  | Função                                                                       |
|----------------|----------------------|------------------------------------------------------------------------------|
| `0 8 * * *`    | `check-plans`        | Rebaixa planos expirados, marca overdue, dispara notifs.                     |
| `0 7 1 * *`    | `recurring`          | Mensal dia 1 — checagens de assinatura recorrente.                           |
| `0 10 1 * *`   | `monthly-report`     | Mensal dia 1 — relatório.                                                    |
| `0 13 * * *`   | `reengagement`       | Diário — reengajamento.                                                      |
| `0 14 * * *`   | `proposal-reminders` | Diário — lembretes de propostas.                                             |

Implementação em `api/cron.js` (router por `?job=`).

## Variáveis de ambiente (server-only)

```
ASAAS_API_KEY              # token de API Asaas
ASAAS_WEBHOOK_TOKEN        # auth do webhook (configurar no Asaas tbm)
SUPABASE_SERVICE_ROLE_KEY  # bypass RLS no webhook
EVOLUTION_API_KEY          # WhatsApp (Evolution API)
EVOLUTION_URL              # default: digitalpaisagismo-evolution.cloudfy.live
EVOLUTION_INSTANCE         # default: jardinei
```

`WHATSAPP_DISABLED = true` em `webhook-asaas.js` linha 24 — kill switch. Quando ligado, todos os `sendWhatsAppMessage` retornam false sem chamar a Evolution.

## CORS

`ALLOWED_ORIGINS` em `create-payment.js` e `manage-asaas.js`:
```
https://www.jardinei.com
https://jardinei.com
https://verdepro-proposals.vercel.app
http://localhost:8080
http://localhost:3000
```

Quando o domínio do produto trocar pra `orcafacil.com`, **adicionar aqui** ou as chamadas do front quebram com CORS (sem mensagem clara — só "failed to fetch").

## Referências legacy a "JARDINEI"

Strings que ainda dizem "JARDINEI" em produção (cuidar ao trocar de nome):
- `PLANS[].name` em `create-payment.js` ("JARDINEI Mensal", "JARDINEI Anual") — **mudou aqui muda a `payment.description` do Asaas, e a detecção de plano no webhook depende disso**. Trocar nos dois ao mesmo tempo.
- `successUrl` hardcoded `https://www.jardinei.com/pagamento-sucesso` em `create-payment.js` linha 359.
- Mensagens de WhatsApp/email no webhook ainda dizem "JARDINEI" e linkam `jardinei.com/dashboard`, `jardinei.com/configuracoes`.
- `CAPI_URL = https://cap.jardinei.com/api/events` — endpoint próprio de CAPI, hospedado fora deste repo.

## Tabelas envolvidas

- `profiles` — colunas relevantes: `user_id`, `plan`, `plan_status`, `plan_period`, `plan_started_at`, `plan_expires_at`, `plan_overdue_since`, `asaas_customer_id`, `cnpj`, `phone`, `is_admin`, `show_tour`, `phone_verified`, `onboarding_completed`
- `payment_history` — `user_id`, `asaas_payment_id`, `amount`, `status`, `paid_at`, `invoice_url`. **Idempotência key: `(asaas_payment_id, status='paid')`**.
- `webhook_logs` — auditoria de cada chamada do webhook (`event_type`, `payload`, `status`, `error_message`).
- `checkout_tracking` — `user_id`, `asaas_subscription_id`, `asaas_payment_id`, `fbp`, `fbc`, `client_ip`, `user_agent`, `event_source_url`. Lida pelo webhook pra atribuir Purchase ao clique no anúncio.
- `coupons` — `code`, `discount_percent`, `valid_until`, `max_uses`, `current_uses`, `active`, `plans[]`.
- `retention_coupons` — cupons exibidos no fluxo de cancelamento.
- `notifications` — tipos relacionados a billing: `payment_confirmed`, `payment_overdue`, `plan_downgraded`, `system` (refund), `coupon_*`.
