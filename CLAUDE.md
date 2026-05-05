# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ REGRA MASTER — Backend compartilhado com Jardinei (produção)

Este repo (FechaAqui) foi **clonado** de Jardinei. Os dois compartilham o mesmo Supabase (`nnqctrjvtacswjvdgred`), as mesmas serverless functions em `api/`, o mesmo Asaas e o mesmo Pixel. **Jardinei está em produção com clientes ativos pagando.**

**Toda mudança em `api/*.js` ou no schema Supabase tem que ser ADITIVA.**

✅ PODE: adicionar tabelas/colunas/policies novas, adicionar keys novas em estruturas (`PLANS.fechaqui_*`), adicionar serverless functions, parametrizar templates por brand com default = jardinei, modificar frontend (`src/`) livremente.

❌ NÃO PODE: alterar/remover colunas, renomear tabelas, mudar RLS de modo que afete Jardinei, trocar valores hardcoded de Jardinei (R$97/R$804, copy "JARDINEI"), apagar dados, fazer migration restritiva.

Padrão de detecção de brand no backend:
```js
const reqOrigin = (req.headers.origin || req.headers.referer || '').toLowerCase();
const brand = reqOrigin.includes('fechaqui') ? 'fechaqui' : 'jardinei';
```
Webhook Asaas detecta pela `payment.description`.

## Aprofundamento por área

Esqueleto fica aqui. Quando for mexer em uma área específica, leia o doc focado primeiro:

- **Billing / Asaas / planos / trial / webhook:** [`docs/billing-asaas.md`](docs/billing-asaas.md)
- **Schema Postgres / tabelas / RLS / migrations / storage:** [`docs/database-schema.md`](docs/database-schema.md)
- (Próximos: `docs/proposals-flow.md`, `docs/tracking.md`, `docs/scripts.md`)

## Commands

```bash
npm run dev          # Vite dev server on port 8080 (no Vercel functions)
npm run build        # Production build
npm run lint         # ESLint
npm run test         # Vitest unit tests
npm run test:watch
npm run test:e2e     # Playwright e2e (BASE_URL env var, default https://www.jardinei.com)
npm run test:all     # vitest + playwright
```

Single test file: `npx vitest run src/path/to/file.test.tsx`
Single e2e: `npx playwright test e2e/auth.spec.ts`

For external network access: `npm run dev -- --host --port 8082`

To exercise the `api/` serverless functions locally, run `npx vercel dev` instead of `npm run dev` — `npm run dev` returns 404 for `/api/*`.

To preview the UI without logging in, set `VITE_BYPASS_AUTH=true` in `.env.local`. This swaps the real `AuthProvider` for a fake admin demo user and `ProtectedRoute` lets everything through (`src/contexts/AuthContext.tsx`, `src/components/ProtectedRoute.tsx`).

## Architecture

**OrçaFácil** (package name `orcamento-facil`, brand defined in `src/lib/brand.ts`) — SaaS para prestadores de serviço brasileiros (jardinagem, elétrica, hidráulica, pintura, etc.) gerarem orçamentos e faturas profissionais. Forked from a previous gardening-only product (`jardinei.com`); some legacy `jardinei`/`paisagismo` strings, env keys, and the e2e BASE_URL still reference the old brand.

### Stack
- React 18 + TypeScript + Vite (SWC), Tailwind + shadcn/ui, React Router, React Query
- Supabase (auth, Postgres, Storage) — project ref `nnqctrjvtacswjvdgred`
- Vercel serverless functions in `api/` for payments, webhooks, OG, cron
- Vitest + Testing Library (unit), Playwright (e2e)
- Sentry, Vercel Speed Insights, Meta Pixel + CAPI tracking

### Routing (`src/App.tsx`)

All pages are lazy-loaded. There are three guard wrappers: `ProtectedRoute`, `AdminRoute`, and the public path.

- **Public:** `/`, `/checkout`, `/login`, `/cadastro`, `/esqueci-senha`, `/reset-password`, `/termos`, `/privacidade`, `/auth/callback`, `/p/:code/:name` (public proposal view), `/pagamento-sucesso`
- **Protected (`ProtectedRoute`):** `/orcamentos*` (canonical) and `/propostas*` (legacy alias — both point at the same components), `/faturas*` (stub — `FaturasStub` page, awaiting backend `doc_type`), `/meus-itens` (Catalogo), `/clientes`, `/despesas*`, `/relatorios`, `/agenda`, `/configuracoes`, `/upgrade`
- **Admin (`AdminRoute`):** `/admin`, `/admin/{assinantes,cupons,logs,relatorios,projecao}` — gated on `profile.is_admin`
- `/dashboard` redirects to `/orcamentos`

`OAuthRedirector` (top of `App.tsx`) intercepts OAuth/recovery hash params anywhere in the URL and forwards to `/auth/callback` or `/reset-password` before the router mounts.

### ProtectedRoute gates (run in order)

`src/components/ProtectedRoute.tsx` enforces, after auth:
1. **Payment gate** — non-admins without `plan_status === "active"` AND a non-`free` plan are redirected to `/upgrade`. `/upgrade` and `/pagamento-sucesso` are exempted so the user can complete checkout.
2. **Phone verification** — `phone_verified === false` shows `<PhoneVerification>`. Required (no skip) for Google sign-ins; manual signups can skip.
3. **Onboarding wizard** — `onboarding_completed === false` shows `<OnboardingWizard>` (collects company name, logo, industry).

### Supabase client pattern (`src/lib/supabase.ts`)

Sessions are managed **manually** — `autoRefreshToken`/`persistSession`/`detectSessionInUrl` are all `false`. We store the session ourselves in `localStorage` under key `sb-${PROJECT_REF}-auth-token` and refresh via `refreshSession()` with a single-flight mutex.

