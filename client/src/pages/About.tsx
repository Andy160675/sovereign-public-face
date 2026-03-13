/*
 * About page — SME-targeted "why us" pitch.
 * Speaks to business owners who need to trust us before buying.
 * Flow: Story → Credentials → Why not Big 4 → Principles → CTA
 * ND-friendly: Chunked sections, clear hierarchy, no walls of text.
 */
import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  Shield, ArrowRight, CheckCircle2, Lock, Cpu, Globe,
  FileCheck, Users, Zap, Heart, AlertTriangle, TrendingDown,
  Award, Clock, Building2, Briefcase
} from "lucide-react";
import { Button } from "@/components/ui/button";

/* ── WHY NOT BIG 4 — the differentiator ── */
const comparison = [
  { them: "£50K+ engagement fee", us: "Start at £99" },
  { them: "6-month timeline", us: "24-hour audit delivery" },
  { them: "Junior consultants doing the work", us: "Senior architect, direct access" },
  { them: "Generic framework, copy-pasted", us: "Tailored to your specific AI systems" },
  { them: "PDF report, no follow-up", us: "Evidence-bound, cryptographically sealed" },
  { them: "Lock you into annual retainers", us: "Pay for what you need, when you need it" },
];

/* ── CREDENTIALS — real, verifiable ── */
const credentials = [
  { icon: Briefcase, title: "25+ Years Senior Leadership", desc: "Aerospace, defence, financial services, and technology. Real operational experience in regulated industries where compliance isn't optional." },
  { icon: Globe, title: "EU AI Act Specialist", desc: "Deep operational knowledge of the EU Artificial Intelligence Act — risk classification, conformity assessment, and what regulators actually look for." },
  { icon: Lock, title: "Cybersecurity & Data Governance", desc: "ISO 27001 aligned, GDPR Article 22 compliant. We don't just talk about security — we build systems with cryptographic evidence chains." },
  { icon: Cpu, title: "Sovereign Infrastructure Architect", desc: "We build and operate our own multi-node infrastructure. No vendor lock-in, no third-party dependencies. Your data stays yours." },
  { icon: Award, title: "Neurodivergent-Led", desc: "Founded by a neurodivergent systems architect. We understand that good governance needs to be accessible, clear, and human-friendly — not just technically correct." },
  { icon: Heart, title: "Human Oversight Advocate", desc: "AI must serve humans, not replace them. Every framework we build includes mandatory human oversight checkpoints because that's what the law requires — and what's right." },
];

/* ── PRINCIPLES — what we stand for ── */
const principles = [
  { num: "01", title: "Plain English, Always", desc: "Every report, every document, every conversation. If you can't understand it, it's useless. We explain what matters, why it matters, and what to do about it." },
  { num: "02", title: "Evidence Over Promises", desc: "Every claim we make is backed by verifiable evidence. Every deliverable is cryptographically sealed. No hand-waving, no trust-me-bro consultancy." },
  { num: "03", title: "Fair Pricing, No Lock-In", desc: "Transparent pricing, no hidden fees, no annual retainers you can't escape. Pay for what you need. If you outgrow us, we'll help you transition." },
  { num: "04", title: "Accessibility First", desc: "Our systems are designed for neurodivergent users from the ground up. High contrast, clear hierarchy, progressive disclosure. Good design serves everyone." },
];

