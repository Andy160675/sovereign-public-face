import { Link } from "wouter";
import { XCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

export default function CheckoutCancel() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center py-20">
      <div className="container max-w-xl">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <div className="w-20 h-20 rounded-full bg-secondary border border-border/50 flex items-center justify-center mx-auto mb-8">
            <XCircle className="w-10 h-10 text-muted-foreground" />
          </div>

          <h1 className="text-3xl font-serif text-ivory mb-4">
            Checkout <span className="text-muted-foreground italic">cancelled</span>.
          </h1>

          <p className="text-muted-foreground text-lg leading-relaxed mb-8">
            No payment was taken. Your cart is still available if you would like to complete
            your purchase. If you have any questions, our team is here to help.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/packs">
              <Button className="bg-gold text-obsidian font-semibold hover:bg-gold-dim px-8 h-12">
                Return to Products <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
            <Link href="/contact">
              <Button variant="outline" className="border-border/60 text-ivory/80 hover:text-ivory hover:border-gold/40 h-12">
                Need Help?
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
