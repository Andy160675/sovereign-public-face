/*
 * Services page — SME-targeted service catalog.
 * Speaks to business owners, not engineers.
 * Flow: "What do you need?" → Service cards → Pricing ladder → Hosting truth → CTA
 * ND-friendly: chunked content, high contrast, progressive disclosure.
 */
import { motion } from "framer-motion";
import { Link } from "wouter";
import {
  Cpu, Brain, Lock, Server, BarChart3, Eye,
  ArrowRight, CheckCircle2, Shield, Users, Lightbulb,
  Clock, FileCheck, AlertTriangle, Heart
} from "lucide-react";
import { Button } from "@/components/ui/button";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: [0, 0, 0.2, 1] as const },
  }),
};

/* ── SERVICES — written for SMEs, not engineers ── */
const services = [
  {
    icon: FileCheck,
    title: "AI Compliance Audit",
    forWho: "Any business using AI tools",
    plain: "We check every AI system in your business against the EU AI Act and tell you exactly what's compliant, what's not, and how to fix it. Plain English report, no jargon.",
    price: "From £99",
    timeframe: "24 hours",
  },
  {
    icon: Brain,
    title: "AI Governance Setup",
    forWho: "SMEs deploying AI at scale",
    plain: "We build you a complete AI governance framework — policies, risk registers, oversight procedures, and documentation. Everything a regulator would ask for, ready to go.",
    price: "From £1,250",
    timeframe: "2–4 weeks",
  },
  {
    icon: Lock,
    title: "Compliance & Security Review",
    forWho: "Regulated industries, financial services, healthcare",
    plain: "Deep-dive security and compliance assessment with evidence-bound reporting. Every finding is documented with cryptographic proof — the kind that holds up in court.",
    price: "From £2,500",
    timeframe: "1–2 weeks",
  },
  {
    icon: Cpu,
    title: "Infrastructure Architecture",
    forWho: "Businesses wanting to own their tech stack",
    plain: "We design and build your IT infrastructure so you own everything. No vendor lock-in, no surprise price hikes, no dependency on services that could disappear tomorrow.",
    price: "From £7,500",
    timeframe: "1–3 months",
  },
  {
    icon: BarChart3,
    title: "Data Pipeline Engineering",
    forWho: "Businesses drowning in data silos",
    plain: "We connect your data sources into a single, governed pipeline. Clean data in, actionable insights out. Full audit trail on every transformation.",
    price: "Custom",
    timeframe: "2–6 weeks",
  },
  {
    icon: Eye,
    title: "VIP Strategy Session",
    forWho: "Leaders who need clarity fast",
    plain: "60 minutes with a sovereign systems architect. You walk away with a personalised roadmap for your specific situation — AI governance, infrastructure, compliance, or all three.",
    price: "£199",
    timeframe: "Same day",
  },
];

/* ── PRICING LADDER — start small, scale up ── */
const pricingLadder = [
  {
    step: "01",
    name: "Quick Win",
    price: "£29 – £99",
    description: "Start here if you just need to understand your position.",
    items: [
      "Compliance Prompt Pack — £29 (47 ready-to-use prompts)",
      "AI Compliance Audit — £99 (full EU AI Act assessment)",
      "VIP Strategy Call — £199 (personalised roadmap)",
    ],
    cta: "Browse Quick Wins",
    href: "/audit",
    featured: false,
  },
  {
    step: "02",
    name: "Get Compliant",
    price: "£1,250 – £2,500",
    description: "For businesses that need a complete governance framework.",
    items: [
      "Operational AI Pack — complete governance kit",
      "Risk register + policy templates",
      "Implementation guide with 90-day timeline",
      "Compliance documentation ready for regulators",
      "One follow-up review session",
    ],
    cta: "View Governance Packs",
    href: "/packs",
    featured: true,
  },
  {
    step: "03",
    name: "Full Transformation",
    price: "£7,500+",
    description: "For organisations that want complete operational sovereignty.",
    items: [
      "Custom infrastructure architecture",
      "AI governance kernel deployment",
      "Data pipeline engineering",
      "Ongoing compliance monitoring",
      "Monthly governance reports",
      "Priority support & board-level reporting",
    ],
    cta: "Start a Conversation",
    href: "/contact",
    featured: false,
  },
];

