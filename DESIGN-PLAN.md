# DESIGN PLAN — Jardinei Landing V2 (redesign)

**Data:** 2026-04-21
**Status:** aprovado pelo Filipe, em implementação
**Escopo:** `src/pages/LandingV2.tsx` (arquivo único, 1459 linhas)

## Princípios

1. **Honestidade sobre exagero** — todo número tem que ter fonte ou sair.
2. **SaaS sóbrio, não infoproduto** — borda > shadow pesada, cor sólida > gradient, zero elemento girando/pulsando decorativo.
3. **"Menos de 3 minutos"** é a promessa unificada (vídeo).
4. **O produto fala por si** — catálogo 800+, link OU PDF, edição depois de enviar, 12 meses ilimitado.
5. **PT-BR direto e profissional** — sem "revolucione", sem emoji em headline, sem exclamação dupla.

## Decisões aprovadas

1. Promessa unificada em "menos de 3 minutos"
2. Logos de stock removidos; TrustBar vira 3 stats (800+, 3 min, 12 meses) + avatares com iniciais
3. "+500 paisagistas" → "Paisagistas e floriculturas de todo Brasil"
4. Seção **PainMath removida**
5. Bloco 15%/45% na Transformation removido
6. Botão "Aprovar proposta" removido dos mocks
7. "12 meses ilimitado" adicionado no Anual + TrustBar
8. Nome científico adicionado nos mocks de proposta
9. "Link OU PDF" adicionado em Hero, Plan, MockEditor, FAQ
10. Proof → **caminho C** (substitui por "O que muda no dia a dia")
11. CTA unificado: `Testar 7 dias`
12. Remover globalmente: `bg-clip-text` em números, `ring-*-offset-*`, `shadow-emerald-500/*`, `animate-pulse` em badges, `animate-[spin]` em selo, `blur-3xl` glows
13. "horticultura" adicionado no ForWho
14. "Seu preço trava pra sempre" removido do card Anual
15. 2 FAQs novas: P13 (link ou PDF), P14 (alteração depois de enviar)

## Implementação em 4 ondas

### Onda 1 — Primeira dobra + CTAs globais
- Nav: CTA "Testar 7 dias", remove bolinha interna
- Hero: headline nova ("Envie uma proposta profissional de paisagismo em menos de 3 minutos"), sub com "link ou PDF", remove underline SVG, remove 2 floating badges, remove pill "NOVO", CTA "Testar 7 dias"
- TrustBar: remove 5 logos stock, 3 stats (800+, 3 min, 12 meses), avatares com iniciais
- FinalCTA: headline "Sua próxima proposta sai em menos de 3 minutos", remove pill pulsante, CTA "Testar 7 dias"
- StickyMobileCTA: label "Testar 7 dias"

### Onda 2 — Mensagem central
- Remove PainMath inteiro (seção + função)
- Transformation: nome científico nos itens, remove botão "Aprovar proposta" do mock, remove rodapé "Aprovado · 2 horas", remove bloco 15%/45%, remove glow blur-3xl, remove "Cliente sumiu · 3 dias" → "Sem retorno"
- Plan: 3 passos reescritos (01 Cadastra, 02 Monta, 03 Envia por link ou PDF), remove animate-pulse, CTA "Testar 7 dias"

### Onda 3 — Prova + Oferta + FAQ
- Proof (caminho C): substitui 3 depoimentos por 3 cards "Antes → Agora" (documento profissional, painel unificado, alteração na hora)
- Offer: headline "Dois planos. 1 serviço fechado paga o ano", features do Anual inclui "Acesso completo por 12 meses", remove "Seu preço trava pra sempre", remove ring-offset, remove gradient no preço R$67, remove selo girando, remove "almoço por semana"
- FAQ: ajusta P2, P3, P7; adiciona P13 (link ou PDF) e P14 (alteração depois de enviar)

### Onda 4 — Produto por dentro + polish
- ProductPreview: MockDashboard (remove emoji 👋, remove "Taxa de fechamento 45%", sidebar reduz pra 4 itens, status "Aprovada/Enviada"), MockEditor (remove emojis de planta, "Clique para adicionar" no lugar de "arraste", nome científico nos itens, botão "Baixar PDF" ao lado de "Enviar por link"), MockProposta (nome científico, linha com CNPJ, remove botão "Aprovar")
- ForWho: copy ajustada, inclui "horticultura"
- Polish global: pass removendo shadows coloridas, gradient-text residuais, animate-pulse

## Tracking

- Pixel e CAPI: intocados
- Rota `/` LandingV2: mantida
- Build: precisa passar em cada onda antes de avançar
