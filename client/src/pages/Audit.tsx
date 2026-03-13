/*
 * AI Audit page — SME-targeted compliance funnel.
 * Speaks directly to SME pain points:
 *   "Will I get fined?" → "How much?" → "How fast can I fix it?" → "Why trust you?"
 * Progressive disclosure: Pain → Solution → What's Included → Process → Pricing → CTA
 * ND-friendly: Chunked content, clear visual hierarchy, single primary CTA.
 */
import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  Shield, CheckCircle2, ArrowRight, Clock, FileText,
  AlertTriangle, BarChart3, Lock, Zap, Loader2,
  XCircle, TrendingDown, Building2, Users, Heart
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { toast } from "sonner";
import { useState } from "react";

/* ── WHAT YOU GET — plain English ── */
const auditIncludes = [
  {
    icon: BarChart3,
    title: "AI System Inventory",
    desc: "We list every AI tool your business uses — ChatGPT, automated hiring, customer chatbots, recommendation engines — and classify each one by risk level.",
  },
  {
    icon: FileText,
    title: "Compliance Gap Report",
    desc: "A clear, plain-English report showing exactly where you're compliant, where you're not, and how serious each gap is. No jargon, no ambiguity.",
  },
  {
    icon: AlertTriangle,
    title: "90-Day Fix Plan",
    desc: "Step-by-step remediation roadmap with specific tasks, who should do them, and realistic deadlines. Designed for businesses without a compliance team.",
  },
  {
    icon: Lock,
    title: "Evidence Package",
    desc: "Cryptographically sealed audit trail that proves when the assessment was done and what was found. The kind of evidence that holds up if a regulator asks.",
  },
  {
    icon: Shield,
    title: "Governance Template",
    desc: "A ready-to-use AI governance policy customised to your business. Fill in the blanks, get your team to sign it, and you've got a governance framework.",
  },
  {
    icon: Zap,
    title: "24-Hour Delivery",
    desc: "Complete report delivered within 24 hours of you completing the questionnaire. Not 24 business days. Not 24 weeks. 24 hours.",
  },
];

/* ── FAQ — real questions SMEs ask ── */
const faqs = [
  {
    q: "Does the EU AI Act apply to my business?",
    a: "If your business uses AI tools (including ChatGPT, automated email, chatbots, or any AI-powered software) and you operate in or sell to the EU — yes, it almost certainly applies to you. The audit will tell you exactly how.",
  },
  {
    q: "What happens if I do nothing?",
    a: "Fines of up to €35 million or 7% of global turnover — whichever is higher. The first enforcement deadline is February 2025 for prohibited practices, with full compliance required by August 2026. The clock is ticking.",
  },
  {
    q: "I'm a small business. Can't I just ignore this?",
    a: "The EU AI Act applies to all businesses regardless of size. There are some lighter requirements for SMEs, but you still need to know which rules apply to you. The £99 audit tells you exactly that.",
  },
  {
    q: "How is this different from hiring a consultant?",
    a: "A Big 4 firm will charge you £50K+ and take 6 months. We deliver the same risk classification and gap analysis in 24 hours for £99. If you need more help after that, we offer governance packs from £1,250.",
  },
  {
    q: "What do I need to prepare?",
    a: "Nothing complicated. After purchase, you'll fill in a 15-minute questionnaire about the AI tools your business uses. We do the rest.",
  },
];