/* ── HOSTING — honest costs ── */
const hostingOptions = [
  { option: "Static Website", cost: "$5/mo", provider: "DigitalOcean", best: "Brochure sites, landing pages" },
  { option: "Website + Backend", cost: "$12/mo", provider: "DigitalOcean", best: "Apps with user accounts and data" },
  { option: "Full Sovereign Server", cost: "€4.51/mo", provider: "Hetzner", best: "Maximum control, you own everything" },
  { option: "Global Edge Network", cost: "Free – $5/mo", provider: "Fly.io", best: "Fast worldwide access" },
  { option: "Self-Hosted", cost: "Electricity only", provider: "Your hardware", best: "Complete sovereignty, zero cloud" },
];

export default function Services() {
  return (
    <div>
      {/* Hero */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-charcoal/50 to-obsidian" />
        <div className="container relative z-10">
          <span className="section-number mb-4 block">WHAT WE DO</span>
          <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-serif text-ivory leading-[1.1] mb-6">
            AI compliance and governance
            <br />
            <span className="text-gold italic">that actually makes sense.</span>
          </h1>
          <p className="text-lg text-ivory/70 max-w-2xl leading-relaxed">
            We help businesses understand their AI compliance obligations, build the governance
            frameworks they need, and prove compliance with evidence that holds up. No jargon,
            no lock-in, no £50K consulting fees.
          </p>
        </div>
      </section>

      <div className="evidence-line" data-timestamp="OUR SERVICES" />

      {/* Services Grid — SME-friendly language */}
      <section className="py-20 lg:py-28">
        <div className="container">
          <div className="max-w-xl mb-14">
            <span className="section-number">WHAT DO YOU NEED?</span>
            <h2 className="text-3xl lg:text-4xl font-serif text-ivory mt-4 mb-4">
              Pick what fits.{" "}
              <span className="text-gold italic">No pressure.</span>
            </h2>
            <p className="text-muted-foreground text-[17px] leading-relaxed">
              Every service is designed to give you a clear outcome. You'll know exactly
              what you're getting, what it costs, and how long it takes — before you commit.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((service, i) => (
              <motion.div
                key={service.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.5 }}
                className="p-8 bg-card rounded border border-border/50 hover:border-gold/30 transition-all duration-300 group flex flex-col"
              >
                <service.icon className="w-8 h-8 text-gold mb-4 group-hover:scale-110 transition-transform" />
                <h3 className="font-serif text-xl text-ivory mb-1">{service.title}</h3>
                <div className="text-xs font-mono text-gold/60 tracking-wider mb-3">{service.forWho}</div>
                <p className="text-muted-foreground text-[15px] leading-relaxed flex-1 mb-4">{service.plain}</p>
                <div className="flex items-center justify-between pt-4 border-t border-border/30">
                  <span className="font-mono text-gold text-sm">{service.price}</span>
                  <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
                    <Clock className="w-3 h-3" /> {service.timeframe}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <div className="evidence-line" data-timestamp="PRICING LADDER" />

      {/* Pricing Ladder — start small, scale up */}
      <section className="py-20 lg:py-28 bg-charcoal/30">
        <div className="container">
          <div className="max-w-xl mb-14">
            <span className="section-number">HOW IT WORKS</span>
            <h2 className="text-3xl lg:text-4xl font-serif text-ivory mt-4 mb-4">
              Start small.{" "}
              <span className="text-gold italic">Scale when you're ready.</span>
            </h2>
            <p className="text-muted-foreground text-[17px] leading-relaxed">
              You don't need to commit to a big project upfront. Most clients start with the
              £99 audit, then decide what they need next based on the results. No sales pressure.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
            {pricingLadder.map((tier, i) => (
              <motion.div
                key={tier.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className={`p-8 rounded border flex flex-col ${
                  tier.featured
                    ? "bg-gold/5 border-gold/30 ring-1 ring-gold/20"
                    : "bg-card border-border/50"
                }`}
              >
                <div className="font-mono text-4xl text-gold/20 font-bold mb-2">{tier.step}</div>
                {tier.featured && (
                  <div className="mb-3 px-2.5 py-1 bg-gold/10 border border-gold/20 rounded text-gold text-xs font-mono tracking-wider w-fit">
                    MOST POPULAR
                  </div>
                )}
                <h3 className="font-serif text-xl text-ivory mb-1">{tier.name}</h3>
                <div className="font-mono text-2xl text-gold mb-2">{tier.price}</div>
                <p className="text-muted-foreground text-[15px] leading-relaxed mb-6">{tier.description}</p>
                <ul className="space-y-3 flex-1">
                  {tier.items.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-[15px]">
                      <CheckCircle2 className="w-4 h-4 text-gold mt-0.5 shrink-0" />
                      <span className="text-ivory/80">{item}</span>
                    </li>
                  ))}
                </ul>
                <Link href={tier.href}>
                  <Button
                    className={`mt-8 w-full ${
                      tier.featured
                        ? "bg-gold text-obsidian font-semibold hover:bg-gold-dim"
                        : "bg-secondary text-ivory hover:bg-secondary/80"
                    }`}
                  >
                    {tier.cta} <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <div className="evidence-line" data-timestamp="HOSTING COSTS" />

      {/* Hosting — Honest Costs */}
      <section className="py-20 lg:py-28">
        <div className="container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="bg-card rounded border border-border/50 p-6 lg:p-8"
          >
            <div className="flex items-start gap-4 mb-6">
              <Shield className="w-6 h-6 text-gold shrink-0 mt-1" />
              <div>
                <h3 className="font-serif text-xl text-ivory mb-2">Honest Hosting Costs</h3>
                <p className="text-muted-foreground text-[15px] leading-relaxed">
                  We don't mark up infrastructure. You pay exactly what the hosting provider charges.
                  We'll recommend the best option for your needs and help you set it up.
                </p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left py-3 px-4 section-number">What You Get</th>
                    <th className="text-left py-3 px-4 section-number">Provider</th>
                    <th className="text-left py-3 px-4 section-number">Monthly Cost</th>
                    <th className="text-left py-3 px-4 section-number">Best For</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {hostingOptions.map((row) => (
                    <tr key={row.option} className="hover:bg-charcoal/30 transition-colors">
                      <td className="py-3 px-4 font-medium text-ivory">{row.option}</td>
                      <td className="py-3 px-4 text-muted-foreground">{row.provider}</td>
                      <td className="py-3 px-4 font-mono text-gold">{row.cost}</td>
                      <td className="py-3 px-4 text-muted-foreground">{row.best}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Accessibility Note */}
      <section className="py-12">
        <div className="container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="p-6 bg-card rounded border border-gold/20 flex items-start gap-4"
          >
            <Heart className="w-6 h-6 text-gold shrink-0 mt-1" />
            <div>
              <h3 className="font-serif text-lg text-ivory mb-2">We speak human.</h3>
              <p className="text-muted-foreground text-[15px] leading-relaxed">
                Every report, every document, every conversation is in plain English.
                We explain what matters, why it matters, and exactly what to do about it.
                No acronym soup. No consultant-speak. Just clear answers to real questions.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-charcoal/30">
        <div className="container text-center">
          <h2 className="text-2xl font-serif text-ivory mb-4">
            Not sure where to start?
          </h2>
          <p className="text-muted-foreground text-[17px] mb-8 max-w-lg mx-auto">
            Most businesses start with the £99 AI Compliance Audit. It tells you exactly
            where you stand and what to do next — no commitment required.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/audit">
              <Button size="lg" className="bg-gold text-obsidian font-semibold hover:bg-gold-dim px-8 h-12">
                Start with the £99 Audit <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
            <Link href="/contact">
              <Button variant="outline" size="lg" className="border-border/60 text-ivory/80 hover:text-ivory hover:border-gold/40 h-12">
                Or just ask us a question
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
