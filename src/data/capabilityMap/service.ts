import type { CapabilityMapDefinition } from "./types";

/** Capability Map — Service (Forge tower: `service`). */
export const serviceCapabilities: CapabilityMapDefinition = {
  id: "service-capabilities",
  name: "Service Capabilities",
  l1Name: "Service",
  mapRelatedTowerIds: ["service"],
  l2: [
    {
      id: "service-l2-customer-support",
      name: "Customer Support Operations",
      l3: [
        {
          id: "service-l3-frontline-support",
          name: "Frontline Support",
          relatedTowerIds: ["service"],
          l4: [
            { id: "service-l4-chat-email", name: "First-Line Chat & Email Support" },
            { id: "service-l4-phone-support", name: "Phone Support" },
            { id: "service-l4-self-service", name: "Self-Service & Help Center" },
            { id: "service-l4-social-care", name: "Social Care" },
          ],
        },
        {
          id: "service-l3-transactional-support",
          name: "Transactional Support",
          relatedTowerIds: ["service"],
          l4: [
            { id: "service-l4-order-mgmt", name: "Order & Transaction Management (Fandango / GolfNow)" },
            { id: "service-l4-subscription-lifecycle", name: "Subscription Lifecycle Management" },
            { id: "service-l4-refunds-disputes", name: "Refunds & Payment Disputes" },
            { id: "service-l4-billing-inquiries", name: "Billing Inquiries" },
          ],
        },
        {
          id: "service-l3-escalation-quality",
          name: "Escalation & Quality",
          relatedTowerIds: ["service"],
          l4: [
            { id: "service-l4-escalation-resolution", name: "Escalation & Complex Issue Resolution" },
            { id: "service-l4-qa-coaching", name: "Quality Assurance & Agent Coaching" },
            { id: "service-l4-knowledge-mgmt", name: "Knowledge Base Management" },
            { id: "service-l4-vendor-bpo-oversight", name: "Vendor / BPO Oversight" },
          ],
        },
        {
          id: "service-l3-voice-of-customer",
          name: "Voice of Customer",
          relatedTowerIds: ["service"],
          l4: [
            { id: "service-l4-voc-analytics", name: "Voice of Customer Analytics" },
            { id: "service-l4-product-feedback-loop", name: "Product Feedback Loop" },
          ],
        },
      ],
    },
    {
      id: "service-l2-retention-lifecycle",
      name: "Subscriber Retention & Lifecycle",
      l3: [
        {
          id: "service-l3-churn-prevention",
          name: "Churn Prevention",
          relatedTowerIds: ["service"],
          l4: [
            { id: "service-l4-churn-prediction", name: "Churn Prediction & Proactive Intervention" },
            { id: "service-l4-save-offers", name: "Save Offer Optimization (at cancellation)" },
            { id: "service-l4-engagement-nudges", name: "Engagement Nudges" },
          ],
        },
        {
          id: "service-l3-winback-cross-sell",
          name: "Win-Back & Cross-Sell",
          relatedTowerIds: ["service"],
          l4: [
            { id: "service-l4-winback", name: "Win-Back Campaign Management" },
            { id: "service-l4-cross-brand-retention", name: "Cross-Brand Retention (bundle plays)" },
            { id: "service-l4-loyalty-rewards", name: "Loyalty & Rewards Programs" },
          ],
        },
        {
          id: "service-l3-satisfaction-nps",
          name: "Satisfaction & NPS",
          relatedTowerIds: ["service"],
          l4: [
            { id: "service-l4-nps-csat", name: "NPS / CSAT Measurement" },
            { id: "service-l4-survey-program", name: "Survey & Feedback Program" },
          ],
        },
      ],
    },
  ],
};
