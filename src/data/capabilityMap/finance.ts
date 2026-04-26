import type { CapabilityMapDefinition } from "./types";

/** Capability Map — Finance (Forge tower: `finance`). */
export const financeCapabilities: CapabilityMapDefinition = {
  id: "finance-capabilities",
  name: "Finance Capabilities",
  l1Name: "Finance",
  mapRelatedTowerIds: ["finance"],
  l2: [
    {
      id: "finance-l2-record-to-report",
      name: "Record to Report",
      l3: [
        {
          id: "finance-l3-close-consolidation",
          name: "Close & Consolidation",
          relatedTowerIds: ["finance"],
          l4: [
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
          relatedTowerIds: ["finance"],
          l4: [
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
          relatedTowerIds: ["finance"],
          l4: [
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
          relatedTowerIds: ["finance"],
          l4: [
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
      l3: [
        {
          id: "finance-l3-cash-liquidity",
          name: "Cash & Liquidity",
          relatedTowerIds: ["finance"],
          l4: [
            { id: "finance-l4-cash-flow-forecast", name: "Cash Flow Forecasting (30/60/90 day)" },
            { id: "finance-l4-bank-cash-mgmt", name: "Banking & Cash Management" },
            { id: "finance-l4-daily-position", name: "Daily Liquidity Position" },
            { id: "finance-l4-short-term-investments", name: "Short-Term Investment Management" },
          ],
        },
        {
          id: "finance-l3-debt-capital-markets",
          name: "Debt & Capital Markets",
          relatedTowerIds: ["finance"],
          l4: [
            { id: "finance-l4-covenant-monitoring", name: "Debt Covenant Monitoring (BB- rating)" },
            { id: "finance-l4-debt-issuance", name: "Debt Issuance & Refinancing" },
            { id: "finance-l4-credit-rating", name: "Credit Rating Agency Engagement" },
          ],
        },
        {
          id: "finance-l3-capital-returns",
          name: "Capital Returns",
          relatedTowerIds: ["finance"],
          l4: [
            { id: "finance-l4-dividend-execution", name: "Dividend Execution ($0.375/share quarterly)" },
            { id: "finance-l4-buyback-execution", name: "Share Repurchase Execution ($1B program)" },
            { id: "finance-l4-capital-allocation", name: "Capital Allocation Strategy" },
          ],
        },
        {
          id: "finance-l3-financial-risk",
          name: "Financial Risk",
          relatedTowerIds: ["finance"],
          l4: [
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
      l3: [
        {
          id: "finance-l3-budgeting-forecasting",
          name: "Budgeting & Forecasting",
          relatedTowerIds: ["finance"],
          l4: [
            { id: "finance-l4-annual-budget", name: "Annual Budget" },
            { id: "finance-l4-long-range-plan", name: "Long-Range Plan" },
            { id: "finance-l4-monthly-forecast", name: "Monthly Forecast Updates" },
            { id: "finance-l4-scenario-modeling", name: "Scenario & Sensitivity Modeling" },
          ],
        },
        {
          id: "finance-l3-performance-analysis",
          name: "Performance Analysis",
          relatedTowerIds: ["finance"],
          l4: [
            { id: "finance-l4-variance-analysis", name: "Variance Analysis & Commentary" },
            { id: "finance-l4-kpi-monitoring", name: "KPI Monitoring" },
            { id: "finance-l4-profitability-brand", name: "Profitability by Brand / Channel" },
            { id: "finance-l4-cost-allocation", name: "Cost Allocation" },
          ],
        },
        {
          id: "finance-l3-strategic-finance",
          name: "Strategic Finance",
          relatedTowerIds: ["finance"],
          l4: [
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
      l3: [
        {
          id: "finance-l3-earnings-disclosures",
          name: "Earnings & Disclosures",
          relatedTowerIds: ["finance"],
          l4: [
            { id: "finance-l4-earnings-prep", name: "Earnings Call Preparation" },
            { id: "finance-l4-analyst-qa", name: "Analyst Q&A Preparation" },
            { id: "finance-l4-earnings-press-release", name: "Earnings Press Release" },
            { id: "finance-l4-investor-deck", name: "Investor Presentation" },
          ],
        },
        {
          id: "finance-l3-market-engagement",
          name: "Market Engagement",
          relatedTowerIds: ["finance"],
          l4: [
            { id: "finance-l4-analyst-engagement", name: "Analyst & Investor Engagement" },
            { id: "finance-l4-conferences", name: "Investor Conferences" },
            { id: "finance-l4-non-deal-roadshow", name: "Non-Deal Roadshows" },
          ],
        },
        {
          id: "finance-l3-ir-intelligence",
          name: "IR Intelligence",
          relatedTowerIds: ["finance"],
          l4: [
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
      l3: [
        {
          id: "finance-l3-sourcing",
          name: "Sourcing & Vendor Selection",
          relatedTowerIds: ["finance"],
          l4: [
            { id: "finance-l4-strategic-sourcing", name: "Strategic Sourcing" },
            { id: "finance-l4-rfp-rfq", name: "RFP / RFQ Administration" },
            { id: "finance-l4-vendor-selection", name: "Vendor Selection" },
            { id: "finance-l4-vendor-onboarding", name: "Vendor Onboarding" },
          ],
        },
        {
          id: "finance-l3-procure-to-pay",
          name: "Procure-to-Pay",
          relatedTowerIds: ["finance"],
          l4: [
            { id: "finance-l4-po-processing", name: "Purchase Order Processing" },
            { id: "finance-l4-invoice-3way", name: "Invoice Processing & 3-Way Matching" },
            { id: "finance-l4-vendor-payment", name: "Vendor Payment Execution" },
            { id: "finance-l4-te-expense", name: "T&E / Expense Report Processing" },
          ],
        },
        {
          id: "finance-l3-spend-contract",
          name: "Spend & Contract Management",
          relatedTowerIds: ["finance"],
          l4: [
            { id: "finance-l4-spend-analytics", name: "Spend Analytics & Optimization" },
            { id: "finance-l4-contract-renewals", name: "Contract Renewals & Negotiations" },
            { id: "finance-l4-vendor-performance", name: "Vendor Performance Management" },
            { id: "finance-l4-category-mgmt", name: "Category Management" },
          ],
        },
      ],
    },
  ],
};
