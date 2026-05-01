import type { CapabilityMapDefinition } from "./types";

/** Capability Map — Programming Development (Forge tower: `programming-dev`). */
export const programmingDevCapabilities: CapabilityMapDefinition = {
  id: "programming-dev-capabilities",
  name: "Programming Development Capabilities",
  l1Name: "Programming Development",
  mapRelatedTowerIds: ["programming-dev"],
  l2: [
    {
      id: "programming-dev-jg",
      name: "Programming & Development",
      l3: [
        {
          id: "prog-l2-linear-programming",
          name: "Linear Programming & Scheduling",
          l4: [
            {
              id: "prog-l3-schedule-management",
              name: "Schedule Management",
              relatedTowerIds: ["programming-dev"],
              l5: [
                { id: "prog-l4-schedule-optimization", name: "Schedule Optimization (7+ networks)" },
                { id: "prog-l4-viewership-prediction", name: "Viewership Prediction" },
                { id: "prog-l4-cross-brand-promo-sched", name: "Cross-Brand Promotion Scheduling" },
                { id: "prog-l4-program-renewals-cancel", name: "Program Renewals & Cancellation Decisions" },
              ],
            },
            {
              id: "prog-l3-fast-channel-programming",
              name: "FAST Channel Programming",
              relatedTowerIds: ["programming-dev"],
              l5: [
                { id: "prog-l4-fast-channel-prog", name: "FAST Channel Programming" },
                { id: "prog-l4-fast-channel-launch", name: "FAST Channel Launch & Branding" },
                { id: "prog-l4-fast-content-curation", name: "FAST Content Curation" },
              ],
            },
            {
              id: "prog-l3-competitive-monitoring",
              name: "Competitive Monitoring",
              relatedTowerIds: ["programming-dev"],
              l5: [
                { id: "prog-l4-competitive-schedule", name: "Competitive Schedule Analysis" },
                { id: "prog-l4-counter-programming", name: "Counter-Programming Strategy" },
              ],
            },
          ],
        },
        {
          id: "prog-l2-content-development",
          name: "Content Development & Greenlight",
          l4: [
            {
              id: "prog-l3-development-research",
              name: "Development Research",
              relatedTowerIds: ["programming-dev"],
              l5: [
                { id: "prog-l4-landscape-whitespace", name: "Content Landscape & White Space Analysis" },
                { id: "prog-l4-audience-demand-pred", name: "Audience Demand Prediction" },
                { id: "prog-l4-synthetic-testing", name: "Synthetic Audience Testing" },
              ],
            },
            {
              id: "prog-l3-greenlight-economics",
              name: "Greenlight Economics",
              relatedTowerIds: ["programming-dev"],
              l5: [
                { id: "prog-l4-content-roi-projection", name: "Content ROI Projection (multi-platform)" },
                { id: "prog-l4-greenlight-decisions", name: "Greenlight Decisions" },
                { id: "prog-l4-budget-economics", name: "Production Budget Economics" },
              ],
            },
            {
              id: "prog-l3-creative-development",
              name: "Creative Development",
              relatedTowerIds: ["programming-dev"],
              l5: [
                { id: "prog-l4-pilot-development", name: "Pilot Development & Production" },
                { id: "prog-l4-talent-attachment", name: "Talent Attachment & Packaging" },
                { id: "prog-l4-format-ip-dev", name: "Format & IP Development" },
                { id: "prog-l4-script-story-dev", name: "Script & Story Development" },
              ],
            },
          ],
        },
        {
          id: "prog-l2-content-acquisition",
          name: "Content Acquisition & Licensing",
          l4: [
            {
              id: "prog-l3-acquisition-research",
              name: "Acquisition Research",
              relatedTowerIds: ["programming-dev"],
              l5: [
                { id: "prog-l4-market-scanning", name: "Content Market Scanning & Target Identification" },
                { id: "prog-l4-portfolio-fit", name: "Portfolio Fit Assessment" },
                { id: "prog-l4-comp-deal-bench", name: "Comparable Deal Benchmarking" },
              ],
            },
            {
              id: "prog-l3-valuation-deals",
              name: "Valuation & Deal Making",
              relatedTowerIds: ["programming-dev"],
              l5: [
                { id: "prog-l4-content-valuation", name: "Multi-Platform Content Valuation" },
                { id: "prog-l4-deal-negotiation", name: "Deal Negotiation" },
                { id: "prog-l4-deal-structure", name: "Deal Structuring (linear / digital / DTC / licensing)" },
              ],
            },
            {
              id: "prog-l3-library-mgmt",
              name: "Library & Catalog Management",
              relatedTowerIds: ["programming-dev"],
              l5: [
                { id: "prog-l4-catalog-mgmt", name: "Catalog & Library Management" },
                { id: "prog-l4-integration-planning", name: "Post-Acquisition Integration Planning" },
                { id: "prog-l4-rights-mgmt-prog", name: "Rights & Window Management" },
              ],
            },
          ],
        },
            ],
    },
  ],
};
