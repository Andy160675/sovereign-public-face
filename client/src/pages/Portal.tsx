/*
 * PORTAL — Sovereign Command Directory
 * Auth-gated consolidated link directory for all deployed services,
 * repos, domains, products, and operational assets.
 * ND-friendly: clear sections, high contrast, generous spacing.
 */
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import {
  Globe, GitBranch, CreditCard, Mail, Server,
  ExternalLink, Lock, Shield, Music, MessageSquare,
  FolderOpen, ArrowRight, LogIn
} from "lucide-react";

interface LinkItem {
  name: string;
  url?: string;
  detail: string;
  status: "LIVE" | "ACTIVE" | "TEST" | "PLACEHOLDER" | "CONFIGURED" | "INCOMPLETE";
}

interface Section {
  title: string;
  icon: React.ElementType;
  items: LinkItem[];
}

const sections: Section[] = [
  {
    title: "Live Websites and Web Applications",
    icon: Globe,
    items: [
      { name: "Sovereign Ledger Address Extractor", url: "https://sovereignledg-wdvwwjvj.manus.space", detail: "Primary Manus webapp — Stripe integrated", status: "LIVE" },
      { name: "RAPTOR Workflow Studio", url: "https://sovereignledg-wdvwwjvj.manus.space/workflow-studio", detail: "Workflow automation engine", status: "LIVE" },
      { name: "Command Console Dashboard", url: "https://sovereignledg-wdvwwjvj.manus.space/dashboard", detail: "Operational command dashboard", status: "LIVE" },
      { name: "Codex Sovereign Systems", url: "https://codexsovereignsystems.com", detail: "GoDaddy Builder site — M365 email configured", status: "LIVE" },
      { name: "Sovereign Sanctuary Systems UK", url: "https://sovereignsanctuarysystems.co.uk", detail: "SiteGround hosted — UK entity", status: "LIVE" },
      { name: "Premier Cichlids", url: "https://premiercichlids.co.uk", detail: "SiteGround hosted — Fish business", status: "LIVE" },
      { name: "VIP Fish", url: "https://vipfish.co.uk", detail: "Heart Internet — Shared hosting", status: "LIVE" },
      { name: "Codex Sovereign", url: "https://codexsovereign.com", detail: "Placeholder — 'Launching Soon'", status: "PLACEHOLDER" },
    ],
  },
  {
    title: "GitHub Repositories (Active)",
    icon: GitBranch,
    items: [
      { name: "sovereign-public-face", url: "https://github.com/Andy160675/sovereign-public-face", detail: "Enterprise revenue website — TypeScript", status: "ACTIVE" },
      { name: "sovereign-tenerife", url: "https://github.com/Andy160675/sovereign-tenerife", detail: "Tenerife SL operations site — TypeScript", status: "ACTIVE" },
      { name: "sovereign-core-monorepo", url: "https://github.com/Andy160675/sovereign-core-monorepo", detail: "Canonical monorepo — 436 MB, all consolidated skills", status: "ACTIVE" },
      { name: "sovereign-artefact-registry", url: "https://github.com/Andy160675/sovereign-artefact-registry", detail: "Cryptographic evidence chain — Bitcoin anchored", status: "ACTIVE" },
      { name: "sovereign-elite-os", url: "https://github.com/Andy160675/sovereign-elite-os", detail: "OS health check — 122/122 tests passing", status: "ACTIVE" },
      { name: "super-agent-execution-pipeline", url: "https://github.com/Andy160675/super-agent-execution-pipeline", detail: "SITREP + remediation pipeline", status: "ACTIVE" },
      { name: "governance-substrate", url: "https://github.com/Andy160675/governance-substrate", detail: "Governance database layer", status: "ACTIVE" },
      { name: "elite-silk", url: "https://github.com/Andy160675/elite-silk", detail: "Brand identity + CI/CD framework", status: "ACTIVE" },
      { name: "SanctuarySovereignSystems", url: "https://github.com/Andy160675/SanctuarySovereignSystems", detail: "PUBLIC — Governance for AI", status: "ACTIVE" },
      { name: "creator777-suno-catalog", url: "https://github.com/Andy160675/creator777-suno-catalog", detail: "Music pipeline catalog — 21+ tracks", status: "ACTIVE" },
      { name: "APMF-Sovereign-Agentic-Performance", url: "https://github.com/Andy160675/APMF-Sovereign-Agentic-Performance", detail: "Agent performance measurement framework", status: "ACTIVE" },
      { name: "enterprise-command-portal-framework", url: "https://github.com/Andy160675/enterprise-command-portal-framework", detail: "PIOPL enterprise taxonomy — 25K trained", status: "ACTIVE" },
      { name: "bolt-on-programmes", url: "https://github.com/Andy160675/bolt-on-programmes", detail: "Governance programme framework", status: "ACTIVE" },
      { name: "CSS-Gumroad-Launch-Kit", url: "https://github.com/Andy160675/CSS-Gumroad-Launch-Kit", detail: "Gumroad product packages", status: "ACTIVE" },
      { name: "content-pillar-ai-compliance-audit", url: "https://github.com/Andy160675/content-pillar-ai-compliance-audit", detail: "£99 audit content — 35 campaign assets", status: "ACTIVE" },
    ],
  },
  {
    title: "Stripe Products (Test Mode)",
    icon: CreditCard,
    items: [
      { name: "AI Governance Checklist", detail: "£19.00 — One-time", status: "CONFIGURED" },
      { name: "Compliance Prompt Pack", detail: "£29.00 — One-time", status: "CONFIGURED" },
      { name: "AI Compliance Audit", detail: "£99.00 — One-time — PRIMARY PRODUCT", status: "CONFIGURED" },
      { name: "Sovereign IDE Strategy Whitepaper", detail: "£149.00 — One-time", status: "CONFIGURED" },
      { name: "MCP Server Development Kit", detail: "£199.00 — One-time", status: "CONFIGURED" },
      { name: "VIP Strategy Call", detail: "£199.00 — One-time", status: "CONFIGURED" },
      { name: "Sovereign Governance Pack v1.0", detail: "£499.00 — One-time", status: "CONFIGURED" },
      { name: "Sovereign Infrastructure Consultation", detail: "£497.00 — One-time", status: "CONFIGURED" },
      { name: "Governance Console", detail: "£1,497.00/mo — Subscription", status: "CONFIGURED" },
      { name: "Managed Fleet — BOARDROOM-13", detail: "£2,000.00/mo — Subscription", status: "CONFIGURED" },
      { name: "Infrastructure Audit", detail: "£2,997.00 — One-time", status: "CONFIGURED" },
      { name: "Sovereign Elite OS — Annual License", detail: "£4,997.00/yr — Subscription", status: "CONFIGURED" },
      { name: "HireAI Enterprise", detail: "£50,000.00/yr — Subscription", status: "CONFIGURED" },
    ],
  },
  {
    title: "Domain Estate (11 Domains)",
    icon: Shield,
    items: [
      { name: "codexsovereignsystems.com", detail: "GoDaddy — Expires 2 Mar 2029 — PRIMARY", status: "ACTIVE" },
      { name: "codexsovereignsystems.co.uk", detail: "GoDaddy — Expires 3 Mar 2027 — Redirect", status: "ACTIVE" },
      { name: "codexsovereignsystems.net", detail: "GoDaddy — Expires 2 Mar 2027 — Redirect", status: "ACTIVE" },
      { name: "codexsovereignsystems.info/.shop/.store/.xyz", detail: "GoDaddy — Expires Mar 2027 — Defensive hold", status: "ACTIVE" },
      { name: "sovereignsanctuarysystemstenerife.com", detail: "GoDaddy (Tenerife acct) — SL operations", status: "ACTIVE" },
      { name: "sovereignsanctuarysystems.co.uk", detail: "SiteGround — Expires 8 Jan 2027", status: "ACTIVE" },
      { name: "premiercichlids.co.uk", detail: "SiteGround — Expires 31 Oct 2026", status: "ACTIVE" },
      { name: "vipfish.co.uk", detail: "Heart Internet — Expires 2 Mar 2028", status: "ACTIVE" },
      { name: "codexsovereign.com", detail: "GoDaddy (unknown acct) — Expires 2 Feb 2029", status: "PLACEHOLDER" },
    ],
  },
  {
    title: "Email Accounts",
    icon: Mail,
    items: [
      { name: "andy@codexsovereignsystems.com", detail: "M365 (Outlook) — Primary business", status: "ACTIVE" },
      { name: "contact@sovereignsanctuarysystems.co.uk", detail: "SiteGround — IMAP 993 / SMTP 465", status: "ACTIVE" },
      { name: "support@sovereignsanctuarysystems.co.uk", detail: "SiteGround — IMAP 993 / SMTP 465", status: "ACTIVE" },
      { name: "andy@vipfish.co.uk", detail: "GoDaddy Workspace — Setup incomplete", status: "INCOMPLETE" },
      { name: "harleigh@vipfish.co.uk", detail: "GoDaddy Workspace — Setup incomplete", status: "INCOMPLETE" },
    ],
  },
  {
    title: "Content and Music",
    icon: Music,
    items: [
      { name: "Suno.ai (Creator777)", url: "https://suno.com/@andyjones160675", detail: "21 tracks — 4,500 plays — 422 likes", status: "ACTIVE" },
      { name: "LinkedIn", url: "https://uk.linkedin.com/in/andyjones160675", detail: "Professional profile — Andrew Jones", status: "ACTIVE" },
      { name: "Telegram Bot", detail: "@SovereignScorecardBot — Webhook active", status: "LIVE" },
    ],
  },
  {
    title: "Slack Workspace",
    icon: MessageSquare,
    items: [
      { name: "#all-sovereign-sanctuary-systems", detail: "Announcements, deployments — HIGH activity", status: "ACTIVE" },
      { name: "#social", detail: "Creator777 music pipeline daily pulls", status: "ACTIVE" },
      { name: "#first-project", detail: "Creator777 + SITREP action items", status: "ACTIVE" },
    ],
  },
  {
    title: "Infrastructure Services",
    icon: Server,
    items: [
      { name: "SiteGround Email Server", detail: "mail.sovereignsanctuarysystems.co.uk — IMAP 993 / SMTP 465", status: "ACTIVE" },
      { name: "GoDaddy DNS", detail: "domaincontrol.com nameservers — 7 domains", status: "ACTIVE" },
      { name: "Render", detail: "API hosting — Key 'lapt' created 31 Jan 2026", status: "ACTIVE" },
      { name: "Google Cloud", detail: "Free trial activated", status: "ACTIVE" },
    ],
  },
  {
    title: "Google Drive Key Folders",
    icon: FolderOpen,
    items: [
      { name: "Content-Pillars", detail: "Pillar 01: Emergency AI Compliance Audit — 35 assets", status: "ACTIVE" },
      { name: "SEOS-Board-Pack", detail: "Executive summary, test results, SHA-256 manifest", status: "ACTIVE" },
      { name: "Sovereign-Elite-OS", detail: "Latest with security hardening + federation", status: "ACTIVE" },
      { name: "governance-substrate", detail: "Latest with migrations 000-009", status: "ACTIVE" },
      { name: "Creator777-Suno-Catalog", detail: "21 tracks, promo images, manifests", status: "ACTIVE" },
      { name: "CSS-Governance-Console", detail: "Deployment report + test results", status: "ACTIVE" },
    ],
  },
];

