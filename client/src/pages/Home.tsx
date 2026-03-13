/*
 * DESIGN: Sovereign Obsidian — Dark Editorial Brutalism
 * Home page: SME-targeted funnel with demographic-specific messaging.
 * Flow: Pain → Urgency → Solution → Proof → Products → Social Proof → CTA
 * ND-friendly: High contrast, generous spacing, clear hierarchy, chunked content.
 */
import { useAuth } from "@/_core/hooks/useAuth";
import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  Shield, ArrowRight, CheckCircle2, FileCheck, Cpu, Lock, Zap,
  BookOpen, AlertTriangle, Users, Building2, TrendingUp, Clock,
  BadgeCheck, Scale, Lightbulb, Heart
} from "lucide-react";
import { Button } from "@/components/ui/button";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.6, ease: [0, 0, 0.2, 1] as const },
  }),
};

/* ── WHO THIS IS FOR ── */
const demographics = [
  {
    icon: Building2,
    title: "SME Owners & Directors",
    pain: "You're using AI tools — ChatGPT, Copilot, automated marketing — but you have no idea if you're compliant. You can't afford a £50K Big 4 audit. You need clarity, fast.",
    solution: "Our £99 audit tells you exactly where you stand. Plain English. No jargon. Actionable steps you can take this week.",
  },
  {
    icon: Cpu,
    title: "CTOs & Tech Leads",
    pain: "Your dev team is shipping AI features but nobody's documented the risk classifications. The board is asking questions you can't answer yet.",
    solution: "Get a technical compliance map of every AI system in your stack. Risk-classified, gap-analysed, with a 90-day fix plan your team can execute.",
  },
  {
    icon: Scale,
    title: "Compliance & Legal Teams",
    pain: "The EU AI Act is live but your AI governance framework is still a blank page. You need evidence-bound documentation that will hold up to regulatory scrutiny.",
    solution: "Cryptographically sealed audit reports with full provenance tracking. The kind of evidence that satisfies regulators and protects your organisation.",
  },
  {
    icon: TrendingUp,
    title: "Startups Scaling with AI",
    pain: "You're moving fast and AI is core to your product. But investors and enterprise clients are starting to ask about AI governance. You need to prove compliance without slowing down.",
    solution: "A lightweight compliance framework that grows with you. Start with the £99 audit, graduate to governance packs as you scale.",
  },
];

/* ── WHY US, NOT THEM ── */
const whyUs = [
  {
    them: "Big 4 consultancies charge £50K–£200K for an AI audit",
    us: "We start at £99. Same regulatory coverage. Evidence-bound.",
    icon: TrendingUp,
  },
  {
    them: "Most consultants deliver a PDF and disappear",
    us: "We deliver a 90-day roadmap with specific tasks, owners, and deadlines",
    icon: FileCheck,
  },
  {
    them: "Generic frameworks that don't fit your business",
    us: "Customised to your AI systems, your risk profile, your industry",
    icon: Lightbulb,
  },
  {
    them: "Weeks of meetings before you see anything",
    us: "24-hour delivery. Purchase today, report tomorrow.",
    icon: Clock,
  },
  {
    them: "Locked into expensive retainers",
    us: "No lock-in. Buy what you need. Upgrade when you're ready.",
    icon: Lock,
  },
  {
    them: "Opaque methodology you can't verify",
    us: "Every finding cryptographically sealed. Every claim evidence-bound.",
    icon: BadgeCheck,
  },
];

/* ── PRODUCTS ── */
const products = [
  {
    icon: FileCheck,
    title: "AI Compliance Audit",
    price: "£99",
    description: "Find out exactly where your AI systems stand against the EU AI Act. Plain English report with a step-by-step fix plan. Delivered in 24 hours.",
    href: "/audit",
    featured: true,
    tag: "START HERE",
  },
  {
    icon: BookOpen,
    title: "Compliance Prompt Pack",
    price: "£29",
    description: "47 ready-to-use prompts for AI governance, risk assessment, and compliance documentation. Use them today, no training needed.",
    href: "/packs",
    featured: false,
    tag: "QUICK WIN",
  },
  {
    icon: Cpu,
    title: "Operational AI Packs",
    price: "From £1,250",
    description: "Complete governance frameworks with policy templates, risk registers, and implementation guides. Everything you need to be fully compliant.",
    href: "/packs",
    featured: false,
    tag: "FULL COVERAGE",
  },
  {
    icon: Zap,
    title: "VIP Strategy Call",
    price: "£199",
    description: "60 minutes with a sovereign systems architect. Walk away with a personalised AI governance roadmap for your specific situation.",
    href: "/book",
    featured: false,
    tag: "PERSONAL",
  },
];