export default function Audit() {
  const { isAuthenticated } = useAuth();
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const createSession = trpc.checkout.createSession.useMutation({
    onSuccess: (data) => {
      if (data.url) {
        toast.info("Redirecting to secure checkout...");
        window.open(data.url, "_blank");
      }
      setIsCheckingOut(false);
    },
    onError: (error) => {
      toast.error(error.message || "Checkout failed. Please try again.");
      setIsCheckingOut(false);
    },
  });

  const handleCheckout = () => {
    if (!isAuthenticated) {
      window.location.href = getLoginUrl();
      return;
    }
    setIsCheckingOut(true);
    createSession.mutate({ productId: "ai-compliance-audit" });
  };

  return (
    <div>
      {/* Hero — Lead with the pain */}
      <section className="relative min-h-[70vh] flex items-center overflow-hidden">
        <div className="absolute inset-0">
          <img
            src="https://d2xsxph8kpxj0f.cloudfront.net/310519663109929189/SjdwYSpMAPPcwToiUcu6zA/hero-audit-8ZPQE9GBCMx38vEM8jBgNa.webp"
            alt=""
            className="w-full h-full object-cover"
            loading="eager"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-obsidian via-obsidian/85 to-obsidian/50" />
          <div className="absolute inset-0 bg-gradient-to-t from-obsidian via-transparent to-obsidian/20" />
        </div>

        <div className="container relative z-10 pt-32 pb-20">
          <div className="max-w-2xl">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-xs font-mono tracking-wider mb-6"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              EU AI ACT ENFORCEMENT BEGINS 2025
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.6 }}
              className="text-4xl sm:text-5xl lg:text-[3.5rem] font-serif text-ivory leading-[1.1] mb-6"
            >
              Will your business
              <br />
              get fined?{" "}
              <span className="text-gold italic">Find out for £99.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="text-lg text-ivory/70 max-w-lg mb-4 leading-relaxed"
            >
              The EU AI Act is now law. Fines start at €35 million. Most SMEs don't
              know if they're compliant — or even which rules apply to them.
            </motion.p>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.6 }}
              className="text-lg text-ivory/90 max-w-lg mb-8 leading-relaxed font-medium"
            >
              Our £99 AI Compliance Audit tells you exactly where you stand — in plain English,
              delivered in 24 hours.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6"
            >
              <Button
                size="lg"
                className="bg-gold text-obsidian font-semibold hover:bg-gold-dim transition-all duration-200 active:scale-[0.98] px-8 h-12 text-[15px]"
                onClick={() => {
                  const el = document.getElementById("pricing");
                  el?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                Check My Compliance — £99
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
              <div className="flex items-center gap-4 text-muted-foreground text-sm">
                <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" /> 24hr delivery</span>
                <span className="flex items-center gap-1.5"><Shield className="w-4 h-4" /> Money-back guarantee</span>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <div className="evidence-line" data-timestamp="THE PROBLEM" />

      {/* The Problem — Compliance Anxiety */}
      <section className="py-20 lg:py-28 bg-charcoal/30">
        <div className="container">
          <div className="max-w-xl mb-14">
            <span className="section-number">THE PROBLEM</span>
            <h2 className="text-3xl lg:text-4xl font-serif text-ivory mt-4 mb-4">
              Most SMEs are flying blind on{" "}
              <span className="text-gold italic">AI compliance.</span>
            </h2>
            <p className="text-muted-foreground text-[17px] leading-relaxed">
              You're using ChatGPT, automated emails, AI chatbots, or recommendation
              engines. But do you know which EU AI Act rules apply to each one?
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: AlertTriangle,
                stat: "€35M",
                label: "Maximum fine for prohibited AI practices",
                detail: "Or 7% of global annual turnover — whichever is higher.",
              },
              {
                icon: TrendingDown,
                stat: "85%",
                label: "Of SMEs haven't assessed their AI compliance",
                detail: "Most don't even know the EU AI Act applies to them.",
              },
              {
                icon: Building2,
                stat: "£50K+",
                label: "What Big 4 consultancies charge for this",
                detail: "We deliver the same assessment for £99 in 24 hours.",
              },
            ].map((item, i) => (
              <motion.div
                key={item.stat}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className="p-6 bg-card rounded border border-border/50 text-center"
              >
                <item.icon className="w-8 h-8 text-gold mx-auto mb-4" />
                <div className="font-mono text-4xl text-gold font-bold mb-2">{item.stat}</div>
                <h3 className="font-serif text-lg text-ivory mb-2">{item.label}</h3>
                <p className="text-muted-foreground text-sm">{item.detail}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <div className="evidence-line" data-timestamp="WHAT YOU GET" />

      {/* What's Included — Plain English */}
      <section className="py-20 lg:py-28">
        <div className="container">
          <div className="max-w-xl mb-14">
            <span className="section-number">WHAT YOU GET FOR £99</span>
            <h2 className="text-3xl lg:text-4xl font-serif text-ivory mt-4 mb-4">
              Everything you need to{" "}
              <span className="text-gold italic">understand your position.</span>
            </h2>
            <p className="text-muted-foreground text-[17px] leading-relaxed">
              A complete AI compliance assessment in plain English. No jargon, no ambiguity,
              no 200-page report you'll never read. Just clear answers to the questions that matter.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {auditIncludes.map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.5 }}
                className="p-6 bg-card rounded border border-border/50"
              >
                <item.icon className="w-7 h-7 text-gold mb-4" />
                <h3 className="font-serif text-lg text-ivory mb-2">{item.title}</h3>
                <p className="text-muted-foreground text-[15px] leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <div className="evidence-line" data-timestamp="HOW IT WORKS" />

      {/* Process — Simple 3 Steps */}
      <section className="py-20 lg:py-28 bg-charcoal/30">
        <div className="container">
          <div className="max-w-xl mb-14">
            <span className="section-number">HOW IT WORKS</span>
            <h2 className="text-3xl lg:text-4xl font-serif text-ivory mt-4 mb-4">
              Three steps. <span className="text-gold italic">24 hours.</span>
            </h2>
            <p className="text-muted-foreground text-[17px] leading-relaxed">
              No meetings. No sales calls. No waiting weeks for a proposal.
              Just buy it, answer the questions, and get your report.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Buy & Answer",
                desc: "Purchase the audit and fill in a 15-minute questionnaire about the AI tools your business uses. That's all we need from you.",
                time: "15 minutes",
              },
              {
                step: "02",
                title: "We Analyse",
                desc: "Our assessment engine checks every AI system against the full EU AI Act framework. Every finding is documented with evidence.",
                time: "Behind the scenes",
              },
              {
                step: "03",
                title: "You Get Clarity",
                desc: "Receive your complete compliance report: risk classifications, gap analysis, and a 90-day plan to fix what needs fixing.",
                time: "Within 24 hours",
              },
            ].map((item, i) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15, duration: 0.5 }}
                className="relative"
              >
                <div className="font-mono text-5xl text-gold/15 font-bold mb-4">{item.step}</div>
                <h3 className="font-serif text-xl text-ivory mb-2">{item.title}</h3>
                <p className="text-muted-foreground text-[15px] leading-relaxed mb-3">{item.desc}</p>
                <div className="flex items-center gap-1.5 text-gold/60 text-xs font-mono">
                  <Clock className="w-3 h-3" /> {item.time}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <div className="evidence-line" data-timestamp="FAQ" />

      {/* FAQ — Real Questions */}
      <section className="py-20 lg:py-28">
        <div className="container">
          <div className="max-w-xl mb-14">
            <span className="section-number">COMMON QUESTIONS</span>
            <h2 className="text-3xl lg:text-4xl font-serif text-ivory mt-4 mb-4">
              Straight answers to{" "}
              <span className="text-gold italic">real questions.</span>
            </h2>
          </div>

          <div className="max-w-3xl space-y-6">
            {faqs.map((faq, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.5 }}
                className="p-6 bg-card rounded border border-border/50"
              >
                <h3 className="font-serif text-lg text-ivory mb-3">{faq.q}</h3>
                <p className="text-muted-foreground text-[15px] leading-relaxed">{faq.a}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <div className="evidence-line" data-timestamp="GET YOUR AUDIT" />

      {/* Pricing — The Buy Box */}
      <section id="pricing" className="py-20 lg:py-28 bg-charcoal/30">
        <div className="container">
          <div className="max-w-lg mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="p-8 lg:p-10 bg-card rounded border border-gold/30 text-center"
            >
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gold/10 border border-gold/20 rounded text-gold text-xs font-mono tracking-wider mb-6">
                <Shield className="w-3.5 h-3.5" />
                MONEY-BACK GUARANTEE
              </div>

              <h3 className="font-serif text-2xl text-ivory mb-2">AI Compliance Audit</h3>
              <div className="flex items-baseline justify-center gap-2 mb-2">
                <span className="font-mono text-5xl text-gold font-medium">£99</span>
                <span className="text-muted-foreground text-sm">one-time</span>
              </div>
              <p className="text-muted-foreground text-xs mb-6">
                That's less than a Big 4 consultant charges for one hour.
              </p>

              <p className="text-muted-foreground text-[15px] leading-relaxed mb-8 max-w-sm mx-auto">
                Find out exactly where your business stands on EU AI Act compliance.
                Plain English report. 24-hour delivery. No commitment to buy anything else.
              </p>

              <div className="space-y-3 text-left mb-8">
                {[
                  "Complete AI system inventory & risk classification",
                  "Plain English compliance gap report",
                  "90-day fix plan with specific actions",
                  "Evidence package (cryptographically sealed)",
                  "AI governance policy template",
                  "24-hour delivery — guaranteed",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-gold mt-0.5 shrink-0" />
                    <span className="text-ivory/80 text-[15px]">{item}</span>
                  </div>
                ))}
              </div>

              <Button
                size="lg"
                className="w-full bg-gold text-obsidian font-semibold hover:bg-gold-dim transition-all duration-200 active:scale-[0.98] h-12 text-[15px]"
                onClick={handleCheckout}
                disabled={isCheckingOut}
              >
                {isCheckingOut ? (
                  <><Loader2 className="mr-2 w-4 h-4 animate-spin" /> Processing...</>
                ) : (
                  <>Check My Compliance — £99</>
                )}
              </Button>

              <p className="text-muted-foreground/50 text-xs font-mono mt-4 tracking-wider">
                SECURE PAYMENT VIA STRIPE &middot; VAT INCLUDED &middot; MONEY-BACK GUARANTEE
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* What Happens Next */}
      <section className="py-16">
        <div className="container text-center">
          <h3 className="font-serif text-2xl text-ivory mb-4">
            What happens after the audit?
          </h3>
          <p className="text-muted-foreground text-[17px] mb-8 max-w-lg mx-auto leading-relaxed">
            Your report will tell you exactly what needs fixing. If you can handle it yourself — great.
            If you need help, our Operational AI Packs start at £1,250 and include everything
            you need to get fully compliant.
          </p>
          <Link href="/packs">
            <Button
              variant="outline"
              className="border-border/60 text-ivory/80 hover:text-ivory hover:border-gold/40 text-[15px]"
            >
              View Governance Packs
              <ArrowRight className="ml-2 w-3.5 h-3.5" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
