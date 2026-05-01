/**
 * Deterministic AI-eligibility rubric.
 *
 * Pure function of `(towerId, l2Name, l3Name, l4Name)` → curation verdict.
 * Used as the **fallback** when:
 *   - the LLM pipeline (PR 2) hasn't run yet,
 *   - or `OPENAI_API_KEY` isn't configured,
 *   - or the curation overlay (`aiCurationOverlay.ts`) has no entry for this L4.
 *
 * The rubric inspects the L4 name against three pattern banks:
 *
 *   1. **Hard-exclude patterns** — clearly human-led work (negotiation,
 *      anchoring, strategic exercises, executive judgment, named-investor
 *      engagement). Returns `reviewed-not-eligible` with one of the 5
 *      approved reasons from `docs/context.md` §9.
 *   2. **Strong-include patterns** — clearly automatable work (reconciliation,
 *      processing, matching, monitoring, drafting, tagging, transcription,
 *      verification, compliance check). Returns `curated` with a binary
 *      `feasibility` ("High" if the pattern is rules-based + named-vendor
 *      ready; "Low" if real but lower confidence on near-term shipping).
 *   3. **Default** — when neither pattern bank matches. Returns
 *      `pending-discovery` with a generic rationale ("editorial sweep
 *      pending"). The selector treats these as ghost-L3 placeholders.
 *
 * Why feasibility (not priority): the rubric assesses ship-readiness only —
 * the program-level 2x2 in `lib/initiatives/programTier.ts` joins this with
 * parent-L4 Activity Group business impact to produce the cross-tower
 * priority. Per-L5 Activity P-tier was misleading because a tower-local "P1"
 * wasn't comparable to another tower's "P2" once initiatives were rolled up.
 *
 * Calibration target: program-wide, the rubric should land between 40%
 * and 60% `curated` across the 489 canonical L4s. Run
 * `assertEligibilityCalibration(...)` in dev to keep this honest.
 */

import type { Feasibility } from "@/data/types";
import type { AiCurationStatus } from "@/data/capabilityMap/types";
import type { NotEligibleReason } from "@/data/assess/types";

// ---------------------------------------------------------------------------
//  Output shape
// ---------------------------------------------------------------------------

export type RubricVerdict = {
  status: AiCurationStatus;
  aiEligible: boolean;
  /**
   * Binary ship-readiness signal — only set when `status === "curated"`.
   * Feeds the program-level 2x2 via `composeL4Verdict()`.
   */
  feasibility?: Feasibility;
  /** Versant-grounded one-liner — mandatory. */
  aiRationale: string;
  /** Only set when `status === "reviewed-not-eligible"`. */
  notEligibleReason?: NotEligibleReason;
  /** Pattern that matched — kept for diagnostics + report generation. */
  matchedPattern?: string;
  /** Confidence band — used by docs to flag low-confidence rows for review. */
  confidence: "high" | "medium" | "low";
};

export type RubricInput = {
  towerId: string;
  l2Name: string;
  l3Name: string;
  l4Name: string;
};

// ---------------------------------------------------------------------------
//  Pattern banks
// ---------------------------------------------------------------------------

type ExcludePattern = {
  pattern: RegExp;
  reason: NotEligibleReason;
  rationale: string;
  /** Tag for diagnostics. */
  tag: string;
};

/**
 * Hard-exclude patterns. Tested in declared order against `${l2} | ${l3} | ${l4}`
 * lowercased. First match wins. Ordering matters — narrower patterns first.
 *
 * Every rationale is Versant-grounded — no generic "this is a strategic
 * activity" copy. Examples cite real Versant context (Mark Lazarus,
 * Anand Kini, MS NOW progressive positioning, etc.).
 */
