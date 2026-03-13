/*
 * DESIGN: Sovereign Obsidian — Dark Editorial Brutalism
 * Audit page: £99 AI Compliance Audit product page.
 * Progressive disclosure: Problem → Solution → What's Included → Pricing → CTA
 * ND-friendly: Chunked content, clear visual hierarchy, single primary CTA.
 */
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Shield, CheckCircle2, ArrowRight, Clock, FileText, AlertTriangle, BarChart3, Lock, Zap, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { toast } from "sonner";
import { useState } from "react";

const auditIncludes = [
  { icon: BarChart3, title: "Risk Classification", desc: "Full AI system inventory with EU AI Act risk tier mapping (Unacceptable, High, Limited, Minimal)." },
  { icon: FileText, title: "Compliance Gap Report", desc: "Detailed gap analysis against EU AI Act Articles 6-51, with severity ratings and remediation priorities." },
  { icon: AlertTriangle, title: "Remediation Roadmap", desc: "Actionable 90-day plan with specific tasks, owners, and deadlines to achieve compliance." },
  { icon: Lock, title: "Evidence Chain", desc: "Cryptographically sealed audit trail with SHA-256 hashes. Court-admissible documentation." },
  { icon: Shield, title: "Governance Framework", desc: "Baseline AI governance policy template customised to your organisation's risk profile." },
  { icon: Zap, title: "24-Hour Delivery", desc: "Complete audit report delivered within 24 hours of questionnaire submission. No delays." },
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
      {/* Hero */}
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
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="section-number"
            >
              AI COMPLIANCE AUDIT
            </motion.span>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.6 }}
              className="text-4xl sm:text-5xl lg:text-[3.5rem] font-serif text-ivory leading-[1.1] mt-4 mb-6"
            >
              Know exactly where
              <br />
              your AI stands.{" "}
              <span className="text-gold italic">£99.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="text-lg text-ivory/70 max-w-lg mb-8 leading-relaxed"
            >
              A full-spectrum AI compliance assessment against the EU AI Act.
              Evidence-bound report with remediation roadmap. Delivered in 24 hours.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="flex items-center gap-6"
            >
              <Button
                size="lg"
                className="bg-gold text-obsidian font-semibold hover:bg-gold-dim transition-all duration-200 active:scale-[0.98] px-8 h-12 text-[15px]"
                onClick={() => {
                  const el = document.getElementById("pricing");
                  el?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                Get Your Audit Now
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Clock className="w-4 h-4" />
                <span>24-hour delivery</span>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Evidence Line */}
      <div className="evidence-line" data-timestamp="WHAT'S INCLUDED" />

      {/* What's Included */}
      <section className="py-20 lg:py-28">
        <div className="container">
          <div className="max-w-xl mb-14">
            <span className="section-number">01 — DELIVERABLES</span>
            <h2 className="text-3xl lg:text-4xl font-serif text-ivory mt-4 mb-4">
              Everything you need to{" "}
              <span className="text-gold italic">prove compliance</span>.
            </h2>
            <p className="text-muted-foreground text-[17px] leading-relaxed">
              The audit covers your entire AI estate. Every system classified, every gap identified,
              every remediation step documented.
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

      {/* Evidence Line */}
      <div className="evidence-line" data-timestamp="HOW IT WORKS" />

      {/* Process */}
      <section className="py-20 lg:py-28 bg-charcoal/30">
        <div className="container">
          <div className="max-w-xl mb-14">
            <span className="section-number">02 — PROCESS</span>
            <h2 className="text-3xl lg:text-4xl font-serif text-ivory mt-4 mb-4">
              Three steps. <span className="text-gold italic">24 hours.</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { step: "01", title: "Purchase & Questionnaire", desc: "Complete the checkout and fill in the AI systems questionnaire. Takes approximately 15 minutes." },
              { step: "02", title: "Analysis & Classification", desc: "Our sovereign AI engine analyses your systems against the full EU AI Act framework. Every finding evidence-bound." },
              { step: "03", title: "Report & Roadmap", desc: "Receive your complete compliance report with risk classifications, gap analysis, and 90-day remediation roadmap." },
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
                <h3 className="font-serif text-xl text-ivory mb-3">{item.title}</h3>
                <p className="text-muted-foreground text-[15px] leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Evidence Line */}
      <div className="evidence-line" data-timestamp="PRICING" />

      {/* Pricing */}
      <section id="pricing" className="py-20 lg:py-28">
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
                EVIDENCE-BOUND AUDIT
              </div>

              <h3 className="font-serif text-2xl text-ivory mb-2">AI Compliance Audit</h3>
              <div className="flex items-baseline justify-center gap-2 mb-4">
                <span className="font-mono text-5xl text-gold font-medium">£99</span>
                <span className="text-muted-foreground text-sm">one-time</span>
              </div>

              <p className="text-muted-foreground text-[15px] leading-relaxed mb-8 max-w-sm mx-auto">
                Full EU AI Act compliance assessment with evidence-bound report
                and 90-day remediation roadmap. Delivered in 24 hours.
              </p>

              <div className="space-y-3 text-left mb-8">
                {[
                  "Full AI system inventory & risk classification",
                  "EU AI Act gap analysis (Articles 6-51)",
                  "90-day remediation roadmap with owners",
                  "Cryptographically sealed evidence chain",
                  "Governance framework template",
                  "24-hour delivery guarantee",
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
                  <>Purchase Audit — £99</>  
                )}
              </Button>

              <p className="text-muted-foreground/50 text-xs font-mono mt-4 tracking-wider">
                SECURE PAYMENT VIA STRIPE &middot; VAT INCLUDED
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Evidence Line */}
      <div className="evidence-line" data-timestamp="NEXT STEPS" />

      {/* Bottom CTA */}
      <section className="py-16 bg-charcoal/30">
        <div className="container text-center">
          <p className="text-muted-foreground text-[15px] mb-4">
            Need a larger scope? Our Operational AI Packs cover full governance deployment.
          </p>
          <Link href="/packs">
            <Button
              variant="outline"
              className="border-border/60 text-ivory/80 hover:text-ivory hover:border-gold/40 text-[15px]"
            >
              View Operational AI Packs
              <ArrowRight className="ml-2 w-3.5 h-3.5" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
