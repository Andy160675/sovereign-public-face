# Public Face Website — Design Brainstorm

<response>
<text>
## Idea 1: "Sovereign Obsidian" — Dark Editorial Brutalism

**Design Movement:** Neo-Brutalist Editorial meets Dark Luxury. Inspired by Bloomberg Terminal aesthetics crossed with high-end fashion editorial (Bottega Veneta, Acne Studios).

**Core Principles:**
1. Information density without cognitive overload — every element earns its space
2. Monochromatic authority — black/charcoal/warm white creates institutional gravitas
3. Asymmetric tension — off-grid layouts create visual interest without chaos
4. Typographic drama — extreme size contrasts between display and body text

**Color Philosophy:** A near-black foundation (oklch(0.15 0.005 250)) with warm ivory text (oklch(0.92 0.02 85)) and a single accent — sovereign gold (oklch(0.75 0.15 85)). The darkness conveys authority and exclusivity. Gold is used sparingly — only for CTAs and price points — creating a "signal in noise" effect that guides the eye.

**Layout Paradigm:** Asymmetric split-screen sections. Hero uses a 60/40 split with text left, visual right. Product sections use alternating full-bleed and contained widths. Pricing uses a horizontal scroll rail (not a grid). Footer is a full-screen "war room" style with contact details arranged like a command interface.

**Signature Elements:**
1. "Sovereign Seal" — a rotating SVG emblem that appears at section transitions
2. "Evidence Lines" — thin horizontal rules with timestamps that separate sections, evoking audit trails
3. "Trust Gate" badges — small shield icons with verification marks next to credentials

**Interaction Philosophy:** Deliberate, weighted interactions. Hover states have a 150ms delay before activating (feels considered, not twitchy). Buttons have a subtle "press" animation (scale 0.98). Scroll reveals are slow and stately — content fades up over 600ms.

**Animation:** Entrance animations use `translateY(20px)` with `opacity: 0` → `1` over 600ms with `ease-out`. No bounce, no spring. Section transitions use a horizontal "wipe" effect. The hero has a slow parallax (0.3x speed) on the background image. Numbers in pricing animate up (counter effect) when scrolled into view.

**Typography System:** Display: "Instrument Serif" (Google Fonts) at 4rem-6rem for hero headlines. Body: "DM Sans" at 18px/1.7 line-height. Monospace: "JetBrains Mono" for prices and technical details. The serif/sans contrast creates editorial sophistication.
</text>
<probability>0.08</probability>
</response>

<response>
<text>
## Idea 2: "Architect's Blueprint" — Technical Precision with Warmth

**Design Movement:** Swiss International Style meets Warm Minimalism. Inspired by Dieter Rams' "less but better" philosophy, combined with the warmth of Japanese wabi-sabi aesthetics.

**Core Principles:**
1. Grid precision with organic warmth — mathematical layouts softened by warm tones
2. Functional beauty — every element serves a purpose, nothing decorative
3. Quiet confidence — the design doesn't shout, it commands respect through restraint
4. Accessibility-first — ND-friendly by default, not as an afterthought

**Color Philosophy:** Warm stone base (oklch(0.96 0.01 80)) — not pure white, which causes eye strain. Deep slate text (oklch(0.25 0.02 250)). Accent is a muted teal (oklch(0.55 0.12 195)) — calming, professional, distinct from the typical blue. Secondary accent: warm terracotta (oklch(0.60 0.14 45)) for CTAs only. The warm base reduces cognitive fatigue for ND users.

**Layout Paradigm:** 12-column grid with generous gutters (2rem). Content never exceeds 65ch width for readability. Sections alternate between full-width "statement" blocks and contained "detail" blocks. Product cards use a stacked vertical layout (not side-by-side) for mobile-first scanning. Pricing is a single-column comparison table, not cards.

**Signature Elements:**
1. "Blueprint Grid" — faint grid lines visible in the background of key sections, evoking architectural precision
2. "Confidence Markers" — small circular indicators (green/amber/red) next to service descriptions showing compliance status
3. "Section Numbers" — large, muted numbers (01, 02, 03) anchoring each section for easy reference

