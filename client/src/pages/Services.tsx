/*
 * Services page — Full service catalog from original Sovereign Sanctuary Systems site.
 * 6 core services + hosting costs table + engagement models.
 * ND-friendly: chunked content, high contrast, progressive disclosure.
 */
import { useAuth } from "@/_core/hooks/useAuth";
import { motion } from "framer-motion";
import { Link } from "wouter";
import {
  Cpu, Brain, Lock, Server, BarChart3, Eye,
  ArrowRight, CheckCircle2, Shield
} from "lucide-react";
import { Button } from "@/components/ui/button";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: [0, 0, 0.2, 1] as const },
  }),
};

const services = [
  {
    icon: Cpu,
    title: "Infrastructure Architecture",
    description: "Zero-SaaS containerised stacks with cryptographic traceability. Multi-node deployments with deterministic, reproducible builds. No vendor lock-in, no silent power accumulation.",
  },
  {
    icon: Brain,
    title: "AI Governance Systems",
    description: "Multi-agent governance kernels with constitutional enforcement, reflexive audit loops, and mathematical coherence verification. Built on Harls Theory.",
  },
  {
    icon: Lock,
    title: "Compliance & Security",
    description: "Evidence-bound compliance frameworks with ALARP risk management, code integrity verification, and cryptographic audit trails. EU AI Act ready.",
  },
  {
    icon: Server,
    title: "Sovereign Hosting",
    description: "Self-hosted infrastructure on your terms. No vendor lock-in, no data sovereignty concerns. From bare metal to managed cloud — you own everything.",
  },
  {
    icon: BarChart3,
    title: "Data Pipeline Engineering",
    description: "Airbyte to dbt to Postgres to Metabase chains with governance-grade data lineage and transformation coherence tracking.",
  },
  {
    icon: Eye,
    title: "System Audit & Assessment",
    description: "Full-spectrum infrastructure audits with gap analysis, blind testing, and actionable remediation roadmaps for operational sovereignty.",
  },
];

const pricingTiers = [
  {
    name: "Assessment",
    price: "£2,500",
    period: "one-off",
    description: "Full-spectrum infrastructure audit with gap analysis and remediation roadmap.",
    features: [
      "Infrastructure audit & blind test",
      "Gap analysis report",
      "Security posture assessment",
      "Remediation roadmap",
      "1-hour debrief call",
    ],
    featured: false,
  },
  {
    name: "Build",
    price: "£7,500",
    period: "/month",
    description: "Sovereign infrastructure design, build, and deployment with ongoing governance.",
    features: [
      "Everything in Assessment",
      "Custom architecture design",
      "Multi-agent deployment",
      "Governance kernel setup",
      "Harls coherence baseline",
      "Monthly governance report",
      "Priority support",
    ],
    featured: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "bespoke",
    description: "Full sovereign transformation for organisations requiring complete operational independence.",
    features: [
      "Everything in Build",
      "Dedicated infrastructure",
      "Custom agent development",
      "Compliance certification",
      "On-site deployment",
      "24/7 operational support",
      "Board-level reporting",
    ],
    featured: false,
  },
];

const hostingOptions = [
  { option: "Static Site", provider: "DigitalOcean App Platform", cost: "$5/mo", best: "Portal-only deployments" },
  { option: "Static + Backend", provider: "DigitalOcean App Platform", cost: "$12/mo", best: "Portal with live coherence metrics" },
  { option: "Full Sovereign", provider: "Hetzner VPS", cost: "€4.51/mo", best: "Maximum control, self-managed" },
  { option: "Global Edge", provider: "Fly.io", cost: "Free tier / $5+/mo", best: "Low-latency global access" },
  { option: "Self-Hosted", provider: "Your own hardware", cost: "Electricity only", best: "Complete sovereignty, zero cloud" },
];

