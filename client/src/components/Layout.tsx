/*
 * DESIGN: Sovereign Obsidian — Dark Editorial Brutalism
 * Layout: Fixed top nav with transparent-to-solid scroll transition.
 * Nav items use DM Sans 500 weight. Logo uses Instrument Serif.
 * Gold accent on active/hover states. Minimal, authoritative.
 */
import { Link, useLocation } from "wouter";
import { useState, useEffect, type ReactNode } from "react";
import { Menu, X, Shield } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/services", label: "Services" },
  { href: "/audit", label: "AI Audit" },
  { href: "/packs", label: "Packs" },
  { href: "/team", label: "Team" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/portal", label: "Portal" },
];

function NavLink({ href, label, active, onClick }: { href: string; label: string; active: boolean; onClick?: () => void }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`relative text-[15px] font-medium tracking-wide transition-colors duration-200 ${
        active
          ? "text-gold"
          : "text-ivory/70 hover:text-ivory"
      }`}
    >
      {label}
      {active && (
        <motion.span
          layoutId="nav-indicator"
          className="absolute -bottom-1 left-0 right-0 h-[2px] bg-gold"
          transition={{ type: "spring", stiffness: 350, damping: 30 }}
        />
      )}
    </Link>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navigation */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-obsidian/95 backdrop-blur-md border-b border-border/50"
            : "bg-transparent"
        }`}
      >
        <nav className="container flex items-center justify-between h-16 lg:h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <Shield className="w-6 h-6 text-gold transition-transform duration-300 group-hover:scale-110" />
            <span className="font-serif text-xl tracking-tight text-ivory">
              Sovereign<span className="text-gold">.</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            {navItems.map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                label={item.label}
                active={location === item.href}
              />
            ))}
          </div>

          {/* CTA */}
          <div className="hidden md:block">
            <Link
              href="/audit"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gold text-obsidian font-semibold text-sm rounded tracking-wide transition-all duration-200 hover:bg-gold-dim active:scale-[0.98]"
            >
              Get Your Audit
            </Link>
          </div>

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 text-ivory/70 hover:text-ivory"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </nav>

        {/* Mobile Menu */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="md:hidden bg-obsidian/98 backdrop-blur-lg border-b border-border/50"
            >
              <div className="container py-6 flex flex-col gap-4">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`text-lg font-medium py-2 ${
                      location === item.href ? "text-gold" : "text-ivory/70"
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
                <Link
                  href="/audit"
                  onClick={() => setMobileOpen(false)}
                  className="mt-2 inline-flex items-center justify-center gap-2 px-5 py-3 bg-gold text-obsidian font-semibold text-sm rounded tracking-wide"
                >
                  Get Your Audit
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Main Content */}
      <main>{children}</main>

      {/* Footer */}
      <footer className="border-t border-border/50 bg-obsidian">
        <div className="container py-16 lg:py-20">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-12">
            {/* Brand Column */}
            <div className="md:col-span-5">
              <div className="flex items-center gap-2.5 mb-4">
                <Shield className="w-5 h-5 text-gold" />
                <span className="font-serif text-lg text-ivory">
                  Sovereign<span className="text-gold">.</span>
                </span>
              </div>
              <p className="text-muted-foreground text-[15px] leading-relaxed max-w-sm">
                Enterprise AI governance, compliance auditing, and operational sovereignty.
                Built for organisations that refuse to outsource their integrity.
              </p>
              <div className="mt-6 font-mono text-xs text-muted-foreground/60 tracking-wider">
                SOVEREIGN SANCTUARY SYSTEMS LTD
              </div>
            </div>

            {/* Links */}
            <div className="md:col-span-3">
              <h4 className="font-sans text-sm font-semibold text-ivory/80 tracking-wider uppercase mb-4">
                Services
              </h4>
              <div className="flex flex-col gap-2.5">
                <Link href="/audit" className="text-muted-foreground hover:text-gold transition-colors text-[15px]">AI Compliance Audit</Link>
                <Link href="/packs" className="text-muted-foreground hover:text-gold transition-colors text-[15px]">Operational AI Packs</Link>
                <Link href="/packs" className="text-muted-foreground hover:text-gold transition-colors text-[15px]">Compliance Prompts</Link>
                <Link href="/book" className="text-muted-foreground hover:text-gold transition-colors text-[15px]">Strategy Calls</Link>
              </div>
            </div>

            {/* Company */}
            <div className="md:col-span-2">
              <h4 className="font-sans text-sm font-semibold text-ivory/80 tracking-wider uppercase mb-4">
                Company
              </h4>
              <div className="flex flex-col gap-2.5">
                <Link href="/about" className="text-muted-foreground hover:text-gold transition-colors text-[15px]">About</Link>
                <Link href="/about" className="text-muted-foreground hover:text-gold transition-colors text-[15px]">Credentials</Link>
                <Link href="/portal" className="text-muted-foreground hover:text-gold transition-colors text-[15px]">Command Portal</Link>
                <Link href="/contact" className="text-muted-foreground hover:text-gold transition-colors text-[15px]">Contact</Link>
              </div>
            </div>

            {/* Trust */}
            <div className="md:col-span-2">
              <h4 className="font-sans text-sm font-semibold text-ivory/80 tracking-wider uppercase mb-4">
                Trust
              </h4>
              <div className="flex flex-col gap-2.5 text-[15px]">
                <span className="text-muted-foreground">EU AI Act Ready</span>
                <span className="text-muted-foreground">ISO 27001 Aligned</span>
                <span className="text-muted-foreground">GDPR Compliant</span>
                <span className="text-muted-foreground">Zero-SaaS</span>
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="evidence-line mt-12 mb-6" data-timestamp="EST. 2024" />
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-muted-foreground/50 text-xs font-mono tracking-wider">
              &copy; {new Date().getFullYear()} SOVEREIGN SANCTUARY SYSTEMS. ALL RIGHTS RESERVED.
            </p>
            <p className="text-muted-foreground/30 text-xs font-mono tracking-wider">
              EVIDENCE-BOUND &middot; CRYPTOGRAPHICALLY SEALED &middot; SOVEREIGN FOREVER
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