/* ── SOCIAL PROOF ── */
const proofPoints = [
  { stat: "25+", label: "years in aerospace, defence & regulated industries" },
  { stat: "£99", label: "starting price — 99.8% cheaper than Big 4 audits" },
  { stat: "24hrs", label: "from purchase to full compliance report" },
  { stat: "0", label: "vendor lock-in. Everything we deliver is yours to keep." },
];

export default function Home() {
  const { user, isAuthenticated } = useAuth();

  return (
    <div>
      {/* ═══════════════════════════════════════════════════════════════
          HERO — Lead with the pain, not the product
          ═══════════════════════════════════════════════════════════════ */}
      <section className="relative min-h-[90vh] flex items-center overflow-hidden">
        <div className="absolute inset-0">
          <img
            src="https://d2xsxph8kpxj0f.cloudfront.net/310519663109929189/SjdwYSpMAPPcwToiUcu6zA/hero-main-Tk2Jxjr3wetwPskusdcRVE.webp"
            alt=""
            className="w-full h-full object-cover"
            loading="eager"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-obsidian via-obsidian/90 to-obsidian/40" />
          <div className="absolute inset-0 bg-gradient-to-t from-obsidian via-transparent to-obsidian/30" />
        </div>

        <div className="container relative z-10 pt-32 pb-20">
          <div className="max-w-2xl">
            <motion.div
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              custom={0}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-xs font-mono tracking-wider mb-6"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              EU AI ACT IS NOW IN FORCE — FINES UP TO €35M
            </motion.div>

            <motion.h1
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              custom={1}
              className="text-4xl sm:text-5xl lg:text-[3.75rem] font-serif text-ivory leading-[1.1] mb-6"
            >
              Is your business{" "}
              <span className="text-gold italic">AI compliant</span>?
              <br />
              <span className="text-ivory/60 text-3xl sm:text-4xl lg:text-[2.5rem]">
                Find out for £99.
              </span>
            </motion.h1>

            <motion.p
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              custom={2}
              className="text-lg text-ivory/70 max-w-lg mb-10 leading-relaxed"
            >
              If you use ChatGPT, AI marketing tools, automated hiring, or any AI system
              in your business — the EU AI Act applies to you. Most SMEs don't know they're
              at risk. We help you find out fast, fix it affordably, and prove compliance
              with evidence that holds up.
            </motion.p>

            <motion.div
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              custom={3}
              className="flex flex-col sm:flex-row gap-4"
            >
              <Link href="/audit">
                <Button
                  size="lg"
                  className="bg-gold text-obsidian font-semibold hover:bg-gold-dim transition-all duration-200 active:scale-[0.98] px-8 h-12 text-[15px]"
                >
                  Get Your £99 Compliance Check
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </Link>
              <Link href="/book">
                <Button
                  variant="outline"
                  size="lg"
                  className="border-border/60 text-ivory/80 hover:text-ivory hover:border-gold/40 h-12 text-[15px]"
                >
                  Talk to an Expert — £199
                </Button>
              </Link>
            </motion.div>

            {/* Quick trust bar */}
            <motion.div
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              custom={4}
              className="flex flex-wrap gap-x-6 gap-y-2 mt-8 text-ivory/40 text-xs font-mono tracking-wider"
            >
              <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-gold/60" /> 24-HOUR DELIVERY</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-gold/60" /> NO LOCK-IN</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-gold/60" /> EVIDENCE-BOUND</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-gold/60" /> STRIPE SECURE</span>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 01 — THE URGENCY (Why you need this NOW)
          ═══════════════════════════════════════════════════════════════ */}
      <div className="evidence-line" data-timestamp="SECTION 01 — THE REALITY" />

      <section className="py-20 lg:py-28">
        <div className="container">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
            <div className="lg:col-span-5">
              <span className="section-number">01 — THE REALITY</span>
              <h2 className="text-3xl lg:text-4xl font-serif text-ivory mt-4 mb-6">
                Most businesses are{" "}
                <span className="text-gold italic">already non-compliant</span>.
              </h2>
              <p className="text-muted-foreground text-[17px] leading-relaxed mb-4">
                The EU AI Act came into force in August 2024. If your business uses AI tools —
                even simple ones like ChatGPT for customer service, AI-powered recruitment screening,
                or automated marketing — you may already be in breach.
              </p>
              <p className="text-muted-foreground text-[17px] leading-relaxed">
                The penalties are not theoretical. They are real, they are severe, and enforcement
                has begun. The question is not whether you need to act — it's whether you can afford not to.
              </p>
            </div>

            <div className="lg:col-span-7">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {[
                  { num: "€35M", label: "Maximum fine for prohibited AI practices — or 7% of global turnover, whichever is higher" },
                  { num: "87%", label: "of UK businesses have no AI governance framework in place (2025 survey)" },
                  { num: "Feb 2025", label: "Prohibited AI practices enforcement began — you could be fined today" },
                  { num: "Aug 2026", label: "Full enforcement of high-risk AI system requirements — 17 months away" },
                ].map((stat, i) => (
                  <motion.div
                    key={stat.num}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1, duration: 0.5 }}
                    className="p-6 bg-card rounded border border-border/50"
                  >
                    <div className="font-mono text-2xl text-gold font-medium mb-2">{stat.num}</div>
                    <div className="text-muted-foreground text-sm leading-relaxed">{stat.label}</div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 02 — WHO THIS IS FOR (Demographic Funnel)
          ═══════════════════════════════════════════════════════════════ */}
      <div className="evidence-line" data-timestamp="SECTION 02 — WHO WE HELP" />

      <section className="py-20 lg:py-28 bg-charcoal/30">
        <div className="container">
          <div className="max-w-xl mb-14">
            <span className="section-number">02 — WHO WE HELP</span>
            <h2 className="text-3xl lg:text-4xl font-serif text-ivory mt-4 mb-4">
              Built for people who{" "}
              <span className="text-gold italic">actually run businesses</span>.
            </h2>
            <p className="text-muted-foreground text-[17px] leading-relaxed">
              We don't sell to procurement departments. We help real people in real businesses
              who need practical answers — not 200-page reports they'll never read.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {demographics.map((demo, i) => (
              <motion.div
                key={demo.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className="p-8 bg-card rounded border border-border/50 hover:border-gold/30 transition-all duration-300"
              >
                <div className="flex items-center gap-3 mb-4">
                  <demo.icon className="w-7 h-7 text-gold" />
                  <h3 className="font-serif text-xl text-ivory">{demo.title}</h3>
                </div>
                <div className="mb-4">
                  <div className="text-xs font-mono text-red-400/70 tracking-wider mb-2">YOUR PAIN</div>
                  <p className="text-muted-foreground text-[15px] leading-relaxed">{demo.pain}</p>
                </div>
                <div>
                  <div className="text-xs font-mono text-gold/70 tracking-wider mb-2">OUR ANSWER</div>
                  <p className="text-ivory/80 text-[15px] leading-relaxed">{demo.solution}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 03 — WHY US (Differentiation)
          ═══════════════════════════════════════════════════════════════ */}
      <div className="evidence-line" data-timestamp="SECTION 03 — WHY US" />

      <section className="py-20 lg:py-28">
        <div className="container">
          <div className="max-w-xl mb-14">
            <span className="section-number">03 — WHY CHOOSE US</span>
            <h2 className="text-3xl lg:text-4xl font-serif text-ivory mt-4 mb-4">
              What they charge.{" "}
              <span className="text-gold italic">What we charge.</span>
            </h2>
            <p className="text-muted-foreground text-[17px] leading-relaxed">
              We built this because the AI compliance industry is broken. Big consultancies
              charge obscene fees for generic frameworks. We deliver better results at a fraction
              of the cost — because we've automated the hard parts and kept the human expertise
              where it matters.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {whyUs.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.5 }}
                className="p-6 bg-card rounded border border-border/50"
              >
                <item.icon className="w-6 h-6 text-gold mb-4" />
                <div className="mb-3">
                  <div className="text-xs font-mono text-red-400/60 tracking-wider mb-1">THEM</div>
                  <p className="text-muted-foreground text-[14px] leading-relaxed line-through decoration-red-400/30">{item.them}</p>
                </div>
                <div>
                  <div className="text-xs font-mono text-gold/70 tracking-wider mb-1">US</div>
                  <p className="text-ivory/90 text-[15px] leading-relaxed font-medium">{item.us}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 04 — PRODUCTS (The Funnel)
          ═══════════════════════════════════════════════════════════════ */}
      <div className="evidence-line" data-timestamp="SECTION 04 — WHAT WE OFFER" />

      <section className="py-20 lg:py-28 bg-charcoal/30">
        <div className="container">
          <div className="max-w-xl mb-14">
            <span className="section-number">04 — YOUR OPTIONS</span>
            <h2 className="text-3xl lg:text-4xl font-serif text-ivory mt-4 mb-4">
              Start small.{" "}
              <span className="text-gold italic">Scale when ready.</span>
            </h2>
            <p className="text-muted-foreground text-[17px] leading-relaxed">
              You don't need to spend thousands to get started. Begin with a £99 audit to understand
              your position, then choose the level of support that fits your business.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {products.map((product, i) => (
              <motion.div
                key={product.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
              >
                <Link href={product.href}>
                  <div
                    className={`group relative p-8 rounded border transition-all duration-300 h-full ${
                      product.featured
                        ? "bg-card border-gold/30 hover:border-gold/60"
                        : "bg-card border-border/50 hover:border-border"
                    }`}
                  >
                    <div className="absolute top-4 right-4 px-2.5 py-1 bg-gold/10 border border-gold/20 rounded text-gold text-xs font-mono tracking-wider">
                      {product.tag}
                    </div>
                    <product.icon className="w-8 h-8 text-gold mb-4" />
                    <div className="flex items-baseline gap-3 mb-3">
                      <h3 className="font-serif text-xl text-ivory">{product.title}</h3>
                      <span className="font-mono text-gold text-sm">{product.price}</span>
                    </div>
                    <p className="text-muted-foreground text-[15px] leading-relaxed mb-4">
                      {product.description}
                    </p>
                    <span className="inline-flex items-center text-gold text-sm font-medium group-hover:gap-2 transition-all duration-200">
                      Learn more <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 05 — PROOF (Social Proof & Credentials)
          ═══════════════════════════════════════════════════════════════ */}
      <div className="evidence-line" data-timestamp="SECTION 05 — PROOF" />

      <section className="py-20 lg:py-28">
        <div className="container">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="section-number">05 — WHY TRUST US</span>
            <h2 className="text-3xl lg:text-4xl font-serif text-ivory mt-4 mb-4">
              Built by someone who's{" "}
              <span className="text-gold italic">been in your shoes</span>.
            </h2>
            <p className="text-muted-foreground text-[17px] leading-relaxed">
              Sovereign Sanctuary Systems was founded by Andy Jones — 25+ years in aerospace,
              defence, and regulated industries. He built this because he saw SMEs being priced
              out of compliance by an industry that profits from complexity.
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {proofPoints.map((point, i) => (
              <motion.div
                key={point.stat}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className="text-center p-6 bg-card rounded border border-border/50"
              >
                <div className="font-mono text-3xl text-gold font-medium mb-2">{point.stat}</div>
                <div className="text-muted-foreground text-sm leading-relaxed">{point.label}</div>
              </motion.div>
            ))}
          </div>

          {/* Trust signals */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              "EU AI Act Compliant",
              "ISO 27001 Aligned",
              "GDPR Article 22 Ready",
              "Evidence-Bound",
              "Human Oversight",
              "ND-Friendly Design",
            ].map((signal, i) => (
              <motion.div
                key={signal}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05, duration: 0.4 }}
                className="flex items-center gap-2 p-3 bg-card rounded border border-border/50 text-center justify-center"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-gold shrink-0" />
                <span className="text-ivory/80 text-xs font-medium">{signal}</span>
              </motion.div>
            ))}
          </div>

          {/* Accessibility commitment */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="mt-12 p-6 bg-card rounded border border-gold/20 flex items-start gap-4"
          >
            <Heart className="w-6 h-6 text-gold shrink-0 mt-1" />
            <div>
              <h3 className="font-serif text-lg text-ivory mb-2">Designed for everyone.</h3>
              <p className="text-muted-foreground text-[15px] leading-relaxed">
                This platform is built to be neurodivergent-friendly and accessible by design.
                High contrast, clear typography, chunked content, no cognitive overload.
                We believe compliance tools should reduce stress, not add to it.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 06 — FINAL CTA
          ═══════════════════════════════════════════════════════════════ */}
      <div className="evidence-line" data-timestamp="SECTION 06 — TAKE ACTION" />

      <section className="py-20 lg:py-28 bg-charcoal/30">
        <div className="container">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl lg:text-4xl font-serif text-ivory mb-6">
              Don't wait for the fine.
              <br />
              <span className="text-gold italic">Find out where you stand today.</span>
            </h2>
            <p className="text-muted-foreground text-lg leading-relaxed mb-10 max-w-lg mx-auto">
              The £99 AI Compliance Audit gives you a complete picture of your AI governance
              posture in 24 hours. Plain English. Evidence-bound. No obligations. No lock-in.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/audit">
                <Button
                  size="lg"
                  className="bg-gold text-obsidian font-semibold hover:bg-gold-dim transition-all duration-200 active:scale-[0.98] px-8 h-14 text-base"
                >
                  Get Your £99 Compliance Check
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </Link>
              <Link href="/book">
                <Button
                  variant="outline"
                  size="lg"
                  className="border-border/60 text-ivory/80 hover:text-ivory hover:border-gold/40 h-14 text-base"
                >
                  Book a Strategy Call — £199
                </Button>
              </Link>
            </div>

            <p className="text-muted-foreground/40 text-xs font-mono mt-8 tracking-wider">
              SECURE PAYMENT VIA STRIPE &middot; NO SUBSCRIPTION &middot; CANCEL ANYTIME
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