export default function Services() {
  return (
    <div>
      {/* Hero */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-charcoal/50 to-obsidian" />
        <div className="container relative z-10">
          <span className="section-number mb-4 block">SOVEREIGN INFRASTRUCTURE SERVICES</span>
          <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-serif text-ivory leading-[1.1] mb-6">
            From architecture to <span className="text-gold italic">deployment</span>.
          </h1>
          <p className="text-lg text-ivory/70 max-w-2xl leading-relaxed">
            We build systems that are compliance-validated, not just feature-complete.
            Every engagement produces evidence-bound deliverables with cryptographic traceability.
          </p>
        </div>
      </section>

      <div className="evidence-line" data-timestamp="SERVICES" />

      {/* Services Grid */}
      <section className="py-20 lg:py-28">
        <div className="container">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((service, i) => (
              <motion.div
                key={service.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.5 }}
                className="p-8 bg-card rounded border border-border/50 hover:border-gold/30 transition-all duration-300 group"
              >
                <service.icon className="w-8 h-8 text-gold mb-4 group-hover:scale-110 transition-transform" />
                <h3 className="font-serif text-xl text-ivory mb-3">{service.title}</h3>
                <p className="text-muted-foreground text-[15px] leading-relaxed">{service.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <div className="evidence-line" data-timestamp="PRICING" />

      {/* Pricing Tiers */}
      <section className="py-20 lg:py-28 bg-charcoal/30">
        <div className="container">
          <div className="max-w-xl mb-14">
            <span className="section-number">COST STRUCTURES</span>
            <h2 className="text-3xl lg:text-4xl font-serif text-ivory mt-4 mb-4">
              Transparent pricing.
              <br />
              <span className="text-gold italic">No hidden fees.</span>
            </h2>
            <p className="text-muted-foreground text-[17px] leading-relaxed">
              Honest pricing with no markup on infrastructure. Choose the engagement model
              that fits your needs. All prices exclude VAT where applicable.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
            {pricingTiers.map((tier, i) => (
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
                {tier.featured && (
                  <div className="mb-4 px-2.5 py-1 bg-gold/10 border border-gold/20 rounded text-gold text-xs font-mono tracking-wider w-fit">
                    RECOMMENDED
                  </div>
                )}
                <span className="section-number text-gold">{tier.name}</span>
                <div className="mt-3 mb-2">
                  <span className="text-4xl font-serif text-ivory">{tier.price}</span>
                  <span className="text-muted-foreground text-sm ml-2">{tier.period}</span>
                </div>
                <p className="text-muted-foreground text-[15px] leading-relaxed mb-6">{tier.description}</p>
                <ul className="space-y-3 flex-1">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-[15px]">
                      <CheckCircle2 className="w-4 h-4 text-gold mt-0.5 shrink-0" />
                      <span className="text-ivory/80">{f}</span>
                    </li>
                  ))}
                </ul>
                <Link href="/contact">
                  <Button
                    className={`mt-8 w-full ${
                      tier.featured
                        ? "bg-gold text-obsidian font-semibold hover:bg-gold-dim"
                        : "bg-secondary text-ivory hover:bg-secondary/80"
                    }`}
                  >
                    Get Started <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </Link>
              </motion.div>
            ))}
          </div>

          {/* Hosting Costs Table */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mt-12 bg-card rounded border border-border/50 p-6 lg:p-8"
          >
            <h3 className="font-serif text-xl text-ivory mb-2">Infrastructure Hosting Costs</h3>
            <p className="text-muted-foreground text-sm mb-6">
              Sovereign hosting is designed to be cheap and honest. No markup on infrastructure — you pay what the provider charges.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left py-3 px-4 section-number">Option</th>
                    <th className="text-left py-3 px-4 section-number">Provider</th>
                    <th className="text-left py-3 px-4 section-number">Cost</th>
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

      <div className="evidence-line" data-timestamp="ENGAGEMENT" />

      {/* Engagement Timeline */}
      <section className="py-20 lg:py-28">
        <div className="container">
          <div className="max-w-xl mb-14">
            <span className="section-number">ENGAGEMENT TIMELINE</span>
            <h2 className="text-3xl lg:text-4xl font-serif text-ivory mt-4 mb-4">
              How long does it <span className="text-gold italic">take</span>?
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { phase: "Assessment", time: "1–2 weeks", desc: "Full-spectrum audit with gap analysis and remediation roadmap." },
              { phase: "Build", time: "1–3 months", desc: "Custom architecture design, deployment, and governance kernel setup." },
              { phase: "Enterprise", time: "3–6 months", desc: "Full sovereign transformation with dedicated infrastructure and compliance." },
            ].map((item, i) => (
              <motion.div
                key={item.phase}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className="p-6 bg-card rounded border border-border/50"
              >
                <div className="font-mono text-2xl text-gold font-medium mb-2">{item.time}</div>
                <h3 className="font-serif text-lg text-ivory mb-2">{item.phase}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-charcoal/30">
        <div className="container text-center">
          <h2 className="text-2xl font-serif text-ivory mb-4">Ready to build sovereign infrastructure?</h2>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/contact">
              <Button size="lg" className="bg-gold text-obsidian font-semibold hover:bg-gold-dim px-8 h-12">
                Start a Conversation <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
            <Link href="/audit">
              <Button variant="outline" size="lg" className="border-border/60 text-ivory/80 hover:text-ivory hover:border-gold/40 h-12">
                Or start with the £99 AI Audit
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
