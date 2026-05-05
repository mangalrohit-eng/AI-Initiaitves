import type { CapabilityMapDefinition } from "./types";

/**
 * Capability Map — Finance (Forge tower: `finance`).
 *
 * Authoring conventions for `description` fields (PR3):
 *   - L2 description: 4-6 sentences setting the function-level context for
 *     the Job Grouping (people, scale, structural constraints).
 *   - L3 description: 3-5 sentences naming the Job Family's scope, vendor
 *     stack tilt, and Versant-specific complexity (TSA, JVs, BB- rating,
 *     split rights, new-public-company SEC obligations).
 *   - L4 description: 2-4 sentences naming the concrete work the Activity
 *     Group performs, the volume / cadence anchor, and the named vendor
 *     candidates from `versantPromptKit.ALLOWED_VENDORS`.
 *   - Always name real Versant brands, real people from `docs/context.md`
 *     §1, and real vendors from the allow-list. Avoid hedge language
 *     ("potentially", "could", "leverage AI"). Numeric anchors come from
 *     `docs/context.md` ($2.75B debt, $1.58B ad, $4.09B distribution,
 *     $0.375/share dividend, $2.45B programming, $1B buyback, etc.).
 *   - These descriptions feed both the Step 1/2/4 LLM prompts AND the
 *     curation content hash — re-authoring one of them flips affected
 *     rows to `queued` so the AI initiatives re-curate against the
 *     updated context. Treat edits as deliberate.
 */