const statusColors: Record<string, string> = {
  LIVE: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  ACTIVE: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  TEST: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  PLACEHOLDER: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
  CONFIGURED: "bg-violet-500/20 text-violet-400 border-violet-500/30",
  INCOMPLETE: "bg-red-500/20 text-red-400 border-red-500/30",
};

export default function Portal() {
  const { user, loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md">
          <Lock className="w-12 h-12 text-gold mx-auto mb-6" />
          <h1 className="text-2xl font-serif text-ivory mb-4">Command Portal</h1>
          <p className="text-muted-foreground mb-8 leading-relaxed">
            This portal requires authentication. Sign in to access the consolidated
            link directory for all deployed services, repositories, and operational assets.
          </p>
          <a href={getLoginUrl()}>
            <Button className="bg-gold text-obsidian font-semibold hover:bg-gold-dim px-8 h-12">
              <LogIn className="w-4 h-4 mr-2" />
              Sign In to Access Portal
            </Button>
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="py-12 lg:py-20">
      <div className="container">
        {/* Header */}
        <div className="max-w-2xl mb-14">
          <span className="section-number">COMMAND PORTAL</span>
          <h1 className="text-3xl lg:text-4xl font-serif text-ivory mt-4 mb-4">
            Sovereign Asset <span className="text-gold italic">Directory</span>
          </h1>
          <p className="text-muted-foreground text-[17px] leading-relaxed">
            Consolidated registry of all deployed services, domains, repositories,
            products, and operational assets. Single source of truth for the entire
            Sovereign Sanctuary Systems estate.
          </p>
        </div>

        {/* Status Legend */}
        <div className="flex flex-wrap gap-3 mb-10">
          {Object.entries(statusColors).map(([status, classes]) => (
            <span key={status} className={`px-3 py-1 text-xs font-mono rounded border ${classes}`}>
              {status}
            </span>
          ))}
        </div>

        {/* Sections */}
        <div className="space-y-10">
          {sections.map((section) => (
            <div key={section.title} className="bg-card rounded border border-border/50 overflow-hidden">
              <div className="flex items-center gap-3 px-6 py-4 border-b border-border/50 bg-charcoal/20">
                <section.icon className="w-5 h-5 text-gold shrink-0" />
                <h2 className="font-serif text-lg text-ivory">{section.title}</h2>
                <span className="ml-auto font-mono text-xs text-muted-foreground">
                  {section.items.length} items
                </span>
              </div>
              <div className="divide-y divide-border/30">
                {section.items.map((item, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-4 px-6 py-4 hover:bg-charcoal/10 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="font-medium text-ivory text-[15px] truncate">
                          {item.name}
                        </span>
                        <span className={`px-2 py-0.5 text-[10px] font-mono rounded border shrink-0 ${statusColors[item.status]}`}>
                          {item.status}
                        </span>
                      </div>
                      <p className="text-muted-foreground text-sm">{item.detail}</p>
                    </div>
                    {item.url && (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 p-2 text-gold/60 hover:text-gold transition-colors"
                        aria-label={`Open ${item.name}`}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer Seal */}
        <div className="mt-16 text-center">
          <div className="inline-flex items-center gap-3 px-6 py-3 bg-card rounded border border-gold/20">
            <Shield className="w-5 h-5 text-gold" />
            <span className="font-mono text-xs text-gold/80 tracking-wider">
              SOVEREIGN COMMAND PORTAL — COMPILED 13 MARCH 2026
            </span>
            <Shield className="w-5 h-5 text-gold" />
          </div>
        </div>
      </div>
    </div>
  );
}
