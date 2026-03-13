/*
 * Team page — Company structure, key personnel, and the Sovereign Elite OS story.
 * Content sourced from PA_HANDOVER and PublicLanding.tsx original site.
 * ND-friendly: clear sections, generous spacing, no cognitive overload.
 */
import { motion } from "framer-motion";
import { Link } from "wouter";
import {
  Shield, Globe, Zap, Lock, Users, Building2,
  MapPin, ArrowRight, Brain, Server, Eye
} from "lucide-react";
import { Button } from "@/components/ui/button";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: [0, 0, 0.2, 1] as const },
  }),
};

const teamMembers = [
  {
    name: "Andrew Jones",
    role: "Founder & Systems Architect",
    location: "Tenerife, Spain",
    description: "Elite systems developer (top 0.001%). Architect of Sovereign Elite OS, the Harls Theory mathematical framework, and the zero-SaaS operational doctrine. 25+ years in enterprise infrastructure.",
    tags: ["Infrastructure", "AI Governance", "Harls Theory", "Zero-SaaS"],
  },

];

const companyEntities = [
  {
    name: "Sovereign Sanctuary Systems",
    jurisdiction: "England & Wales",
    type: "UK Limited Company",
    domain: "sovereignsanctuarysystems.co.uk",
    focus: "Enterprise AI governance, compliance audits, and sovereign infrastructure consulting.",
    icon: Building2,
  },
  {
    name: "Sovereign Sanctuary Systems SL",
    jurisdiction: "Tenerife, Spain",
    type: "Sociedad Limitada",
    domain: "sovereignsanctuarysystemstenerife.com",
    focus: "Local IT infrastructure, NAS deployment, network architecture, and Canary Islands operations.",
    icon: MapPin,
  },
];

const coreValues = [
  { icon: Globe, label: "Sovereign", desc: "Zero external dependencies. You own everything." },
  { icon: Shield, label: "Governed", desc: "Constitutional enforcement with mathematical verification." },
  { icon: Zap, label: "Verified", desc: "28/30 blind test baseline. C=0.933 coherence score." },
  { icon: Lock, label: "Traceable", desc: "Cryptographic audit trail on every operation." },
];

const agentFleet = [
  { name: "Governance Kernel", role: "Constitutional enforcement and policy execution" },
  { name: "Audit Agent", role: "Continuous compliance monitoring and evidence collection" },
  { name: "Security Agent", role: "Threat detection, access control, and integrity verification" },
  { name: "Data Agent", role: "Pipeline orchestration and transformation coherence" },
  { name: "Deployment Agent", role: "Deterministic builds and infrastructure provisioning" },
  { name: "Intelligence Agent", role: "Pattern recognition and operational analytics" },
];

