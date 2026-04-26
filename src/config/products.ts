import { isAudienceMatch, type PortalAudience, getPortalAudience } from "@/lib/portalAudience";

export type ProductAudience = "client" | "internal" | "both";

export type ProductStatus = "active" | "coming-soon";

export type ForgeProduct = {
  id: string;
  /** Display name on cards and as the page-level product title. */
  name: string;
  /** Compact label for the top bar */
  navLabel: string;
  /** One-liner used inside cards and on the journey stepper. */
  tagline: string;
  /** Longer description used on the program home cards. */
  shortDescription: string;
  path: string;
  /** Key matching `getProductIcon` in `@/config/productIcons` */
  iconId: string;
  order: number;
  audience: ProductAudience;
  showInTopNav: boolean;
  status: ProductStatus;
  /** When status is `coming-soon`, 3-5 bullets shown on the card and stub page. */
  comingSoonBullets?: string[];
  /** When status is `coming-soon`, the user-facing label for the readiness chip. */
  comingSoonLabel?: "Coming next" | "Planned";
};

const ALL_PRODUCTS: ForgeProduct[] = [
  {
    id: "capability-map",
    name: "Tower Capability Map",
    navLabel: "Capability Map",
    tagline: "Per tower: confirm the L1 to L4 capability tree and the workforce footprint behind it.",
    shortDescription:
      "For each functional tower, confirm the in-scope L1 to L4 capabilities and the workforce footprint that delivers them. Sets the canvas the Assessment dials operate on.",
    path: "/capability-map",
    iconId: "map",
    order: 10,
    audience: "both",
    showInTopNav: true,
    status: "active",
  },
  {
    id: "assessment",
    name: "Offshore + AI Assessment",
    navLabel: "Assessment",
    tagline: "Per tower: dial offshore and AI per L4 to see where modeled OpEx reduction lands.",
    shortDescription:
      "Set offshore and AI dials per L4 against the confirmed capability map. The tool weights the dials by pool $ and rolls up to a live program-wide modeled impact with sensitivity bands.",
    path: "/assessment",
    iconId: "sliders",
    order: 15,
    audience: "both",
    showInTopNav: true,
    status: "active",
  },
  {
    id: "tower-explorer",
    name: "Tower AI Initiatives",
    navLabel: "AI Initiatives",
    tagline: "Per tower: the AI roadmap, agents, and process-level detail behind the levers.",
    shortDescription:
      "Drill into each tower's AI agenda: sequenced initiatives (now / next / later), agent architectures, and 4-lens detail (work, workforce, workbench, digital core) for every named process.",
    path: "/towers",
    iconId: "sparkles",
    order: 20,
    audience: "both",
    showInTopNav: true,
    status: "active",
  },
  {
    id: "offshore-plan",
    name: "Offshore Plan",
    navLabel: "Offshore Plan",
    tagline: "Translate the offshore dials into a delivery plan: locations, role mix, transition runway.",
    shortDescription:
      "Take the offshore percentages from Capability Map and turn them into a defensible plan — target locations, role-by-role offshorability, transition risk, and runway against the BB- credit covenants.",
    path: "/offshore-plan",
    iconId: "globe-2",
    order: 30,
    audience: "both",
    showInTopNav: false,
    status: "coming-soon",
    comingSoonLabel: "Coming next",
    comingSoonBullets: [
      "Recommended locations by tower (India / Philippines / nearshore) keyed off task complexity and editorial sensitivity.",
      "Role-level offshorability with the editorial / news / political-brand carve-outs the BB- credit story demands.",
      "Wave-by-wave transition runway against the NBCU TSA expiration.",
      "Modeled cost-to-serve before / after, declared in the same tier framework as Capability Map.",
    ],
  },
  {
    id: "prototypes",
    name: "Prototypes",
    navLabel: "Prototypes",
    tagline: "Working agent prototypes that prove the highest-impact initiatives before scale.",
    shortDescription:
      "A lightweight gallery of clickable / live agent prototypes — one or two per priority tower — so leadership can experience the AI initiative, not just read about it.",
    path: "/prototypes",
    iconId: "flask-conical",
    order: 40,
    audience: "both",
    showInTopNav: false,
    status: "coming-soon",
    comingSoonLabel: "Planned",
    comingSoonBullets: [
      "Reconciliation Agent for Finance close (BlackLine + intercompany matching).",
      "Editorial Standards co-pilot for News (Brian Carovillano review workflow).",
      "Ad sales pipeline scoring on the new direct-to-advertiser model post-NBCU TSA.",
      "HR talent-market signal scanner (Eightfold-grounded).",
    ],
  },
  {
    id: "delivery-plan",
    name: "Effort Estimate",
    navLabel: "Effort Estimate",
    tagline: "Translate the modeled levers into Accenture delivery effort, run-rate cost, and a value plan.",
    shortDescription:
      "Effort estimate, sequencing, and the investment case Accenture brings to Versant leadership: scope per tower, run-rate cost, value tracking against $2.43B adj. EBITDA and $0.375 quarterly dividend, and the governance (Steering, Tower Leads, Editorial Standards) that keeps the brand intact.",
    path: "/delivery-plan",
    iconId: "clipboard-list",
    order: 50,
    audience: "both",
    showInTopNav: false,
    status: "coming-soon",
    comingSoonLabel: "Planned",
    comingSoonBullets: [
      "Effort and run-rate cost per tower translated from the modeled levers in the Assessment.",
      "Sequencing across the 0-6 / 6-12 / 12-24 horizons keyed off the NBCU TSA expiration.",
      "Value tracking against the $2.43B adj. EBITDA and $0.375 dividend commitments.",
      "Governance — Steering, Tower Leads, Editorial Standards review — to keep the brand intact.",
    ],
  },
  {
    id: "workshops",
    name: "Workshops",
    navLabel: "Workshops",
    tagline: "Facilitator-led tower workshops with agenda, attendance, and decision logs.",
    shortDescription:
      "The connective tissue between the Capability Map and the Assessment — facilitator-led workshops with Versant tower leads. Pre-read packs, structured decisions on offshore carve-outs and AI priorities, and an audit trail of who agreed to what.",
    path: "/workshops",
    iconId: "users-round",
    order: 60,
    audience: "both",
    showInTopNav: false,
    status: "coming-soon",
    comingSoonLabel: "Planned",
    comingSoonBullets: [
      "Workshop calendar across the 13 towers with Versant tower-lead and Accenture facilitator pairing.",
      "Pre-read packs auto-generated from the tower's capability map and starter dial defaults.",
      "Structured decision log for editorial / news / political-brand carve-outs (BB- credit, on-air talent).",
      "Attendance + sign-off so the Assessment dials carry the names of the people who agreed to them.",
    ],
  },
];

