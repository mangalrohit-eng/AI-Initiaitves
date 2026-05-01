import type { CapabilityMapDefinition } from "./types";

/** Capability Map — Operations & Technology (Forge tower: `operations-technology`). */
export const operationsTechnologyCapabilities: CapabilityMapDefinition = {
  id: "operations-technology-capabilities",
  name: "Operations & Technology Capabilities",
  l1Name: "Operations & Technology",
  mapRelatedTowerIds: ["operations-technology"],
  l2: [
    {
      id: "operations-technology-jg",
      name: "Operations & Technology",
      l3: [
        {
          id: "ops-l2-master-control-playout",
          name: "Master Control & Playout",
          l4: [
            {
              id: "ops-l3-live-playout",
              name: "Live Playout",
              relatedTowerIds: ["operations-technology"],
              l5: [
                { id: "ops-l4-playout-monitoring", name: "Live Playout Monitoring & Management" },
                { id: "ops-l4-network-control-room", name: "Network Control Room Operations (7+ networks)" },
                { id: "ops-l4-pre-emption-mgmt", name: "Breaking News Pre-Emption Management" },
                { id: "ops-l4-promo-insertion", name: "Promo & Bug Insertion" },
              ],
            },
            {
              id: "ops-l3-commercial-insertion",
              name: "Commercial Insertion",
              relatedTowerIds: ["operations-technology"],
              l5: [
                { id: "ops-l4-commercial-execution", name: "Commercial Insertion Execution" },
                { id: "ops-l4-traffic-coordination", name: "Traffic Coordination" },
                { id: "ops-l4-as-run-logging", name: "As-Run Logging" },
              ],
            },
            {
              id: "ops-l3-broadcast-qa-compliance",
              name: "Broadcast QA & Compliance",
              relatedTowerIds: ["operations-technology"],
              l5: [
                { id: "ops-l4-fcc-logging", name: "FCC Compliance Logging" },
                { id: "ops-l4-broadcast-qa", name: "Quality Assurance (video / audio / captioning)" },
                { id: "ops-l4-closed-captioning", name: "Closed Captioning Compliance" },
                { id: "ops-l4-loudness-monitoring", name: "Loudness / CALM Act Monitoring" },
              ],
            },
          ],
        },
        {
          id: "ops-l2-signal-distribution",
          name: "Signal Distribution",
          l4: [
            {
              id: "ops-l3-distribution-paths",
              name: "Distribution Paths",
              relatedTowerIds: ["operations-technology"],
              l5: [
                { id: "ops-l4-signal-monitoring", name: "Multi-Path Signal Monitoring" },
                { id: "ops-l4-cable-satellite-feeds", name: "Cable / Satellite Feed Management" },
                { id: "ops-l4-ota-distribution", name: "OTA Distribution" },
                { id: "ops-l4-international-feeds", name: "International Feed Management (Nikkei CNBC)" },
              ],
            },
            {
              id: "ops-l3-streaming-fast",
              name: "Streaming & FAST",
              relatedTowerIds: ["operations-technology"],
              l5: [
                { id: "ops-l4-fast-channel-ops", name: "FAST Channel Operations (Pluto / Tubi / Samsung TV+)" },
                { id: "ops-l4-cdn-streaming", name: "CDN & Streaming Infrastructure" },
                { id: "ops-l4-dtc-delivery", name: "DTC Streaming Delivery" },
              ],
            },
            {
              id: "ops-l3-resilience",
              name: "Resilience & Failover",
              relatedTowerIds: ["operations-technology"],
              l5: [
                { id: "ops-l4-auto-failover", name: "Auto-Failover & Redundancy Management" },
                { id: "ops-l4-satellite-transponder", name: "Satellite Transponder Management" },
                { id: "ops-l4-fiber-backhaul", name: "Fiber Backhaul Operations" },
              ],
            },
          ],
        },
        {
          id: "ops-l2-broadcast-engineering",
          name: "Broadcast Engineering",
          l4: [
            {
              id: "ops-l3-equipment-maintenance",
              name: "Equipment Maintenance",
              relatedTowerIds: ["operations-technology"],
              l5: [
                { id: "ops-l4-predictive-maintenance", name: "Predictive Equipment Maintenance" },
                { id: "ops-l4-corrective-maintenance", name: "Corrective Maintenance" },
                { id: "ops-l4-spare-parts", name: "Spare Parts Inventory Management" },
                { id: "ops-l4-vendor-service-mgmt", name: "Equipment Vendor & Service Management" },
              ],
            },
            {
              id: "ops-l3-engineering-projects",
              name: "Engineering Projects",
              relatedTowerIds: ["operations-technology"],
              l5: [
                { id: "ops-l4-capacity-planning", name: "Capacity Planning & Upgrades" },
                { id: "ops-l4-equipment-lifecycle", name: "Equipment Lifecycle Management" },
                { id: "ops-l4-project-engineering", name: "Project / Build Engineering" },
              ],
            },
            {
              id: "ops-l3-standards-design",
              name: "Standards & Design",
              relatedTowerIds: ["operations-technology"],
              l5: [
                { id: "ops-l4-smpte-standards", name: "SMPTE & Industry Standards Compliance" },
                { id: "ops-l4-broadcast-systems-design", name: "Broadcast Systems Design" },
                { id: "ops-l4-documentation-cmdb", name: "Documentation & CMDB" },
              ],
            },
          ],
        },
            ],
    },
  ],
};
