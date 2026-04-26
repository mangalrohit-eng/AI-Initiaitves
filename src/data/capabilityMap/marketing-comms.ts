import type { CapabilityMapDefinition } from "./types";

/** Capability Map — Marketing & Comms (Forge tower: `marketing-comms`). */
export const marketingCommsCapabilities: CapabilityMapDefinition = {
  id: "marketing-comms-capabilities",
  name: "Marketing & Comms Capabilities",
  l1Name: "Marketing & Comms",
  mapRelatedTowerIds: ["marketing-comms"],
  l2: [
    {
      id: "mkt-l2-social-content",
      name: "Social Media & Content Distribution",
      l3: [
        {
          id: "mkt-l3-social-content-creation",
          name: "Social Content Creation",
          relatedTowerIds: ["marketing-comms"],
          l4: [
            { id: "mkt-l4-clip-detection", name: "Clip Detection & Social Content Creation" },
            { id: "mkt-l4-platform-formatting", name: "Platform-Specific Formatting (TikTok / YT / IG / X)" },
            { id: "mkt-l4-thumbnail-creation", name: "Thumbnail & Cover Art Creation" },
          ],
        },
        {
          id: "mkt-l3-publishing-community",
          name: "Publishing & Community",
          relatedTowerIds: ["marketing-comms"],
          l4: [
            { id: "mkt-l4-multi-platform-publishing", name: "Multi-Platform Publishing & Scheduling" },
            { id: "mkt-l4-community-moderation", name: "Community Management & Moderation" },
            { id: "mkt-l4-social-analytics", name: "Social Analytics & Performance" },
          ],
        },
        {
          id: "mkt-l3-creator-strategy",
          name: "Creator & Strategy",
          relatedTowerIds: ["marketing-comms"],
          l4: [
            { id: "mkt-l4-creator-partnerships", name: "Influencer & Creator Partnerships" },
            { id: "mkt-l4-social-strategy", name: "Social Media Strategy" },
          ],
        },
      ],
    },
    {
      id: "mkt-l2-performance-growth",
      name: "Performance & Growth Marketing",
      l3: [
        {
          id: "mkt-l3-paid-media",
          name: "Paid Media",
          relatedTowerIds: ["marketing-comms"],
          l4: [
            { id: "mkt-l4-paid-media-mgmt", name: "Paid Media Campaign Management" },
            { id: "mkt-l4-creative-testing", name: "Creative Generation & Testing" },
            { id: "mkt-l4-bid-budget-mgmt", name: "Bid & Budget Management" },
          ],
        },
        {
          id: "mkt-l3-lifecycle-crm",
          name: "Lifecycle & CRM",
          relatedTowerIds: ["marketing-comms"],
          l4: [
            { id: "mkt-l4-lifecycle-marketing", name: "CRM & Lifecycle Marketing" },
            { id: "mkt-l4-email-push-inapp", name: "Email / Push / In-App Messaging" },
            { id: "mkt-l4-conversion-rate-opt", name: "Conversion Rate Optimization" },
          ],
        },
        {
          id: "mkt-l3-growth-strategy",
          name: "Growth Strategy",
          relatedTowerIds: ["marketing-comms"],
          l4: [
            { id: "mkt-l4-marketing-budget", name: "Marketing Budget & Allocation" },
            { id: "mkt-l4-experimentation", name: "Experimentation Program" },
          ],
        },
      ],
    },
    {
      id: "mkt-l2-brand-events",
      name: "Brand Marketing & Events",
      l3: [
        {
          id: "mkt-l3-brand-creative",
          name: "Brand & Creative",
          relatedTowerIds: ["marketing-comms"],
          l4: [
            { id: "mkt-l4-brand-campaign-dev", name: "Brand Campaign Development" },
            { id: "mkt-l4-creative-production", name: "Creative Production Oversight" },
            { id: "mkt-l4-brand-guidelines", name: "Brand Guidelines & Asset Management" },
          ],
        },
        {
          id: "mkt-l3-events-sponsorships",
          name: "Events & Sponsorships",
          relatedTowerIds: ["marketing-comms"],
          l4: [
            { id: "mkt-l4-event-marketing", name: "Event Marketing (Elections / Olympics / Sports)" },
            { id: "mkt-l4-sponsorship-mgmt", name: "Sponsorship & Partnership Management" },
            { id: "mkt-l4-trade-marketing", name: "Trade & Industry Marketing" },
          ],
        },
        {
          id: "mkt-l3-brand-research",
          name: "Brand Research",
          relatedTowerIds: ["marketing-comms"],
          l4: [
            { id: "mkt-l4-brand-health", name: "Brand Health Tracking" },
            { id: "mkt-l4-brand-research-studies", name: "Brand Research Studies" },
          ],
        },
      ],
    },
    {
      id: "mkt-l2-pr-comms",
      name: "PR & Corporate Communications",
      l3: [
        {
          id: "mkt-l3-media-relations",
          name: "Media Relations",
          relatedTowerIds: ["marketing-comms"],
          l4: [
            { id: "mkt-l4-media-monitoring", name: "Media Monitoring & Sentiment Tracking" },
            { id: "mkt-l4-press-release", name: "Press Release & Statement Drafting" },
            { id: "mkt-l4-proactive-media", name: "Proactive Media Relations" },
            { id: "mkt-l4-spokesperson-prep", name: "Spokesperson & Interview Prep" },
          ],
        },
        {
          id: "mkt-l3-crisis-comms",
          name: "Crisis & Issues",
          relatedTowerIds: ["marketing-comms"],
          l4: [
            { id: "mkt-l4-crisis-detection", name: "Crisis Detection & Early Warning" },
            { id: "mkt-l4-crisis-response", name: "Crisis Response Coordination" },
            { id: "mkt-l4-issues-mgmt", name: "Issues Management" },
          ],
        },
        {
          id: "mkt-l3-internal-exec-comms",
          name: "Internal & Executive Comms",
          relatedTowerIds: ["marketing-comms"],
          l4: [
            { id: "mkt-l4-internal-comms", name: "Internal Communications" },
            { id: "mkt-l4-exec-thought-leadership", name: "Executive Thought Leadership" },
            { id: "mkt-l4-leadership-comms", name: "Leadership Communications" },
          ],
        },
      ],
    },
    {
      id: "mkt-l2-marketing-analytics",
      name: "Marketing Analytics & Attribution",
      l3: [
        {
          id: "mkt-l3-attribution",
          name: "Attribution",
          relatedTowerIds: ["marketing-comms"],
          l4: [
            { id: "mkt-l4-cross-brand-attribution", name: "Cross-Brand Marketing Attribution" },
            { id: "mkt-l4-mta", name: "Multi-Touch Attribution" },
            { id: "mkt-l4-mmm", name: "Marketing Mix Modeling" },
          ],
        },
        {
          id: "mkt-l3-effects-reporting",
          name: "Effects & Reporting",
          relatedTowerIds: ["marketing-comms"],
          l4: [
            { id: "mkt-l4-cross-brand-effects", name: "Cross-Brand Effect Measurement" },
            { id: "mkt-l4-campaign-reporting", name: "Campaign Reporting & Dashboards" },
            { id: "mkt-l4-marketing-ops", name: "Marketing Operations" },
          ],
        },
      ],
    },
  ],
};
