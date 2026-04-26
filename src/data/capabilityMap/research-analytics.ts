import type { CapabilityMapDefinition } from "./types";

/** Capability Map — Research & Analytics (Forge tower: `research-analytics`). */
export const researchAnalyticsCapabilities: CapabilityMapDefinition = {
  id: "research-analytics-capabilities",
  name: "Research & Analytics Capabilities",
  l1Name: "Research & Analytics",
  mapRelatedTowerIds: ["research-analytics"],
  l2: [
    {
      id: "ra-l2-audience-measurement",
      name: "Audience Measurement & Identity",
      l3: [
        {
          id: "ra-l3-cross-platform-identity",
          name: "Cross-Platform Identity",
          relatedTowerIds: ["research-analytics"],
          l4: [
            { id: "ra-l4-identity-resolution", name: "Cross-Platform Identity Resolution" },
            { id: "ra-l4-identity-graph-ops", name: "Identity Graph Operations" },
            { id: "ra-l4-data-clean-rooms", name: "Data Clean Room Operations (LiveRamp)" },
            { id: "ra-l4-first-party-onboarding", name: "First-Party Data Onboarding" },
          ],
        },
        {
          id: "ra-l3-linear-digital-measurement",
          name: "Linear & Digital Measurement",
          relatedTowerIds: ["research-analytics"],
          l4: [
            { id: "ra-l4-linear-nielsen", name: "Linear Audience Measurement (Nielsen)" },
            { id: "ra-l4-digital-measurement", name: "Digital Audience Measurement" },
            { id: "ra-l4-streaming-measurement", name: "Streaming / DTC Measurement" },
            { id: "ra-l4-ott-measurement", name: "OTT / FAST Measurement" },
          ],
        },
        {
          id: "ra-l3-social-podcast-measurement",
          name: "Social & Podcast Measurement",
          relatedTowerIds: ["research-analytics"],
          l4: [
            { id: "ra-l4-social-measurement", name: "Social Audience Measurement (10+ brands)" },
            { id: "ra-l4-podcast-measurement", name: "Podcast Audience Measurement" },
            { id: "ra-l4-creator-influencer", name: "Creator / Influencer Reach Tracking" },
          ],
        },
        {
          id: "ra-l3-privacy-consent",
          name: "Privacy & Consent",
          relatedTowerIds: ["research-analytics"],
          l4: [
            { id: "ra-l4-privacy-compliance", name: "Privacy & Consent Management (CCPA / GDPR)" },
            { id: "ra-l4-data-rights-mgmt", name: "Data Rights Request Handling" },
            { id: "ra-l4-cookieless-strategy", name: "Cookieless Strategy" },
          ],
        },
      ],
    },
    {
      id: "ra-l2-content-performance",
      name: "Content Performance Analytics",
      l3: [
        {
          id: "ra-l3-content-dashboards",
          name: "Performance Dashboards",
          relatedTowerIds: ["research-analytics"],
          l4: [
            { id: "ra-l4-realtime-content-dashboards", name: "Real-Time Content Performance Dashboards" },
            { id: "ra-l4-anomaly-detection", name: "Performance Anomaly Detection" },
            { id: "ra-l4-content-leaderboards", name: "Content Leaderboards" },
          ],
        },
        {
          id: "ra-l3-attribution-roi",
          name: "Attribution & ROI",
          relatedTowerIds: ["research-analytics"],
          l4: [
            { id: "ra-l4-content-attribution", name: "Content Attribution Modeling" },
            { id: "ra-l4-content-roi-measurement", name: "Cross-Platform Content ROI" },
            { id: "ra-l4-cross-promo-effect", name: "Cross-Brand Promotion Effect" },
          ],
        },
        {
          id: "ra-l3-segmentation",
          name: "Audience Segmentation",
          relatedTowerIds: ["research-analytics"],
          l4: [
            { id: "ra-l4-segmentation-profiling", name: "Audience Segmentation & Profiling" },
            { id: "ra-l4-cohort-analytics", name: "Cohort & Lifecycle Analytics" },
            { id: "ra-l4-fan-base-analysis", name: "Fan Base / Affinity Analysis" },
            { id: "ra-l4-post-mortem", name: "Post-Mortem / Post-Event Analysis" },
          ],
        },
      ],
    },
    {
      id: "ra-l2-competitive-intelligence",
      name: "Competitive Intelligence",
      l3: [
        {
          id: "ra-l3-competitor-monitoring",
          name: "Competitor Monitoring",
          relatedTowerIds: ["research-analytics"],
          l4: [
            { id: "ra-l4-competitive-monitoring", name: "Automated Competitive Monitoring (Fox / CNN / Bloomberg / ESPN)" },
            { id: "ra-l4-competitive-briefs", name: "Competitive Brief Generation" },
          ],
        },
        {
          id: "ra-l3-brand-sentiment",
          name: "Brand Sentiment & Listening",
          relatedTowerIds: ["research-analytics"],
          l4: [
            { id: "ra-l4-social-listening", name: "Social Listening & Brand Sentiment" },
            { id: "ra-l4-brand-perception", name: "Brand Perception Tracking (MS NOW / CNBC)" },
            { id: "ra-l4-narrative-tracking", name: "Narrative & Theme Tracking" },
          ],
        },
        {
          id: "ra-l3-market-trends",
          name: "Market & Industry Trends",
          relatedTowerIds: ["research-analytics"],
          l4: [
            { id: "ra-l4-market-trend-analysis", name: "Market Trend Analysis" },
            { id: "ra-l4-industry-research", name: "Industry & Sector Research" },
          ],
        },
      ],
    },
    {
      id: "ra-l2-ad-sales-research",
      name: "Ad Sales Research",
      l3: [
        {
          id: "ra-l3-audience-packaging",
          name: "Audience Packaging & Insights",
          relatedTowerIds: ["research-analytics"],
          l4: [
            { id: "ra-l4-audience-packaging", name: "Audience Packaging for Advertisers" },
            { id: "ra-l4-custom-research", name: "Custom Advertiser Research" },
            { id: "ra-l4-pre-sale-insights", name: "Pre-Sale Audience Insights" },
          ],
        },
        {
          id: "ra-l3-market-intelligence",
          name: "Market Intelligence",
          relatedTowerIds: ["research-analytics"],
          l4: [
            { id: "ra-l4-upfront-scatter", name: "Upfront / Scatter Market Intelligence" },
            { id: "ra-l4-category-spend-tracking", name: "Category Ad Spend Tracking" },
          ],
        },
        {
          id: "ra-l3-attribution-advertisers",
          name: "Advertiser Attribution",
          relatedTowerIds: ["research-analytics"],
          l4: [
            { id: "ra-l4-advertiser-attribution", name: "Cross-Platform Ad Attribution" },
            { id: "ra-l4-campaign-effectiveness", name: "Campaign Effectiveness Measurement" },
            { id: "ra-l4-post-campaign-reporting", name: "Post-Campaign Reporting" },
          ],
        },
      ],
    },
  ],
};
