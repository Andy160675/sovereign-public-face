/*
 * DESIGN: Sovereign Obsidian — Dark Editorial Brutalism
 * About page: Sovereign credentials, trust framework, company story.
 * ND-friendly: Chunked sections, clear hierarchy, no walls of text.
 */
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Shield, ArrowRight, CheckCircle2, Lock, Cpu, Globe, FileCheck, Users, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

const credentials = [
  { icon: Globe, title: "EU AI Act Expertise", desc: "Deep operational knowledge of the EU Artificial Intelligence Act, including risk classification, conformity assessment, and regulatory reporting requirements." },
  { icon: Lock, title: "Zero-SaaS Architecture", desc: "Every system we build is sovereign. No third-party dependencies, no vendor lock-in, no data leaving your control. Your infrastructure, your rules." },
  { icon: FileCheck, title: "Evidence-Bound Delivery", desc: "Every deliverable is cryptographically sealed with SHA-256 hash chains. Court-admissible documentation with full provenance tracking." },
  { icon: Cpu, title: "Sovereign Infrastructure", desc: "Multi-node deployment architecture with Pentad cluster governance. Bare-metal, containerised, and cryptographically traceable." },
  { icon: Users, title: "Human Oversight by Design", desc: "AI systems must serve humans, not replace them. Every framework includes mandatory human oversight checkpoints and intervention mechanisms." },
  { icon: Zap, title: "Operational Velocity", desc: "24-hour audit delivery. 90-day governance deployment. We operate at the speed of business, not the speed of consultancy." },
];

const principles = [
  { num: "01", title: "Sovereignty First", desc: "Your data, your systems, your control. We build for independence, not dependence." },
  { num: "02", title: "Evidence Over Promises", desc: "Every claim is backed by cryptographic evidence. Every deliverable is verifiable." },
  { num: "03", title: "Human-Centric Design", desc: "Neurodivergent-friendly, accessible, intuitive. Technology should reduce cognitive load, not increase it." },
  { num: "04", title: "No Corporate Greed", desc: "Fair pricing, transparent scope, no hidden fees. Sovereign forever — not just until the next funding round." },
];

export default function About() {
  return (
    <div>
      {/* Hero */}
      <section className="relative min-h-[60vh] flex items-center overflow-hidden">
        <div className="absolute inset-0">
          <img
            src="https://d2xsxph8kpxj0f.cloudfront.net/310519663109929189/SjdwYSpMAPPcwToiUcu6zA/hero-about-MDcZFHTYh887xH2dxcPnDi.webp"
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
              ABOUT SOVEREIGN SANCTUARY
            </motion.span>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.6 }}
              className="text-4xl sm:text-5xl lg:text-[3.5rem] font-serif text-ivory leading-[1.1] mt-4 mb-6"
            >
              Built by operators.
              <br />
              <span className="text-gold italic">For operators.</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="text-lg text-ivory/70 max-w-lg leading-relaxed"
            >
              Sovereign Sanctuary Systems exists because the AI governance industry is broken.
              Too many consultancies sell fear. We sell clarity, evidence, and operational sovereignty.
            </motion.p>
          </div>
        </div>
      </section>

      {/* Evidence Line */}
      <div className="evidence-line" data-timestamp="CREDENTIALS" />

      {/* Credentials */}
      <section className="py-20 lg:py-28">
        <div className="container">
          <div className="max-w-xl mb-14">
            <span className="section-number">01 — CREDENTIALS</span>
            <h2 className="text-3xl lg:text-4xl font-serif text-ivory mt-4 mb-4">
              What we <span className="text-gold italic">bring to the table</span>.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {credentials.map((cred, i) => (
              <motion.div
                key={cred.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.5 }}
                className="p-6 bg-card rounded border border-border/50"
              >
                <cred.icon className="w-7 h-7 text-gold mb-4" />
                <h3 className="font-serif text-lg text-ivory mb-2">{cred.title}</h3>
                <p className="text-muted-foreground text-[15px] leading-relaxed">{cred.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Evidence Line */}
      <div className="evidence-line" data-timestamp="PRINCIPLES" />

      {/* Principles */}
      <section className="py-20 lg:py-28 bg-charcoal/30">
        <div className="container">
          <div className="max-w-xl mb-14">
            <span className="section-number">02 — OPERATING PRINCIPLES</span>
            <h2 className="text-3xl lg:text-4xl font-serif text-ivory mt-4 mb-4">
              How we <span className="text-gold italic">operate</span>.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {principles.map((p, i) => (
              <motion.div
                key={p.num}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className="flex gap-6"
              >
                <div className="font-mono text-4xl text-gold/15 font-bold shrink-0">{p.num}</div>
                <div>
                  <h3 className="font-serif text-xl text-ivory mb-2">{p.title}</h3>
                  <p className="text-muted-foreground text-[15px] leading-relaxed">{p.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Evidence Line */}
      <div className="evidence-line" data-timestamp="TECHNOLOGY" />

      {/* Tech Stack */}
      <section className="py-20 lg:py-28">
        <div className="container">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            <div className="lg:col-span-5">
              <span className="section-number">03 — TECHNOLOGY</span>
              <h2 className="text-3xl lg:text-4xl font-serif text-ivory mt-4 mb-6">
                Sovereign <span className="text-gold italic">by design</span>.
              </h2>
              <p className="text-muted-foreground text-[17px] leading-relaxed">
                Our infrastructure runs on bare-metal, containerised stacks with zero third-party
                dependencies. Every deployment is cryptographically traceable, every data flow
                is evidence-bound, and every system is designed for full offline and online sovereignty.
              </p>
            </div>

            <div className="lg:col-span-7">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { label: "Infrastructure", value: "Bare-metal + Docker" },
                  { label: "Orchestration", value: "Pentad Cluster" },
                  { label: "Database", value: "PostgreSQL + Drizzle" },
                  { label: "Evidence Chain", value: "SHA-256 Hash Chain" },
                  { label: "Networking", value: "WireGuard + Tailscale" },
                  { label: "Monitoring", value: "Sovereign Health Tracker" },
                  { label: "CI/CD", value: "GitHub Actions + Git" },
                  { label: "Frontend", value: "React + TypeScript" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-3 p-4 bg-card rounded border border-border/50">
                    <CheckCircle2 className="w-4 h-4 text-gold shrink-0" />
                    <div>
                      <div className="text-ivory/60 text-xs font-mono tracking-wider">{item.label}</div>
                      <div className="text-ivory text-[15px] font-medium">{item.value}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-16 bg-charcoal/30">
        <div className="container text-center">
          <h3 className="font-serif text-2xl text-ivory mb-4">Ready to get started?</h3>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/audit">
              <Button className="bg-gold text-obsidian font-semibold hover:bg-gold-dim transition-all duration-200 active:scale-[0.98] text-[15px]">
                Get Your £99 Audit
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
            <Link href="/book">
              <Button variant="outline" className="border-border/60 text-ivory/80 hover:text-ivory hover:border-gold/40 text-[15px]">
                Book a Strategy Call
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
