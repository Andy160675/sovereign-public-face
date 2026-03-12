/*
 * DESIGN: Sovereign Obsidian — Dark Editorial Brutalism
 * Home page: Asymmetric hero with cinematic background.
 * Progressive disclosure: Hero → Value Prop → Products → Trust → CTA
 * ND-friendly: High contrast, generous spacing, clear hierarchy.
 */
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Shield, ArrowRight, CheckCircle2, FileCheck, Cpu, Lock, Zap, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.6, ease: [0, 0, 0.2, 1] as const },
  }),
};

const products = [
  {
    icon: FileCheck,
    title: "AI Compliance Audit",
    price: "£99",
    description: "Full-spectrum AI compliance assessment against EU AI Act requirements. Evidence-bound report with remediation roadmap.",
    href: "/audit",
    featured: true,
  },
  {
    icon: Cpu,
    title: "Operational AI Packs",
    price: "From £1,250",
    description: "Five deployment-ready AI governance packs. Each includes policy templates, risk frameworks, and implementation guides.",
    href: "/packs",
    featured: false,
  },
  {
    icon: BookOpen,
    title: "Compliance Prompt Pack",
    price: "£29",
    description: "47 battle-tested compliance prompts for AI governance, risk assessment, and regulatory documentation.",
    href: "/packs",
    featured: false,
  },
  {
    icon: Zap,
    title: "VIP Strategy Call",
    price: "£199",
    description: "60-minute one-on-one session with a sovereign systems architect. Actionable roadmap delivered within 24 hours.",
    href: "/book",
    featured: false,
  },
];

const trustSignals = [
  "EU AI Act Compliant",
  "ISO 27001 Aligned",
  "Zero-SaaS Architecture",
  "Cryptographic Evidence Chains",
  "GDPR Article 22 Ready",
  "Human Oversight Guaranteed",
];

export default function Home() {
  return (
    <div>
      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center overflow-hidden">
        {/* Background Image */}
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
              className="section-number mb-6"
            >
              ENTERPRISE AI GOVERNANCE
            </motion.div>

            <motion.h1
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              custom={1}
              className="text-4xl sm:text-5xl lg:text-[3.75rem] font-serif text-ivory leading-[1.1] mb-6"
            >
              Your AI systems are{" "}
              <span className="text-gold italic">not compliant</span>.
              <br />
              We fix that.
            </motion.h1>

            <motion.p
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              custom={2}
              className="text-lg text-ivory/70 max-w-lg mb-10 leading-relaxed"
            >
              Sovereign-grade AI compliance audits, governance frameworks, and operational
              packs. Evidence-bound. Cryptographically sealed. Built for the EU AI Act era.
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
                  Start with the £99 Audit
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </Link>
              <Link href="/packs">
                <Button
                  variant="outline"
                  size="lg"
                  className="border-border/60 text-ivory/80 hover:text-ivory hover:border-gold/40 h-12 text-[15px]"
                >
                  View All Packs
                </Button>
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Evidence Line */}
      <div className="evidence-line" data-timestamp="SECTION 01 — VALUE" />

      {/* Value Proposition */}
      <section className="py-20 lg:py-28">
        <div className="container">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
            <div className="lg:col-span-5">
              <span className="section-number">01 — THE PROBLEM</span>
              <h2 className="text-3xl lg:text-4xl font-serif text-ivory mt-4 mb-6">
                The EU AI Act is{" "}
                <span className="text-gold italic">already in force</span>.
              </h2>
              <p className="text-muted-foreground text-[17px] leading-relaxed">
                Most organisations are using AI systems that would fail a compliance audit today.
                The penalties are severe — up to 7% of global turnover. The deadline is not coming.
                It has arrived.
              </p>
            </div>

            <div className="lg:col-span-7">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {[
                  { num: "87%", label: "of UK businesses have no AI governance framework" },
                  { num: "€35M", label: "maximum fine for non-compliance with EU AI Act" },
                  { num: "7%", label: "of global turnover — the penalty ceiling" },
                  { num: "24hrs", label: "from audit to actionable remediation roadmap" },
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

      {/* Evidence Line */}
      <div className="evidence-line" data-timestamp="SECTION 02 — PRODUCTS" />

      {/* Products Section */}
      <section className="py-20 lg:py-28 bg-charcoal/30">
        <div className="container">
          <div className="max-w-xl mb-14">
            <span className="section-number">02 — WHAT WE DELIVER</span>
            <h2 className="text-3xl lg:text-4xl font-serif text-ivory mt-4 mb-4">
              Sovereign-grade solutions.
              <br />
              <span className="text-gold italic">No SaaS. No lock-in.</span>
            </h2>
            <p className="text-muted-foreground text-[17px] leading-relaxed">
              Every deliverable is yours to own. Evidence-bound, cryptographically sealed,
              and portable to any system or IDE.
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
                    {product.featured && (
                      <div className="absolute top-4 right-4 px-2.5 py-1 bg-gold/10 border border-gold/20 rounded text-gold text-xs font-mono tracking-wider">
                        MOST POPULAR
                      </div>
                    )}
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

      {/* Evidence Line */}
      <div className="evidence-line" data-timestamp="SECTION 03 — TRUST" />

      {/* Trust Signals */}
      <section className="py-20 lg:py-28">
        <div className="container">
          <div className="text-center max-w-xl mx-auto mb-14">
            <span className="section-number">03 — TRUST FRAMEWORK</span>
            <h2 className="text-3xl lg:text-4xl font-serif text-ivory mt-4 mb-4">
              Built on <span className="text-gold italic">evidence</span>,
              not promises.
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {trustSignals.map((signal, i) => (
              <motion.div
                key={signal}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.4 }}
                className="flex items-center gap-3 p-5 bg-card rounded border border-border/50"
              >
                <CheckCircle2 className="w-5 h-5 text-gold shrink-0" />
                <span className="text-ivory/90 text-[15px] font-medium">{signal}</span>
              </motion.div>
            ))}
          </div>

          {/* Sovereign Seal */}
          <div className="mt-16 text-center">
            <div className="inline-flex items-center gap-3 px-6 py-3 bg-card rounded border border-gold/20">
              <Shield className="w-5 h-5 text-gold" />
              <span className="font-mono text-xs text-gold/80 tracking-wider">
                SOVEREIGN SANCTUARY SYSTEMS — EVIDENCE-BOUND SINCE 2024
              </span>
              <Shield className="w-5 h-5 text-gold" />
            </div>
          </div>
        </div>
      </section>

      {/* Evidence Line */}
      <div className="evidence-line" data-timestamp="SECTION 04 — ACTION" />

      {/* Final CTA */}
      <section className="py-20 lg:py-28 bg-charcoal/30">
        <div className="container">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl lg:text-4xl font-serif text-ivory mb-6">
              Start with the audit.
              <br />
              <span className="text-gold italic">Know where you stand.</span>
            </h2>
            <p className="text-muted-foreground text-lg leading-relaxed mb-10 max-w-lg mx-auto">
              The £99 AI Compliance Audit gives you a complete picture of your AI governance
              posture in 24 hours. Evidence-bound. No obligations.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/audit">
                <Button
                  size="lg"
                  className="bg-gold text-obsidian font-semibold hover:bg-gold-dim transition-all duration-200 active:scale-[0.98] px-8 h-12 text-[15px]"
                >
                  Get Your £99 Audit
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </Link>
              <Link href="/book">
                <Button
                  variant="outline"
                  size="lg"
                  className="border-border/60 text-ivory/80 hover:text-ivory hover:border-gold/40 h-12 text-[15px]"
                >
                  Book a Strategy Call — £199
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
