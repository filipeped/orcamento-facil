import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Check,
  ChevronDown,
  X,
  Search,
  Bell,
  Package,
  FileText,
  Star,
  ShieldCheck,
} from "lucide-react";
import { motion } from "motion/react";
import { Logo } from "@/components/Logo";
import { Reveal, Stagger, Counter } from "@/components/landing/Motion";
import { useAuth } from "@/contexts/AuthContext";
import { trackPageView, trackViewContent } from "@/services/metaPixel";

const CTA_URL = "/checkout?plan=pro";

export default function LandingV2() {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const hasTracked = useRef(false);

  useEffect(() => {
    // Desliga scroll restoration do browser — evita Hero 'flutuando' no meio
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    if (!hasTracked.current) {
      hasTracked.current = true;
      trackPageView();
      const t = setTimeout(() => trackViewContent(), 2000);
      return () => clearTimeout(t);
    }
  }, []);

  useEffect(() => {
    if (!isLoading && isAuthenticated) navigate("/propostas");
  }, [isAuthenticated, isLoading, navigate]);

  return (
    <div className="min-h-screen w-full bg-jd-bg text-jd-ink font-body overflow-x-hidden antialiased selection:bg-jd-accent selection:text-white">
      <Nav />
      <main>
        <Hero />
        <Transformation />
        <Plan />
        <Proof />
        <Offer />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}

// =============================================================================
// NAV v3 — editorial, serifada, terra/natureza
// =============================================================================
function Nav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 ${
        scrolled
          ? "bg-[hsl(40,33%,96%)]/80 backdrop-blur-xl border-b border-jd-border py-3"
          : "bg-transparent py-4"
      }`}
    >
      <div className="max-w-4xl mx-auto px-5 sm:px-6 flex items-center justify-between">
        <Link to="/v2" aria-label="FechaAqui">
          <Logo />
        </Link>
        <div className="flex items-center gap-1 md:gap-2">
          <Link
            to={CTA_URL}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-jd-accent text-white hover:opacity-90 rounded-full transition-opacity"
          >
            Começar
            <ArrowRight size={13} strokeWidth={2} />
          </Link>
          <Link
            to="/login"
            className="inline-flex px-3 py-1.5 text-sm font-medium text-jd-muted hover:text-jd-ink transition-colors"
          >
            Entrar
          </Link>
        </div>
      </div>
    </header>
  );
}

// =============================================================================
// HERO v3 — editorial, serifado, silencioso
// =============================================================================
function Hero() {
  return (
    <section className="relative pt-32 md:pt-40 pb-12 md:pb-16">
      <div className="relative max-w-3xl mx-auto px-5 sm:px-6 text-center">
        {/* Kicker sobrio — sem motion, evita bug de hidratacao mobile */}
        <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-jd-muted mb-8">
          Para todo prestador de serviço
        </p>

        {/* Headline direto ao benefício — promessa clara. leading 1.15 pra
            descenders Fraunces nao colidirem com kicker no FOUT */}
        <h1 className="font-display text-jd-ink mb-6 text-[36px] sm:text-5xl md:text-6xl lg:text-[68px] leading-[1.15] md:leading-[1.1] tracking-[-0.02em] font-medium">
          Feche mais orçamentos com propostas <em className="text-jd-accent font-normal italic">profissionais em 3 minutos.</em>
        </h1>

        {/* Sub alinhada com o anúncio — direto no fluxo */}
        <p className="text-base md:text-lg text-jd-muted max-w-xl mx-auto leading-relaxed mb-10">
          Monta seu orçamento, manda o link pelo WhatsApp. O cliente abre no celular, vê tudo organizado, aprova com 1 clique e paga via Pix.
        </p>

        {/* Um CTA so, sem stack de bullets */}
        <div className="mb-3">
          <Link
            to={CTA_URL}
            className="inline-flex items-center gap-2.5 px-6 py-3.5 bg-jd-accent hover:opacity-90 text-white font-medium rounded-full transition-opacity text-[15px]"
          >
            Começar agora
            <ArrowRight size={15} strokeWidth={2} />
          </Link>
        </div>

        {/* Micro-copy discreta, uma linha so */}
        <p className="text-xs text-jd-muted">
          R$97/mês · 7 dias de garantia · cancele quando quiser
        </p>

        {/* Video / mockup — abaixo do fold, pode animar sem risco */}
        <motion.div
          className="mt-14 md:mt-20"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <VTurbPlayer />
        </motion.div>
      </div>
    </section>
  );
}

// =============================================================================
// TRUST BAR — Logos/stats after hero
// =============================================================================
function TrustBar() {
  const avatars = [
    { initials: "CO", bg: "bg-green-600" },
    { initials: "AF", bg: "bg-neutral-800" },
    { initials: "JM", bg: "bg-green-600" },
    { initials: "RS", bg: "bg-neutral-800" },
    { initials: "PL", bg: "bg-green-600" },
  ];

  return (
    <section className="py-10 md:py-14 bg-gradient-to-b from-neutral-50/30 via-white to-white">
      <div className="max-w-5xl mx-auto px-5 sm:px-6">
        <Reveal direction="up" className="flex flex-col items-center gap-2.5 mb-6">
          <div className="flex items-center -space-x-2">
            {avatars.map((a, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.5 }}
                transition={{ duration: 0.35, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
                className={`w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-white text-[10px] font-bold ${a.bg}`}
              >
                {a.initials}
              </motion.div>
            ))}
          </div>
          <p className="text-center text-[10px] md:text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
            Prestadores de serviço de todo Brasil
          </p>
        </Reveal>
        <Stagger className="grid grid-cols-3 gap-y-4 gap-x-4 items-center max-w-2xl mx-auto" stagger={0.1}>
          <TrustStatAnimated counter={20} suffix="+" label="ramos atendidos" highlight />
          <TrustStat value="3 min" label="pra montar proposta" />
          <TrustStat value="12 meses" label="de acesso no Anual" />
        </Stagger>
      </div>
    </section>
  );
}

function TrustStatAnimated({ counter, suffix = "", label, highlight = false }: { counter: number; suffix?: string; label: string; highlight?: boolean }) {
  return (
    <div className="text-center">
      <p className={`text-2xl md:text-3xl font-bold tabular-nums tracking-tight ${highlight ? "text-green-600" : "text-neutral-950"}`}>
        <Counter value={counter} suffix={suffix} duration={1} />
      </p>
      <p className="text-[11px] md:text-xs text-neutral-500 mt-0.5 leading-tight">{label}</p>
    </div>
  );
}

function TrustStat({ value, label, highlight = false }: { value: string; label: string; highlight?: boolean }) {
  return (
    <div className="text-center">
      <p className={`text-2xl md:text-3xl font-bold tabular-nums tracking-tight ${highlight ? "text-green-600" : "text-neutral-950"}`}>
        {value}
      </p>
      <p className="text-[11px] md:text-xs text-neutral-500 mt-0.5 leading-tight">{label}</p>
    </div>
  );
}

// =============================================================================
// TRANSFORMATION — Asymmetric, bolder contrast
// =============================================================================
function Transformation() {
  return (
    <section id="como-funciona" className="py-14 md:py-24 bg-jd-surface relative scroll-mt-20">
      <div className="relative max-w-2xl mx-auto px-6 sm:px-8">
        {/* Header centralizado — padrao Hero */}
        <Reveal direction="up" className="mb-12 md:mb-16 text-center">
          <p className="text-[11px] font-medium text-jd-accent uppercase tracking-[0.28em] mb-4">
            O mesmo orçamento. Dois resultados.
          </p>
          <h2 className="font-display text-jd-ink text-[28px] md:text-[40px] leading-[1.1] tracking-[-0.015em] font-medium">
            Um perdeu o cliente. <em className="italic text-jd-accent font-normal">O outro fechou em 2 horas.</em>
          </h2>
          <p className="mt-5 text-[15px] md:text-base text-jd-muted leading-relaxed max-w-md mx-auto">
            A Rafaela pediu orçamento pro jardim dela. Recebeu duas respostas. Veja qual ela aprovou.
          </p>
        </Reveal>

        {/* Comparison — empilhado pra respirar. Cards centralizados. */}
        <div className="space-y-10 md:space-y-14">
          {/* BEFORE — WhatsApp caótico */}
          <motion.div
            className="relative flex flex-col"
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-jd-muted">Paisagista 1</span>
              <span className="flex-1 h-px bg-jd-border" />
              <span className="text-[10px] font-medium text-jd-muted italic">perdeu</span>
            </div>
            {/* Card WhatsApp — estilo print de celular (iOS) */}
            <div className="relative bg-[#e5ddd5] rounded-xl overflow-hidden border border-jd-border flex-1 flex flex-col">
              {/* Status bar iOS simulada */}
              <div className="bg-[#075e54] px-4 pt-1.5 pb-0 flex items-center justify-between text-[10px] font-semibold text-white">
                <span>9:41</span>
                <div className="flex items-center gap-1">
                  {/* Sinal */}
                  <svg viewBox="0 0 18 12" className="w-3 h-2" fill="currentColor"><rect x="0" y="8" width="3" height="4" rx="0.5"/><rect x="5" y="5" width="3" height="7" rx="0.5"/><rect x="10" y="2" width="3" height="10" rx="0.5"/><rect x="15" y="0" width="3" height="12" rx="0.5"/></svg>
                  {/* Wifi */}
                  <svg viewBox="0 0 16 12" className="w-3 h-2.5" fill="currentColor"><path d="M8 11.5a1 1 0 100-2 1 1 0 000 2zm-3-2.8l1.4 1.4a2.3 2.3 0 013.2 0l1.4-1.4a4.3 4.3 0 00-6 0zm-2.1-2.1l1.4 1.4a5.3 5.3 0 017.4 0l1.4-1.4a7.3 7.3 0 00-10.2 0zM0 4.6l1.4 1.4a9.3 9.3 0 0113.2 0L16 4.6a11.3 11.3 0 00-16 0z"/></svg>
                  {/* Bateria */}
                  <div className="flex items-center ml-0.5">
                    <div className="w-4 h-2 border border-white rounded-sm relative">
                      <div className="absolute inset-0.5 bg-white rounded-[1px]" style={{ width: "75%" }} />
                    </div>
                    <div className="w-[1px] h-1 bg-white ml-[1px] rounded-r-sm" />
                  </div>
                </div>
              </div>

              {/* Header WhatsApp — com setinha voltar, avatar, nome, icones */}
              <div className="bg-[#075e54] text-white px-3 py-2.5 flex items-center gap-2">
                {/* Voltar */}
                <svg viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                {/* Avatar */}
                <div className="w-8 h-8 rounded-full bg-white/25 border border-white/40 flex items-center justify-center text-white text-[10px] font-semibold tracking-wider flex-shrink-0">RS</div>
                {/* Nome + status */}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium leading-tight text-white truncate">Rafaela Santos</p>
                  <p className="text-[10px] text-white/80 leading-tight">visto há 3 dias</p>
                </div>
                {/* Icones video/call/menu */}
                <div className="flex items-center gap-3 text-white flex-shrink-0">
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><path d="M17 10.5V7a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h12a1 1 0 001-1v-3.5l4 4v-11l-4 4z"/></svg>
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><path d="M6.62 10.79a15 15 0 006.59 6.59l2.2-2.2a.94.94 0 011-.24 10.8 10.8 0 003.38.54.94.94 0 01.94.94v3.52c0 .52-.42.94-.94.94A16.47 16.47 0 013 4.94c0-.52.42-.94.94-.94h3.54c.52 0 .94.42.94.94a10.8 10.8 0 00.54 3.38.94.94 0 01-.24 1l-2.2 2.2z"/></svg>
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
                </div>
              </div>

              {/* Área de mensagens com wallpaper */}
              <div
                className="p-3 space-y-1.5 flex-1"
                style={{
                  backgroundImage: "url('https://imagens.net.br/wp-content/uploads/2023/09/como-adicionar-fundos-divertidos-e-personalizados-aos-seus-chats-do-whatsapp-6.jpg')",
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  backgroundRepeat: "no-repeat",
                }}
              >
                {[
                  { from: "client" as const, text: "oi boa tarde, quanto fica pro meu jardim?", time: "14:32" },
                  { from: "me" as const, text: "1500 com grama e umas plantinhas", time: "14:45" },
                  { from: "client" as const, text: "que tipo de planta?", time: "14:46" },
                  { from: "me" as const, text: "vou ver e te mando", time: "15:58" },
                  { from: "client" as const, text: "ah tá vou pensar", time: "16:02" },
                ].map((b, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 6 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.3 }}
                    transition={{ duration: 0.3, delay: 0.4 + i * 0.18, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <Bubble from={b.from} text={b.text} time={b.time} />
                  </motion.div>
                ))}
              </div>

              {/* Input bar tipo WhatsApp */}
              <div className="bg-[#f0f0f0] px-2 py-1.5 flex items-center gap-1.5 border-t border-black/5">
                <div className="flex-1 bg-white rounded-full px-3 py-1.5 flex items-center gap-2">
                  <svg viewBox="0 0 24 24" className="w-3 h-3 text-neutral-500" fill="currentColor"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2"/><circle cx="9" cy="10" r="1"/><circle cx="15" cy="10" r="1"/><path d="M8 14c1 1.5 2.5 2 4 2s3-.5 4-2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                  <span className="text-[11px] text-neutral-400 flex-1">Mensagem</span>
                </div>
                <div className="w-8 h-8 rounded-full bg-[#075e54] flex items-center justify-center flex-shrink-0">
                  <svg viewBox="0 0 24 24" className="w-3 h-3 text-white" fill="currentColor"><path d="M12 14a3 3 0 003-3V5a3 3 0 00-6 0v6a3 3 0 003 3zm5-3a5 5 0 01-10 0H5a7 7 0 006 6.9V21h2v-3.1A7 7 0 0019 11h-2z"/></svg>
                </div>
              </div>

              {/* Legenda editorial — fora do celular */}
            </div>
            {/* Legenda apos o celular */}
            <p className="text-[11px] text-jd-muted leading-relaxed italic font-display mt-3 text-center">
              "Ela não respondeu mais."
            </p>
          </motion.div>

          {/* AFTER — Documento profissional */}
          <motion.div
            className="relative flex flex-col"
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-jd-accent">Paisagista 2</span>
              <span className="flex-1 h-px bg-jd-accent/30" />
              <span className="text-[10px] font-medium text-jd-accent italic">fechou</span>
            </div>
            {/* Documento — mesmo estilo editorial do ClienteVe */}
            <div className="relative bg-white rounded-xl overflow-hidden border border-jd-border shadow-jd-lift flex-1 flex flex-col">
              {/* Top accent bar */}
              <div className="h-1 bg-jd-accent" />

              {/* Cabeçalho */}
              <div className="px-5 pt-5 pb-4">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src="https://s3-sa-east-1.amazonaws.com/projetos-artes/fullsize%2F2013%2F09%2F11%2F15%2FLogo-LV-60794_14403_035513304_1089769313.jpg"
                      alt="Carlos Paisagismo"
                      className="w-10 h-10 rounded-md object-cover flex-shrink-0 border border-jd-border"
                      loading="lazy"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-jd-ink leading-tight truncate">Carlos Paisagismo</p>
                      <p className="text-[10px] text-jd-muted leading-tight mt-0.5">CNPJ 45.892.103/0001-20</p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[9px] uppercase tracking-wider text-jd-muted font-medium">Proposta</p>
                    <p className="text-sm font-medium text-jd-ink tabular-nums">#0042</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 py-3 border-y border-jd-border">
                  <div>
                    <p className="text-[9px] uppercase tracking-wider text-jd-muted font-medium mb-0.5">Cliente</p>
                    <p className="text-xs font-medium text-jd-ink leading-tight">Rafaela Santos</p>
                    <p className="text-[10px] text-jd-muted mt-0.5">(11) 98444-2210</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] uppercase tracking-wider text-jd-muted font-medium mb-0.5">Emitida</p>
                    <p className="text-xs font-medium text-jd-ink">12 abr 2026</p>
                    <p className="text-[10px] text-jd-muted mt-0.5">Válida até 19 abr</p>
                  </div>
                </div>
              </div>

              {/* Itens */}
              <div className="px-5 pb-4 flex-1">
                <p className="text-[9px] uppercase tracking-wider text-jd-muted font-medium mb-2.5">Itens</p>
                <div className="space-y-3">
                  {[
                    { name: "Implantação de Jardim", sci: "Preparo do solo, plantio e irrigação", qty: "Serviço completo", price: "R$ 1.800", img: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT3iNHoyoeD66R1MnfS6i5svtoXgsyfEPfmpA&s" },
                    { name: "Grama Esmeralda", sci: "Zoysia japonica", qty: "50 m² · incluso plantio", price: "R$ 750", img: "https://jardimpark.com.br/wp-content/uploads/2019/10/grama-esmeralda.jpg" },
                    { name: "Guaimbé", sci: "Philodendron bipinnatifidum", qty: "4 mudas adultas · 1,2 m", price: "R$ 320", img: "https://www.picturethisai.com/image-handle/website_cmsname/image/1080/153432187658567683.jpeg?x-oss-process=image/format,jpg/resize,s_300&v=1.0" },
                  ].map((it, i) => (
                    <div key={i} className="flex items-start gap-3 pb-3 border-b border-jd-border last:border-0 last:pb-0">
                      <img
                        src={it.img}
                        alt={it.name}
                        loading="lazy"
                        className="w-11 h-11 rounded-md object-cover flex-shrink-0 border border-jd-border bg-jd-bg"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-jd-ink leading-tight">{it.name}</p>
                        <p className="text-[10px] italic text-jd-muted mt-0.5 leading-tight font-display">{it.sci}</p>
                        <p className="text-[10px] text-jd-muted mt-0.5 leading-tight">{it.qty}</p>
                      </div>
                      <p className="text-xs font-medium tabular-nums text-jd-ink flex-shrink-0 pt-0.5">{it.price}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total */}
              <div className="px-5 py-4 bg-jd-bg border-t-2 border-jd-ink flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-jd-muted font-medium">Valor total</p>
                  <p className="text-[9px] text-jd-muted mt-0.5">50% entrada · 50% entrega</p>
                </div>
                <p className="font-display text-2xl font-medium tabular-nums text-jd-ink">R$ 2.870</p>
              </div>

              {/* Rodapé — reação calma */}
              <div className="px-5 py-3 border-t border-jd-border">
                <div className="flex items-center justify-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-jd-accent" />
                  <p className="text-[11px] text-jd-accent leading-relaxed italic font-display">
                    "Pode fechar" — 2 horas depois.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Bottom — reflexao editorial centralizada */}
        <Reveal direction="up" delay={0.3} className="mt-12 md:mt-16 text-center">
          <p className="font-display text-lg md:text-xl text-jd-ink leading-[1.45] italic font-normal max-w-md mx-auto">
            Mesmo preço. Mesmo serviço. <span className="not-italic font-medium">O que mudou foi só como chegou.</span>
          </p>
        </Reveal>
      </div>
    </section>
  );
}

function Bubble({ from, text, time }: { from: "me" | "client"; text: string; time: string }) {
  return (
    <div className={`flex ${from === "me" ? "justify-end" : ""}`}>
      <div className={`${from === "me" ? "bg-[#dcf8c6]" : "bg-white"} rounded-lg ${from === "me" ? "rounded-tr-none" : "rounded-tl-none"} px-2.5 py-1.5 shadow-sm max-w-[85%]`}>
        <p className="text-[11px] text-neutral-800 whitespace-pre-line leading-snug">{text}</p>
        <p className="text-[9px] text-neutral-400 text-right mt-0.5">{time}</p>
      </div>
    </div>
  );
}

// =============================================================================
// FOR WHO — Qualification filter (pra quem é / pra quem não é)
// =============================================================================
function ForWho() {
  const fits = [
    { bold: "Você é prestador de serviço", rest: "— eletricista, encanador, pintor, diarista, jardineiro, fotógrafo, personal, marceneiro, qualquer ramo" },
    { bold: "Você manda orçamento pelo WhatsApp", rest: "e perde cliente porque chega mal apresentado" },
    { bold: "Você cobra o preço justo", rest: "mas parece caro porque o cliente não entende o que tá comprando" },
    { bold: "Você monta orçamento à mão em cada cliente", rest: "e perde tempo digitando item por item" },
    { bold: "Você quer um painel", rest: "pra saber o que mandou, pra quem, quanto e quando — e receber via Pix" },
  ];
  const notFits = [
    { bold: "Você fecha a maioria dos orçamentos", rest: "que manda hoje no WhatsApp" },
    { bold: "Você vende só no balcão", rest: "e não manda proposta pra cliente fora" },
    { bold: "Você só revende produto pronto", rest: "sem prestar nenhum tipo de serviço" },
    { bold: "Você não quer mudar nada", rest: "em como já trabalha hoje" },
  ];

  return (
    <section className="py-14 md:py-24 bg-gradient-to-b from-white via-neutral-50/50 to-white">
      <div className="max-w-4xl mx-auto px-5 sm:px-6">
        {/* Header — editorial, assimétrico */}
        <Reveal direction="up" className="max-w-3xl mb-12 md:mb-16">
          <p className="text-[11px] font-semibold text-green-600 uppercase tracking-[0.25em] mb-4">
            Leia antes de assinar
          </p>
          <h2 className="font-semibold tracking-[-0.035em] leading-[0.95] text-4xl md:text-5xl text-neutral-950">
            Não é pra todo mundo.
            <br />
            <span className="text-neutral-400">Mas pode ser pra você.</span>
          </h2>
        </Reveal>

        <div className="grid md:grid-cols-[1.3fr,1fr] gap-4 md:gap-5">
          {/* Fits — card dominante */}
          <motion.div
            className="relative bg-white rounded-2xl overflow-hidden border border-green-400/30 shadow-[0_12px_40px_-16px_rgba(34,197,94,0.12)]"
            initial={{ opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Accent top bar */}
            <div className="h-1 bg-green-500" />
            <div className="p-5 md:p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
                  <Check size={18} strokeWidth={3} className="text-white" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-green-700 uppercase tracking-[0.2em]">Faz sentido se</p>
                  <p className="text-sm text-neutral-500">Você se reconhece em pelo menos 2 abaixo</p>
                </div>
              </div>
              <ul className="space-y-4">
                {fits.map((f, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 pb-4 border-b border-neutral-100 last:border-0 last:pb-0"
                  >
                    <span className="flex-shrink-0 w-6 h-6 rounded-md bg-accent/10 flex items-center justify-center mt-0.5">
                      <Check size={12} strokeWidth={3} className="text-green-700" />
                    </span>
                    <p className="text-[15px] text-neutral-800 leading-relaxed">
                      <strong className="text-neutral-950 font-semibold">{f.bold}</strong>
                      {f.rest && <span className="text-neutral-600"> — {f.rest}</span>}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>

          {/* Not fits — satélite menor, sóbrio */}
          <motion.div
            className="relative bg-neutral-50/60 border border-neutral-200/40 rounded-xl p-5 md:p-6"
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-neutral-300 flex items-center justify-center">
                <X size={18} strokeWidth={3} className="text-neutral-600" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-[0.2em]">Não serve se</p>
                <p className="text-sm text-neutral-500">Seja honesto</p>
              </div>
            </div>
            <ul className="space-y-3.5">
              {notFits.map((f, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="flex-shrink-0 w-5 h-5 rounded-md bg-neutral-200 flex items-center justify-center mt-0.5">
                    <X size={10} strokeWidth={3} className="text-neutral-500" />
                  </span>
                  <p className="text-sm text-neutral-500 leading-relaxed">
                    <strong className="text-neutral-700 font-semibold">{f.bold}</strong>
                    {f.rest && <span> {f.rest}</span>}
                  </p>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// =============================================================================
// PLAN — Vertical timeline with connecting line
// =============================================================================
function Plan() {
  const steps = [
    {
      n: "01",
      time: "1 minuto",
      title: "Assine e entra direto",
      desc: "Pix na hora ou cartão. Sem fila, sem cadastro de 10 páginas. Você entra e já começa.",
    },
    {
      n: "02",
      time: "3 minutos",
      title: "Monta a proposta",
      desc: "Nome do cliente, plantas do catálogo com 800+ espécies, quantidade, preço. Manda o link ou o PDF pelo WhatsApp — você escolhe.",
    },
    {
      n: "03",
      time: "Horas depois",
      title: "Cliente aprova",
      desc: "Chega notificação no seu celular. Cliente clicou em 'Aprovar'. Você fecha o serviço, cobra o preço justo.",
    },
  ];

  return (
    <section className="py-14 md:py-24 bg-jd-bg relative">
      <div className="max-w-2xl mx-auto px-6 sm:px-8">
        {/* Header centralizado — padrao */}
        <Reveal direction="up" className="mb-12 md:mb-16 text-center">
          <p className="text-[11px] font-medium text-jd-accent uppercase tracking-[0.28em] mb-4">
            Em 3 passos
          </p>
          <h2 className="font-display text-jd-ink text-[28px] md:text-[40px] leading-[1.1] tracking-[-0.015em] font-medium">
            Escolhe as plantas, manda o link, <em className="italic text-jd-accent font-normal">cliente aprova.</em>
          </h2>
        </Reveal>

        {/* Passos — stack vertical centralizado */}
        <div className="space-y-10 md:space-y-14">
          {steps.map((s, i) => (
            <motion.div
              key={s.n}
              className="text-center"
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.5, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="font-display text-[56px] md:text-[80px] leading-none text-jd-accent/25 tabular-nums font-medium mb-3">
                {s.n}
              </div>
              <p className="text-[11px] font-medium text-jd-muted uppercase tracking-[0.22em] mb-2">
                {s.time}
              </p>
              <h3 className="font-display text-xl md:text-2xl text-jd-ink leading-tight tracking-[-0.01em] font-medium mb-3">
                {s.title}
              </h3>
              <p className="text-[15px] md:text-base text-jd-muted leading-relaxed max-w-md mx-auto">
                {s.desc}
              </p>
            </motion.div>
          ))}
        </div>

        {/* CTA centralizado */}
        <div className="mt-12 md:mt-16 text-center">
          <Link
            to={CTA_URL}
            className="inline-flex items-center gap-2 text-jd-accent hover:text-jd-ink transition-colors text-sm font-medium group"
          >
            <span className="border-b border-jd-accent/40 group-hover:border-jd-ink pb-0.5">
              Começar pelo passo 01
            </span>
            <ArrowRight size={14} strokeWidth={1.5} className="transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </div>
    </section>
  );
}

// =============================================================================
// CLIENTE VE v3 — Mostra o documento de orcamento bonito (sem tabs, so a proposta)
// =============================================================================
function ClienteVe() {
  return (
    <section className="py-14 md:py-24 bg-jd-surface">
      <div className="max-w-2xl mx-auto px-6 sm:px-8">
        <Reveal direction="up" className="mb-12 md:mb-16 text-center">
          <p className="text-[11px] font-medium text-jd-accent uppercase tracking-[0.28em] mb-4">
            É isso que o cliente vê
          </p>
          <h2 className="font-display text-jd-ink text-[28px] md:text-[40px] leading-[1.1] tracking-[-0.015em] font-medium">
            Abre no celular. Vê tudo organizado. <em className="italic text-jd-accent font-normal">Aprova com 1 clique.</em>
          </h2>
          <p className="mt-5 text-[15px] md:text-base text-jd-muted leading-relaxed max-w-md mx-auto">
            Sem app, sem cadastro, sem fricção. Seu cliente recebe o link no WhatsApp e fecha o serviço direto do celular.
          </p>
        </Reveal>

        {/* Documento / Proposta — mockup */}
        <Reveal direction="scale" delay={0.1} className="max-w-md mx-auto">
          <div className="bg-white rounded-xl overflow-hidden border border-jd-border shadow-jd-lift">
            {/* Top accent bar */}
            <div className="h-1 bg-jd-accent" />

            {/* Cabeçalho */}
            <div className="px-5 pt-5 pb-4">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-2.5 min-w-0">
                  <img
                    src="https://s3-sa-east-1.amazonaws.com/projetos-artes/fullsize%2F2013%2F09%2F11%2F15%2FLogo-LV-60794_14403_035513304_1089769313.jpg"
                    alt="Carlos Paisagismo"
                    className="w-10 h-10 rounded-md object-cover flex-shrink-0 border border-jd-border"
                    loading="lazy"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-jd-ink leading-tight truncate">Carlos Paisagismo</p>
                    <p className="text-[10px] text-jd-muted leading-tight mt-0.5">CNPJ 45.892.103/0001-20</p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[9px] uppercase tracking-wider text-jd-muted font-medium">Proposta</p>
                  <p className="text-sm font-medium text-jd-ink tabular-nums">#0042</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 py-3 border-y border-jd-border">
                <div>
                  <p className="text-[9px] uppercase tracking-wider text-jd-muted font-medium mb-0.5">Cliente</p>
                  <p className="text-xs font-medium text-jd-ink leading-tight">Rafaela Santos</p>
                  <p className="text-[10px] text-jd-muted mt-0.5">(11) 98444-2210</p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] uppercase tracking-wider text-jd-muted font-medium mb-0.5">Emitida</p>
                  <p className="text-xs font-medium text-jd-ink">12 abr 2026</p>
                  <p className="text-[10px] text-jd-muted mt-0.5">Válida até 19 abr</p>
                </div>
              </div>
            </div>

            {/* Itens */}
            <div className="px-5 pb-4">
              <p className="text-[9px] uppercase tracking-wider text-jd-muted font-medium mb-2.5">Itens</p>
              <div className="space-y-3">
                {[
                  { name: "Implantação de Jardim", sci: "Preparo do solo, plantio e irrigação", qty: "Serviço completo", price: "R$ 1.800" },
                  { name: "Grama Esmeralda", sci: "Zoysia japonica", qty: "50 m² · incluso plantio", price: "R$ 750" },
                  { name: "Guaimbé", sci: "Philodendron bipinnatifidum", qty: "4 mudas adultas · 1,2 m", price: "R$ 320" },
                ].map((it, i) => (
                  <div key={i} className="flex items-start justify-between gap-3 pb-3 border-b border-jd-border last:border-0 last:pb-0">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-jd-ink leading-tight">{it.name}</p>
                      <p className="text-[10px] italic text-jd-muted mt-0.5 leading-tight font-display">{it.sci}</p>
                      <p className="text-[10px] text-jd-muted mt-0.5 leading-tight">{it.qty}</p>
                    </div>
                    <p className="text-xs font-medium tabular-nums text-jd-ink flex-shrink-0 pt-0.5">{it.price}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Total */}
            <div className="px-5 py-4 bg-jd-bg border-t-2 border-jd-ink flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-jd-muted font-medium">Valor total</p>
                <p className="text-[9px] text-jd-muted mt-0.5">50% entrada · 50% entrega</p>
              </div>
              <p className="font-display text-2xl font-medium tabular-nums text-jd-ink">R$ 2.870</p>
            </div>

            {/* Rodapé */}
            <div className="px-5 py-3 border-t border-jd-border">
              <div className="flex items-center justify-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-jd-accent" />
                <p className="text-[10px] text-jd-muted">
                  Dúvidas? Chame Carlos no WhatsApp <span className="font-medium text-jd-ink">(11) 98765-4321</span>
                </p>
              </div>
            </div>
          </div>

          <p className="text-center text-xs text-jd-muted mt-6 italic font-display">
            O link abre assim no celular do cliente.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

// =============================================================================
// PRODUCT PREVIEW — mockups estilizados do app (dashboard, editor, proposta)
// =============================================================================
function ProductPreview() {
  const [tab, setTab] = useState<"dashboard" | "editor" | "proposta">("dashboard");

  return (
    <section className="py-14 md:py-24 bg-gradient-to-b from-white via-neutral-50/50 to-white relative overflow-hidden">
      <div className="relative max-w-4xl mx-auto px-5 sm:px-6">
        <Reveal direction="up" className="max-w-2xl mx-auto text-center mb-10 md:mb-12">
          <p className="text-[11px] font-semibold text-green-600 uppercase tracking-[0.2em] mb-3">
            Como é por dentro
          </p>
          <h2 className="font-semibold tracking-[-0.035em] leading-[1.1] text-3xl md:text-5xl text-neutral-950">
            Bonito. Simples. <span className="text-green-600">Seu cliente vê.</span>
          </h2>
          <p className="mt-4 text-sm md:text-base text-neutral-600">
            3 telas. Sem curso, sem tutorial. Clica e usa.
          </p>
        </Reveal>

        {/* Tabs com sliding indicator */}
        <div className="flex justify-center mb-6 md:mb-8">
          <div className="inline-flex items-center gap-1 bg-white border border-neutral-200 rounded-full p-1 shadow-sm max-w-full overflow-x-auto">
            {[
              { id: "dashboard" as const, label: "Painel" },
              { id: "editor" as const, label: "Editor" },
              { id: "proposta" as const, label: "Cliente vê" },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`relative px-3.5 md:px-4 py-1.5 text-xs md:text-sm font-semibold rounded-full transition-colors whitespace-nowrap ${
                  tab === t.id ? "text-white" : "text-neutral-600 hover:text-neutral-900"
                }`}
              >
                {tab === t.id && (
                  <motion.span
                    layoutId="tabPill"
                    className="absolute inset-0 bg-neutral-900 rounded-full"
                    transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
                  />
                )}
                <span className="relative z-10">{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Mockup */}
        <Reveal direction="scale" delay={0.1} className="relative max-w-4xl mx-auto">
          <div className="relative bg-white border border-neutral-200/60 rounded-2xl shadow-[0_12px_40px_-16px_rgba(0,0,0,0.08)] overflow-hidden">
            {/* Browser chrome */}
            <div className="bg-neutral-100 border-b border-neutral-200 px-4 py-2.5 flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
              </div>
              <div className="flex-1 flex justify-center">
                <div className="bg-white border border-neutral-200 rounded-md px-3 py-1 text-[10px] text-neutral-500 font-mono">
                  app.fechaaqui.com/{tab}
                </div>
              </div>
            </div>

            {/* Cross-fade entre tabs */}
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            >
              {tab === "dashboard" && <MockDashboard />}
              {tab === "editor" && <MockEditor />}
              {tab === "proposta" && <MockProposta />}
            </motion.div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function MockDashboard() {
  return (
    <div className="grid md:grid-cols-[200px,1fr] bg-white">
      {/* Sidebar */}
      <aside className="hidden md:block border-r border-neutral-200 bg-neutral-50 p-4">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center">
            <Package size={16} className="text-white" />
          </div>
          <span className="font-bold text-sm text-neutral-900">FechaAqui</span>
        </div>
        <nav className="space-y-1 text-sm">
          {[
            { label: "Painel", active: true },
            { label: "Propostas" },
            { label: "Clientes" },
            { label: "Catálogo" },
            { label: "Agenda" },
            { label: "Configurações" },
          ].map((item) => (
            <div
              key={item.label}
              className={`px-3 py-2 rounded-lg ${
                item.active
                  ? "bg-green-500 text-white font-semibold"
                  : "text-neutral-600"
              }`}
            >
              {item.label}
            </div>
          ))}
        </nav>
      </aside>

      {/* Content */}
      <div className="p-5 md:p-7">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-xs text-neutral-500">Bem-vindo, Carlos 👋</p>
            <h3 className="text-xl md:text-2xl font-bold text-neutral-950">Seu mês em números</h3>
          </div>
          <div className="flex items-center gap-2">
            <Bell size={16} className="text-neutral-400" />
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center text-white text-xs font-bold">CO</div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Propostas enviadas", value: "18", trend: "+4" },
            { label: "Taxa de fechamento", value: "45%", trend: "+12%", highlight: true },
            { label: "Faturamento", value: "R$ 11.4k", trend: "+R$3k" },
            { label: "A aprovar", value: "3", trend: "hoje" },
          ].map((s) => (
            <div key={s.label} className={`rounded-xl p-3.5 ${s.highlight ? "bg-green-500 text-white" : "bg-neutral-50 border border-neutral-100"}`}>
              <p className={`text-[10px] uppercase tracking-wider font-semibold ${s.highlight ? "text-green-100" : "text-neutral-500"}`}>
                {s.label}
              </p>
              <p className={`text-xl md:text-2xl font-bold mt-1 tabular-nums ${s.highlight ? "text-white" : "text-neutral-950"}`}>
                {s.value}
              </p>
              <p className={`text-[10px] mt-0.5 ${s.highlight ? "text-green-100" : "text-green-600 font-semibold"}`}>
                {s.trend}
              </p>
            </div>
          ))}
        </div>

        <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-neutral-100 flex items-center justify-between">
            <p className="text-sm font-semibold text-neutral-900">Últimas propostas</p>
            <span className="text-[10px] text-neutral-500">hoje</span>
          </div>
          <div className="divide-y divide-neutral-100">
            {[
              { cliente: "Rafaela Santos", valor: "R$ 2.870", status: "Aprovada", statusColor: "bg-accent/10 text-green-700" },
              { cliente: "Marcos Silva", valor: "R$ 4.200", status: "Enviada", statusColor: "bg-neutral-100 text-neutral-600" },
              { cliente: "Cond. Jardim Sul", valor: "R$ 12.5k", status: "Aprovada", statusColor: "bg-accent/10 text-green-700" },
            ].map((p, i) => (
              <div key={i} className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-neutral-100 flex items-center justify-center">
                    <FileText size={14} className="text-neutral-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-neutral-900">{p.cliente}</p>
                    <p className="text-[11px] text-neutral-500 tabular-nums">{p.valor}</p>
                  </div>
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${p.statusColor}`}>
                  {p.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MockEditor() {
  return (
    <div className="grid md:grid-cols-[240px,1fr] bg-white">
      {/* Catalog */}
      <aside className="border-r border-neutral-200 bg-neutral-50 p-4 hidden md:block">
        <div className="flex items-center gap-2 mb-3 px-2 py-1.5 bg-white rounded-lg border border-neutral-200">
          <Search size={14} className="text-neutral-400" />
          <span className="text-xs text-neutral-400">buscar planta...</span>
        </div>
        <p className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold mb-2 mt-4 px-1">Catálogo</p>
        {[
          { name: "Mão de obra (hora)", price: "R$ 90/h", emoji: "🧰" },
          { name: "Visita técnica", price: "R$ 150", emoji: "📍" },
          { name: "Material", price: "R$ 320", emoji: "📦" },
          { name: "Deslocamento", price: "R$ 50", emoji: "🚐" },
          { name: "Hora extra", price: "R$ 120/h", emoji: "⏱️" },
        ].map((p, i) => (
          <div
            key={i}
            className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-white cursor-grab transition-colors group"
          >
            <div className="w-8 h-8 rounded-md bg-gradient-to-br from-green-100 to-green-50 flex items-center justify-center text-base">
              {p.emoji}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-neutral-900 truncate">{p.name}</p>
              <p className="text-[10px] text-neutral-500 tabular-nums">{p.price}</p>
            </div>
          </div>
        ))}
        <p className="text-[10px] text-neutral-400 text-center mt-3">800+ itens</p>
      </aside>

      {/* Editor canvas */}
      <div className="p-5 md:p-7 bg-neutral-50">
        <div className="bg-white rounded-xl border border-neutral-200 p-5 md:p-6">
          <div className="flex items-center justify-between mb-5 pb-4 border-b border-neutral-100">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold">Proposta #0042</p>
              <input
                type="text"
                defaultValue="Jardim da Rafaela Santos"
                className="text-lg md:text-xl font-bold text-neutral-950 outline-none bg-transparent w-full"
                readOnly
              />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-neutral-100 text-neutral-600">
              Rascunho
            </span>
          </div>

          <div className="space-y-2">
            {[
              { name: "Implantação de Jardim", qty: "1", price: "R$ 1.800" },
              { name: "Grama Esmeralda", qty: "50 m²", price: "R$ 750" },
              { name: "Guaimbé", qty: "4 un", price: "R$ 320" },
            ].map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-3 bg-neutral-50 rounded-lg px-3 py-2.5 hover:bg-accent/10 transition-colors group"
              >
                <div className="w-8 h-8 rounded-md bg-gradient-to-br from-green-100 to-green-50 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-neutral-900 truncate">{item.name}</p>
                  <p className="text-[10px] text-neutral-500">{item.qty}</p>
                </div>
                <p className="text-sm font-bold tabular-nums text-neutral-900">{item.price}</p>
              </div>
            ))}

            <div className="flex items-center justify-center gap-2 py-3 border-2 border-dashed border-neutral-200 rounded-lg text-xs text-neutral-400 font-medium">
              <Sparkles size={12} /> arraste plantas aqui ou clique pra adicionar
            </div>
          </div>

          <div className="mt-5 pt-5 border-t border-neutral-100 flex items-center justify-between">
            <span className="text-sm text-neutral-600 font-medium">Total</span>
            <span className="text-2xl md:text-3xl font-bold text-neutral-950 tabular-nums">R$ 2.870</span>
          </div>

          <button className="mt-5 w-full py-3 rounded-full bg-green-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-sm">
            Enviar proposta por link
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

function MockProposta() {
  return (
    <div className="bg-neutral-100/60 p-5 md:p-8">
      {/* Documento com aparência de papel */}
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-[0_4px_16px_-6px_rgba(0,0,0,0.08)] overflow-hidden border border-neutral-200">
        {/* Top accent bar */}
        <div className="h-1 bg-green-600" />

        {/* Cabeçalho do documento */}
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-start justify-between gap-3 mb-4">
            {/* Logo + empresa */}
            <div className="flex items-center gap-2.5 min-w-0">
              <img
                src="https://s3-sa-east-1.amazonaws.com/projetos-artes/fullsize%2F2013%2F09%2F11%2F15%2FLogo-LV-60794_14403_035513304_1089769313.jpg"
                alt="Carlos Paisagismo"
                className="w-10 h-10 rounded-md object-cover flex-shrink-0 border border-neutral-200"
                loading="lazy"
              />
              <div className="min-w-0">
                <p className="text-sm font-bold text-neutral-900 leading-tight truncate">Carlos Paisagismo</p>
                <p className="text-[10px] text-neutral-500 leading-tight mt-0.5">CNPJ 45.892.103/0001-20</p>
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-[9px] uppercase tracking-wider text-neutral-400 font-semibold">Proposta</p>
              <p className="text-sm font-bold text-neutral-900 tabular-nums">#0042</p>
            </div>
          </div>

          {/* Cliente + datas */}
          <div className="grid grid-cols-2 gap-3 py-3 border-y border-neutral-200">
            <div>
              <p className="text-[9px] uppercase tracking-wider text-neutral-400 font-semibold mb-0.5">Cliente</p>
              <p className="text-xs font-semibold text-neutral-900 leading-tight">Rafaela Santos</p>
              <p className="text-[10px] text-neutral-500 mt-0.5">(11) 98444-2210</p>
            </div>
            <div className="text-right">
              <p className="text-[9px] uppercase tracking-wider text-neutral-400 font-semibold mb-0.5">Emitida</p>
              <p className="text-xs font-semibold text-neutral-900">12 abr 2026</p>
              <p className="text-[10px] text-neutral-500 mt-0.5">Válida até 19 abr</p>
            </div>
          </div>
        </div>

        {/* Itens */}
        <div className="px-5 pb-4">
          <p className="text-[9px] uppercase tracking-wider text-neutral-400 font-semibold mb-2.5">Itens</p>
          <div className="space-y-3">
            {[
              { name: "Implantação de Jardim", sci: "Preparo do solo, plantio e irrigação", qty: "Serviço completo", price: "R$ 1.800" },
              { name: "Grama Esmeralda", sci: "Zoysia japonica", qty: "50 m² · incluso plantio", price: "R$ 750" },
              { name: "Guaimbé", sci: "Philodendron bipinnatifidum", qty: "4 mudas adultas · 1,2 m", price: "R$ 320" },
            ].map((it, i) => (
              <div key={i} className="flex items-start justify-between gap-3 pb-3 border-b border-neutral-100 last:border-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-neutral-900 leading-tight">{it.name}</p>
                  <p className="text-[10px] italic text-neutral-500 mt-0.5 leading-tight">{it.sci}</p>
                  <p className="text-[10px] text-neutral-500 mt-0.5 leading-tight">{it.qty}</p>
                </div>
                <p className="text-xs font-bold tabular-nums text-neutral-900 flex-shrink-0 pt-0.5">{it.price}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Total */}
        <div className="px-5 py-3.5 bg-neutral-50 border-t-2 border-neutral-900 flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold">Valor total</p>
            <p className="text-[9px] text-neutral-500 mt-0.5">Pagamento: 50% entrada · 50% entrega</p>
          </div>
          <p className="text-2xl font-bold tabular-nums text-neutral-900">R$ 2.870</p>
        </div>

        {/* Rodapé — ação real (WhatsApp) */}
        <div className="px-5 py-3 border-t border-neutral-200">
          <div className="flex items-center justify-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
            <p className="text-[10px] text-neutral-600">
              Dúvidas? Chame Carlos no WhatsApp <span className="font-semibold text-neutral-900">(11) 98765-4321</span>
            </p>
          </div>
        </div>
      </div>

      {/* Micro-label explicando o que é */}
      <p className="text-center text-[10px] text-neutral-400 mt-4">
        Assim o cliente recebe a proposta no WhatsApp — por link ou PDF
      </p>
    </div>
  );
}

// =============================================================================
// PROOF — Editorial, pull quotes, asymmetric
// =============================================================================
function Proof() {
  // So 2 testemunhos — mais humano, menos parede de texto
  const testimonials = [
    {
      quote: "Eu fechava 2 serviços por mês chorando. No primeiro mês de FechaAqui bati R$18 mil. O cliente responde diferente quando chega link bonito.",
      headline: "R$ 7k → R$ 18k/mês",
      name: "Carlos Oliveira",
      role: "Eletricista · São Paulo",
      initials: "CO",
    },
    {
      quote: "Era péssima com computador, mas é só arrastar e clicar. Recuperei R$14k em orçamentos que sumiam. Cobrei 20% mais caro e ninguém reclamou.",
      headline: "+R$ 14k em 60 dias",
      name: "Ana Ferreira",
      role: "Diarista · Curitiba",
      initials: "AF",
    },
  ];

  return (
    <section className="py-14 md:py-24 bg-jd-surface">
      <div className="max-w-2xl mx-auto px-6 sm:px-8">
        <Reveal direction="up" className="mb-12 md:mb-16 text-center">
          <p className="text-[11px] font-medium text-jd-accent uppercase tracking-[0.28em] mb-4">
            Gente como você
          </p>
          <h2 className="font-display text-jd-ink text-[28px] md:text-[40px] leading-[1.1] tracking-[-0.015em] font-medium">
            Quem usa FechaAqui <em className="italic text-jd-accent font-normal">fecha mais.</em>
          </h2>
        </Reveal>

        <div className="space-y-12 md:space-y-16">
          {testimonials.map((t, i) => (
            <motion.figure
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.6, delay: i * 0.15, ease: [0.22, 1, 0.36, 1] }}
              className="relative"
            >
              {/* Aspas serif decorativa */}
              <div
                className="font-display text-jd-accent/25 text-[120px] leading-none mb-[-40px] ml-[-6px] select-none pointer-events-none italic"
                aria-hidden="true"
              >
                &ldquo;
              </div>

              {/* Headline editorial do testemunho */}
              <p className="font-display text-jd-accent text-xl md:text-2xl italic leading-tight mb-4 tracking-tight font-medium">
                {t.headline}
              </p>

              {/* Citacao principal — serifada, editorial */}
              <blockquote className="font-display text-jd-ink text-lg md:text-xl leading-[1.55] mb-6 font-normal">
                {t.quote}
              </blockquote>

              {/* Assinatura */}
              <figcaption className="flex items-center gap-3 pt-5 border-t border-jd-border">
                <div className="w-11 h-11 rounded-full bg-jd-accent/10 text-jd-accent flex items-center justify-center font-display text-sm font-medium border border-jd-accent/20">
                  {t.initials}
                </div>
                <div>
                  <p className="text-sm font-medium text-jd-ink leading-tight">{t.name}</p>
                  <p className="text-xs text-jd-muted mt-0.5">{t.role}</p>
                </div>
              </figcaption>
            </motion.figure>
          ))}
        </div>
      </div>
    </section>
  );
}

// =============================================================================
// OFFER — Pricing bold, anual card premium
// =============================================================================
function Offer() {
  return (
    <section id="precos" className="py-14 md:py-24 bg-jd-bg">
      <div className="max-w-2xl mx-auto px-6 sm:px-8">
        <Reveal direction="up" className="mb-12 md:mb-16 text-center">
          <p className="text-[11px] font-medium text-jd-accent uppercase tracking-[0.28em] mb-4">
            O preço
          </p>
          <h2 className="font-display text-jd-ink text-[28px] md:text-[40px] leading-[1.1] tracking-[-0.015em] font-medium mb-4">
            Um serviço fechado paga <em className="italic text-jd-accent font-normal">o ano inteiro.</em>
          </h2>
          <p className="text-[15px] md:text-base text-jd-muted leading-relaxed max-w-md mx-auto">
            Sem fidelidade. 7 dias de garantia. Cancele quando quiser.
          </p>
        </Reveal>

        {/* Planos — layout editorial sem cards, separados por linha */}
        <div className="divide-y divide-jd-border border-y border-jd-border">
          {/* Mensal */}
          <motion.div
            className="grid md:grid-cols-[1fr_auto] gap-6 md:gap-10 py-10 md:py-14 items-start"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <div>
              <div className="flex items-baseline gap-4 mb-4">
                <p className="text-[11px] font-medium text-jd-muted uppercase tracking-[0.22em]">Mensal</p>
                <span className="text-xs text-jd-muted">sem fidelidade</span>
              </div>

              <div className="flex items-baseline gap-1.5 mb-6">
                <span className="text-sm text-jd-muted">R$</span>
                <span className="font-display text-5xl md:text-6xl tabular-nums tracking-[-0.02em] text-jd-ink font-medium">97</span>
                <span className="text-base text-jd-muted">/mês</span>
              </div>

              <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-2.5 text-[15px] text-jd-ink max-w-xl">
                {[
                  "Propostas ilimitadas",
                  "Link ou PDF no WhatsApp",
                  "800+ plantas no catálogo",
                  "Sua marca no orçamento",
                  "Notificação quando abrir",
                ].map((f, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Check size={13} className="text-jd-accent flex-shrink-0 mt-1.5" strokeWidth={2} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>

            <Link
              to="/checkout?plan=essential"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-medium bg-jd-ink hover:opacity-80 text-white transition-opacity whitespace-nowrap self-end"
            >
              Assinar Mensal
              <ArrowRight size={13} strokeWidth={2} />
            </Link>
          </motion.div>

          {/* Anual — destaque pela tipografia, nao por caixa */}
          <motion.div
            className="grid md:grid-cols-[1fr_auto] gap-6 md:gap-10 py-10 md:py-14 items-start"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          >
            <div>
              <div className="flex items-baseline gap-4 mb-4">
                <p className="text-[11px] font-medium text-jd-accent uppercase tracking-[0.22em]">Anual</p>
                <span className="text-xs text-jd-accent italic font-display">mais escolhido</span>
              </div>

              <div className="flex items-baseline gap-1.5 mb-1">
                <span className="text-sm text-jd-muted">R$</span>
                <span className="font-display text-[64px] md:text-[80px] tabular-nums tracking-[-0.025em] text-jd-accent font-medium leading-none">67</span>
                <span className="text-base text-jd-muted">/mês</span>
              </div>
              <p className="text-xs text-jd-muted mb-6 pl-6">
                R$ 804/ano · <span className="line-through">R$ 1.164</span> · economia de R$ 360
              </p>

              <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-2.5 text-[15px] text-jd-ink max-w-xl">
                {[
                  "Tudo do Mensal",
                  "12 meses de acesso",
                  "3 meses grátis",
                  "Suporte prioritário WhatsApp",
                  "1 serviço paga o ano",
                ].map((f, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Check size={13} className="text-jd-accent flex-shrink-0 mt-1.5" strokeWidth={2} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>

            <Link
              to="/checkout?plan=pro"
              className="group inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-medium bg-jd-accent hover:opacity-90 text-white transition-opacity whitespace-nowrap self-end"
            >
              Assinar Anual
              <ArrowRight size={13} strokeWidth={2} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
          </motion.div>
        </div>

        {/* Garantia — linha editorial, sem card */}
        <Reveal direction="up" delay={0.2} className="mt-10 md:mt-14 text-center">
          <p className="font-display text-lg md:text-xl text-jd-ink italic font-normal">
            <ShieldCheck size={18} className="inline text-jd-accent mr-2 mb-1" strokeWidth={1.5} />
            7 dias de garantia — se não servir, devolvemos no Pix.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

// =============================================================================
// FAQ — clean accordion, no shadcn
// =============================================================================
function FAQ() {
  const faqs = [
    {
      q: "Não manjo muito de computador. Vou conseguir?",
      a: "Se você usa WhatsApp, você usa FechaAqui. Só escolher os itens, colocar o valor e apertar enviar. Feito pra quem detesta tecnologia. E se travar, tem suporte no WhatsApp respondendo em minutos.",
    },
    {
      q: "Preciso ter CNPJ ou empresa formalizada?",
      a: "Não. FechaAqui atende MEI, autônomo, pessoa física, empresa registrada — qualquer um. Você coloca o nome ou razão social que quiser aparecer pro cliente.",
    },
    {
      q: "Combina com meu WhatsApp? Não quero parar de usar.",
      a: "Combina, é feito pra isso. Você monta o orçamento no FechaAqui e manda o link ou o PDF pelo WhatsApp. O cliente clica, vê tudo bonito e aprova. O zap continua sendo seu canal — só que agora seu orçamento chega profissional.",
    },
    {
      q: "Tem limite de orçamentos, faturas ou clientes?",
      a: "No plano pago, tudo ilimitado. Orçamentos, faturas, clientes, catálogo. Sem pegadinha de 'upgrade pra fazer mais um'.",
    },
    {
      q: "Como é a garantia de 7 dias?",
      a: "Você paga, entra direto no produto e usa sem limite. Se em 7 dias não gostar, manda mensagem e devolvemos 100% do valor no Pix em 24h. Zero pergunta, zero burocracia. Não é trial — é garantia de satisfação.",
    },
    {
      q: "Meu cliente precisa instalar algum app?",
      a: "Não. Você manda um link por WhatsApp e o cliente abre direto no celular. Ele vê tudo organizado e aprova com 1 clique. Sem cadastro, sem app, sem fricção.",
    },
    {
      q: "Posso importar meu catálogo de plantas?",
      a: "Você recebe 800+ plantas e serviços já prontos no sistema. Só escolher e arrastar. Quer adicionar seus próprios? Em 30 segundos você cadastra. Quer alterar preço de uma planta? Um clique.",
    },
    {
      q: "Posso cancelar quando quiser?",
      a: "Sim. Sem multa, sem fidelidade. Cancela direto pelas configurações e pronto.",
    },
  ];

  return (
    <section className="py-14 md:py-24 bg-jd-surface">
      <div className="max-w-2xl mx-auto px-6 sm:px-8">
        <Reveal direction="up" className="mb-12 md:mb-16 text-center">
          <p className="text-[11px] font-medium text-jd-accent uppercase tracking-[0.28em] mb-4">
            Ainda em dúvida?
          </p>
          <h2 className="font-display text-jd-ink text-[28px] md:text-[40px] leading-[1.1] tracking-[-0.015em] font-medium">
            As perguntas que <em className="italic text-jd-accent font-normal">todo mundo faz.</em>
          </h2>
        </Reveal>

        <div className="divide-y divide-jd-border border-y border-jd-border">
          {faqs.map((f, i) => (
            <FAQItem key={i} q={f.q} a={f.a} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        className="w-full py-5 md:py-6 flex items-start justify-between gap-4 text-left group"
        onClick={() => setOpen((o) => !o)}
      >
        <span className={`font-display text-base md:text-lg leading-snug transition-colors ${open ? "text-jd-accent" : "text-jd-ink group-hover:text-jd-accent"}`}>
          {q}
        </span>
        <motion.div
          animate={{ rotate: open ? 45 : 0 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="flex-shrink-0 text-jd-muted mt-1"
        >
          <span className="block text-xl leading-none font-light">+</span>
        </motion.div>
      </button>
      <motion.div
        initial={false}
        animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="overflow-hidden"
      >
        <p className="pb-6 pr-10 text-[15px] text-jd-muted leading-[1.7]">{a}</p>
      </motion.div>
    </div>
  );
}

// =============================================================================
// FINAL CTA — aggressive, dramatic
// =============================================================================
function FinalCTA() {
  return (
    <section className="py-16 md:py-28 bg-jd-bg relative">
      <div className="relative max-w-2xl mx-auto px-6 sm:px-8 text-center">
        <Reveal direction="up">
          <h2 className="font-display text-jd-ink text-[30px] md:text-[48px] leading-[1.08] tracking-[-0.02em] font-medium mb-5">
            Pare de perder cliente por causa do orçamento. <em className="italic text-jd-accent font-normal">Comece hoje.</em>
          </h2>
        </Reveal>

        <Reveal direction="up" delay={0.15}>
          <p className="text-jd-muted text-[15px] md:text-base mb-8 max-w-md mx-auto leading-relaxed">
            Assina, monta a primeira proposta em 3 minutos, manda pelo WhatsApp. Se não servir em 7 dias, devolvemos 100% no Pix.
          </p>
        </Reveal>

        <Reveal direction="up" delay={0.3}>
          <Link
            to={CTA_URL}
            className="inline-flex items-center gap-2.5 px-6 py-3.5 bg-jd-accent hover:opacity-90 text-white font-medium rounded-full transition-opacity text-[15px]"
          >
            Começar agora
            <ArrowRight size={15} strokeWidth={2} />
          </Link>
        </Reveal>

        <p className="text-xs text-jd-muted mt-5">
          R$97/mês · 7 dias de garantia · cancele quando quiser
        </p>
      </div>
    </section>
  );
}

// =============================================================================
// FOOTER
// =============================================================================
function Footer() {
  return (
    <footer className="py-10 md:py-12 bg-jd-bg border-t border-jd-border">
      <div className="max-w-2xl mx-auto px-6 sm:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-5">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="hidden md:inline text-xs text-jd-muted">·</span>
            <p className="text-xs text-jd-muted italic font-display text-center md:text-left">Orçamentos que fazem prestador de serviço parecer empresa grande</p>
          </div>
          <div className="flex items-center gap-5 text-xs text-jd-muted">
            <Link to="/termos" className="hover:text-jd-ink transition-colors">Termos</Link>
            <Link to="/privacidade" className="hover:text-jd-ink transition-colors">Privacidade</Link>
            <a href="https://wa.me/5551992185607" target="_blank" rel="noopener" className="hover:text-jd-ink transition-colors">WhatsApp</a>
          </div>
          <p className="text-xs text-jd-muted">
            © {new Date().getFullYear()} FechaAqui
          </p>
        </div>
      </div>
    </footer>
  );
}

// =============================================================================
// VTURB VSL PLAYER — video do criativo principal
// =============================================================================
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      "vturb-smartplayer": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & { id?: string };
    }
  }
}

const VTURB_PLAYER_ID = "vid-69e79dcaa8ce2d72e1d510f1";
const VTURB_SCRIPT_SRC = "https://scripts.converteai.net/ec2ef009-462a-408f-8a77-4f9e59fe2b68/players/69e79dcaa8ce2d72e1d510f1/v4/player.js";

function VTurbPlayer() {
  useEffect(() => {
    // Evita carregar o script mais de uma vez
    if (document.querySelector(`script[src="${VTURB_SCRIPT_SRC}"]`)) return;
    const s = document.createElement("script");
    s.src = VTURB_SCRIPT_SRC;
    s.async = true;
    document.head.appendChild(s);
  }, []);

  // Celular com proporcao 9:16 padrao. Vídeo usa object-contain pra NAO cortar
  // conteudo — se o video tiver ratio diferente, aparecem faixas pretas (OK).
  // Botoes laterais em % da altura → sempre proporcionais ao tamanho do celular.
  return (
    <div className="relative mx-auto w-full max-w-[300px] md:max-w-[340px] lg:max-w-[380px]">
      {/* Sombra ambiente embaixo */}
      <div
        className="absolute left-1/2 -translate-x-1/2 bottom-[-20px] w-[80%] h-8 bg-black/20 blur-2xl rounded-[50%] pointer-events-none"
        aria-hidden="true"
      />

      {/* Moldura externa (titanium) */}
      <div
        className="relative"
        style={{
          background: "linear-gradient(135deg, #3d3d3f 0%, #1a1a1c 25%, #0a0a0c 50%, #1a1a1c 75%, #3d3d3f 100%)",
          padding: "3px",
          borderRadius: "44px",
          boxShadow:
            "0 24px 50px -18px rgba(0,0,0,0.4), 0 14px 28px -10px rgba(0,0,0,0.25), 0 0 0 0.5px rgba(255,255,255,0.08) inset",
        }}
      >
        {/* Bezel preto */}
        <div
          className="relative bg-neutral-950"
          style={{
            padding: "7px",
            borderRadius: "41px",
          }}
        >
          {/* Reflexo de vidro na borda superior */}
          <div
            className="absolute inset-x-10 top-[3px] h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none"
            aria-hidden="true"
          />

          {/* Tela — 9:16, encaixa o video sem cortar */}
          <div
            className="relative overflow-hidden bg-black"
            style={{
              borderRadius: "34px",
              aspectRatio: "9 / 16",
            }}
          >
            {/* Vídeo VSL — object-contain: encaixa inteiro, sem cortar */}
            <style>{`
              #${VTURB_PLAYER_ID}, #${VTURB_PLAYER_ID} video, #${VTURB_PLAYER_ID} .smartplayer-video {
                width: 100% !important;
                height: 100% !important;
                object-fit: contain !important;
                background: #000;
              }
            `}</style>
            <div className="absolute inset-0 z-10">
              {/* @ts-ignore -- custom element do VTurb */}
              <vturb-smartplayer
                id={VTURB_PLAYER_ID}
                style={{ display: "block", width: "100%", height: "100%" }}
              />
            </div>

            {/* Home indicator */}
            <div className="absolute bottom-[6px] left-1/2 -translate-x-1/2 z-30 w-[30%] h-[3px] rounded-full bg-white/70 pointer-events-none" aria-hidden="true" />
          </div>
        </div>

        {/* Botoes laterais — posicao e altura em % pra escalar com o celular */}
        {/* Power (direita) */}
        <div
          className="absolute right-[-2px] rounded-r-sm pointer-events-none"
          style={{
            top: "22%",
            width: "3px",
            height: "12%",
            background: "linear-gradient(to right, #2a2a2c, #4a4a4d)",
            boxShadow: "inset -0.5px 0 0 rgba(255,255,255,0.1)",
          }}
          aria-hidden="true"
        />
        {/* Mute (esquerda, curto) */}
        <div
          className="absolute left-[-2px] rounded-l-sm pointer-events-none"
          style={{
            top: "16%",
            width: "3px",
            height: "4%",
            background: "linear-gradient(to left, #2a2a2c, #4a4a4d)",
            boxShadow: "inset 0.5px 0 0 rgba(255,255,255,0.1)",
          }}
          aria-hidden="true"
        />
        {/* Volume + */}
        <div
          className="absolute left-[-2px] rounded-l-sm pointer-events-none"
          style={{
            top: "22%",
            width: "3px",
            height: "7%",
            background: "linear-gradient(to left, #2a2a2c, #4a4a4d)",
            boxShadow: "inset 0.5px 0 0 rgba(255,255,255,0.1)",
          }}
          aria-hidden="true"
        />
        {/* Volume - */}
        <div
          className="absolute left-[-2px] rounded-l-sm pointer-events-none"
          style={{
            top: "31%",
            width: "3px",
            height: "7%",
            background: "linear-gradient(to left, #2a2a2c, #4a4a4d)",
            boxShadow: "inset 0.5px 0 0 rgba(255,255,255,0.1)",
          }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
