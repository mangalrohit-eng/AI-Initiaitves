import type { CapabilityMapDefinition } from "./types";

/** Capability Map — Legal (Forge tower: `legal`). */
export const legalCapabilities: CapabilityMapDefinition = {
  id: "legal-capabilities",
  name: "Legal Capabilities",
  l1Name: "Legal",
  mapRelatedTowerIds: ["legal"],
  l2: [
    {
      id: "legal-jg",
      name: "Legal & Business Affairs",
      l3: [
        {
          id: "legal-l2-rights-ip",
          name: "Content Rights & Intellectual Property",
          l4: [
            {
              id: "legal-l3-content-rights",
              name: "Content Rights Management",
              relatedTowerIds: ["legal"],
              l5: [
                { id: "legal-l4-rights-tracking", name: "Content Rights Tracking & Compliance" },
                { id: "legal-l4-rights-availability", name: "Rights Availability Queries" },
                { id: "legal-l4-rights-windows", name: "Rights Window Management" },
                { id: "legal-l4-rights-renewals", name: "Rights Expiration & Renewal Management" },
                { id: "legal-l4-split-rights-admin", name: "Split Rights Administration (e.g., on-air vs. streaming)" },
              ],
            },
            {
              id: "legal-l3-sports-rights",
              name: "Sports & Live Event Rights",
              relatedTowerIds: ["legal"],
              l5: [
                { id: "legal-l4-sports-rights-admin", name: "Sports Rights Administration (USGA / WNBA / Olympics)" },
                { id: "legal-l4-platform-restrictions", name: "Platform Restriction Compliance" },
                { id: "legal-l4-event-clearances", name: "Event-Level Clearances" },
              ],
            },
            {
              id: "legal-l3-ip-protection",
              name: "IP Protection",
              relatedTowerIds: ["legal"],
              l5: [
                { id: "legal-l4-ip-registration", name: "IP Registration & Trademarks" },
                { id: "legal-l4-ip-enforcement", name: "IP Enforcement & DMCA" },
                { id: "legal-l4-fair-use-clearance", name: "Fair Use & Clearance Review" },
              ],
            },
          ],
        },
        {
          id: "legal-l2-contracts-transactions",
          name: "Contracts & Transactions",
          l4: [
            {
              id: "legal-l3-contract-lifecycle",
              name: "Contract Lifecycle",
              relatedTowerIds: ["legal"],
              l5: [
                { id: "legal-l4-contract-review", name: "Contract Review & Risk Analysis" },
                { id: "legal-l4-contract-drafting", name: "Contract Drafting & Template Management" },
                { id: "legal-l4-clause-library", name: "Clause Library Maintenance" },
                { id: "legal-l4-contract-execution", name: "Signature & Execution" },
                { id: "legal-l4-obligation-tracking", name: "Post-Signature Obligation Tracking" },
              ],
            },
            {
              id: "legal-l3-ma-deals",
              name: "M&A & Strategic Deals",
              relatedTowerIds: ["legal"],
              l5: [
                { id: "legal-l4-ma-due-diligence", name: "M&A Due Diligence (Vox / Free TV Networks)" },
                { id: "legal-l4-deal-structuring", name: "Deal Structuring Support" },
                { id: "legal-l4-jv-administration", name: "JV / Partnership Administration" },
                { id: "legal-l4-integration-legal", name: "Post-Deal Integration Support" },
              ],
            },
            {
              id: "legal-l3-distribution-talent",
              name: "Distribution & Talent",
              relatedTowerIds: ["legal"],
              l5: [
                { id: "legal-l4-carriage-support", name: "Carriage Agreement Negotiation Support" },
                { id: "legal-l4-talent-contract-admin", name: "Talent Contract Administration" },
                { id: "legal-l4-vendor-contracts", name: "Vendor & Production Contracts" },
                { id: "legal-l4-licensing-deals", name: "Content Licensing Deals" },
              ],
            },
          ],
        },
        {
          id: "legal-l2-compliance-governance",
          name: "Compliance & Governance",
          l4: [
            {
              id: "legal-l3-securities-compliance",
              name: "Securities & SEC",
              relatedTowerIds: ["legal"],
              l5: [
                { id: "legal-l4-sec-compliance", name: "SEC Compliance Monitoring" },
                { id: "legal-l4-disclosure-mgmt", name: "Disclosure Management" },
                { id: "legal-l4-insider-trading", name: "Insider Trading Window Administration" },
                { id: "legal-l4-edgar-filings", name: "EDGAR Filing Coordination" },
              ],
            },
            {
              id: "legal-l3-broadcast-regulatory",
              name: "Broadcast & Regulatory",
              relatedTowerIds: ["legal"],
              l5: [
                { id: "legal-l4-fcc-compliance", name: "FCC Broadcast Compliance" },
                { id: "legal-l4-political-ad-rules", name: "Political Advertising Rules (esp. MS NOW)" },
                { id: "legal-l4-childrens-programming", name: "Children's Programming Compliance" },
                { id: "legal-l4-content-standards-legal", name: "Content Standards Legal Review" },
              ],
            },
            {
              id: "legal-l3-corporate-governance",
              name: "Corporate Governance",
              relatedTowerIds: ["legal"],
              l5: [
                { id: "legal-l4-corp-governance", name: "Corporate Governance & Board Support" },
                { id: "legal-l4-policy-mgmt", name: "Corporate Policy Management" },
                { id: "legal-l4-ethics-compliance", name: "Ethics & Compliance Programs" },
                { id: "legal-l4-litigation-mgmt", name: "Litigation Management" },
              ],
            },
            {
              id: "legal-l3-emerging-regulation",
              name: "Emerging Regulation",
              relatedTowerIds: ["legal"],
              l5: [
                { id: "legal-l4-ai-policy-governance", name: "AI Policy & Governance" },
                { id: "legal-l4-regulatory-monitoring", name: "Regulatory Change Monitoring" },
                { id: "legal-l4-privacy-legal", name: "Privacy Law Counsel" },
              ],
            },
          ],
        },
            ],
    },
  ],
};
