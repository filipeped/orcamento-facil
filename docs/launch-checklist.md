# Checklist de lançamento — FechaAqui

Tudo que **precisa ser feito por você** (Claude não consegue) antes de subir o FechaAqui em produção.

## 🔴 Bloqueadores (sem isso, não dá pra abrir o app no domínio próprio)

### 1. Domínio
- [ ] Comprar `fechaqui.com` (e `fechaqui.com.br` se quiser)
- [ ] No Vercel: **Add Domain** → apontar pro projeto deste repo
- [ ] DNS: criar registro A/CNAME conforme o Vercel pedir
- [ ] Aguardar SSL (~15 min)

### 2. Variáveis de ambiente no Vercel
Adicionar em **Project → Settings → Environment Variables** (Production + Preview + Development):

```
FECHAQUI_PUBLIC_DOMAIN=https://www.fechaqui.com
FROM_EMAIL_FECHAQUI=FechaAqui <noreply@fechaqui.com>
```

(`JARDINEI_PUBLIC_DOMAIN`, `FROM_EMAIL` etc. continuam no que está hoje — não mexer)

### 3. Migration aditiva no Supabase
Aplicar **uma vez**:

```bash
# Configurar DATABASE_URL no .env.local primeiro
npx dotenv -e .env.local -- node scripts/run-migration.cjs supabase/migrations/20260505_fechaqui_discount_and_signature.sql
```

Adiciona:
- `proposal_items.discount_amount`, `proposal_items.discount_type` (NULL — Jardinei não usa)
- `proposals.signature_url`, `signed_at`, `signed_ip`, `signed_name` (NULL — Jardinei não usa)
- Bucket `signatures` no Storage + RLS pra leitura pública/escrita autenticada

100% seguro pra Jardinei: tudo NULL/default zero, Jardinei nunca lê/escreve esses campos.

### 4. Email transacional (Resend)
- [ ] Adicionar/verificar domínio `fechaqui.com` no painel Resend
- [ ] Configurar SPF + DKIM conforme Resend instrui
- [ ] Sem isso, emails do FechaAqui caem em spam

### 5. Asaas
**Não precisa criar webhook novo** — usa o mesmo do Jardinei (backend é compartilhado). Webhook detecta automaticamente qual brand pelo nome do plano na descrição.

Conferir:
- [ ] Webhook do Asaas continua apontando pra `https://[domínio-vercel]/api/webhook-asaas` (não muda)
- [ ] `ASAAS_WEBHOOK_TOKEN` está setada (já estava antes — não mexer)

## 🟡 Importante mas não bloqueia abrir o site

### 6. Logos / ícones / OG image
Hoje em `public/brand/` tem só JPG raster. Pra qualidade boa:

- [ ] Gerar **SVG** do símbolo (A com check verde) — Figma/Illustrator, retracejar a partir do JPG
- [ ] Gerar **SVG** do wordmark "FechaAqui"
- [ ] `public/favicon.ico` (multi-resolução do símbolo)
- [ ] `public/icons/icon-192x192.png` (PWA)
- [ ] `public/icons/icon-512x512.png` (PWA)
- [ ] `public/icons/icon-152x152.png`, `144x144`, `128x128`, `96x96`, `72x72`, `384x384` (compat completa)
- [ ] `public/og-image.png` 1200×630 (preview WhatsApp/redes)

Sem isso o site funciona — só o ícone na tela inicial e a preview do WhatsApp ficam genéricos.

### 7. Verificar Pixel Facebook
Decisão: continua usando o pixel compartilhado `888149620416465`.
- [ ] (Opcional) Em **Eventos do Meta**, criar audiências segmentadas filtrando por `content_category = "fechaqui_lead"` / `"fechaqui_app"` / etc — pra atribuição separada do Jardinei

### 8. Evolution WhatsApp
Decisão: usa instância `jardinei` por padrão (env var `EVOLUTION_INSTANCE`). Se quiser número/instância separada:
- [ ] Criar instância `fechaqui` no painel Evolution
- [ ] No Vercel, setar `EVOLUTION_INSTANCE=fechaqui` (vai afetar **ambos** os apps porque é uma var só — se quer separar de fato, tem que parametrizar por brand no código também)

## 🟢 Nice to have

### 9. Sentry
- [ ] Criar projeto separado "fechaqui" no Sentry (já está identificado por `app: "fechaqui"` nas tags)
- [ ] Se criar projeto novo, atualizar `VITE_SENTRY_DSN` no Vercel pra DSN nova

### 10. CAPI proxy
Hoje aponta pra `cap.jardinei.com` (compartilhado). Funciona normal.
- [ ] Quando quiser separar: subir `cap.fechaqui.com` (mesmo código do proxy atual, em outro subdomínio)
- [ ] Alterar `CAPI_URL` em `src/services/metaPixel.ts` e `src/tracking/providers/RealCAPIProvider.ts`

### 11. SEO / Search Console
- [ ] Adicionar `fechaqui.com` no Google Search Console
- [ ] Submeter `sitemap.xml` (não existe ainda — criar se for fazer SEO sério)

## ✅ Já feito no código

- ✅ Brand source `brand.ts` com nome, cores, links FechaAqui
- ✅ Logo wordmark "FechaAqui" no `Logo.tsx`
- ✅ Cores do design system (marinho `#0E2A5C` + verde `#22C55E`)
- ✅ Meta tags / OG / Schema.org / manifest.json / sw.js / vercel.json CSP
- ✅ Pricing R$29/228 em PLANS, Upgrade.tsx, Checkout.tsx
- ✅ Trial 7 dias ilimitado
- ✅ Backend `api/*` multi-tenant (default jardinei, fechaqui ativado por origin/body)
- ✅ Catálogo de plantas só carrega pra nicho jardinagem/paisagismo
- ✅ Desconto por item (interface + cálculo + persiste se migration aplicada)
- ✅ E-signature integrado em PropostaPublica (modal + canvas + upload + audit fields)
- ✅ Mensagens WhatsApp/email parametrizadas por brand
- ✅ localStorage migration silenciosa (orcafacil → fechaqui)
- ✅ Build compila sem erros
- ✅ Jardinei intacto: PLANS legados preservados, default jardinei em todo lugar, schema sem alterações

## 🚫 O que NÃO foi feito (decisão consciente)

- ❌ Templates de PDF múltiplos (3-6 layouts) — pulado, fica pra v2
- ❌ Histórico financeiro por cliente — fica pra v2
- ❌ Tags em clientes — fica pra v2
- ❌ Export XLSX/CSV — fica pra v2
- ❌ Conversão proposta → recibo (rota `/faturas` ainda é stub) — fica pra v2
- ❌ Lint cleanup dos 44 erros pré-existentes — não é responsabilidade desse rebrand
- ❌ Renomear prefixo CSS `--jd-*` → `--fq-*` — refator gigante sem ROI agora
