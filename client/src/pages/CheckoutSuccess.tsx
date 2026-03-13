import { Link } from "wouter";
import { CheckCircle2, ArrowRight, Download, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

export default function CheckoutSuccess() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center py-20">
      <div className="container max-w-xl">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <div className="w-20 h-20 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center mx-auto mb-8">
            <CheckCircle2 className="w-10 h-10 text-gold" />
          </div>

          <h1 className="text-3xl font-serif text-ivory mb-4">
            Payment <span className="text-gold italic">confirmed</span>.
          </h1>

          <p className="text-muted-foreground text-lg leading-relaxed mb-8">
            Thank you for your purchase. Your order has been processed and a confirmation
            email will arrive shortly. All deliverables will be sent within the stated timeframe.
          </p>

          <div className="bg-card rounded border border-border/50 p-6 mb-8 text-left">
            <h3 className="text-sm font-mono text-gold mb-3">WHAT HAPPENS NEXT</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Download className="w-4 h-4 text-gold mt-0.5 shrink-0" />
                <p className="text-sm text-ivory/80">
                  Digital products are delivered to your email within minutes.
                  Audit reports and consultations are scheduled within 24 hours.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <Shield className="w-4 h-4 text-gold mt-0.5 shrink-0" />
                <p className="text-sm text-ivory/80">
                  All deliverables are evidence-bound and cryptographically sealed.
                  Your receipt is available in your Stripe account.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/">
              <Button className="bg-gold text-obsidian font-semibold hover:bg-gold-dim px-8 h-12">
                Return Home <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
            <Link href="/contact">
              <Button variant="outline" className="border-border/60 text-ivory/80 hover:text-ivory hover:border-gold/40 h-12">
                Contact Support
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
