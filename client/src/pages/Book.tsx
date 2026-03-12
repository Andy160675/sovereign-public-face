/*
 * DESIGN: Sovereign Obsidian — Dark Editorial Brutalism
 * Book page: VIP Strategy Call booking page.
 * ND-friendly: Minimal form, clear expectations, single CTA.
 */
import { motion } from "framer-motion";
import { Shield, Clock, CheckCircle2, Calendar, ArrowRight, Mail, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const callIncludes = [
  "60-minute one-on-one session",
  "Sovereign systems architect",
  "Actionable roadmap within 24 hours",
  "Recording provided (optional)",
  "Follow-up email summary",
  "Priority scheduling",
];

export default function Book() {
  return (
    <div>
      {/* Hero */}
      <section className="pt-32 pb-16">
        <div className="container">
          <div className="max-w-2xl">
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="section-number"
            >
              VIP STRATEGY CALL
            </motion.span>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.6 }}
              className="text-4xl sm:text-5xl lg:text-[3.5rem] font-serif text-ivory leading-[1.1] mt-4 mb-6"
            >
              Talk to an architect.
              <br />
              <span className="text-gold italic">Get a roadmap.</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="text-lg text-ivory/70 max-w-lg leading-relaxed"
            >
              A 60-minute strategy session with a sovereign systems architect.
              Walk away with a clear, actionable plan for your AI governance needs.
            </motion.p>
          </div>
        </div>
      </section>

      {/* Evidence Line */}
      <div className="evidence-line" data-timestamp="BOOKING" />

      {/* Booking Section */}
      <section className="py-20 lg:py-28">
        <div className="container">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            {/* Left: Details */}
            <div className="lg:col-span-5">
              <div className="p-8 bg-card rounded border border-gold/30">
                <div className="flex items-center gap-3 mb-6">
                  <Calendar className="w-6 h-6 text-gold" />
                  <h3 className="font-serif text-xl text-ivory">VIP Strategy Call</h3>
                </div>

                <div className="flex items-baseline gap-2 mb-6">
                  <span className="font-mono text-4xl text-gold font-medium">£199</span>
                  <span className="text-muted-foreground text-sm">per session</span>
                </div>

                <div className="space-y-3 mb-8">
                  {callIncludes.map((item) => (
                    <div key={item} className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-gold/70 mt-0.5 shrink-0" />
                      <span className="text-ivory/70 text-[14px]">{item}</span>
                    </div>
                  ))}
                </div>

                <div className="evidence-line mb-6" data-timestamp="" />

                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground text-[14px]">60 minutes, video call</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Shield className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground text-[14px]">Confidential, NDA available</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Booking Form / Calendly Placeholder */}
            <div className="lg:col-span-7">
              <div className="p-8 lg:p-10 bg-card rounded border border-border/50 min-h-[500px] flex flex-col items-center justify-center">
                <Calendar className="w-12 h-12 text-gold/30 mb-6" />
                <h3 className="font-serif text-xl text-ivory mb-3 text-center">
                  Schedule Your Strategy Call
                </h3>
                <p className="text-muted-foreground text-[15px] text-center max-w-sm mb-8">
                  Select a time that works for you. Calendly integration will be activated
                  once your booking system is configured.
                </p>

                <Button
                  size="lg"
                  className="bg-gold text-obsidian font-semibold hover:bg-gold-dim transition-all duration-200 active:scale-[0.98] px-8 h-12 text-[15px]"
                  onClick={() => toast.info("Calendly booking integration coming soon. Use the contact details below to schedule.")}
                >
                  Book Your Call — £199
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>

                <p className="text-muted-foreground/50 text-xs font-mono mt-4 tracking-wider">
                  SECURE PAYMENT VIA STRIPE
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Evidence Line */}
      <div className="evidence-line" data-timestamp="CONTACT" />

      {/* Alternative Contact */}
      <section className="py-16 bg-charcoal/30">
        <div className="container">
          <div className="max-w-xl mx-auto text-center">
            <h3 className="font-serif text-xl text-ivory mb-4">Prefer to reach out directly?</h3>
            <p className="text-muted-foreground text-[15px] mb-6">
              For enterprise enquiries, custom scoping, or urgent compliance needs.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <div className="flex items-center gap-2 text-ivory/70 text-[15px]">
                <Mail className="w-4 h-4 text-gold" />
                <span>contact@sovereign-sanctuary.com</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
