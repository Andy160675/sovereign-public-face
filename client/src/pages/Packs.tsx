/*
 * DESIGN: Sovereign Obsidian — Dark Editorial Brutalism
 * Packs page: 5 Operational AI Packs + Compliance Prompt Pack.
 * Layout: Stacked cards with alternating detail levels.
 * ND-friendly: One pack per visual block, clear pricing, minimal decisions.
 */
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Shield, ArrowRight, CheckCircle2, Package, FileText, Cpu, Lock, BarChart3, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const packs = [
  {
    id: "governance",
    icon: Shield,
    title: "AI Governance Pack",
    price: "£1,250",
    tier: "FOUNDATION",
    description: "Complete AI governance framework deployment. Policies, procedures, and accountability structures aligned to the EU AI Act.",
    includes: [
      "AI Governance Policy (customised)",
      "Risk Management Framework",
      "Accountability & Roles Matrix",
      "Board Reporting Templates",
      "Implementation Playbook (90-day)",
    ],
  },
  {
    id: "risk",
    icon: BarChart3,
    title: "Risk Assessment Pack",
    price: "£1,500",
    tier: "OPERATIONAL",
    description: "Systematic AI risk identification, classification, and mitigation. Covers all EU AI Act risk tiers with evidence-bound documentation.",
    includes: [
      "Risk Classification Engine",
      "Impact Assessment Templates",
      "Mitigation Strategy Library",
      "Monitoring & Review Procedures",
      "Regulatory Mapping (EU AI Act Articles)",
    ],
  },
  {
    id: "transparency",
    icon: FileText,
    title: "Transparency & Documentation Pack",
    price: "£1,750",
    tier: "COMPLIANCE",
    description: "Full documentation suite for AI transparency obligations. Technical documentation, user notices, and regulatory filings.",
    includes: [
      "Technical Documentation Templates",
      "User-Facing Transparency Notices",
      "Data Sheet Generator",
      "Model Card Framework",
      "Regulatory Filing Templates",
    ],
  },
  {
    id: "oversight",
    icon: Users,
    title: "Human Oversight Pack",
    price: "£2,000",
    tier: "CONTROL",
    description: "Human-in-the-loop governance systems. Oversight procedures, escalation protocols, and intervention mechanisms.",
    includes: [
      "Human Oversight Procedures",
      "Escalation Protocol Framework",
      "Intervention Mechanism Design",
      "Override & Kill-Switch Procedures",
      "Operator Training Materials",
    ],
  },
  {
    id: "enterprise",
    icon: Cpu,
    title: "Enterprise Sovereign Pack",
    price: "£2,500",
    tier: "SOVEREIGN",
    description: "The complete sovereign AI governance deployment. All four packs unified into a single, evidence-bound enterprise framework.",
    includes: [
      "All 4 Operational Packs included",
      "Cross-pack Integration Layer",
      "Enterprise Dashboard Setup",
      "Quarterly Review Framework",
      "Priority Support Channel",
      "Cryptographic Evidence Chain",
    ],
  },
];