**Interaction Philosophy:** Immediate, predictable responses. No hover delays. Buttons change color on hover within 100ms. Focus states are highly visible (3px solid teal outline). All interactive elements have clear affordances — buttons look like buttons, links are underlined.

**Animation:** Minimal. Content fades in on scroll with `opacity` only (no movement) over 300ms. Page transitions use a simple crossfade. No parallax. Progress indicators use smooth linear transitions. The only "dramatic" animation is the pricing counter on the audit page.

**Typography System:** Single family: "Plus Jakarta Sans" at multiple weights (400, 500, 600, 700). Display: 700 weight at 3rem-4rem. Body: 400 weight at 18px/1.75. The single-family approach reduces cognitive switching. Monospace: "IBM Plex Mono" for prices and codes only.
</text>
<probability>0.06</probability>
</response>

<response>
<text>
## Idea 3: "Sovereign Dusk" — Twilight Gradient Authority

**Design Movement:** Atmospheric Futurism meets Corporate Gravitas. Inspired by the visual language of SpaceX mission control, Stripe's documentation, and the twilight color palette of dusk — the transition between day and night.

**Core Principles:**
1. Atmospheric depth — layered backgrounds create a sense of looking into something substantial
2. Progressive revelation — content emerges from the atmosphere as you scroll
3. Dual-tone authority — deep navy transitions to warm amber, symbolizing the bridge between technology and humanity
4. Spatial hierarchy — z-axis depth (shadows, overlays) replaces traditional size hierarchy

**Color Philosophy:** Deep navy base (oklch(0.18 0.04 265)) transitioning to midnight blue (oklch(0.22 0.05 270)). Text in warm cream (oklch(0.93 0.02 90)). Primary accent: amber gold (oklch(0.78 0.16 80)) for CTAs and prices. Secondary: soft copper (oklch(0.65 0.10 55)) for secondary actions. The gradient background creates depth without distraction — it's a single, slow gradient, not a busy pattern.

**Layout Paradigm:** Full-viewport sections with content floating in "cards" that have subtle glass-morphism (backdrop-blur + semi-transparent backgrounds). Hero is a single centered statement with the gradient behind it. Products are presented in a "deck" layout — overlapping cards that fan out on hover. Pricing uses elevated cards with shadow depth indicating tier importance.

**Signature Elements:**
1. "Dusk Gradient" — a continuous background gradient that shifts from navy to deep purple to midnight as you scroll
2. "Glass Panels" — frosted glass cards (backdrop-blur: 20px) that float above the gradient
3. "Sovereign Glow" — amber/gold glow effects on hover states and active elements

**Interaction Philosophy:** Fluid and responsive. Hover states trigger immediately with smooth 200ms transitions. Cards lift on hover (translateY(-4px) + shadow increase). CTAs have a subtle glow pulse on hover. Scroll-triggered animations are staggered — elements in a group appear sequentially with 100ms delays.

**Animation:** Hero text fades in with a slow `translateY(30px)` over 800ms. Section cards slide up from below with staggered timing. The background gradient shifts subtly on scroll (CSS custom properties driven by scroll position). Price numbers use a typewriter-style reveal. Page transitions use a fade-through-black effect.

**Typography System:** Display: "Sora" (Google Fonts) at 3.5rem-5rem — geometric, modern, authoritative. Body: "Inter" at 18px/1.7 but with variable font weight (optical sizing enabled). Monospace: "Fira Code" for technical details and prices. The geometric display + humanist body creates a "technology with soul" feeling.
</text>
<probability>0.05</probability>
</response>

---

## Selected Approach: Idea 1 — "Sovereign Obsidian" (Dark Editorial Brutalism)

This approach best aligns with the Sovereign brand identity already established across 56 repos. The dark authority aesthetic matches the existing elite-silk-web cinematic style, the gold accent maps to the existing brand palette, and the editorial brutalism creates the institutional gravitas needed for a £99-£2,500 product range. The asymmetric layouts and typographic drama will differentiate this from generic SaaS landing pages while maintaining ND-friendliness through high contrast, generous spacing, and progressive disclosure.