export function getAllProducts(): ForgeProduct[] {
  return [...ALL_PRODUCTS].sort((a, b) => a.order - b.order);
}

export function getProductsForAudience(audience: PortalAudience = getPortalAudience()): ForgeProduct[] {
  return getAllProducts().filter((p) => isAudienceMatch(p.audience, audience));
}

export function getActiveProducts(audience: PortalAudience = getPortalAudience()): ForgeProduct[] {
  return getProductsForAudience(audience).filter((p) => p.status === "active");
}

export function getComingSoonProducts(audience: PortalAudience = getPortalAudience()): ForgeProduct[] {
  return getProductsForAudience(audience).filter((p) => p.status === "coming-soon");
}

export function getTopNavProducts(audience: PortalAudience = getPortalAudience()): ForgeProduct[] {
  return getProductsForAudience(audience).filter((p) => p.showInTopNav);
}

export function getProductById(id: string): ForgeProduct | undefined {
  return ALL_PRODUCTS.find((p) => p.id === id);
}

export type StaticNavLink = {
  id: string;
  name: string;
  path: string;
  order: number;
  audience: ProductAudience;
  /** Optional icon for nav (from `getStaticLinkIcon` / `productIcons`). */
  iconId?: string;
  showLabel: boolean;
};

const STATIC_LINKS: StaticNavLink[] = [
  {
    id: "exec-summary",
    name: "Executive summary",
    path: "/summary",
    order: 5,
    audience: "both",
    showLabel: true,
  },
  {
    id: "assumptions",
    name: "Assumptions",
    path: "/assumptions",
    order: 16,
    iconId: "calculator",
    audience: "both",
    showLabel: true,
  },
  {
    id: "glossary",
    name: "Glossary",
    path: "/glossary",
    order: 40,
    iconId: "book-open" as const,
    audience: "both",
    showLabel: true,
  },
  {
    id: "changelog",
    name: "What’s new",
    path: "/changelog",
    order: 50,
    iconId: "bell",
    audience: "internal",
    showLabel: true,
  },
];

export function getStaticNavLinks(audience: PortalAudience = getPortalAudience()): StaticNavLink[] {
  return STATIC_LINKS.filter((l) => isAudienceMatch(l.audience, audience)).sort(
    (a, b) => a.order - b.order,
  );
}

export type NavItem =
  | { kind: "product"; order: number; product: ForgeProduct }
  | { kind: "static"; order: number; link: StaticNavLink };

export function getOrderedNavItems(audience: PortalAudience = getPortalAudience()): NavItem[] {
  const products = getTopNavProducts(audience).map(
    (product): NavItem => ({ kind: "product", order: product.order, product }),
  );
  const statics = getStaticNavLinks(audience).map(
    (link): NavItem => ({ kind: "static", order: link.order, link }),
  );
  return [...products, ...statics].sort((a, b) => a.order - b.order);
}
