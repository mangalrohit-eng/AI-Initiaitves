import type { CapabilityMapDefinition } from "./types";

/** Capability Map — Localize to Versant (HR). HR Forge tower: `hr`. */
export const hrLocalizeToVersant: CapabilityMapDefinition = {
  id: "hr-localize-versant",
  name: "Localize to Versant (HR)",
  l1Name: "Human Resources",
  mapRelatedTowerIds: ["hr"],
  l2: [
    {
      id: "hr-jg",
      name: "HR & Talent",
      l3: [
        {
          id: "hr-loc-l2-hrbps",
          name: "HRBPs",
          l4: [
            {
              id: "hr-loc-l3-hr-business-partners",
              name: "HR Business Partners",
              relatedTowerIds: ["hr"],
              l5: [
                { id: "hr-loc-l4-workforce-strategy", name: "Workforce Strategy (BU / function specific)" },
                { id: "hr-loc-l4-talent-planning", name: "Talent Planning" },
                { id: "hr-loc-l4-succession", name: "Succession Management" },
                { id: "hr-loc-l4-employee-relations", name: "Employee Relations" },
                { id: "hr-loc-l4-org-design", name: "Org Design (BU / function specific)" },
                { id: "hr-loc-l4-change-management-hrbp", name: "Change Management (BU / function specific)" },
              ],
            },
          ],
        },
        {
          id: "hr-loc-l2-talent-acquisition",
          name: "Talent Acquisition",
          l4: [
            {
              id: "hr-loc-l3-talent-acquisition",
              name: "Talent Acquisition",
              relatedTowerIds: ["hr"],
              l5: [
                { id: "hr-loc-l4-demand-forecasting", name: "Demand Forecasting and Workforce Planning" },
                { id: "hr-loc-l4-employer-branding", name: "Employer Branding and Employee Value Proposition" },
                { id: "hr-loc-l4-sourcing-engagement", name: "Candidate Sourcing and Engagement Design" },
                { id: "hr-loc-l4-recruiting-hiring", name: "Recruiting and Hiring Experience Design" },
                { id: "hr-loc-l4-new-joiner-onboarding", name: "New Joiner Offer and Onboarding Design" },
              ],
            },
            {
              id: "hr-loc-l3-executive-ta",
              name: "Executive Talent Acquisition",
              relatedTowerIds: ["hr"],
              l5: [
                { id: "hr-loc-l4-exec-search", name: "Executive Search" },
                { id: "hr-loc-l4-leadership-assessment", name: "Leadership Assessment" },
                { id: "hr-loc-l4-exec-hiring-onboard", name: "Executive Hiring and Onboarding" },
                { id: "hr-loc-l4-alumni", name: "Alumni Relations" },
              ],
            },
          ],
        },
        {
          id: "hr-loc-l2-ld",
          name: "L&D",
          l4: [
            {
              id: "hr-loc-l3-learning-dev",
              name: "Learning and Development",
              relatedTowerIds: ["hr"],
              l5: [
                { id: "hr-loc-l4-learning-experience", name: "Learning Experience and Pathways" },
                { id: "hr-loc-l4-learning-design", name: "Learning Design" },
                { id: "hr-loc-l4-learning-tech", name: "Learning Technology and Systems" },
                { id: "hr-loc-l4-exec-coaching", name: "Executive Coaching and Leadership Development" },
                { id: "hr-loc-l4-skills-strategy", name: "Skills Strategy and Frameworks" },
                { id: "hr-loc-l4-skills-assessment", name: "Skills Assessment" },
                { id: "hr-loc-l4-performance", name: "Performance Management" },
              ],
            },
          ],
        },
        {
          id: "hr-loc-l2-total-rewards",
          name: "Total Rewards",
          l4: [
            {
              id: "hr-loc-l3-comp",
              name: "Compensation / Total Rewards",
              relatedTowerIds: ["hr"],
              l5: [
                { id: "hr-loc-l4-comp-strategy", name: "Compensation Strategy and Design" },
                { id: "hr-loc-l4-benefits-strategy", name: "Benefits Strategy and Design" },
                { id: "hr-loc-l4-other-benefits", name: "Other Benefits and Perks" },
                { id: "hr-loc-l4-recognition", name: "Recognition Programs" },
              ],
            },
            {
              id: "hr-loc-l3-global-mobility",
              name: "Global Mobility",
              relatedTowerIds: ["hr"],
              l5: [
                { id: "hr-loc-l4-relocation", name: "Relocation Programs" },
                { id: "hr-loc-l4-immigration", name: "Immigration Compliance" },
                { id: "hr-loc-l4-tax-coord", name: "Tax Coordination" },
                { id: "hr-loc-l4-repatriation", name: "Repatriation Support" },
              ],
            },
          ],
        },
        {
          id: "hr-loc-l2-hr-services",
          name: "HR Services",
          l4: [
            {
              id: "hr-loc-l3-hr-management",
              name: "HR Management",
              relatedTowerIds: ["hr"],
              l5: [
                { id: "hr-loc-l4-hr-operating-model", name: "Operating Model and Organization Design" },
                { id: "hr-loc-l4-func-budget", name: "Function Management and Budget Oversight" },
              ],
            },
            {
              id: "hr-loc-l3-hr-ops",
              name: "HR Operations",
              relatedTowerIds: ["hr"],
              l5: [
                { id: "hr-loc-l4-digital-hr", name: "Digital HR and AI (Systems and Applications)" },
                { id: "hr-loc-l4-people-analytics", name: "People Analytics and Data" },
                { id: "hr-loc-l4-policy-compliance", name: "Policy Compliance" },
                { id: "hr-loc-l4-continuous-improvement", name: "Continuous Improvement and Operational Excellence" },
                { id: "hr-loc-l4-change-mgmt-ops", name: "Change Management" },
                { id: "hr-loc-l4-employee-comm", name: "Employee Communication" },
                { id: "hr-loc-l4-pre-payroll", name: "Pre-Payroll" },
              ],
            },
            {
              id: "hr-loc-l3-hr-shared-services",
              name: "HR Shared Services",
              relatedTowerIds: ["hr"],
              l5: [
                { id: "hr-loc-l4-case-mgmt", name: "Case Management" },
                { id: "hr-loc-l4-contact-inquiry", name: "Contact / Inquiry" },
                { id: "hr-loc-l4-hr-portal", name: "HR Portal and Knowledge Management" },
                { id: "hr-loc-l4-records", name: "Records Management" },
                { id: "hr-loc-l4-ld-delivery", name: "Learning and Development Delivery" },
                { id: "hr-loc-l4-ta-delivery", name: "Talent Acquisition Delivery" },
                { id: "hr-loc-l4-tr-delivery", name: "Total Rewards Delivery" },
                { id: "hr-loc-l4-leave-absence", name: "Leave and Absence Management" },
              ],
            },
          ],
        },
            ],
    },
  ],
};