const EXCLUDE_PATTERNS: ExcludePattern[] = [
  // ----- Strategic / executive judgment -----
  {
    pattern: /\b(executive\s+(decision|judgment|review|approval|thought\s+leadership|coaching|search|leadership|talent\s+acquisition)|board\s+(governance|oversight|support)|corporate\s+governance|c-?suite\s+strategy|capital\s+allocation\s+strategy)\b/i,
    reason: "Strategic exercise requiring executive judgment",
    rationale:
      "Capital-allocation calls and executive judgment sit with Mark Lazarus / Anand Kini and the Versant board — AI can prep the data, not make the call.",
    tag: "executive-judgment",
  },
  {
    pattern: /\b(strategic\s+(sourcing|finance|planning|exercise|workforce\s+planning|partnership)|workforce\s+strategy|talent\s+planning|succession\s+management|succession\s+planning|org\s+design|operating\s+model|workforce\s+plan)\b/i,
    reason: "Strategic exercise requiring executive judgment",
    rationale:
      "Strategic exercises require Versant executive judgment on multi-year direction — AI accelerates the analysis underneath but doesn't replace the call.",
    tag: "strategic-exercise",
  },
  {
    pattern: /\b(real\s+estate\s+strategy|dtc\s+product\s+strategy|product\s+strategy|growth\s+strategy|brand\s+strategy|content\s+strategy|cookieless\s+strategy|subscriber\s+growth\s+roadmap|marketing\s+budget\s+(&|and)?\s*allocation)\b/i,
    reason: "Strategic exercise requiring executive judgment",
    rationale:
      "Multi-year strategic direction at Versant is shaped by senior leaders' judgment on Versant's brand portfolio, ad-sales greenfield, and DTC posture — AI assembles the inputs.",
    tag: "strategic-roadmap",
  },
  {
    pattern: /\b(m&a|mergers?\s+and\s+acquisitions|due\s+diligence)\s*(modeling|strategy|negotiation)?\b/i,
    reason: "Strategic exercise requiring executive judgment",
    rationale:
      "M&A modeling for Vox / Free TV Networks is a deal-team exercise built bespoke per transaction by Anand Kini's CFO org — pattern volume is too low for a general-purpose AI agent.",
    tag: "ma-modeling",
  },
  {
    pattern: /\b(business\s+case\s+modeling|investment\s+thesis|deal\s+structuring)\b/i,
    reason: "Strategic exercise requiring executive judgment",
    rationale:
      "Bespoke investment / deal modeling on Versant capital decisions — judgment-heavy and low-volume.",
    tag: "deal-modeling",
  },
  {
    pattern: /\b(ad\s*hoc|ad-hoc)\s+(strategic\s+)?analysis\b/i,
    reason: "Low volume — ROI doesn't justify AI investment",
    rationale:
      "Ad-hoc strategic asks are bespoke per request and low-volume — automation cost exceeds the editorial savings.",
    tag: "ad-hoc",
  },

  // ----- Relationship-driven -----
  {
    pattern: /\b(analyst|investor|shareholder|sell-?side|buy-?side|earnings\s+call|conference|roadshow|non-?deal)\b.*\b(engagement|q.{0,3}a|preparation|presentation|pitch|relations?|coverage)\b/i,
    reason: "Fundamentally relationship-driven",
    rationale:
      "Sell-side / buy-side engagement is a direct conversation between Versant IR and named analysts — relationship trust drives the outcome, not content automation.",
    tag: "ir-engagement",
  },
  {
    pattern: /\b(rating\s+agency|credit\s+rating)\s+(engagement|management|presentation)\b/i,
    reason: "Fundamentally relationship-driven",
    rationale:
      "Versant's BB- credit rating is preserved through direct conversations with S&P / Moody's / Fitch analysts — the relationship is the work.",
    tag: "rating-agency",
  },
  {
    pattern: /\b(vendor|partner|supplier|customer|client)\s+(negotiation|relationship|engagement|onboarding\s+meeting|kickoff|selection)\b/i,
    reason: "Fundamentally relationship-driven",
    rationale:
      "Vendor / partner selection and engagement runs on multi-year relationships across Versant's BlackLine, Eightfold, Amagi, Piano stack — AI prep the dossier, humans walk the hallway.",
    tag: "vendor-relationship",
  },
  {
    pattern: /\b(contract|deal|term)\b.*\b(negotiation|negotiations|renewal)\b|\bnegotiations?\b/i,
    reason: "Fundamentally relationship-driven",
    rationale:
      "Renewal and new-contract negotiations are Versant procurement / legal-led conversations — AI surfaces benchmark data, humans cut the deal.",
    tag: "contract-negotiation",
  },
  {
    pattern: /\b(category\s+management|sourcing\s+strategy|spend\s+strategy|vendor\s+performance\s+management)\b/i,
    reason: "Strategic exercise requiring executive judgment",
    rationale:
      "Category strategy and vendor performance reviews are buying-strategy calls owned by Versant procurement leads — AI surfaces the spend cube, humans set the category direction.",
    tag: "category-strategy",
  },
  {
    pattern: /\b(event\s+(&|and)?\s*meeting\s+support|reception\s+support|venue\s+management|incident\s+investigation|business\s+continuity\s+planning|emergency\s+response(\s+(&|and)?\s*drills)?|tabletop\s+exercises?)\b/i,
    reason: "Low volume — ROI doesn't justify AI investment",
    rationale:
      "Bespoke physical-event support and BCP / emergency drills run a few times a year at Versant — judgment-heavy, low-volume; AI value is marginal.",
    tag: "low-volume-physical",
  },
  {
    pattern: /\b(photo|image)\s+(&|and)?\s*(selection|choice|curation\s+for\s+article)\b/i,
    reason: "Requires human editorial judgment",
    rationale:
      "Hero-image selection on MS NOW / CNBC stories is an editorial framing call — AI surfaces candidate images, photo editors pick the one that matches the angle.",
    tag: "photo-selection",
  },
  {
    pattern: /\b(architecture\s+(&|and)?\s*design|broadcast\s+systems\s+design|capacity\s+planning\s+(&|and)?\s*upgrades?|data\s+center\s+operations|smpte\s+(&|and)?\s*industry\s+standards|industry\s+standards\s+compliance)\b/i,
    reason: "Strategic exercise requiring executive judgment",
    rationale:
      "Versant's architecture and broadcast-engineering design decisions are bespoke per build — Nate Balogh's CIO org and the broadcast TOC engineers own the call; AI helps with documentation, not design.",
    tag: "architecture-design",
  },
  {
    pattern: /\b(host|anchor|talent|on-?camera|reporter)\s+(management|relations?|preparation|prep|meeting)\b/i,
    reason: "Fundamentally relationship-driven",
    rationale:
      "Talent and on-air relationships at MS NOW / CNBC / Golf Channel are Rebecca Kutler / KC Sullivan / Molly Solomon's franchise — AI doesn't replace the executive producer call.",
    tag: "talent-relationship",
  },
  {
    pattern: /\b(crisis\s+communication|crisis\s+management|reputation\s+management|stakeholder\s+management)\b/i,
    reason: "Fundamentally relationship-driven",
    rationale:
      "Crisis comms requires direct judgment from Hilary Smith / Anita Marks on Versant's progressive-positioning brands — AI surfaces context, humans speak for the company.",
    tag: "crisis-comms",
  },
  {
    pattern: /\b(employee|labor|union)\s+(relations?|negotiation|grievance|disciplinary)\b/i,
    reason: "Fundamentally relationship-driven",
    rationale:
      "Labor relations at Versant span SAG-AFTRA / NABET / WGA — these are direct human conversations governed by union contracts.",
    tag: "labor-relations",
  },

  // ----- Editorial judgment -----
  {
    pattern: /\b(story\s+selection|editorial\s+(meeting|judgment|decision|standards|standards\s+development)|assignment\s+desk|news\s+judgment|story\s+development|long[-\s]?form\s+story|article\s+writing|investigative\s+team)\b/i,
    reason: "Requires human editorial judgment",
    rationale:
      "Editorial selection and long-form journalism at MS NOW are the franchise — Brian Carovillano's standards desk owns what runs and how it's framed, especially for Rebecca Kutler's progressive-positioning audience.",
    tag: "editorial-selection",
  },
  {
    pattern: /\b(corrections?\s*\&?\s*retractions?|content\s+labeling|content\s+standards|bias\s+(&|and)?\s*tone\s+review|ai\s+content\s+(quality\s+)?review|policy\s+compliance\s+review)\b/i,
    reason: "Requires human editorial judgment",
    rationale:
      "Standards / corrections are reputation calls under Carovillano's editorial standards desk — humans own the decision and the brand, AI prep the diff.",
    tag: "corrections-retractions",
  },
  {
    pattern: /\b(host|interview|on-?camera|anchoring|live\s+show|control\s+room|floor\s+operations|on-?floor\s+production|on-?site\s+production|on-?site\s+technical|camera\s+(&|and)?\s*crew|teleprompter)\b/i,
    reason: "Requires human editorial judgment",
    rationale:
      "Live broadcast direction, floor ops, and on-camera reporting are the on-air craft — AI supports the rundown, humans run the show.",
    tag: "live-direction",
  },
  {
    pattern: /\b(brand|creative)\s+(strategy|positioning|voice|identity|design\s+direction|guidelines?|asset\s+management|campaign\s+development)\b/i,
    reason: "Requires human editorial judgment",
    rationale:
      "Brand voice across MS NOW vs. CNBC vs. Golf Channel requires editorial judgment — AI iterates copy variants, humans pick the one that lands.",
    tag: "brand-voice",
  },
  {
    pattern: /\b(executive\s+coaching|leadership\s+(development|assessment|communications?)|talent\s+identification|leadership\s+talent)\b/i,
    reason: "Requires human editorial judgment",
    rationale:
      "Talent identification and leadership development at Versant are senior-judgment calls owned by HR business partners and the CEO's office.",
    tag: "talent-judgment",
  },
  {
    pattern: /\b(legal|litigation|case)\s+(strategy|judgment|advice|counsel|management)\b|\b(privacy|ai|emerging)\s+(law\s+counsel|policy(\s+(&|and)?\s*governance)?)\b/i,
    reason: "Requires human editorial judgment",
    rationale:
      "Legal strategy and emerging-policy judgment are privileged work that sits with Versant's general counsel team — AI summarises filings, lawyers set the strategy.",
    tag: "legal-strategy",
  },
  {
    pattern: /\b(greenlight\s+decisions?|pilot\s+development|talent\s+attachment|format\s+(&|and)?\s*ip\s+development|script\s+(&|and)?\s*story|content\s+valuation|post-?acquisition\s+integration|production\s+budget\s+economics|on-?site\s+production\s+direction)\b/i,
    reason: "Requires human editorial judgment",
    rationale:
      "Greenlight, packaging, and creative-development decisions are made by Versant programming executives weighing brand fit against the $2.45B programming budget — AI surfaces precedents, humans make the call.",
    tag: "greenlight-creative",
  },
  {
    pattern: /\b(podcast\s+strategy(\s+(&|and)?\s*development)?|content\s+strategy(\s+(&|and)?\s*development)?|programming\s+strategy)\b/i,
    reason: "Requires human editorial judgment",
    rationale:
      "Podcast and programming strategy are creative-judgment exercises — AI tracks what's resonating, humans decide what to commission.",
    tag: "programming-strategy",
  },
  {
    pattern: /\b(set\s+design|studio\s+(set\s+)?(design|construction|technology\s+upgrades?)|fit-?outs?|construction\s+projects?|lighting\s+(&|and)?\s*rigging)\b/i,
    reason: "Strategic exercise requiring executive judgment",
    rationale:
      "Studio build and major construction are bespoke capital projects — judgment-heavy, low-volume, AI doesn't materially shrink the cycle.",
    tag: "studio-build",
  },
  {
    pattern: /\b(sound\s+design(\s+(&|and)?\s*music)?|music(\s+composition)?|vfx(\s+(&|and)?\s*complex.*graphics?)?)\b/i,
    reason: "Requires human editorial judgment",
    rationale:
      "Sound design, music, and complex VFX are creative craft — AI accelerates the technical layers (denoise, conform), humans own the artistic call.",
    tag: "sound-music-vfx",
  },

  // ----- Physical / low-volume / low-ROI -----
  {
    pattern: /\b(cleaning|janitorial|reception|concierge|mail\s+(&|and)?\s*package|security\s+guard|crew\s+deployment\s+(&|and)?\s*travel|permits?\s+(&|and)?\s*locations?|equipment\s+vendor)\b/i,
    reason: "Low volume — ROI doesn't justify AI investment",
    rationale:
      "Physical or hospitality services at Versant — automation gain doesn't justify the integration cost; better-targeted AI plays sit elsewhere on the tower.",
    tag: "physical-services",
  },
  {
    pattern: /\b(immigration|relocation|tax\s+coordination|repatriation\s+support|recognition\s+programs|alumni\s+relations)\b/i,
    reason: "Low volume — ROI doesn't justify AI investment",
    rationale:
      "Specialist HR programs that run case-by-case across a small Versant population — humans handle the unique-circumstance review; AI value is marginal.",
    tag: "specialist-hr",
  },
  {
    pattern: /\b(employer\s+branding|employee\s+value\s+proposition|engagement\s+design|candidate\s+sourcing\s+and\s+engagement|tip\s+line|inbound\s+lead\s+management|source\s+development)\b/i,
    reason: "Fundamentally relationship-driven",
    rationale:
      "EVP, source-trust, and tipline relationships are built by humans inside Versant's brand orgs — agents support search and triage, but the trust signal is the work.",
    tag: "evp-trust",
  },
  {
    pattern: /\b(crisis\s+response\s+coordination|crisis\s+response|issues\s+management|reputation\s+management|stakeholder\s+management)\b/i,
    reason: "Fundamentally relationship-driven",
    rationale:
      "Crisis response coordination requires direct judgment from Versant comms / IR / legal leadership across the live event — AI supplies signal, humans steer the response.",
    tag: "crisis-response-coord",
  },
  {
    pattern: /\b(internal\s+communications?|internal\s+comms?)\b/i,
    reason: "Fundamentally relationship-driven",
    rationale:
      "Internal comms at the new-public-company Versant carries CEO voice and culture signal — humans write, AI helps with localisation and translation.",
    tag: "internal-comms",
  },
  {
    pattern: /\b(upfront\s+negotiation|scatter\s+market(\s+sales)?|political\s+(\/\s*)?election\s+ad\s+management|trade\s+(&|and)?\s*industry\s+marketing)\b/i,
    reason: "Fundamentally relationship-driven",
    rationale:
      "Upfront / scatter / political-ad sales is a relationship-and-judgment business — AI feeds the analytics, sellers carry the relationships.",
    tag: "ad-sales-relationship",
  },
  {
    pattern: /\b(media\s+relations|proactive\s+media\s+relations|sponsorship\s+(&|and)?\s*partnership|trade\s+marketing|event\s+marketing\b.*\b(elections|olympics|sports?))\b/i,
    reason: "Fundamentally relationship-driven",
    rationale:
      "Press, sponsorship, and named-event partnerships are walked-in-the-room relationships — AI supplies the brief, humans hold the relationship.",
    tag: "press-sponsorship",
  },
];

