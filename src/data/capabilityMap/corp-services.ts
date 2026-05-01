import type { CapabilityMapDefinition } from "./types";

/** Capability Map — Corporate Services (Forge tower: `corp-services`). */
export const corpServicesCapabilities: CapabilityMapDefinition = {
  id: "corp-services-capabilities",
  name: "Corporate Services Capabilities",
  l1Name: "Corporate Services",
  mapRelatedTowerIds: ["corp-services"],
  l2: [
    {
      id: "corp-services-jg",
      name: "Corporate Services",
      l3: [
        {
          id: "corp-l2-facilities-real-estate",
          name: "Facilities & Real Estate",
          l4: [
            {
              id: "corp-l3-workplace-services",
              name: "Workplace Services",
              relatedTowerIds: ["corp-services"],
              l5: [
                { id: "corp-l4-work-orders", name: "Work Order Management & Dispatch" },
                { id: "corp-l4-helpdesk-facilities", name: "Facilities Help Desk" },
                { id: "corp-l4-mail-package", name: "Mail & Package Services" },
                { id: "corp-l4-event-support", name: "Event & Meeting Support" },
                { id: "corp-l4-reception-concierge", name: "Reception & Concierge" },
              ],
            },
            {
              id: "corp-l3-building-operations",
              name: "Building Operations",
              relatedTowerIds: ["corp-services"],
              l5: [
                { id: "corp-l4-predictive-maintenance", name: "Predictive Facilities Maintenance" },
                { id: "corp-l4-hvac-mep", name: "HVAC / MEP Operations" },
                { id: "corp-l4-cleaning-janitorial", name: "Cleaning & Janitorial" },
                { id: "corp-l4-energy-sustainability", name: "Energy Management & Sustainability" },
                { id: "corp-l4-space-occupancy", name: "Space & Occupancy Management" },
              ],
            },
            {
              id: "corp-l3-real-estate-portfolio",
              name: "Real Estate Portfolio",
              relatedTowerIds: ["corp-services"],
              l5: [
                { id: "corp-l4-real-estate-strategy", name: "Real Estate Strategy" },
                { id: "corp-l4-lease-mgmt", name: "Lease Administration (NYC HQ / Englewood Cliffs / DC)" },
                { id: "corp-l4-fitouts-construction", name: "Fit-Outs & Construction Projects" },
              ],
            },
          ],
        },
        {
          id: "corp-l2-security",
          name: "Security",
          l4: [
            {
              id: "corp-l3-physical-security",
              name: "Physical Security",
              relatedTowerIds: ["corp-services"],
              l5: [
                { id: "corp-l4-cctv-monitoring", name: "CCTV & Physical Monitoring" },
                { id: "corp-l4-access-control", name: "Access Control & Visitor Management" },
                { id: "corp-l4-guard-operations", name: "Security Guard Operations" },
                { id: "corp-l4-incident-investigation", name: "Incident Investigation" },
              ],
            },
            {
              id: "corp-l3-threat-intelligence",
              name: "Threat Intelligence",
              relatedTowerIds: ["corp-services"],
              l5: [
                { id: "corp-l4-threat-intel", name: "Threat Intelligence & Assessment" },
                { id: "corp-l4-journalist-protection", name: "Journalist & Talent Protection" },
                { id: "corp-l4-event-security", name: "Event & Travel Security" },
                { id: "corp-l4-executive-protection", name: "Executive Protection" },
              ],
            },
            {
              id: "corp-l3-bcp-emergency",
              name: "Business Continuity & Emergency",
              relatedTowerIds: ["corp-services"],
              l5: [
                { id: "corp-l4-bcp-planning", name: "Business Continuity Planning" },
                { id: "corp-l4-emergency-response", name: "Emergency Response & Drills" },
                { id: "corp-l4-crisis-mgmt-physical", name: "Physical Crisis Management" },
              ],
            },
          ],
        },
        {
          id: "corp-l2-procurement-vendor",
          name: "Procurement & Vendor Operations",
          l4: [
            {
              id: "corp-l3-corporate-procurement",
              name: "Corporate Procurement",
              relatedTowerIds: ["corp-services"],
              l5: [
                { id: "corp-l4-vendor-onboarding", name: "Vendor Selection & Onboarding" },
                { id: "corp-l4-po-processing", name: "Purchase Order Processing" },
                { id: "corp-l4-corp-spend-analytics", name: "Spend Analytics" },
              ],
            },
            {
              id: "corp-l3-accounts-payable",
              name: "Accounts Payable",
              relatedTowerIds: ["corp-services"],
              l5: [
                { id: "corp-l4-invoice-processing", name: "Invoice Processing & Payment" },
                { id: "corp-l4-vendor-master-data", name: "Vendor Master Data" },
                { id: "corp-l4-1099-reporting", name: "1099 / Tax Reporting" },
              ],
            },
            {
              id: "corp-l3-travel-expense",
              name: "Travel & Expense",
              relatedTowerIds: ["corp-services"],
              l5: [
                { id: "corp-l4-travel-mgmt", name: "Travel Management" },
                { id: "corp-l4-expense-policy", name: "Expense Policy Administration" },
                { id: "corp-l4-corporate-card", name: "Corporate Card Program" },
              ],
            },
          ],
        },
            ],
    },
  ],
};
