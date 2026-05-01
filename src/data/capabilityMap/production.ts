import type { CapabilityMapDefinition } from "./types";

/** Capability Map — Production (Forge tower: `production`). */
export const productionCapabilities: CapabilityMapDefinition = {
  id: "production-capabilities",
  name: "Production Capabilities",
  l1Name: "Production",
  mapRelatedTowerIds: ["production"],
  l2: [
    {
      id: "production-jg",
      name: "Production",
      l3: [
        {
          id: "prod-l2-post-production",
          name: "Post-Production",
          l4: [
            {
              id: "prod-l3-edit-clip",
              name: "Editing & Clip Creation",
              relatedTowerIds: ["production"],
              l5: [
                { id: "prod-l4-rough-cutting", name: "Automated Rough Cutting & Clip Creation" },
                { id: "prod-l4-finish-edit", name: "Finish Edit" },
                { id: "prod-l4-promo-cutting", name: "Promo & Trailer Cutting" },
                { id: "prod-l4-archive-clip-pull", name: "Archive Clip Pulls" },
              ],
            },
            {
              id: "prod-l3-graphics-design",
              name: "Graphics & Design",
              relatedTowerIds: ["production"],
              l5: [
                { id: "prod-l4-graphics-thumbnails", name: "Graphics & Thumbnail Generation" },
                { id: "prod-l4-motion-graphics", name: "Motion Graphics & Lower Thirds" },
                { id: "prod-l4-vfx-complex", name: "VFX & Complex Motion Graphics" },
              ],
            },
            {
              id: "prod-l3-audio-finishing",
              name: "Audio & Finishing",
              relatedTowerIds: ["production"],
              l5: [
                { id: "prod-l4-audio-mixing", name: "Audio Processing & Mixing" },
                { id: "prod-l4-color-grading", name: "Color Correction & Grading" },
                { id: "prod-l4-sound-design", name: "Sound Design & Music" },
              ],
            },
            {
              id: "prod-l3-distribution-mam",
              name: "Distribution & Asset Management",
              relatedTowerIds: ["production"],
              l5: [
                { id: "prod-l4-captioning-accessibility", name: "Captioning & Accessibility" },
                { id: "prod-l4-transcoding-distribution", name: "Format Transcoding & Multi-Platform Distribution" },
                { id: "prod-l4-archive-indexing", name: "Content Archive Indexing & Search" },
                { id: "prod-l4-mam-operations", name: "MAM / DAM Operations" },
              ],
            },
          ],
        },
        {
          id: "prod-l2-studio-operations",
          name: "Studio Operations",
          l4: [
            {
              id: "prod-l3-studio-scheduling",
              name: "Scheduling & Resourcing",
              relatedTowerIds: ["production"],
              l5: [
                { id: "prod-l4-studio-scheduling", name: "Studio Scheduling & Utilization" },
                { id: "prod-l4-crew-scheduling", name: "Crew Scheduling & Assignment" },
                { id: "prod-l4-equipment-allocation", name: "Equipment Tracking & Allocation" },
                { id: "prod-l4-breaking-news-realloc", name: "Breaking News Reallocation" },
              ],
            },
            {
              id: "prod-l3-studio-design-build",
              name: "Studio Design & Build",
              relatedTowerIds: ["production"],
              l5: [
                { id: "prod-l4-studio-set-design", name: "Studio Set Design & Construction" },
                { id: "prod-l4-studio-tech-upgrades", name: "Studio Technology Upgrades" },
                { id: "prod-l4-lighting-rigging", name: "Lighting & Rigging" },
              ],
            },
            {
              id: "prod-l3-studio-on-floor",
              name: "On-Floor Production",
              relatedTowerIds: ["production"],
              l5: [
                { id: "prod-l4-floor-operations", name: "Floor Operations" },
                { id: "prod-l4-camera-crew", name: "Camera & Crew Operations" },
                { id: "prod-l4-teleprompter-prompt", name: "Teleprompter & Prompt Operations" },
              ],
            },
          ],
        },
        {
          id: "prod-l2-remote-field",
          name: "Remote & Field Production",
          l4: [
            {
              id: "prod-l3-event-planning",
              name: "Event Planning",
              relatedTowerIds: ["production"],
              l5: [
                { id: "prod-l4-remi-decision", name: "Production Planning & REMI Decision" },
                { id: "prod-l4-logistics-coordination", name: "Logistics Coordination" },
                { id: "prod-l4-permits-locations", name: "Permits & Locations" },
              ],
            },
            {
              id: "prod-l3-connectivity",
              name: "Connectivity",
              relatedTowerIds: ["production"],
              l5: [
                { id: "prod-l4-connectivity-mgmt", name: "Connectivity Management (fiber / 5G / sat)" },
                { id: "prod-l4-remote-feed-monitoring", name: "Remote Feed Quality Monitoring" },
              ],
            },
            {
              id: "prod-l3-field-operations",
              name: "Field Operations",
              relatedTowerIds: ["production"],
              l5: [
                { id: "prod-l4-crew-deployment", name: "Crew Deployment & Travel" },
                { id: "prod-l4-on-site-direction", name: "On-Site Production Direction" },
                { id: "prod-l4-on-site-tech", name: "On-Site Technical Operations" },
              ],
            },
          ],
        },
            ],
    },
  ],
};
