import type { CapabilityMapDefinition } from "./types";

/** Capability Map — Sales (Forge tower: `sales`). */
export const salesCapabilities: CapabilityMapDefinition = {
  id: "sales-capabilities",
  name: "Sales Capabilities",
  l1Name: "Sales",
  mapRelatedTowerIds: ["sales"],
  l2: [
    {
      id: "sales-jg",
      name: "Sales",
      l3: [
        {
          id: "sales-l2-advertising-sales",
          name: "Advertising Sales",
          l4: [
            {
              id: "sales-l3-inventory-pricing",
              name: "Inventory & Pricing",
              relatedTowerIds: ["sales"],
              l5: [
                { id: "sales-l4-inventory-forecasting", name: "Inventory Forecasting & Management" },
                { id: "sales-l4-yield-optimization", name: "Dynamic Pricing & Yield Optimization" },
                { id: "sales-l4-rate-card-mgmt", name: "Rate Card Management" },
              ],
            },
            {
              id: "sales-l3-audience-targeting",
              name: "Audience Targeting",
              relatedTowerIds: ["sales"],
              l5: [
                { id: "sales-l4-audience-segments", name: "Audience Targeting & Segment Creation" },
                { id: "sales-l4-cross-brand-packages", name: "Cross-Brand Audience Packages" },
                { id: "sales-l4-data-product-mgmt", name: "Audience Data Product Management" },
              ],
            },
            {
              id: "sales-l3-campaign-execution",
              name: "Campaign Execution",
              relatedTowerIds: ["sales"],
              l5: [
                { id: "sales-l4-proposal-generation", name: "Proposal Generation" },
                { id: "sales-l4-campaign-execution", name: "Campaign Execution & Optimization" },
                { id: "sales-l4-stewardship-makegoods", name: "Stewardship & Make-Goods" },
                { id: "sales-l4-billing-collections", name: "Ad Sales Billing & Collections" },
              ],
            },
            {
              id: "sales-l3-market-types",
              name: "Market & Specialty Sales",
              relatedTowerIds: ["sales"],
              l5: [
                { id: "sales-l4-upfront-negotiation", name: "Upfront Negotiation" },
                { id: "sales-l4-scatter-sales", name: "Scatter Market Sales" },
                { id: "sales-l4-political-election-ads", name: "Political / Election Ad Management" },
                { id: "sales-l4-programmatic-ops", name: "Programmatic Advertising Operations" },
              ],
            },
          ],
        },
        {
          id: "sales-l2-distribution-sales",
          name: "Distribution Sales",
          l4: [
            {
              id: "sales-l3-mvpd-management",
              name: "MVPD Management",
              relatedTowerIds: ["sales"],
              l5: [
                { id: "sales-l4-mvpd-analytics", name: "MVPD Analytics & Negotiation Intelligence" },
                { id: "sales-l4-carriage-negotiation", name: "Carriage Agreement Negotiation" },
                { id: "sales-l4-affiliate-relations", name: "Affiliate Relations Management" },
              ],
            },
            {
              id: "sales-l3-distribution-monitoring",
              name: "Distribution Monitoring",
              relatedTowerIds: ["sales"],
              l5: [
                { id: "sales-l4-cord-cutting", name: "Cord-Cutting Churn Risk Monitoring" },
                { id: "sales-l4-vmvpd-mgmt", name: "vMVPD Partner Management (YouTube TV / Hulu Live / Sling)" },
                { id: "sales-l4-fast-distribution", name: "FAST Platform Distribution Deals" },
              ],
            },
          ],
        },
        {
          id: "sales-l2-dtc-subscription",
          name: "DTC & Subscription Sales",
          l4: [
            {
              id: "sales-l3-acquisition-conversion",
              name: "Acquisition & Conversion",
              relatedTowerIds: ["sales"],
              l5: [
                { id: "sales-l4-paywall-conversion", name: "Dynamic Paywall & Conversion Optimization" },
                { id: "sales-l4-trial-to-paid", name: "Trial-to-Paid Conversion" },
                { id: "sales-l4-checkout-optimization", name: "Checkout & Funnel Optimization" },
              ],
            },
            {
              id: "sales-l3-pricing-packaging",
              name: "Pricing & Packaging",
              relatedTowerIds: ["sales"],
              l5: [
                { id: "sales-l4-pricing-packaging", name: "Pricing & Packaging Optimization" },
                { id: "sales-l4-cross-brand-bundles", name: "Cross-Brand Bundle Sales (CNBC Pro / GolfPass)" },
                { id: "sales-l4-promo-mgmt", name: "Promotion & Discount Management" },
              ],
            },
            {
              id: "sales-l3-dtc-strategy",
              name: "DTC Product Strategy",
              relatedTowerIds: ["sales"],
              l5: [
                { id: "sales-l4-dtc-strategy", name: "DTC Product Strategy" },
                { id: "sales-l4-subscriber-roadmap", name: "Subscriber Growth Roadmap" },
              ],
            },
          ],
        },
            ],
    },
  ],
};