export default function About() {
  return (
    <div>
      {/* Hero — The Story */}
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
              WHY WE EXIST
            </motion.span>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.6 }}
              className="text-4xl sm:text-5xl lg:text-[3.5rem] font-serif text-ivory leading-[1.1] mt-4 mb-6"
            >
              Because SMEs deserve
              <br />
              <span className="text-gold italic">better than Big 4 leftovers.</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="text-lg text-ivory/70 max-w-lg leading-relaxed"
            >
              The AI governance industry charges enterprise prices for template-driven advice.
              We built Sovereign Sanctuary Systems because small and medium businesses deserve
              the same quality of compliance support — at prices that don't require a funding round.
            </motion.p>
          </div>
        </div>
      </section>

      <div className="evidence-line" data-timestamp="THE FOUNDER" />

      {/* Founder — Andrew Jones */}
      <section className="py-20 lg:py-28">
        <div className="container">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            <div className="lg:col-span-5">
              <span className="section-number">MEET THE FOUNDER</span>
              <h2 className="text-3xl lg:text-4xl font-serif text-ivory mt-4 mb-6">
                Andy Jones
              </h2>
              <p className="text-muted-foreground text-[17px] leading-relaxed mb-4">
                Sovereign Systems Architect with 25+ years of senior leadership experience
                across aerospace, defence, financial services, and technology.
              </p>
              <p className="text-muted-foreground text-[17px] leading-relaxed mb-4">
                Andy founded Sovereign Sanctuary Systems after seeing too many SMEs
                get priced out of proper AI governance. The big consultancies charge
                £50K+ for work that a senior architect can deliver in days, not months.
              </p>
              <p className="text-muted-foreground text-[17px] leading-relaxed mb-6">
                As a neurodivergent founder, Andy brings a different perspective to
                compliance and governance — one that prioritises clarity, accessibility,
                and practical outcomes over consultant-speak and PowerPoint decks.
              </p>

              <div className="space-y-3">
                {[
                  "Sovereign Sanctuary Systems Ltd (UK)",
                  "Sovereign Sanctuary Systems SL (Tenerife)",
                  "EU AI Act Compliance Specialist",
                  "ISO 27001 Aligned Operations",
                  "Neurodivergent-Led Business",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-gold shrink-0" />
                    <span className="text-ivory/80 text-[15px]">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-7">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {credentials.map((cred, i) => (
                  <motion.div
                    key={cred.title}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.08, duration: 0.5 }}
                    className="p-5 bg-card rounded border border-border/50"
                  >
                    <cred.icon className="w-6 h-6 text-gold mb-3" />
                    <h3 className="font-serif text-base text-ivory mb-1.5">{cred.title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">{cred.desc}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="evidence-line" data-timestamp="WHY NOT BIG 4" />

      {/* Why Not Big 4 — The Differentiator */}
      <section className="py-20 lg:py-28 bg-charcoal/30">
        <div className="container">
          <div className="max-w-xl mb-14">
            <span className="section-number">THE HONEST COMPARISON</span>
            <h2 className="text-3xl lg:text-4xl font-serif text-ivory mt-4 mb-4">
              Big consultancy vs.{" "}
              <span className="text-gold italic">us.</span>
            </h2>
            <p className="text-muted-foreground text-[17px] leading-relaxed">
              We're not trying to be Deloitte. We're trying to give you what Deloitte
              charges £50K for — but faster, clearer, and at a price that makes sense
              for a business your size.
            </p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="bg-card rounded border border-border/50 overflow-hidden"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left py-4 px-6 section-number text-red-400/80">BIG CONSULTANCY</th>
                    <th className="text-left py-4 px-6 section-number text-gold">SOVEREIGN SANCTUARY</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {comparison.map((row, i) => (
                    <tr key={i} className="hover:bg-charcoal/30 transition-colors">
                      <td className="py-3.5 px-6 text-ivory/50 flex items-center gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-red-400/50 shrink-0" />
                        {row.them}
                      </td>
                      <td className="py-3.5 px-6 text-ivory font-medium flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-gold shrink-0" />
                        {row.us}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        </div>
      </section>

      <div className="evidence-line" data-timestamp="PRINCIPLES" />

      {/* Principles */}
      <section className="py-20 lg:py-28">
        <div className="container">
          <div className="max-w-xl mb-14">
            <span className="section-number">HOW WE WORK</span>
            <h2 className="text-3xl lg:text-4xl font-serif text-ivory mt-4 mb-4">
              Four rules we{" "}
              <span className="text-gold italic">never break.</span>
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

      {/* Company Structure */}
      <section className="py-12">
        <div className="container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="p-6 bg-card rounded border border-border/50"
          >
            <div className="flex items-start gap-4">
              <Building2 className="w-6 h-6 text-gold shrink-0 mt-1" />
              <div>
                <h3 className="font-serif text-lg text-ivory mb-3">Company Structure</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[15px]">
                  <div>
                    <div className="text-gold/60 text-xs font-mono tracking-wider mb-1">UK ENTITY</div>
                    <div className="text-ivory">Sovereign Sanctuary Systems Ltd</div>
                    <div className="text-muted-foreground text-sm">Registered in England & Wales</div>
                  </div>
                  <div>
                    <div className="text-gold/60 text-xs font-mono tracking-wider mb-1">TENERIFE ENTITY</div>
                    <div className="text-ivory">Sovereign Sanctuary Systems SL</div>
                    <div className="text-muted-foreground text-sm">Registered in Tenerife, Canary Islands</div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-16 bg-charcoal/30">
        <div className="container text-center">
          <h3 className="font-serif text-2xl text-ivory mb-4">
            Still not sure? Start with the £99 audit.
          </h3>
          <p className="text-muted-foreground text-[17px] mb-8 max-w-lg mx-auto">
            It's the lowest-risk way to see how we work. If the report doesn't give you
            clear, actionable value — we'll refund it. No questions asked.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/audit">
              <Button className="bg-gold text-obsidian font-semibold hover:bg-gold-dim transition-all duration-200 active:scale-[0.98] text-[15px] h-12 px-8">
                Get Your £99 Audit
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
            <Link href="/contact">
              <Button variant="outline" className="border-border/60 text-ivory/80 hover:text-ivory hover:border-gold/40 text-[15px] h-12">
                Or just ask us a question
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