- `supabase` — anon client, used only for login/register/`auth.refreshSession`.
- `getSupabase()` — returns a memoized client whose `Authorization: Bearer` header tracks the current `access_token`. Use this for **every** authenticated DB query. The cached instance is invalidated whenever the token changes.

Always call `getSupabase()` (not `supabase`) for table reads/writes. Anything else returns rows as the anon role and trips RLS.

### State / contexts

Provider order in `App.tsx` is `Auth → Notifications → Proposals → Catalog → Expenses`. Don't reorder — `ProposalsContext` reads `useAuth()` and notifications helpers.

- `AuthContext` — manual session lifecycle, profile fetch/upsert, plan name mapping, trial computation, fires Meta Pixel + CAPI tracking on register.
- `ProposalsContext` — server-backed CRUD against Supabase. `PLAN_LIMITS` (`free` 0/mo, `essential` 30/mo & 90 days history, `pro`/`admin` unlimited) and `TRIAL_SENT_LIMIT = 5` are defined here. Status flow: `draft → sent → viewed → approved` (or `expired`). `visibleProposals` is filtered by `historyDays`; `hiddenProposalsCount` shows what the plan is hiding.
- `CatalogContext` — user's catalog of services/items.
- `ExpensesContext` — **localStorage only** (`orcafacil_expenses_v1`), no Supabase backing yet. Anything written here is per-device.
- `NotificationsContext` — in-app notifications + helpers (`createProposalViewedNotification`, etc.) imported by other contexts.

### Industry templates (`src/lib/industryTemplates.ts`)

`INDUSTRIES` array drives the onboarding wizard's industry picker and seeds the catalog with `defaultItems` for each segment (jardinagem, elétrica, hidráulica, pintura, …). When adding a new vertical, add it here — the wizard, catalog seeding, and copy fan out from this list. Selected industry id is also stored under `orcafacil_user_industry` in localStorage.

### Tracking (`src/tracking/`)

Meta Pixel + CAPI dual-send with deduplication. Don't touch unless you understand the contract.
- `core/DeduplicationEngine` — generates `event_id`, manages `external_id` (24h validity, localStorage with sessionStorage fallback for migration), single-flight mutex on generation.
- `providers/BrowserPixelProvider` (fbq) and `RealCAPIProvider` (server). Same `event_id` is sent both sides for dedup.
- `utils/{CookieManager,IPDetector,GeoEnrichment}` — fbp/fbc, IP detection, geo enrichment (PII hashed SHA-256 before send).
- `events/LeadTracker` — Lead event helper.
- The bridge `localStorage['jardinei_profile_tracking']` (key still uses old brand) is written by `AuthContext` so `services/metaPixel.ts` can read profile data outside React.

### API functions (`api/`, Vercel)

`create-payment.js`, `create-proposal-payment.js`, `manage-asaas.js`, `cancel-subscription.js` (via `manage-asaas`), `webhook-asaas.js` — Asaas billing.
`approve-proposal.js`, `notify-proposal.js`, `og-proposal.js` (OG image rendered for crawlers on `/p/:id`), `notifications.js`, `verify-phone.js`, `delete-account.js`, `subscription.js`, `cron.js`.

`vercel.json` configures CSP headers, rewrites `/p/*` to `og-proposal` for known crawler UAs, and schedules cron jobs (daily plan check 08:00, monthly recurring 1st @ 07:00, monthly report 1st @ 10:00, daily reengagement 13:00, daily proposal reminders 14:00) — all hitting `/api/cron?job=…`.

These run only on Vercel (or `npx vercel dev`). They cannot be exercised under `npm run dev`.

### Tests

- Unit (`src/**/*.test.{ts,tsx}`) — jsdom env, setup file `src/test/setup.ts`. Examples: `proposal-helpers.test.ts`, `date-formatting.test.ts`, `sentry.test.ts`.
- E2E (`e2e/*.spec.ts`) — Playwright, Chromium only. **Default `baseURL` is `https://www.jardinei.com`** (`playwright.config.ts`); override with `BASE_URL=http://localhost:8080` to hit local dev.

### Design system

Theme in `src/index.css`, tokens in `tailwind.config.ts`:
- Primary green palette (`verde-50` … `verde-900`), gold accent (`gold-400` … `gold-600`)
- Fonts: Inter (body), Poppins (headings)
- Utility classes: `.btn-hero`, `.btn-cta`, `.card-elevated`, `.card-pricing`, `.pill-sent`, `.pill-viewed`, `.pill-accepted`

### Path aliases

```typescript
import { Button } from "@/components/ui/button";       // src/
```

### Adding shadcn components

```bash
npx shadcn@latest add [component-name]
```

### Environment variables

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_BYPASS_AUTH=true              # optional, preview without login
ASAAS_API_KEY=                     # server only
SUPABASE_SERVICE_ROLE_KEY=         # server only
DATABASE_URL=                      # migrations, in .env.local
```

### Supabase migrations

SQL files live in `supabase/migrations/<TIMESTAMP>_name.sql`. Run with:

```bash
npx dotenv -e .env.local -- node scripts/run-migration.cjs supabase/migrations/<FILE>.sql
```

`scripts/run-migration.cjs` uses `pg` against `DATABASE_URL` from `.env.local`. The `scripts/` folder also has many one-off ops scripts (audits, seeders, fixers, fuzzy-match) — read before running, several mutate production data.

### Vite build chunking

`vite.config.ts` defines manual chunks (`vendor`, `supabase`, `ui`, `forms`, `dates`, `query`). `console.log`/`debugger` are dropped in production builds. `html2pdf.js` (~982KB) is intentionally lazy-loaded — keep it that way.