export default function Team() {
  return (
    <div>
      {/* Hero */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-charcoal/50 to-obsidian" />
        <div className="container relative z-10">
          <span className="section-number mb-4 block">THE TEAM BEHIND THE SYSTEM</span>
          <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-serif text-ivory leading-[1.1] mb-6">
            Built by <span className="text-gold italic">operators</span>,
            <br />not theorists.
          </h1>
          <p className="text-lg text-ivory/70 max-w-2xl leading-relaxed">
            Sovereign Sanctuary Systems is a lean, high-output operation. Every system we build,
            we run. Every framework we sell, we use. No consultancy theatre — just working infrastructure.
          </p>
        </div>
      </section>

      <div className="evidence-line" data-timestamp="SECTION 01 — PEOPLE" />

      {/* Team Members */}
      <section className="py-20 lg:py-28">
        <div className="container">
          <div className="max-w-xl mb-14">
            <span className="section-number">01 — KEY PERSONNEL</span>
            <h2 className="text-3xl lg:text-4xl font-serif text-ivory mt-4 mb-4">
              The <span className="text-gold italic">people</span> behind the doctrine.
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {teamMembers.map((member, i) => (
              <motion.div
                key={member.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className="p-8 bg-card rounded border border-border/50"
              >
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-14 h-14 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0">
                    <Users className="w-6 h-6 text-gold" />
                  </div>
                  <div>
                    <h3 className="font-serif text-xl text-ivory">{member.name}</h3>
                    <p className="text-gold text-sm font-mono">{member.role}</p>
                    <p className="text-muted-foreground text-xs flex items-center gap-1 mt-1">
                      <MapPin className="w-3 h-3" /> {member.location}
                    </p>
                  </div>
                </div>
                <p className="text-muted-foreground text-[15px] leading-relaxed mb-4">
                  {member.description}
                </p>
                <div className="flex flex-wrap gap-2">
                  {member.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs font-mono text-gold/80 bg-gold/5 border border-gold/10 rounded px-2.5 py-1"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <div className="evidence-line" data-timestamp="SECTION 02 — ENTITIES" />

      {/* Company Entities */}
      <section className="py-20 lg:py-28 bg-charcoal/30">
        <div className="container">
          <div className="max-w-xl mb-14">
            <span className="section-number">02 — CORPORATE STRUCTURE</span>
            <h2 className="text-3xl lg:text-4xl font-serif text-ivory mt-4 mb-4">
              Two entities. <span className="text-gold italic">One doctrine.</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {companyEntities.map((entity, i) => (
              <motion.div
                key={entity.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className="p-8 bg-card rounded border border-border/50"
              >
                <entity.icon className="w-8 h-8 text-gold mb-4" />
                <h3 className="font-serif text-xl text-ivory mb-1">{entity.name}</h3>
                <div className="flex flex-wrap gap-3 mb-4">
                  <span className="text-xs font-mono text-muted-foreground bg-secondary rounded px-2 py-1">{entity.jurisdiction}</span>
                  <span className="text-xs font-mono text-muted-foreground bg-secondary rounded px-2 py-1">{entity.type}</span>
                </div>
                <p className="text-muted-foreground text-[15px] leading-relaxed mb-3">{entity.focus}</p>
                <p className="text-gold text-sm font-mono">{entity.domain}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <div className="evidence-line" data-timestamp="SECTION 03 — SYSTEM" />

      {/* Sovereign Elite OS */}
      <section className="py-20 lg:py-28">
        <div className="container">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
            <div className="lg:col-span-5">
              <span className="section-number">03 — SOVEREIGN ELITE OS</span>
              <h2 className="text-3xl lg:text-4xl font-serif text-ivory mt-4 mb-6">
                The system that <span className="text-gold italic">governs itself</span>.
              </h2>
              <p className="text-muted-foreground text-[17px] leading-relaxed mb-4">
                Sovereign Elite OS is a governance-first operating system architecture built from first principles.
                It combines a 6-agent microservice fleet with a constitutional governance kernel, mathematical
                coherence verification (Harls Theory), and cryptographic audit trails.
              </p>
              <p className="text-muted-foreground text-[17px] leading-relaxed mb-6">
                The system has been independently blind-tested at 28/30 (C=0.933), with all governance kernel
                checks passing. Our mathematical foundation, the Universal Information-Preservation Law,
                provides a rigorous framework: <span className="text-gold italic">"Truth is what survives transformation."</span>
              </p>

              <div className="grid grid-cols-2 gap-4">
                {coreValues.map((item) => (
                  <div key={item.label} className="p-4 bg-card rounded border border-border/50 text-center">
                    <item.icon className="w-6 h-6 text-gold mx-auto mb-2" />
                    <p className="text-sm font-semibold text-ivory">{item.label}</p>
                    <p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-7">
              <h3 className="font-serif text-xl text-ivory mb-6">The 6-Agent Fleet</h3>
              <div className="space-y-3">
                {agentFleet.map((agent, i) => (
                  <motion.div
                    key={agent.name}
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.08, duration: 0.4 }}
                    className="flex items-start gap-4 p-4 bg-card rounded border border-border/50"
                  >
                    <div className="w-8 h-8 rounded bg-gold/10 flex items-center justify-center shrink-0">
                      <Brain className="w-4 h-4 text-gold" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-ivory">{agent.name}</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">{agent.role}</p>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8">
                {[
                  { value: "28/30", label: "Blind Test" },
                  { value: "0.933", label: "Coherence" },
                  { value: "6", label: "Agents" },
                  { value: "0", label: "Dependencies" },
                ].map((stat) => (
                  <div key={stat.label} className="p-4 bg-card rounded border border-border/50 text-center">
                    <div className="font-mono text-xl text-gold font-medium">{stat.value}</div>
                    <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-charcoal/30">
        <div className="container text-center">
          <h2 className="text-2xl font-serif text-ivory mb-4">Want to work with us?</h2>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/contact">
              <Button size="lg" className="bg-gold text-obsidian font-semibold hover:bg-gold-dim px-8 h-12">
                Get in Touch <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
            <Link href="/services">
              <Button variant="outline" size="lg" className="border-border/60 text-ivory/80 hover:text-ivory hover:border-gold/40 h-12">
                View Our Services
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