export const financeCapabilities: CapabilityMapDefinition = {
  id: "finance-capabilities",
  name: "Finance Capabilities",
  l1Name: "Finance",
  mapRelatedTowerIds: ["finance"],
  l2: [
    {
      id: "finance-jg",
      name: "Finance",
      description:
        "Versant Finance is a stand-alone function being built off NBCU TSAs that expire ~2028 — close, treasury, payroll, and tax all migrate from NBCU shared services to Versant-owned platforms. CFO/COO Anand Kini owns the function alongside the broader operating model build (Greg Wright leads Controllership, Andre Hale leads FP&A). Multi-entity consolidation spans 7+ Versant brands plus the Fandango JV (75/25 with WBD) and the Nikkei CNBC JV — eliminations and FX are non-trivial. Year one closed with the maiden 10-K (FY2025); ongoing SEC reporting cadence is new-public-company scale (NASDAQ: VSNT). BB- credit rating means covenant monitoring on $2.75B debt is existential, and the $0.375/share quarterly dividend + $1B buyback authorization sets a cash-deployment floor every period.",
      l3: [
        {
          id: "finance-l2-record-to-report",
          name: "Record to Report",
          description:
            "Owns the close cycle, multi-entity consolidations, content-rights amortization, and external/management reporting. TSA exit forces a stand-alone close (target 5-7 days, down from 12-18 inside NBCU shared services) on Workday Financials / SAP S/4HANA / Oracle Fusion / NetSuite (final stack TBD pre-discovery). Nikkei CNBC and Fandango JV add elimination + minority-interest complexity; programming spend amortization across hundreds of multi-year deals (sports rights through 2032 USGA, Olympics on USA/CNBC) is a material accounting workstream. Vendor stack tilts toward BlackLine, FloQast, Trintech for orchestration; Workiva for SOX + filings.",
          l4: [
            {
              id: "finance-l3-close-consolidation",
              name: "Close & Consolidation",
              description:
                "Monthly + quarterly close orchestration across 7+ Versant entities, intercompany eliminations between MS NOW / CNBC / Golf Channel / GolfNow / GolfPass / USA Network / E! / Syfy / Oxygen True Crime / Fandango (75/25 WBD JV) / Nikkei CNBC JV, content-rights amortization on $2.45B annual programming spend, and revenue recognition across Distribution ($4.09B) / Ad ($1.58B) / Platforms ($826M). Substrate vendors: BlackLine for reconciliations, FloQast / Trintech for close orchestration, Workiva for SOX controls.",
              relatedTowerIds: ["finance"],
              l5: [
                { id: "finance-l4-month-end-close", name: "Month-End Close Orchestration" },
                { id: "finance-l4-quarterly-close", name: "Quarterly Close" },
                { id: "finance-l4-multi-entity-consolidation", name: "Multi-Entity Consolidation (Fandango / Nikkei CNBC JVs)" },
                { id: "finance-l4-intercompany-eliminations", name: "Intercompany Eliminations" },
                { id: "finance-l4-content-rights-amortization", name: "Content Rights Amortization" },
                { id: "finance-l4-revenue-recognition", name: "Revenue Recognition (Distribution / Ad / Platforms / Other)" },
                { id: "finance-l4-journal-entries", name: "Journal Entry Management" },
              ],
            },
            {
              id: "finance-l3-general-ledger",
              name: "General Ledger & Sub-Ledgers",
              description:
                "Chart of accounts maintenance, fixed assets, lease accounting (ASC 842), monthly balance-sheet reconciliations, and daily bank reconciliations across Versant entities. Standard ERP plumbing on Workday Financials / SAP S/4HANA / Oracle Fusion / NetSuite. High-volume rules-based work — primary AI substrate (BlackLine for recs, AppZen / Tipalti adjacent on AP).",
              relatedTowerIds: ["finance"],
              l5: [
                { id: "finance-l4-chart-of-accounts", name: "Chart of Accounts Maintenance" },
                { id: "finance-l4-fixed-assets", name: "Fixed Asset Accounting" },
                { id: "finance-l4-leases", name: "Lease Accounting (ASC 842)" },
                { id: "finance-l4-balance-sheet-recons", name: "Balance Sheet Reconciliations" },
                { id: "finance-l4-bank-recons", name: "Bank Reconciliations" },
              ],
            },
            {
              id: "finance-l3-external-reporting",
              name: "External Reporting",
              description:
                "10-K / 10-Q drafting under new-public-company SEC obligations (FY2025 maiden 10-K shipped; FY2026+ ongoing cadence), MD&A narrative authoring against Versant's segmented portfolio, XBRL tagging on Workiva, statutory + tax reporting across Nikkei JV jurisdictions (US + Japan), and external audit support. Brian Carovillano-style editorial discipline applies to MD&A — first-draft AI assist is appropriate, final narrative judgment stays human.",
              relatedTowerIds: ["finance"],
              l5: [
                { id: "finance-l4-10k-10q-drafting", name: "10-K / 10-Q Drafting" },
                { id: "finance-l4-mda-narrative", name: "MD&A Narrative Drafting" },
                { id: "finance-l4-xbrl-tagging", name: "XBRL Tagging" },
                { id: "finance-l4-statutory-reporting", name: "Statutory & Tax Reporting" },
                { id: "finance-l4-external-audit", name: "External Audit Support" },
              ],
            },
            {
              id: "finance-l3-management-reporting",
              name: "Management Reporting",
              description:
                "Monthly board reporting package, executive dashboards consumed by Mark Lazarus / Anand Kini / Deep Bagchee / KC Sullivan / Rebecca Kutler, segment + brand P&L reporting (Distribution $4.09B / Ad $1.58B / Platforms $826M slice down to MS NOW, CNBC, Golf Channel, GolfNow, GolfPass, USA, E!, Syfy, Oxygen, Fandango), and KPI scorecards. Reports are CEO/CFO-grade — narrative bar is high; executive judgment owns the read-out.",
              relatedTowerIds: ["finance"],
              l5: [
                { id: "finance-l4-board-package", name: "Board Reporting Package" },
                { id: "finance-l4-executive-dashboards", name: "Executive Dashboards" },
                { id: "finance-l4-segment-reporting", name: "Segment / Brand P&L Reporting" },
                { id: "finance-l4-kpi-scorecards", name: "KPI Scorecards" },
              ],
            },
          ],
        },
        {
          id: "finance-l2-treasury-capital",
          name: "Treasury & Capital",
          description:
            "Manages $2.75B of BB-rated debt (covenant breach is existential), ~$1.09B cash on hand, FX exposure on the Nikkei CNBC JV, $0.375/share quarterly dividend, and the $1B buyback authorization. Treasury stack tilts toward Kyriba or GTreasury for cash + bank connectivity. Capital allocation strategy stays executive-judgment work (CFO + Board); debt issuance and rating-agency engagement are relationship-driven. AI substrate is on the monitoring + reporting side, not the decision side.",
          l4: [
            {
              id: "finance-l3-cash-liquidity",
              name: "Cash & Liquidity",
              description:
                "30/60/90 day cash flow forecasting against the $0.375/share quarterly dividend obligation and $1B buyback program window, daily liquidity position across Versant entities, banking and cash management, and short-term investment of the ~$1.09B cash balance. Recurring + rules-based — Kyriba / GTreasury substrate.",
              relatedTowerIds: ["finance"],
              l5: [
                { id: "finance-l4-cash-flow-forecast", name: "Cash Flow Forecasting (30/60/90 day)" },
                { id: "finance-l4-bank-cash-mgmt", name: "Banking & Cash Management" },
                { id: "finance-l4-daily-position", name: "Daily Liquidity Position" },
                { id: "finance-l4-short-term-investments", name: "Short-Term Investment Management" },
              ],
            },
            {
              id: "finance-l3-debt-capital-markets",
              name: "Debt & Capital Markets",
              description:
                "Daily / weekly covenant monitoring on $2.75B debt at BB- — every covenant ratio (leverage, interest coverage) is tracked against thresholds since a breach trips the entire stack. Debt issuance + refinancing windows; credit rating agency engagement with Moody's / S&P / Fitch. Monitoring side is rules-based; issuance + agency dialogue is fundamentally relationship-driven.",
              relatedTowerIds: ["finance"],
              l5: [
                { id: "finance-l4-covenant-monitoring", name: "Debt Covenant Monitoring (BB- rating)" },
                { id: "finance-l4-debt-issuance", name: "Debt Issuance & Refinancing" },
                { id: "finance-l4-credit-rating", name: "Credit Rating Agency Engagement" },
              ],
            },
            {
              id: "finance-l3-capital-returns",
              name: "Capital Returns",
              description:
                "$0.375/share quarterly dividend execution and share repurchase execution under the $1B Board-authorized program. Capital allocation strategy itself (dividend raise, buyback pace, M&A vs deleveraging) is a strategic decision owned by Anand Kini + Mark Lazarus + the Board — not an AI workstream.",
              relatedTowerIds: ["finance"],
              l5: [
                { id: "finance-l4-dividend-execution", name: "Dividend Execution ($0.375/share quarterly)" },
                { id: "finance-l4-buyback-execution", name: "Share Repurchase Execution ($1B program)" },
                { id: "finance-l4-capital-allocation", name: "Capital Allocation Strategy" },
              ],
            },
            {
              id: "finance-l3-financial-risk",
              name: "Financial Risk",
              description:
                "Foreign-exchange management on the Nikkei CNBC JV (yen / dollar exposure on a recurring P&L line), interest-rate risk on the $2.75B debt stack, counterparty risk monitoring on banking + investment counterparties, and insurance + risk-transfer programs. Heavy monitoring + reporting work; AI augmentable on the data side.",
              relatedTowerIds: ["finance"],
              l5: [
                { id: "finance-l4-fx-mgmt", name: "Foreign Exchange Management (Nikkei CNBC)" },
                { id: "finance-l4-interest-rate-risk", name: "Interest Rate Risk Management" },
                { id: "finance-l4-counterparty-risk", name: "Counterparty Risk Monitoring" },
                { id: "finance-l4-insurance-risk", name: "Insurance & Risk Transfer" },
              ],
            },
          ],
        },
        {
          id: "finance-l2-fpa",
          name: "Planning & Analysis",
          description:
            "Annual budget, long-range plan, monthly forecast updates, scenario modeling against the post-TSA ad-sales greenfield + 2026 election cycle + Olympics windows, variance analysis with CFO/CEO commentary, profitability by brand / channel, content investment ROI on $2.45B programming spend, and M&A modeling. Andre Hale leads FP&A. Vendor stack tilts toward Workday Adaptive Insights, Anaplan, Pigment, or Vena. Heavy data + senior-commentary work — AI substrate sits on data preparation and first-draft narrative; executive judgment owns the call.",
          l4: [
            {
              id: "finance-l3-budgeting-forecasting",
              name: "Budgeting & Forecasting",
              description:
                "Annual budget cycle, 3-5 year long-range plan, monthly forecast updates, and scenario / sensitivity modeling for the post-TSA ad-sales stand-up (greenfield revenue line), the 2026 election advertising window (MS NOW + CNBC), Olympics on USA / CNBC, and USGA windows through 2032. Workday Adaptive Insights / Anaplan / Pigment / Vena for the platform.",
              relatedTowerIds: ["finance"],
              l5: [
                { id: "finance-l4-annual-budget", name: "Annual Budget" },
                { id: "finance-l4-long-range-plan", name: "Long-Range Plan" },
                { id: "finance-l4-monthly-forecast", name: "Monthly Forecast Updates" },
                { id: "finance-l4-scenario-modeling", name: "Scenario & Sensitivity Modeling" },
              ],
            },
            {
              id: "finance-l3-performance-analysis",
              name: "Performance Analysis",
              description:
                "Variance analysis with executive commentary (vs budget / forecast / prior period), KPI monitoring across linear + digital + platforms, profitability roll-ups by brand (MS NOW / CNBC / Golf / USA / E! / Syfy / Oxygen / Fandango), and cost allocation across shared services. The narrative output is read by the CFO + segment presidents; commentary bar is high.",
              relatedTowerIds: ["finance"],
              l5: [
                { id: "finance-l4-variance-analysis", name: "Variance Analysis & Commentary" },
                { id: "finance-l4-kpi-monitoring", name: "KPI Monitoring" },
                { id: "finance-l4-profitability-brand", name: "Profitability by Brand / Channel" },
                { id: "finance-l4-cost-allocation", name: "Cost Allocation" },
              ],
            },
            {
              id: "finance-l3-strategic-finance",
              name: "Strategic Finance",
              description:
                "Content investment ROI modeling on $2.45B annual programming spend — break-even modeling for original commissions, sports-rights renewals (USGA through 2032, Olympics on USA / CNBC, NHL on USA), library content. M&A modeling for adjacencies (Vox-style digital, Free TV Networks expansion). Business-case modeling for new platforms / brands. Ad-hoc CEO/CFO analysis.",
              relatedTowerIds: ["finance"],
              l5: [
                { id: "finance-l4-content-roi", name: "Content Investment ROI ($2.45B programming spend)" },
                { id: "finance-l4-ma-modeling", name: "M&A Financial Modeling (Vox / Free TV Networks)" },
                { id: "finance-l4-business-case-modeling", name: "Business Case Modeling" },
                { id: "finance-l4-ad-hoc-analysis", name: "Ad Hoc Strategic Analysis" },
              ],
            },
          ],
        },
        {
          id: "finance-l2-investor-relations",
          name: "Investor Relations",
          description:
            "Newly stood-up IR function for NASDAQ: VSNT. Quarterly earnings cycle (call prep, analyst Q&A binder, press release, deck), analyst + investor engagement, conferences (UBS Media, BofA Media, Morgan Stanley TMT), non-deal roadshows. Peer benchmarking against WBD / Paramount / Fox / Disney; sell-side coverage tracking and shareholder analytics. Engagement side is fundamentally relationship-driven (Anand Kini + IR head); intelligence + prep side is heavy AI substrate.",
          l4: [
            {
              id: "finance-l3-earnings-disclosures",
              name: "Earnings & Disclosures",
              description:
                "Quarterly earnings call preparation (script, slides, Q&A briefing), analyst Q&A binder assembly, earnings press release drafting, and the investor presentation deck. Mark Lazarus + Anand Kini are the principals. Cadence is fixed quarterly; output is high-stakes (drives the after-hours stock reaction).",
              relatedTowerIds: ["finance"],
              l5: [
                { id: "finance-l4-earnings-prep", name: "Earnings Call Preparation" },
                { id: "finance-l4-analyst-qa", name: "Analyst Q&A Preparation" },
                { id: "finance-l4-earnings-press-release", name: "Earnings Press Release" },
                { id: "finance-l4-investor-deck", name: "Investor Presentation" },
              ],
            },
            {
              id: "finance-l3-market-engagement",
              name: "Market Engagement",
              description:
                "1:1 analyst + investor calls, investor days, attendance at sell-side conferences (UBS Global Media & Communications, BofA Media Communications & Entertainment, Morgan Stanley TMT), and non-deal roadshows. Fundamentally relationship-driven on the dialogue itself; AI assists scheduling, briefing materials, and post-meeting transcript / summary drafting.",
              relatedTowerIds: ["finance"],
              l5: [
                { id: "finance-l4-analyst-engagement", name: "Analyst & Investor Engagement" },
                { id: "finance-l4-conferences", name: "Investor Conferences" },
                { id: "finance-l4-non-deal-roadshow", name: "Non-Deal Roadshows" },
              ],
            },
            {
              id: "finance-l3-ir-intelligence",
              name: "IR Intelligence",
              description:
                "Peer benchmarking against WBD / Paramount / Fox / Disney (KPIs, capital structure, content spend, segment trends), sell-side coverage tracking (ratings, target prices, model deltas, channel-checks), and shareholder analytics (top holders, ownership shifts, activist watch). Heavy data work — high-leverage AI substrate; LLM extraction + summarization of public filings + transcripts is directly applicable.",
              relatedTowerIds: ["finance"],
              l5: [
                { id: "finance-l4-peer-benchmarking", name: "Peer Benchmarking (WBD / Paramount / Fox / Disney)" },
                { id: "finance-l4-sell-side-tracking", name: "Sell-Side Coverage Tracking" },
                { id: "finance-l4-shareholder-analytics", name: "Shareholder Analytics" },
              ],
            },
          ],
        },
        {
          id: "finance-l2-procurement",
          name: "Procurement & Vendor Management",
          description:
            "Procurement is largely greenfield post-TSA — new sourcing relationships, new contracts, new spend categories standing up alongside the function. Sourcing + vendor selection (RFP/RFQ administration, due diligence), procure-to-pay (PO processing, invoice 3-way matching, vendor payment, T&E expense reports), spend analytics, and contract renewals. Vendor stack tilts toward SAP Ariba / Coupa for source-to-pay, Tipalti for AP, AppZen for expense AI. P2P is high-volume rules-based — heavy AI substrate; contract negotiations are relationship-driven.",
          l4: [
            {
              id: "finance-l3-sourcing",
              name: "Sourcing & Vendor Selection",
              description:
                "Strategic sourcing for new vendors across Versant entities (the post-TSA stand-up adds many net-new categories), RFP / RFQ administration, vendor selection scoring, and vendor onboarding (W9, banking, certificates of insurance, ABS scorecard). Heavy due-diligence work — Coupa / SAP Ariba substrate; AI assists requirements drafting + bid-summary extraction.",
              relatedTowerIds: ["finance"],
              l5: [
                { id: "finance-l4-strategic-sourcing", name: "Strategic Sourcing" },
                { id: "finance-l4-rfp-rfq", name: "RFP / RFQ Administration" },
                { id: "finance-l4-vendor-selection", name: "Vendor Selection" },
                { id: "finance-l4-vendor-onboarding", name: "Vendor Onboarding" },
              ],
            },
            {
              id: "finance-l3-procure-to-pay",
              name: "Procure-to-Pay",
              description:
                "Purchase order processing, invoice processing & 3-way matching (target 85%+ straight-through processing), vendor payment execution, T&E expense report processing. Vendor stack: Tipalti for AP automation, AppZen for expense AI, SAP Ariba / Coupa for source-to-pay orchestration. Highest-volume rules-based workstream in Finance — primary AI substrate.",
              relatedTowerIds: ["finance"],
              l5: [
                { id: "finance-l4-po-processing", name: "Purchase Order Processing" },
                { id: "finance-l4-invoice-3way", name: "Invoice Processing & 3-Way Matching" },
                { id: "finance-l4-vendor-payment", name: "Vendor Payment Execution" },
                { id: "finance-l4-te-expense", name: "T&E / Expense Report Processing" },
              ],
            },
            {
              id: "finance-l3-spend-contract",
              name: "Spend & Contract Management",
              description:
                "Spend analytics + optimization (where is Versant's spend going by category / brand / vendor / quarter), contract renewals + negotiations, vendor performance management (SLAs, scorecards), and category management. Analytics side is heavy data work; negotiation side is relationship-driven.",
              relatedTowerIds: ["finance"],
              l5: [
                { id: "finance-l4-spend-analytics", name: "Spend Analytics & Optimization" },
                { id: "finance-l4-contract-renewals", name: "Contract Renewals & Negotiations" },
                { id: "finance-l4-vendor-performance", name: "Vendor Performance Management" },
                { id: "finance-l4-category-mgmt", name: "Category Management" },
              ],
            },
          ],
        },
            ],
    },
  ],
};