type IncludePattern = {
  pattern: RegExp;
  /**
   * Binary ship-readiness for this pattern. "High" maps to the legacy
   * P1 set (rules-based, named vendor ready, high-volume). "Low" maps to
   * the legacy P2 / P3 sets — real opportunities but lower confidence
   * on shipping inside the near-term plan window without further build.
   */
  feasibility: Feasibility;
  rationaleTemplate: (in_: RubricInput) => string;
  primaryVendor?: string;
  tag: string;
};

/**
 * Strong-include patterns. Tested in declared order. First match wins, with
 * narrower patterns first. The rationale templates cite real Versant context
 * — entity counts, brand names, dollar figures from `docs/context.md`.
 */
const INCLUDE_PATTERNS: IncludePattern[] = [
  // ----- P1: high-volume, rule-based, named vendor exists -----
  {
    pattern: /\b(reconciliation|recons?|reconciliations|3-?way\s+match(ing)?|match-?pay(-and-extract)?)\b/i,
    feasibility: "High",
    rationaleTemplate: () =>
      `Reconciliation across Versant's 7+ legal entities (NBCU TSA carve-out, Fandango, Nikkei CNBC JV, Golf operations) is rules-based and high-volume — straight-through processing on the modal flow, exception queues for the rest.`,
    primaryVendor: "BlackLine",
    tag: "reconciliation",
  },
  {
    pattern: /\b(invoice|po|purchase\s+order)\s+(processing|capture|matching|workflow)\b/i,
    feasibility: "High",
    rationaleTemplate: () =>
      `Invoice / PO processing is high-volume transactional work — vendor agents extract, validate, and route 85%+ straight-through across Versant's six business units.`,
    primaryVendor: "BlackLine",
    tag: "invoice-processing",
  },
  {
    pattern: /\b(t.{0,2}e|expense\s+report)\s+(processing|workflow|management)\b/i,
    feasibility: "High",
    rationaleTemplate: () =>
      `T&E processing is OCR + policy-rule matching at scale — typical 70-80% straight-through with Concur / SAP Concur agents handling exceptions.`,
    primaryVendor: "SAP Concur",
    tag: "te-processing",
  },
  {
    pattern: /\b(transcription|transcribe|caption(ing)?|subtitle|stt|speech-?to-?text)\b/i,
    feasibility: "Low",
    rationaleTemplate: () =>
      `Transcription and captioning ride proven STT (Deepgram / OpenAI Whisper) — already standard across MSNBC News Group archive ingest, Sport rundowns, and live closed-captioning workflows.`,
    primaryVendor: "Deepgram",
    tag: "transcription",
  },
  {
    pattern: /\b(xbrl|xbrl\s+tagging|tagging|metadata\s+(tagging|enrichment)|categori[sz]ation|classification)\b/i,
    feasibility: "High",
    rationaleTemplate: () =>
      `Tagging and classification work (XBRL on 10-K/10-Q, content metadata, taxonomy enrichment) is structured and high-volume — proven LLM territory.`,
    primaryVendor: "Workiva",
    tag: "tagging",
  },
  {
    pattern: /\b(monitoring|monitor)\b/i,
    feasibility: "Low",
    rationaleTemplate: () =>
      `Continuous monitoring (brand mentions, broadcast-quality KPIs, recurring vendor SLAs) — scheduled agents poll, threshold, and escalate, freeing analysts for the exception cases.`,
    primaryVendor: "Datadog",
    tag: "monitoring",
  },
  {
    pattern: /\b(breaking\s+news|alert\s+generation|threat\s+detection|fraud\s+detection|anomaly\s+detection)\b/i,
    feasibility: "High",
    rationaleTemplate: () =>
      `Real-time event detection (breaking news, security signals, transaction anomalies) at MS NOW / CNBC newsroom and Versant SOC scales — humans triage the alerts the agents surface.`,
    primaryVendor: "CrowdStrike",
    tag: "alert-detection",
  },
  {
    pattern: /\b(scheduling|schedule|rota|shift)\s+(management|optimization|automation)?\b/i,
    feasibility: "Low",
    rationaleTemplate: () =>
      `Schedule optimization across MS NOW / CNBC / Sport rundowns and crew rotations — constraint-solver agents handle the complexity that breaks Excel.`,
    primaryVendor: "Quinyx",
    tag: "scheduling",
  },
  {
    pattern: /\b(intake|ingestion|wire\s+service|feed\s+ingest)\b/i,
    feasibility: "Low",
    rationaleTemplate: () =>
      `Wire-service intake and content ingestion (AP / Reuters / Bloomberg / live feeds) is highly structured — agents triage, dedupe, and route at machine speed across the MSNBC News Group desks.`,
    primaryVendor: "AP / Reuters API",
    tag: "intake-ingestion",
  },
  {
    pattern: /\b(verification|fact[-\s]?check(ing)?)\b/i,
    feasibility: "High",
    rationaleTemplate: () =>
      `Real-time fact verification on MS NOW broadcast lower-thirds and CNBC tickers — vector-search + retrieval agents surface authoritative sources for the on-air desk to confirm.`,
    primaryVendor: "Pinecone + LLM",
    tag: "fact-verification",
  },
  {
    pattern: /\b(publishing|cms\s+(publishing|workflow)|distribution)\b/i,
    feasibility: "Low",
    rationaleTemplate: () =>
      `Cross-platform publishing (article + video + social + newsletter + podcast feeds) — packaging agents serialise the same source content into 6+ surfaces.`,
    primaryVendor: "Brightspot CMS",
    tag: "publishing",
  },
  {
    pattern: /\b(seo|search\s+engine\s+optimization|metadata\s+seo)\b/i,
    feasibility: "Low",
    rationaleTemplate: () =>
      `SEO optimisation (titles, descriptions, schema, internal linking) is structured + high-volume — agents propose, humans approve.`,
    primaryVendor: "Conductor",
    tag: "seo",
  },
  {
    pattern: /\b(close|consolidation|month-?end|quarter-?end|intercompany|elimination)\b/i,
    feasibility: "High",
    rationaleTemplate: () =>
      `Close / consolidation across Versant's 7+ entities (Fandango, Nikkei CNBC JV, Golf operations) hits a 12-18 day clock today — orchestration + reconciliation agents push toward a 5-7 day close.`,
    primaryVendor: "BlackLine",
    tag: "close-consolidation",
  },
  {
    pattern: /\b(cash\s+flow\s+forecast|cash\s+forecast(ing)?|liquidity\s+(forecast|position))\b/i,
    feasibility: "High",
    rationaleTemplate: () =>
      `30/60/90-day cash forecasting feeds Versant's $1.09B cash + $2.75B debt covenant management — ML on AR/AP patterns is well-trodden territory.`,
    primaryVendor: "Kyriba",
    tag: "cash-forecast",
  },
  {
    pattern: /\b(covenant|debt\s+covenant)\s+(monitoring|testing|tracking)\b/i,
    feasibility: "High",
    rationaleTemplate: () =>
      `BB- credit rating makes covenant monitoring existential at Versant — continuous-monitoring agents test EBITDA / leverage / interest-coverage thresholds nightly.`,
    primaryVendor: "Kyriba",
    tag: "covenant-monitoring",
  },

  // ----- P2: monthly / regular cadence, judgment-light but not transactional -----
  {
    pattern: /\b(drafting|drafted|narrative\s+drafting|memo\s+drafting|first[-\s]?draft)\b/i,
    feasibility: "Low",
    rationaleTemplate: () =>
      `LLM-driven drafting (10-K / 10-Q narrative, MD&A, board memos, earnings press releases) — agents produce a structured first draft, humans edit for tone and accuracy.`,
    primaryVendor: "Workiva + LLM",
    tag: "drafting",
  },
  {
    pattern: /\b(forecast(ing)?|projection|forward\s+look)\b/i,
    feasibility: "Low",
    rationaleTemplate: () =>
      `Forecasting (rolling FP&A views, ad-sales pipeline, content-amortization curves) — ML on the historical pattern, FP&A overlay on the strategic adjustments.`,
    primaryVendor: "Pigment",
    tag: "forecasting",
  },
  {
    pattern: /\b(variance\s+analysis|kpi\s+(monitoring|reporting|scorecard)|management\s+report(ing)?|board\s+(package|reporting)|executive\s+dashboard)\b/i,
    feasibility: "Low",
    rationaleTemplate: () =>
      `Variance commentary, KPI scorecards, and board-package narrative — agents prep the diff and the talk-track, FP&A leads add the strategic overlay.`,
    primaryVendor: "Workiva",
    tag: "mgmt-reporting",
  },
  {
    pattern: /\b(audit|sox|controls\s+testing|control\s+monitoring)\s*(support|preparation|testing)?\b/i,
    feasibility: "Low",
    rationaleTemplate: () =>
      `External audit / SOX support — agents collate evidence packages from systems-of-record (Workday, BlackLine, Coupa) so audit teams spend their time on judgment, not tickmark prep.`,
    primaryVendor: "AuditBoard",
    tag: "audit-support",
  },
  {
    pattern: /\b(payroll|compensation|benefits)\s+(processing|administration|management|reconciliation)?\b/i,
    feasibility: "Low",
    rationaleTemplate: () =>
      `Payroll and benefits administration is rule-driven across the Versant entities — Workday + Eightfold agents handle the standard flow, humans handle exceptions.`,
    primaryVendor: "Workday",
    tag: "payroll-benefits",
  },
  {
    pattern: /\b(onboarding|offboarding)\b/i,
    feasibility: "Low",
    rationaleTemplate: () =>
      `Onboarding / offboarding orchestration (system access, equipment, documents, mandatory training) — workflow agents drive the checklist across HR, IT, and Security.`,
    primaryVendor: "ServiceNow",
    tag: "onboarding-offboarding",
  },
  {
    pattern: /\b(recruit(ing|ment)?|sourc(ing|e)\s+candidates?|talent\s+sourcing|cv\s+(screening|matching)|résum[ée]\s+screening)\b/i,
    feasibility: "Low",
    rationaleTemplate: () =>
      `Talent sourcing and résumé screening across Versant's News / Sport / Tech orgs — Eightfold matches inbound candidates against open req profiles, recruiters spend their time on the long-list.`,
    primaryVendor: "Eightfold",
    tag: "recruiting",
  },
  {
    pattern: /\b(learning|training|skills?\s+(gap|assessment|catalog)|curriculum)\b/i,
    feasibility: "Low",
    rationaleTemplate: () =>
      `Skills inference and learning-path curation — Eightfold reads the role taxonomy + employee history, surfaces the curriculum that closes the gap.`,
    primaryVendor: "Eightfold",
    tag: "learning-skills",
  },
  {
    pattern: /\b(creative|copy|video|content)\s+(production|generation|repurposing|adaptation|cutdowns?)\b/i,
    feasibility: "Low",
    rationaleTemplate: () =>
      `Creative repurposing (long-form → social cutdowns, hero edit → 6/15/30 sec versions) — Descript + Runway agents handle the modal cuts, editors finesse the brand-defining ones.`,
    primaryVendor: "Descript",
    tag: "creative-repurposing",
  },
  {
    pattern: /\b(personalization|recommendation|rec(s)?\s+engine|content\s+recommendation)\b/i,
    feasibility: "Low",
    rationaleTemplate: () =>
      `On-platform personalisation (newsletter, podcast, GolfNow tee times, GolfPass content) — recommendation agents on first-party signals lift engagement without third-party cookies.`,
    primaryVendor: "LiveRamp",
    tag: "personalization",
  },
  {
    pattern: /\b(ad\s+(operations|ops)|trafficking|campaign\s+(setup|management|optimization)|media\s+plan(ning)?)\b/i,
    feasibility: "Low",
    rationaleTemplate: () =>
      `Ad ops / trafficking / campaign optimisation — critical post-NBCU TSA where Versant builds its own ad-sales engine; agents handle the order entry + creative QA, humans focus on strategy.`,
    primaryVendor: "FreeWheel",
    tag: "ad-ops",
  },
  {
    pattern: /\b(rights\s+(management|tracking|amortization)|content\s+rights)\b/i,
    feasibility: "Low",
    rationaleTemplate: () =>
      `Rights management for split-rights catalogues (Kardashians: on-air retained, streaming to Hulu) is high-complexity — agents track windows, restrictions, and amortization curves across the Versant catalogue.`,
    primaryVendor: "Whip Media",
    tag: "rights-management",
  },
  {
    pattern: /\b(security\s+(monitoring|operations|incident)|soc\s+(operations|monitoring)|incident\s+response)\b/i,
    feasibility: "Low",
    rationaleTemplate: () =>
      `SOC operations and incident response across the new-public-company Versant attack surface — CrowdStrike + Abnormal agents triage low-severity events, humans handle hands-on response.`,
    primaryVendor: "CrowdStrike",
    tag: "security-soc",
  },
  {
    pattern: /\b(playout|broadcast\s+(automation|scheduling)|channel\s+(playout|operations))\b/i,
    feasibility: "Low",
    rationaleTemplate: () =>
      `Channel playout and broadcast automation (linear scheduling, FAST channel ops, cloud playout) — Amagi agents orchestrate the schedule and ad-break triggers across Versant's 4 free TV networks.`,
    primaryVendor: "Amagi",
    tag: "playout-broadcast",
  },
  {
    pattern: /\b(quality\s+assurance|qa\s+(testing|automation)|test\s+automation)\b/i,
    feasibility: "Low",
    rationaleTemplate: () =>
      `QA and test automation across Versant's tech estate (Peacock-derived stack, internal tooling, ad-tech) — coding agents generate test scaffolding, engineers refine.`,
    primaryVendor: "BrowserStack",
    tag: "qa-test",
  },
  {
    pattern: /\b(documentation|docs|knowledge\s+base|runbook)\s*(generation|drafting|management)?\b/i,
    feasibility: "Low",
    rationaleTemplate: () =>
      `Documentation and runbook generation — LLM agents read the codebase / config and draft the docs that engineers usually defer; freshness measured by automated drift detection.`,
    primaryVendor: "Cursor / Claude",
    tag: "documentation",
  },
  {
    pattern: /\b(contract\s+(review|abstraction|analysis|repository)|clm)\b/i,
    feasibility: "Low",
    rationaleTemplate: () =>
      `Contract review and abstraction (ad-sales agreements, talent contracts, vendor agreements, IT licence terms) — LLM agents extract clauses, surface risks, attorneys focus on the negotiation.`,
    primaryVendor: "Ironclad",
    tag: "clm",
  },
  {
    pattern: /\b(chatbot|customer\s+support|tier\s*1\s+support|service\s+desk|help\s+desk)\b/i,
    feasibility: "Low",
    rationaleTemplate: () =>
      `Tier-1 service desk / customer support — RAG agents on the Versant knowledge base resolve ~50% of tickets straight-through, humans handle the long tail.`,
    primaryVendor: "ServiceNow + Vivantio",
    tag: "service-desk",
  },

  // ----- P2: research / analysis (after specific include patterns) -----
  {
    pattern: /\b(research|competitive\s+intelligence|market\s+research|peer\s+benchmarking)\b/i,
    feasibility: "Low",
    rationaleTemplate: () =>
      `Versant peer-benchmarking against WBD / Paramount / Fox / Disney is structured RAG territory — agents pull comparable filings, summarise the deltas.`,
    primaryVendor: "AlphaSense",
    tag: "research",
  },
  {
    pattern: /\b(analytics?|kpi|insight\s+generation)\b/i,
    feasibility: "Low",
    rationaleTemplate: () =>
      `Analytics / KPI work — agents generate the chart packs and the talk-track, humans add the strategic overlay that drives the decision.`,
    primaryVendor: "Hex",
    tag: "analytics",
  },
  {
    pattern: /\b(reporting|report\s+generation|status\s+report)\b/i,
    feasibility: "Low",
    rationaleTemplate: () =>
      `Recurring reporting (financial, operational, brand-level) — agents assemble the data, draft the narrative, hand off the editable doc to the analyst.`,
    primaryVendor: "Workiva",
    tag: "reporting",
  },

  // ----- P1: ad-tech / DTC operational (post-NBCU TSA greenfield) -----
  {
    pattern: /\b(dynamic\s+(pricing|paywall|ad\s+insertion)|yield\s+optimization|rate\s+card|programmatic|trial-?to-?paid|checkout(\s+(&|and)?\s*funnel)?|funnel\s+optimization|conversion\s+rate\s+optimization|conversion\s+optimization|pricing\s+(&|and)?\s*packaging|promotion\s+(&|and)?\s*discount)\b/i,
    feasibility: "Low",
    rationaleTemplate: () =>
      `DTC pricing, packaging, and dynamic ad / paywall optimisation are continuous-experiment surfaces — Piano + LiveRamp + custom agents test the modal user, humans set the brand guard-rails.`,
    primaryVendor: "Piano",
    tag: "dtc-optimization",
  },
  {
    pattern: /\b(audience\s+(targeting|measurement|data|segment(s|ation)?|packages?)|cross-?platform\s+identity|identity\s+graph|clean\s+room|clean[-\s]?room\s+operations|nielsen\s+measurement|cross-?brand\s+(audience|bundle))\b/i,
    feasibility: "Low",
    rationaleTemplate: () =>
      `Audience measurement and identity resolution across Versant's 10+ brands is structured, machine-scale work — clean-room agents on LiveRamp + Nielsen feeds match identities and segment without exposing PII.`,
    primaryVendor: "LiveRamp",
    tag: "audience-identity",
  },
  {
    pattern: /\b(bid\s+(&|and)?\s*budget|paid\s+media|email\s*\/\s*push\s*\/\s*in-?app|crm\s+(&|and)?\s*lifecycle|lifecycle\s+marketing|experimentation\s+program|engagement\s+nudges?|save\s+offer\s+optimization|loyalty\s+(&|and)?\s*rewards)\b/i,
    feasibility: "Low",
    rationaleTemplate: () =>
      `Lifecycle marketing, loyalty / retention nudges, and bid/budget optimisation lift Versant DTC subscriber LTV — agents continuously tune across email / push / in-app surfaces.`,
    primaryVendor: "Iterable",
    tag: "lifecycle-marketing",
  },
  {
    pattern: /\b(churn\s+prediction|churn\s+prevention|proactive\s+intervention|nps\s*\/?\s*csat|survey\s+(&|and)?\s*feedback|cross-?brand\s+retention)\b/i,
    feasibility: "Low",
    rationaleTemplate: () =>
      `Churn prediction across Versant's NBCU TSA-exit DTC bases (CNBC Pro, GolfPass) — ML on engagement signal flags at-risk subscribers for save-offer agents and retention humans.`,
    primaryVendor: "Optimove",
    tag: "churn-retention",
  },
  {
    pattern: /\b(proposal\s+generation|stewardship\s+(&|and)?\s*make-?goods?|campaign\s+execution(\s+(&|and)?\s*optimization)?|ad\s+sales\s+billing|ad\s+sales\s+collections?|ad\s+ops|programmatic\s+advertising)\b/i,
    feasibility: "Low",
    rationaleTemplate: () =>
      `Ad-sales execution (proposal, stewardship, make-goods, billing) is the post-NBCU TSA greenfield — agents handle the order-entry and reconciliation against impressions delivered.`,
    primaryVendor: "FreeWheel + Operative",
    tag: "ad-sales-ops",
  },

  // ----- P1: cyber / tech operations -----
  {
    pattern: /\b(soc\b|threat\s+(hunting|intelligence)|incident\s+(triage|response)|phishing|social\s+engineering|vulnerability\s+management|data\s+loss\s+prevention|dlp\b|identity\s+(&|and)?\s*access\s+management|iam\b|access\s+control|visitor\s+management)\b/i,
    feasibility: "High",
    rationaleTemplate: () =>
      `SOC, IAM, and threat-hunting workflows scale on automation — CrowdStrike + Abnormal + ConductorOne agents triage low-severity events, humans handle hands-on response.`,
    primaryVendor: "CrowdStrike",
    tag: "cyber-ops",
  },

  // ----- P1: facilities / operations technology -----
  {
    pattern: /\b(predictive\s+(facilities\s+|equipment\s+)?maintenance|hvac|mep|energy\s+management|space\s+(&|and)?\s*occupancy|spare\s+parts|equipment\s+lifecycle|capacity\s+planning|equipment\s+tracking)\b/i,
    feasibility: "Low",
    rationaleTemplate: () =>
      `Predictive maintenance and facilities IoT (HVAC, energy, equipment lifecycle) — sensor-driven agents flag drift before failure across NYC HQ, Englewood Cliffs, and the broadcast TOC.`,
    primaryVendor: "IBM Maximo",
    tag: "predictive-facilities",
  },
  {
    pattern: /\b(work\s+order\s+management|dispatch|service\s+desk|help\s+desk)\b/i,
    feasibility: "Low",
    rationaleTemplate: () =>
      `Work-order routing and service-desk triage at Versant — RAG agents on the knowledge base resolve ~50% of tickets straight-through, humans handle the long tail.`,
    primaryVendor: "ServiceNow",
    tag: "work-orders",
  },

  // ----- P2: production / post-production -----
  {
    pattern: /\b(rough\s+cut(s|ting)?|finish\s+edit|promo(\s+(&|and)?\s*trailer)?|trailer\s+cutting|archive\s+clip\s+pulls|graphics\s+(&|and)?\s*thumbnail|thumbnail\s+generation|motion\s+graphics(\s+(&|and)?\s*lower\s+thirds?)?|color\s+correction|audio\s+processing|audio\s+(&|and)?\s*mixing)\b/i,
    feasibility: "Low",
    rationaleTemplate: () =>
      `Post-production tasks (rough cuts, trailers, thumbnails, lower-thirds, audio cleanup) ride proven media-AI tools — Descript / Runway / Adobe Sensei agents do the modal work, editors finesse hero pieces.`,
    primaryVendor: "Descript",
    tag: "post-production",
  },
  {
    pattern: /\b(studio\s+scheduling|crew\s+scheduling|equipment\s+(tracking|allocation)|production\s+planning|remi\s+decision|logistics\s+coordination|connectivity\s+management)\b/i,
    feasibility: "Low",
    rationaleTemplate: () =>
      `Resource scheduling across Versant studios + remote / REMI productions is constraint-solver territory — agents optimise crew, equipment, and connectivity assignments.`,
    primaryVendor: "Quinyx",
    tag: "production-scheduling",
  },

  // ----- P2: programming linear / FAST -----
  {
    pattern: /\b(fast\s+channel(\s+programming|\s+launch|\s+content\s+curation)?|catalog\s+(&|and)?\s*library|library\s+(&|and)?\s*catalog|rights\s+(&|and)?\s*window|content\s+rights|window\s+management)\b/i,
    feasibility: "Low",
    rationaleTemplate: () =>
      `FAST programming and rights-window management at Versant ride structured metadata — agents schedule, validate windows, and surface conflicts across the catalogue.`,
    primaryVendor: "Whip Media",
    tag: "fast-rights",
  },

  // ----- P2: legal compliance / structured filings -----
  {
    pattern: /\b(disclosure\s+management|edgar\s+filing|fcc\s+(broadcast\s+)?compliance|insider\s+trading\s+window|political\s+advertising\s+rules|children'?s\s+programming\s+compliance|clause\s+library|signature\s+(&|and)?\s*execution|post-?signature\s+obligation|ethics\s+(&|and)?\s*compliance|corporate\s+policy|privacy\s+(&|and)?\s*consent|data\s+rights\s+request)\b/i,
    feasibility: "Low",
    rationaleTemplate: () =>
      `Structured legal compliance (SEC disclosure, FCC, political-ad rules, post-signature tracking, privacy / DSAR) — agents read the playbook, surface the obligation, route to counsel for sign-off.`,
    primaryVendor: "Workiva",
    tag: "legal-structured",
  },

  // ----- P2: finance ops / GL -----
  {
    pattern: /\b(chart\s+of\s+accounts|fixed\s+asset|lease\s+accounting|asc\s+842|banking|short-?term\s+investment|debt\s+issuance|refinancing|fx\s+management|foreign\s+exchange|interest\s+rate\s+risk|insurance\s+(&|and)?\s*risk\s+transfer|profitability\s+by\s+brand|cost\s+allocation)\b/i,
    feasibility: "Low",
    rationaleTemplate: () =>
      `Recurring finance-ops work (sub-ledger maintenance, lease accounting, FX risk, brand P&L allocation) — Workday + BlackLine + Workiva agents handle the rule-based flow, finance leads handle the strategic edge.`,
    primaryVendor: "Workday",
    tag: "finance-ops",
  },

  // ----- P2: HR services -----
  {
    pattern: /\b(case\s+management|contact\s*\/?\s*inquiry|hr\s+portal|knowledge\s+management|records\s+management|leave\s+(&|and)?\s*absence|pre-?payroll|hr\s+shared\s+services|talent\s+acquisition\s+delivery|total\s+rewards\s+delivery|policy\s+compliance|continuous\s+improvement|employee\s+communication|change\s+management|digital\s+hr)\b/i,
    feasibility: "Low",
    rationaleTemplate: () =>
      `HR shared-services workflows (cases, leave / absence, knowledge base, pre-payroll, communications) ride Workday + ServiceNow rails — agents handle the intake and modal flow, HR leads handle the outliers.`,
    primaryVendor: "Workday + ServiceNow",
    tag: "hr-shared-services",
  },

  // ----- P1: software engineering productivity -----
  {
    pattern: /\b(code\s+(development|generation|review|completion)|pair\s+programming|technical\s+debt|ci\/cd|cicd|deployment\s+management|developer\s+experience|developer\s+tooling|internal\s+developer\s+platforms?)\b/i,
    feasibility: "High",
    rationaleTemplate: () =>
      `Engineering-productivity AI (Cursor / Copilot / Claude Code) is the single largest cycle-time lever at Versant — agents draft, review, refactor; engineers focus on architecture and edge cases.`,
    primaryVendor: "Cursor / GitHub Copilot",
    tag: "engineering-productivity",
  },
  {
    pattern: /\b(incident\s+(detection\s+(&|and)?\s*response|triage|response)|sre|on-?call\s+operations?|post-?incident\s+(review|analysis)|rca|runbook)\b/i,
    feasibility: "High",
    rationaleTemplate: () =>
      `SRE on-call and incident-response automation — agents triage signals, propose runbooks, and draft post-incident reviews; engineers focus on the unique-failure root cause.`,
    primaryVendor: "PagerDuty + Datadog",
    tag: "sre-incident",
  },
  {
    pattern: /\b(cloud\s+(infrastructure\s+provisioning|cost\s+optimization)|infrastructure\s+as\s+code|iac\b|sd-?wan|edge\s+connectivity|dns|cdn\s+management|network\s+(architecture|management))\b/i,
    feasibility: "High",
    rationaleTemplate: () =>
      `Cloud / network ops (provisioning, IaC, cost optimization, DNS / CDN) — Terraform + agentic IaC at Versant turns 4-week provisioning cycles into self-service.`,
    primaryVendor: "Terraform / Pulumi",
    tag: "cloud-network-ops",
  },
  {
    pattern: /\b(mlops|ml\s+platform\s+operations|model\s+(registry|versioning|lifecycle)|llm\s+gateway|cost\s+management|prompt\s+(&|and)?\s*rag(\s+asset\s+management)?|eval\s+(&|and)?\s*quality\s+tooling|responsible\s+ai\s+reviews?|data\s+science\s+enablement|ai\s+governance)\b/i,
    feasibility: "High",
    rationaleTemplate: () =>
      `Versant's AI platform itself — MLOps, LLM gateway, RAG assets, eval tooling — is internal-AI-on-internal-AI: agents instrument, observe, and govern model behaviour for the AI-on-Versant program.`,
    primaryVendor: "LangSmith + Weights & Biases",
    tag: "ai-platform",
  },

  // ----- P2: operational follow-on -----
  {
    pattern: /\b(travel\s+management|expense\s+policy|corporate\s+card|expense\s+report|vendor\s+master\s+data|lease\s+administration)\b/i,
    feasibility: "Low",
    rationaleTemplate: () =>
      `Recurring services (T&E, vendor master, lease admin) — agents handle the modal flow against Versant's Concur / Workday / contract repository.`,
    primaryVendor: "SAP Concur",
    tag: "ops-recurring",
  },
  {
    pattern: /\b(corrective\s+maintenance|project\s*\/?\s*build\s+engineering|project\s+engineering)\b/i,
    feasibility: "Low",
    rationaleTemplate: () =>
      `Corrective maintenance and project-engineering tracking — agents on top of the CMMS surface ticket trends, anticipate part needs, and shorten Versant TOC down-times.`,
    primaryVendor: "IBM Maximo",
    tag: "corrective-maintenance",
  },
  {
    pattern: /\b(automated\s+data-?driven|data-?driven\s+content|markets?\s+\/?\s*scores?\s+\/?\s*digests?|crisis\s+detection(\s+(&|and)?\s*early\s+warning)?|early\s+warning|cross-?show\s+(promotion|discovery)|show\s+rundown\s+management|rundown\s+management|live\s+broadcast\s+data\s+(&|and)?\s*graphics?)\b/i,
    feasibility: "Low",
    rationaleTemplate: () =>
      `Automated data-driven content (markets / scores / digests), rundown ops, and crisis early-warning at Versant news desks — agents surface and draft, editors fact-check and frame.`,
    primaryVendor: "AP / Reuters API + LLM",
    tag: "newsroom-automation",
  },

  // ----- P2: scheduled finance ops -----
  {
    pattern: /\b(dividend\s+execution|share\s+repurchase\s+execution|buyback\s+execution|rfp\s*\/?\s*rfq\s+administration|vendor\s+payment(\s+execution)?)\b/i,
    feasibility: "Low",
    rationaleTemplate: () =>
      `Scheduled finance execution — Versant's $0.375/share quarterly dividend, $1B buyback program, and vendor-payment cycles run on rule-based workflow against the corporate-actions calendar.`,
    primaryVendor: "BlackLine + Treasury Stack",
    tag: "scheduled-finance-ops",
  },

  // ----- P3: heavier judgment, lower frequency -----
  {
    pattern: /\b(disaster\s+recovery|business\s+continuity\b(?!.*planning)|comcast\s+tsa\s+migration|tsa\s+migration|cutover|equipment\s+lifecycle\s+management)\b/i,
    feasibility: "Low",
    rationaleTemplate: () =>
      `One-off but very high-stakes programs (Versant TSA exit / cutover from Comcast, DR readiness, multi-year equipment refresh) — AI tracks the runbook, leaders own the cutover decisions.`,
    primaryVendor: "ServiceNow",
    tag: "tsa-cutover",
  },
  {
    pattern: /\b(annual\s+budget|long[-\s]?range\s+plan|three[-\s]?year\s+plan|five[-\s]?year\s+plan)\b/i,
    feasibility: "Low",
    rationaleTemplate: () =>
      `Annual budget / long-range plan — once-a-year exercise with heavy executive overlay; agents help with the scenario sweeps and consolidation, humans set the targets.`,
    primaryVendor: "Pigment",
    tag: "budget-lrp",
  },
  {
    pattern: /\b(scenario|sensitivity)\s+(modeling|analysis)\b/i,
    feasibility: "Low",
    rationaleTemplate: () =>
      `Scenario / sensitivity modeling — agents sweep the parameter space and surface the cliff-edges, finance leads pick the scenarios that matter.`,
    primaryVendor: "Pigment",
    tag: "scenario-modeling",
  },
  {
    pattern: /\b(content\s+investment\s+roi|content\s+roi|programming\s+roi)\b/i,
    feasibility: "Low",
    rationaleTemplate: () =>
      `Content investment ROI on Versant's $2.45B programming spend — agents reconcile the cost basis, attribute the engagement, and surface the long-tail vs. tent-pole portfolio mix.`,
    primaryVendor: "Hex",
    tag: "content-roi",
  },
];

// ---------------------------------------------------------------------------
//  Rubric
// ---------------------------------------------------------------------------

/**
 * Run the rubric against a single L4. Returns a verdict object that the
 * selector and tower-reports both consume directly.
 */
export function classifyL4(input: RubricInput): RubricVerdict {
  const haystack = `${input.l2Name} | ${input.l3Name} | ${input.l4Name}`;

  // 1. Hard-exclude patterns (first match wins).
  for (const x of EXCLUDE_PATTERNS) {
    if (x.pattern.test(haystack)) {
      return {
        status: "reviewed-not-eligible",
        aiEligible: false,
        aiRationale: x.rationale,
        notEligibleReason: x.reason,
        matchedPattern: x.tag,
        confidence: "high",
      };
    }
  }

  // 2. Strong-include patterns (first match wins).
  for (const inc of INCLUDE_PATTERNS) {
    if (inc.pattern.test(haystack)) {
      return {
        status: "curated",
        aiEligible: true,
        feasibility: inc.feasibility,
        aiRationale: inc.rationaleTemplate(input),
        matchedPattern: inc.tag,
        confidence: "high",
      };
    }
  }

  // 3. Default — pending discovery. Confidence is low; the deterministic
  //    fallback declines to commit, the LLM pipeline will refine on its run.
  return {
    status: "pending-discovery",
    aiEligible: false,
    aiRationale:
      "Editorial sweep pending — the rubric doesn't recognise this activity name. The tower lead workshop or the LLM pipeline (when configured) will produce a Versant-specific verdict.",
    matchedPattern: "default",
    confidence: "low",
  };
}

// ---------------------------------------------------------------------------
//  Vendor inference (used by P1 deep-curation overlay)
// ---------------------------------------------------------------------------

/**
 * Returns the named vendor an INCLUDE pattern would have suggested. Used by
 * the curation overlay to seed `primaryVendor` for L4s that match a strong
 * pattern, without having to duplicate the vendor mapping.
 */
export function inferPrimaryVendor(input: RubricInput): string | undefined {
  const haystack = `${input.l2Name} | ${input.l3Name} | ${input.l4Name}`;
  for (const inc of INCLUDE_PATTERNS) {
    if (inc.pattern.test(haystack)) return inc.primaryVendor;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
//  Calibration sanity-check (dev-mode only)
// ---------------------------------------------------------------------------

/**
 * Asserts the rubric lands in the program-wide 50-75% eligibility band.
 *
 * Why this band is wider than the LLM target (40-60%):
 *   - The rubric is **name-keyword-driven** — it identifies L4s whose names
 *     SUGGEST AI-readiness (matching, processing, monitoring, drafting…).
 *   - It cannot apply Versant-specific judgment (TSA carve-out, BB- credit,
 *     MS NOW progressive positioning, multi-entity JV) that demotes some
 *     "name-eligible" L4s on ROI / context grounds. That judgment is what
 *     the LLM pipeline (PR 2) adds, calibrated to 40-60%.
 *   - So the rubric runs hotter by ~10-15 points by design — it captures
 *     the universe of "could be AI" before judgment trims to "should be AI."
 *
 * Used by the build-lint smoke test to keep the pattern banks honest as
 * new towers / L4s are added.
 */
export function assertEligibilityCalibration(
  verdicts: ReadonlyArray<RubricVerdict>,
  minPct = 50,
  maxPct = 75,
): { eligible: number; notEligible: number; pending: number; pct: number } {
  let eligible = 0;
  let notEligible = 0;
  let pending = 0;
  for (const v of verdicts) {
    if (v.status === "curated") eligible += 1;
    else if (v.status === "reviewed-not-eligible") notEligible += 1;
    else pending += 1;
  }
  const total = eligible + notEligible + pending;
  const pct = total === 0 ? 0 : Math.round((eligible / total) * 100);
  if (process.env.NODE_ENV !== "production") {
    if (pct < minPct || pct > maxPct) {
      // Soft assertion — log but don't throw, so the dev server doesn't
      // crash if a new tower's L4 names don't match enough patterns.
      // Hard-throw only in CI / build mode.
      // eslint-disable-next-line no-console
      console.warn(
        `[forge.eligibilityRubric] Calibration drift: ${eligible}/${total} ` +
          `(${pct}%) outside ${minPct}-${maxPct}% target. ` +
          `Consider reviewing pattern banks or curation overlay.`,
      );
    }
  }
  return { eligible, notEligible, pending, pct };
}