export default function Packs() {
  return (
    <div>
      {/* Hero */}
      <section className="relative min-h-[60vh] flex items-center overflow-hidden">
        <div className="absolute inset-0">
          <img
            src="https://d2xsxph8kpxj0f.cloudfront.net/310519663109929189/SjdwYSpMAPPcwToiUcu6zA/hero-packs-BHJRek4KxtqsDYRDYvSiHg.webp"
            alt=""
            className="w-full h-full object-cover"
            loading="eager"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-obsidian via-obsidian/85 to-obsidian/50" />
          <div className="absolute inset-0 bg-gradient-to-t from-obsidian via-transparent to-obsidian/20" />
        </div>

        <div className="container relative z-10 pt-32 pb-20">
          <div className="max-w-2xl">
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="section-number"
            >
              OPERATIONAL AI PACKS
            </motion.span>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.6 }}
              className="text-4xl sm:text-5xl lg:text-[3.5rem] font-serif text-ivory leading-[1.1] mt-4 mb-6"
            >
              Deployment-ready
              <br />
              <span className="text-gold italic">governance packs</span>.
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="text-lg text-ivory/70 max-w-lg leading-relaxed"
            >
              Five sovereign-grade packs covering every aspect of AI governance.
              Each is self-contained, evidence-bound, and yours to own forever.
            </motion.p>
          </div>
        </div>
      </section>

      {/* Evidence Line */}
      <div className="evidence-line" data-timestamp="OPERATIONAL PACKS" />

      {/* Packs Grid */}
      <section className="py-20 lg:py-28">
        <div className="container">
          <div className="space-y-6">
            {packs.map((pack, i) => (
              <motion.div
                key={pack.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.5 }}
                className={`p-8 lg:p-10 bg-card rounded border transition-colors ${
                  pack.id === "enterprise"
                    ? "border-gold/30 hover:border-gold/50"
                    : "border-border/50 hover:border-border"
                }`}
              >
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                  {/* Left: Info */}
                  <div className="lg:col-span-7">
                    <div className="flex items-center gap-3 mb-4">
                      <pack.icon className="w-6 h-6 text-gold" />
                      <span className="font-mono text-xs text-gold/60 tracking-wider">{pack.tier}</span>
                      {pack.id === "enterprise" && (
                        <span className="px-2 py-0.5 bg-gold/10 border border-gold/20 rounded text-gold text-xs font-mono">
                          BEST VALUE
                        </span>
                      )}
                    </div>
                    <h3 className="font-serif text-2xl text-ivory mb-3">{pack.title}</h3>
                    <p className="text-muted-foreground text-[16px] leading-relaxed max-w-lg">
                      {pack.description}
                    </p>
                  </div>

                  {/* Right: Pricing + Includes */}
                  <div className="lg:col-span-5">
                    <div className="flex items-baseline gap-2 mb-5">
                      <span className="font-mono text-3xl text-gold font-medium">{pack.price}</span>
                      <span className="text-muted-foreground text-sm">one-time</span>
                    </div>
                    <div className="space-y-2.5 mb-6">
                      {pack.includes.map((item) => (
                        <div key={item} className="flex items-start gap-2.5">
                          <CheckCircle2 className="w-4 h-4 text-gold/70 mt-0.5 shrink-0" />
                          <span className="text-ivory/70 text-[14px]">{item}</span>
                        </div>
                      ))}
                    </div>
                    <Button
                      className="bg-gold text-obsidian font-semibold hover:bg-gold-dim transition-all duration-200 active:scale-[0.98] text-[14px]"
                      onClick={() => toast.info("Stripe checkout integration coming soon. Contact us to proceed.")}
                    >
                      Purchase Pack
                      <ArrowRight className="ml-2 w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Evidence Line */}
      <div className="evidence-line" data-timestamp="PROMPT PACK" />

      {/* Compliance Prompt Pack */}
      <section className="py-20 lg:py-28 bg-charcoal/30">
        <div className="container">
          <div className="max-w-lg mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="p-8 lg:p-10 bg-card rounded border border-border/50"
            >
              <Package className="w-8 h-8 text-gold mx-auto mb-4" />
              <span className="section-number">DIGITAL PRODUCT</span>
              <h3 className="font-serif text-2xl text-ivory mt-3 mb-2">Compliance Prompt Pack</h3>
              <div className="flex items-baseline justify-center gap-2 mb-4">
                <span className="font-mono text-4xl text-gold font-medium">£29</span>
                <span className="text-muted-foreground text-sm">instant download</span>
              </div>
              <p className="text-muted-foreground text-[15px] leading-relaxed mb-6">
                47 battle-tested prompts for AI governance, risk assessment, compliance documentation,
                and regulatory analysis. Works with any LLM.
              </p>
              <div className="space-y-2 text-left mb-8">
                {[
                  "47 compliance-specific prompts",
                  "Risk assessment prompt chains",
                  "Documentation generation prompts",
                  "Regulatory analysis templates",
                  "Instant PDF download",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-gold/70 mt-0.5 shrink-0" />
                    <span className="text-ivory/70 text-[14px]">{item}</span>
                  </div>
                ))}
              </div>
              <Button
                className="w-full bg-gold text-obsidian font-semibold hover:bg-gold-dim transition-all duration-200 active:scale-[0.98] h-11 text-[14px]"
                onClick={() => toast.info("Stripe checkout integration coming soon. Contact us to proceed.")}
              >
                Download Prompt Pack — £29
              </Button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-16">
        <div className="container text-center">
          <p className="text-muted-foreground text-[15px] mb-4">
            Not sure which pack you need? Start with the £99 audit to identify your gaps.
          </p>
          <Link href="/audit">
            <Button
              variant="outline"
              className="border-border/60 text-ivory/80 hover:text-ivory hover:border-gold/40 text-[15px]"
            >
              Start with the £99 Audit
              <ArrowRight className="ml-2 w-3.5 h-3.5" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
