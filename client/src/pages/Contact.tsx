/*
 * Contact page — Enquiry form, FAQ, and direct contact details.
 * Integrates the "Ask Sovereign" chatbox (under development) and the full enquiry form.
 * ND-friendly: clear labels, generous spacing, no ambiguity.
 */
import { useState } from "react";
import { motion } from "framer-motion";
import {
  Send, CheckCircle2, ChevronDown, ChevronUp,
  Shield, Mail, Globe, MapPin, Phone
} from "lucide-react";
import { Button } from "@/components/ui/button";

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border/30 last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-4 text-left group"
      >
        <span className="text-[15px] font-medium text-ivory group-hover:text-gold transition-colors pr-4">
          {question}
        </span>
        {open ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
        )}
      </button>
      {open && (
        <motion.p
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="text-muted-foreground text-[15px] pb-4 leading-relaxed"
        >
          {answer}
        </motion.p>
      )}
    </div>
  );
}

export default function Contact() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    organisation: "",
    subject: "",
    message: "",
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const to = "enquiries@sovereignsanctuarysystems.co.uk";
    const subjectLine = `[${formData.subject || "General"}] Enquiry from ${formData.name}`;
    const body = [
      `Name: ${formData.name}`,
      `Email: ${formData.email}`,
      formData.organisation ? `Organisation: ${formData.organisation}` : "",
      `Subject: ${formData.subject}`,
      "",
      "--- Message ---",
      formData.message,
      "",
      "---",
      `Sent via Sovereign Sanctuary Systems Portal — ${new Date().toISOString()}`,
    ].filter(Boolean).join("\n");
    const mailtoUrl = `mailto:${to}?subject=${encodeURIComponent(subjectLine)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoUrl, "_blank");
    setSubmitted(true);
  };

  return (
    <div>
      {/* Hero */}
      <section className="relative pt-32 pb-16 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-charcoal/50 to-obsidian" />
        <div className="container relative z-10">
          <span className="section-number mb-4 block">GET IN TOUCH</span>
          <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-serif text-ivory leading-[1.1] mb-6">
            Ask a <span className="text-gold italic">question</span>.
            <br />Start a conversation.
          </h1>
          <p className="text-lg text-ivory/70 max-w-2xl leading-relaxed">
            Whether you need an infrastructure assessment, want to discuss a build engagement,
            or have questions about Harls Theory — we respond within 24 hours.
          </p>
        </div>
      </section>

      <div className="evidence-line" data-timestamp="CONTACT" />

      {/* Contact Info + Form */}
      <section className="py-20 lg:py-28">
        <div className="container">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
            {/* Left: Contact Details */}
            <div className="lg:col-span-4">
              <span className="section-number">DIRECT CONTACT</span>
              <h2 className="text-2xl font-serif text-ivory mt-4 mb-8">Reach us directly.</h2>

              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded bg-gold/10 flex items-center justify-center shrink-0">
                    <Mail className="w-5 h-5 text-gold" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-ivory">Email</p>
                    <a href="mailto:enquiries@sovereignsanctuarysystems.co.uk" className="text-gold text-sm hover:underline">
                      enquiries@sovereignsanctuarysystems.co.uk
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded bg-gold/10 flex items-center justify-center shrink-0">
                    <Globe className="w-5 h-5 text-gold" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-ivory">UK Entity</p>
                    <p className="text-muted-foreground text-sm">Sovereign Sanctuary Systems</p>
                    <p className="text-muted-foreground text-xs">Registered in England & Wales</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded bg-gold/10 flex items-center justify-center shrink-0">
                    <MapPin className="w-5 h-5 text-gold" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-ivory">Tenerife Entity</p>
                    <p className="text-muted-foreground text-sm">Sovereign Sanctuary Systems SL</p>
                    <p className="text-muted-foreground text-xs">Tenerife, Canary Islands, Spain</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded bg-gold/10 flex items-center justify-center shrink-0">
                    <Phone className="w-5 h-5 text-gold" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-ivory">Phone (Tenerife)</p>
                    <p className="text-muted-foreground text-sm">+34 695 81 22 56</p>
                    <p className="text-muted-foreground text-sm">+34 642 05 66 22</p>
                  </div>
                </div>
              </div>

              {/* Response Time */}
              <div className="mt-8 p-4 bg-card rounded border border-gold/20">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-4 h-4 text-gold" />
                  <span className="text-sm font-medium text-ivory">Response Guarantee</span>
                </div>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  All enquiries receive a human response within 24 hours. No chatbots. No auto-replies.
                  Your data is processed in accordance with our privacy policy.
                </p>
              </div>
            </div>

            {/* Right: Enquiry Form */}
            <div className="lg:col-span-8">
              <span className="section-number">ENQUIRY FORM</span>
              <h2 className="text-2xl font-serif text-ivory mt-4 mb-8">Tell us what you need.</h2>

              {submitted ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-gold/5 border border-gold/20 rounded p-8 text-center"
                >
                  <CheckCircle2 className="w-12 h-12 text-gold mx-auto mb-4" />
                  <h3 className="text-xl font-serif text-ivory mb-2">Enquiry Received</h3>
                  <p className="text-muted-foreground">
                    Thank you. Your question has been logged. A member of the team will respond within 24 hours.
                  </p>
                  <Button
                    onClick={() => { setSubmitted(false); setFormData({ name: "", email: "", organisation: "", subject: "", message: "" }); }}
                    className="mt-6 bg-gold text-obsidian hover:bg-gold-dim"
                  >
                    Send Another Enquiry
                  </Button>
                </motion.div>
              ) : (
                <form onSubmit={handleSubmit} className="bg-card rounded border border-border/50 p-6 lg:p-8 space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-medium text-ivory mb-1.5">Name *</label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-4 py-2.5 rounded border border-border bg-secondary text-ivory text-sm focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold/50 transition-colors placeholder:text-muted-foreground"
                        placeholder="Your name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-ivory mb-1.5">Email *</label>
                      <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full px-4 py-2.5 rounded border border-border bg-secondary text-ivory text-sm focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold/50 transition-colors placeholder:text-muted-foreground"
                        placeholder="you@company.com"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-ivory mb-1.5">Organisation</label>
                    <input
                      type="text"
                      value={formData.organisation}
                      onChange={(e) => setFormData({ ...formData, organisation: e.target.value })}
                      className="w-full px-4 py-2.5 rounded border border-border bg-secondary text-ivory text-sm focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold/50 transition-colors placeholder:text-muted-foreground"
                      placeholder="Your organisation (optional)"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-ivory mb-1.5">Subject *</label>
                    <select
                      required
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      className="w-full px-4 py-2.5 rounded border border-border bg-secondary text-ivory text-sm focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold/50 transition-colors"
                    >
                      <option value="">Select a topic</option>
                      <option value="assessment">Infrastructure Assessment</option>
                      <option value="ai-audit">AI Compliance Audit (£99)</option>
                      <option value="build">Build Engagement</option>
                      <option value="enterprise">Enterprise Enquiry</option>
                      <option value="harls">Harls Theory / Research</option>
                      <option value="tenerife">Tenerife Operations</option>
                      <option value="pricing">Pricing Question</option>
                      <option value="general">General Question</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-ivory mb-1.5">Your Question *</label>
                    <textarea
                      required
                      rows={5}
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      className="w-full px-4 py-2.5 rounded border border-border bg-secondary text-ivory text-sm focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold/50 transition-colors resize-none placeholder:text-muted-foreground"
                      placeholder="Describe your question or requirement..."
                    />
                  </div>
                  <Button
                    type="submit"
                    className="bg-gold text-obsidian font-semibold hover:bg-gold-dim px-8 h-12"
                  >
                    Submit Enquiry <Send className="ml-2 w-4 h-4" />
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Your data is processed in accordance with our privacy policy. We do not share your information with third parties.
                    All prices exclude VAT. IP protected under UK law.
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="evidence-line" data-timestamp="FAQ" />

      {/* FAQ */}
      <section className="py-20 lg:py-28 bg-charcoal/30">
        <div className="container">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12">
              <span className="section-number">FREQUENTLY ASKED QUESTIONS</span>
              <h2 className="text-3xl font-serif text-ivory mt-4">
                Common <span className="text-gold italic">questions</span>.
              </h2>
            </div>
            <div className="bg-card rounded border border-border/50 p-6 lg:p-8">
              <FAQItem
                question="What is Sovereign Elite OS?"
                answer="Sovereign Elite OS is a governance-first operating system architecture. It's not a traditional OS like Windows or Linux — it's a framework of autonomous agents, a constitutional governance kernel, and mathematical coherence verification that ensures your infrastructure operates with zero external dependencies and full cryptographic traceability."
              />
              <FAQItem
                question="What does 'zero SaaS dependency' mean?"
                answer="It means your infrastructure doesn't rely on any third-party subscription services to function. No Slack, no Jira, no AWS lock-in. Every component is self-hosted, self-managed, and self-governed. You own everything."
              />
              <FAQItem
                question="What is Harls Theory?"
                answer="Harls Theory (formally: the Universal Information-Preservation Law) is a mathematical framework for measuring how much information survives transformation. It provides a rigorous, falsifiable metric for system coherence. The core equation is C = I_survive / I_in, where C=1 means perfect coherence and C<1 indicates drift."
              />
              <FAQItem
                question="What does the 28/30 blind test score mean?"
                answer="We run a 30-test blind baseline against the system covering governance, security, compliance, economics, and operational readiness. 28 tests pass, 2 are skipped due to infrastructure gating (NAS access). This gives a coherence score of C=0.933. The goal is 30/30 (C=1.0)."
              />
              <FAQItem
                question="How long does a typical engagement take?"
                answer="An Assessment takes 1-2 weeks. A Build engagement typically runs 1-3 months depending on complexity. Enterprise transformations are scoped individually but typically 3-6 months for full sovereign infrastructure deployment."
              />
              <FAQItem
                question="Do you work with neurodivergent clients?"
                answer="Absolutely. Our systems, documentation, and interfaces are designed with neurodivergent users in mind. We use clear language, progressive disclosure, high contrast interfaces, and structured communication. Our founder is neurodivergent — accessibility is not an afterthought, it's foundational."
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
