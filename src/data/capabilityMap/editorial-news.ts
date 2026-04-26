import type { CapabilityMapDefinition } from "./types";

/** Capability Map — Editorial — News (Forge tower: `editorial-news`). */
export const editorialNewsCapabilities: CapabilityMapDefinition = {
  id: "editorial-news-capabilities",
  name: "Editorial — News Capabilities",
  l1Name: "Editorial — News",
  mapRelatedTowerIds: ["editorial-news"],
  l2: [
    {
      id: "ed-l2-news-production",
      name: "News Production — Digital & Live",
      l3: [
        {
          id: "ed-l3-news-gathering",
          name: "News Gathering",
          relatedTowerIds: ["editorial-news"],
          l4: [
            { id: "ed-l4-breaking-news-monitoring", name: "Breaking News Monitoring & Alert Generation" },
            { id: "ed-l4-wire-intake", name: "Wire Service Intake & Curation" },
            { id: "ed-l4-source-development", name: "Source Development & Relationship Management" },
            { id: "ed-l4-tip-line-mgmt", name: "Tip Line & Inbound Lead Management" },
          ],
        },
        {
          id: "ed-l3-news-content-creation",
          name: "Content Creation",
          relatedTowerIds: ["editorial-news"],
          l4: [
            { id: "ed-l4-data-driven-content", name: "Automated Data-Driven Content (markets / scores / digests)" },
            { id: "ed-l4-article-writing-editing", name: "Article Writing & Editing" },
            { id: "ed-l4-headline-cms-publishing", name: "CMS Publishing & SEO Optimization" },
            { id: "ed-l4-photo-image-selection", name: "Photo & Image Selection" },
          ],
        },
        {
          id: "ed-l3-live-broadcast-news",
          name: "Live Broadcast",
          relatedTowerIds: ["editorial-news"],
          l4: [
            { id: "ed-l4-show-rundown-mgmt", name: "Show Rundown Management" },
            { id: "ed-l4-live-data-graphics", name: "Live Broadcast Data & Graphics Support" },
            { id: "ed-l4-live-show-production", name: "Live Show Production" },
            { id: "ed-l4-on-camera-anchoring", name: "On-Camera Reporting & Anchoring" },
            { id: "ed-l4-control-room-direction", name: "Control Room Direction" },
          ],
        },
        {
          id: "ed-l3-editorial-decisions",
          name: "Editorial Decisions",
          relatedTowerIds: ["editorial-news"],
          l4: [
            { id: "ed-l4-story-selection", name: "Editorial Meeting / Story Selection" },
            { id: "ed-l4-assignment-desk", name: "Assignment Desk Operations" },
          ],
        },
      ],
    },
    {
      id: "ed-l2-investigative-enterprise",
      name: "Investigative & Enterprise Journalism",
      l3: [
        {
          id: "ed-l3-research-analysis",
          name: "Research & Analysis",
          relatedTowerIds: ["editorial-news"],
          l4: [
            { id: "ed-l4-document-research", name: "Document Research & Analysis" },
            { id: "ed-l4-pattern-detection", name: "Pattern & Connection Detection" },
            { id: "ed-l4-foia-records", name: "FOIA & Public Records Requests" },
            { id: "ed-l4-data-journalism", name: "Data Journalism & Visualization" },
          ],
        },
        {
          id: "ed-l3-fact-verification",
          name: "Fact Verification",
          relatedTowerIds: ["editorial-news"],
          l4: [
            { id: "ed-l4-real-time-fact-check", name: "Real-Time Fact Verification" },
            { id: "ed-l4-source-verification", name: "Source Verification" },
            { id: "ed-l4-image-video-verification", name: "Image / Video Verification" },
          ],
        },
        {
          id: "ed-l3-long-form-development",
          name: "Long-Form Development",
          relatedTowerIds: ["editorial-news"],
          l4: [
            { id: "ed-l4-long-form-stories", name: "Long-Form Story Development" },
            { id: "ed-l4-investigative-collaboration", name: "Investigative Team Collaboration" },
          ],
        },
      ],
    },
    {
      id: "ed-l2-audio-podcast",
      name: "Audio & Podcast Production",
      l3: [
        {
          id: "ed-l3-podcast-production",
          name: "Podcast Production",
          relatedTowerIds: ["editorial-news"],
          l4: [
            { id: "ed-l4-podcast-recording", name: "Recording & Host Preparation" },
            { id: "ed-l4-post-recording-processing", name: "Post-Recording Processing (transcription / edit / show notes / clips)" },
            { id: "ed-l4-podcast-publishing", name: "Podcast Publishing & Distribution" },
          ],
        },
        {
          id: "ed-l3-podcast-monetization",
          name: "Monetization & Promotion",
          relatedTowerIds: ["editorial-news"],
          l4: [
            { id: "ed-l4-dynamic-ad-insertion", name: "Dynamic Ad Insertion & Monetization" },
            { id: "ed-l4-cross-show-promo", name: "Cross-Show Promotion & Discovery" },
            { id: "ed-l4-podcast-analytics", name: "Podcast Performance Analytics" },
          ],
        },
        {
          id: "ed-l3-podcast-strategy",
          name: "Podcast Strategy",
          relatedTowerIds: ["editorial-news"],
          l4: [
            { id: "ed-l4-podcast-strategy", name: "Podcast Strategy & Development" },
            { id: "ed-l4-talent-host-mgmt", name: "Host & Talent Management" },
          ],
        },
      ],
    },
    {
      id: "ed-l2-editorial-standards",
      name: "Editorial Standards & Quality",
      l3: [
        {
          id: "ed-l3-standards-policy",
          name: "Standards & Policy",
          relatedTowerIds: ["editorial-news"],
          l4: [
            { id: "ed-l4-standards-development", name: "Editorial Standards Development" },
            { id: "ed-l4-content-labeling", name: "Content Labeling & Transparency" },
            { id: "ed-l4-corrections-retractions", name: "Corrections & Retractions" },
            { id: "ed-l4-editorial-training", name: "Editorial Training" },
          ],
        },
        {
          id: "ed-l3-ai-content-review",
          name: "AI Content Review",
          relatedTowerIds: ["editorial-news"],
          l4: [
            { id: "ed-l4-ai-content-quality-review", name: "AI Content Quality Review" },
            { id: "ed-l4-bias-tone-review", name: "Bias & Tone Review" },
          ],
        },
        {
          id: "ed-l3-multilingual-localization",
          name: "Multilingual & Localization",
          relatedTowerIds: ["editorial-news"],
          l4: [
            { id: "ed-l4-multilingual-quality", name: "Multilingual Content Quality (Nikkei CNBC)" },
            { id: "ed-l4-translation-localization", name: "Translation & Localization" },
          ],
        },
      ],
    },
  ],
};
