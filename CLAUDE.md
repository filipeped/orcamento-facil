# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server on port 8080
npm run build        # Production build
npm run lint         # Run ESLint
npm run test         # Run all tests
npm run test:watch   # Run tests in watch mode
```

Single test file: `npx vitest run src/path/to/file.test.tsx`

For external network access: `npm run dev -- --host --port 8082`

## Architecture

**JARDINEI** - SaaS para jardineiros e paisagistas brasileiros criarem propostas profissionais.

### Stack
- React 18 + TypeScript + Vite
- Tailwind CSS + shadcn/ui components
- React Router for routing
- React Query for server state
- Supabase for auth, database, and storage
- Vitest + Testing Library for tests

### Project Structure

```
src/
├── components/
│   ├── ui/              # shadcn/ui primitives (Button, Input, Dialog, etc.)
│   ├── landing/         # Landing page sections
│   ├── DashboardLayout  # Main app layout with sidebar
│   └── ProtectedRoute   # Auth guard wrapper
├── contexts/
│   ├── AuthContext      # Auth state + Supabase session management
│   ├── ProposalsContext # Proposals CRUD + plan limits
│   ├── CatalogContext   # Plant/service catalog management
│   └── NotificationsContext # In-app notifications
├── pages/               # Route pages
└── lib/
    ├── supabase.ts      # Supabase client + DB types
    ├── generatePDF.ts   # PDF generation for proposals
    ├── generateContract.ts # Contract document generation
    └── utils.ts         # cn() helper for class merging

api/                     # Vercel serverless functions (payment integration)
├── create-payment.js    # Create Asaas subscription
├── cancel-subscription.js
├── reactivate-subscription.js
└── webhook-asaas.js     # Handle Asaas payment webhooks
```

### Routing
- **Public:** `/`, `/login`, `/cadastro`, `/esqueci-senha`, `/termos`, `/privacidade`
- **Protected:** `/dashboard`, `/propostas`, `/clientes`, `/catalogo`, `/agenda`, `/configuracoes`, `/upgrade`

### Key Patterns

**Supabase Client:** Use `getSupabase()` for authenticated requests (includes user token), use `supabase` directly only for auth operations (login/register).

**Plan Limits:** Defined in `ProposalsContext.tsx` - `PLAN_LIMITS` object controls proposals/month and client limits per plan (free, essential, pro).

**Proposal Status Flow:** `draft` → `sent` → `viewed` → `approved` (or `expired`)

### Design System

Custom theme in `src/index.css`:
- **Primary:** Green palette (`verde-50` to `verde-900`)
- **Accent:** Gold for CTAs (`gold-400` to `gold-600`)
- **Fonts:** Inter (body), Poppins (headings)

Utility classes: `.btn-hero`, `.btn-cta`, `.card-elevated`, `.card-pricing`, `.pill-sent`, `.pill-viewed`, `.pill-accepted`

### Path Aliases

```typescript
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { getSupabase } from "@/lib/supabase";
```

### Adding shadcn/ui Components

```bash
npx shadcn@latest add [component-name]
```

### API Functions (Vercel)

The `api/` folder contains serverless functions for Asaas payment integration. These only work:
1. When deployed to Vercel
2. Locally with `npx vercel dev`

They do NOT work with `npm run dev` (will return 404/empty JSON errors).

### Environment Variables

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
ASAAS_API_KEY=           # Server-side only
SUPABASE_SERVICE_ROLE_KEY= # Server-side only
DATABASE_URL=            # Para migrations (em .env.local)
```

### Supabase Migrations

Para criar/alterar tabelas no Supabase via terminal:

1. **Criar arquivo SQL** em `supabase/migrations/[TIMESTAMP]_nome.sql`

2. **Executar migration:**
```bash
npx dotenv -e .env.local -- node scripts/run-migration.cjs supabase/migrations/ARQUIVO.sql
```

3. **Credenciais:** Salvas em `.env.local` (ignorado pelo git)
```
DATABASE_URL=postgresql://postgres:SENHA@db.nnqctrjvtacswjvdgred.supabase.co:5432/postgres
```

**Script:** `scripts/run-migration.cjs` - Conecta ao Supabase e executa SQL

**Exemplo:**
```bash
# Executar migration específica
npx dotenv -e .env.local -- node scripts/run-migration.cjs supabase/migrations/20260128_verification_codes.sql
```
