/**
 * Centralized product catalog for Sovereign Sanctuary Systems.
 * These products are created in Stripe and referenced by their price IDs.
 * Products are organized into tiers matching the monetisation architecture.
 */

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number; // in pence (GBP)
  currency: "gbp";
  mode: "payment" | "subscription";
  tier: "entry" | "professional" | "enterprise";
  featured: boolean;
  deliverables: string[];
}

/**
 * Product catalog — all products available for purchase.
 * Stripe Price IDs will be set via environment variables or created dynamically.
 * For now, we use Stripe Checkout with line_items built from these definitions.
 */
export const PRODUCTS: Product[] = [
  // --- ENTRY TIER ---
  {
    id: "ai-governance-checklist",
    name: "AI Governance Checklist for SMBs",
    description: "Comprehensive AI governance checklist covering EU AI Act requirements, risk classification, and compliance documentation. Immediate download.",
    price: 1900, // £19.00
    currency: "gbp",
    mode: "payment",
    tier: "entry",
    featured: false,
    deliverables: [
      "47-point AI governance checklist (PDF)",
      "Risk classification worksheet",
      "EU AI Act quick-reference guide",
    ],
  },
  {
    id: "compliance-prompt-pack",
    name: "Compliance Prompt Pack",
    description: "47 battle-tested compliance prompts for AI governance, risk assessment, and regulatory documentation. Works with any LLM.",
    price: 2900, // £29.00
    currency: "gbp",
    mode: "payment",
    tier: "entry",
    featured: false,
    deliverables: [
      "47 compliance prompts (Markdown + PDF)",
      "Prompt engineering guide for governance",
      "LLM-agnostic — works with ChatGPT, Claude, Gemini",
    ],
  },
  {
    id: "sovereign-governance-pack",
    name: "Sovereign Governance Pack",
    description: "Complete governance framework including scope, controls, risks, metrics, and evidence templates. Based on the Sovereign Elite OS doctrine.",
    price: 4900, // £49.00
    currency: "gbp",
    mode: "payment",
    tier: "entry",
    featured: false,
    deliverables: [
      "SCOPE document template",
      "CONTROLS framework",
      "RISKS register",
      "METRICS dashboard template",
      "EVIDENCE chain guide",
      "PROGRAMME management template",
    ],
  },
  // --- PROFESSIONAL TIER ---
  {
    id: "ai-compliance-audit",
    name: "Emergency AI Compliance Audit",
    description: "Full-spectrum AI compliance assessment against EU AI Act requirements. Evidence-bound report with remediation roadmap delivered within 24 hours.",
    price: 9900, // £99.00
    currency: "gbp",
    mode: "payment",
    tier: "professional",
    featured: true,
    deliverables: [
      "Full AI system inventory and classification",
      "EU AI Act compliance gap analysis",
      "Risk-rated remediation roadmap",
      "Evidence-bound audit report (PDF)",
      "24-hour turnaround guarantee",
    ],
  },
  {
    id: "strategic-consultation",
    name: "Sovereign Architecture Consultation",
    description: "60-minute one-on-one session with a sovereign systems architect. Actionable roadmap delivered within 24 hours. Covers infrastructure, governance, and compliance.",
    price: 49700, // £497.00
    currency: "gbp",
    mode: "payment",
    tier: "professional",
    featured: false,
    deliverables: [
      "60-minute video consultation",
      "Written action plan within 24 hours",
      "Architecture recommendations",
      "Follow-up email support (7 days)",
    ],
  },
  // --- ENTERPRISE TIER ---
  {
    id: "infrastructure-audit",
    name: "Sovereign Infrastructure Audit",
    description: "Comprehensive infrastructure audit covering network architecture, data governance, security posture, and sovereign compliance. Includes remediation plan.",
    price: 299700, // £2,997.00
    currency: "gbp",
    mode: "payment",
    tier: "enterprise",
    featured: false,
    deliverables: [
      "Full infrastructure assessment",
      "Network topology analysis",
      "Security posture evaluation",
      "Data governance review",
      "Sovereign compliance scorecard",
      "Prioritised remediation plan",
    ],
  },
  {
    id: "managed-fleet",
    name: "Managed Fleet — BOARDROOM-13 Seat",
    description: "Managed AI agent fleet with constitutional governance. 13-agent deliberation engine with hash-chained audit trails. Monthly managed service.",
    price: 200000, // £2,000.00/month
    currency: "gbp",
    mode: "subscription",
    tier: "enterprise",
    featured: false,
    deliverables: [
      "13-agent AI fleet deployment",
      "Constitutional governance kernel",
      "Hash-chained audit trails",
      "Monthly operational reports",
      "24/7 monitoring and support",
    ],
  },
];

/** Get a product by its ID */
export function getProductById(id: string): Product | undefined {
  return PRODUCTS.find((p) => p.id === id);
}

/** Get all products in a specific tier */
export function getProductsByTier(tier: Product["tier"]): Product[] {
  return PRODUCTS.filter((p) => p.tier === tier);
}

/** Get the featured product */
export function getFeaturedProduct(): Product | undefined {
  return PRODUCTS.find((p) => p.featured);
}
