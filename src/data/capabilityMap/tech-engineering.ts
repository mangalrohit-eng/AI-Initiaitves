import type { CapabilityMapDefinition } from "./types";

/** Capability Map — Tech & Engineering (Forge tower: `tech-engineering`). */
export const techEngineeringCapabilities: CapabilityMapDefinition = {
  id: "tech-engineering-capabilities",
  name: "Tech & Engineering Capabilities",
  l1Name: "Tech & Engineering",
  mapRelatedTowerIds: ["tech-engineering"],
  l2: [
    {
      id: "tech-engineering-jg",
      name: "Technology & Engineering",
      l3: [
        {
          id: "tech-l2-infrastructure-cloud",
          name: "Infrastructure & Cloud",
          l4: [
            {
              id: "tech-l3-cloud-platform",
              name: "Cloud Platform",
              relatedTowerIds: ["tech-engineering"],
              l5: [
                { id: "tech-l4-cloud-provisioning", name: "Cloud Infrastructure Provisioning" },
                { id: "tech-l4-iac", name: "Infrastructure as Code (IaC)" },
                { id: "tech-l4-cloud-cost-optimization", name: "Cloud Cost Optimization" },
                { id: "tech-l4-cloud-tagging-governance", name: "Cloud Tagging & Governance" },
              ],
            },
            {
              id: "tech-l3-network-connectivity",
              name: "Network & Connectivity",
              relatedTowerIds: ["tech-engineering"],
              l5: [
                { id: "tech-l4-network-architecture", name: "Network Architecture & Management" },
                { id: "tech-l4-sd-wan", name: "SD-WAN & Edge Connectivity" },
                { id: "tech-l4-dns-cdn-mgmt", name: "DNS & CDN Management" },
              ],
            },
            {
              id: "tech-l3-resilience-migration",
              name: "Resilience & Migration",
              relatedTowerIds: ["tech-engineering"],
              l5: [
                { id: "tech-l4-dr-bcp", name: "Disaster Recovery & Business Continuity" },
                { id: "tech-l4-comcast-migration", name: "Comcast TSA Migration & Cutover" },
                { id: "tech-l4-data-center-ops", name: "Data Center Operations" },
              ],
            },
          ],
        },
        {
          id: "tech-l2-software-engineering",
          name: "Software Engineering",
          l4: [
            {
              id: "tech-l3-product-engineering",
              name: "Product Engineering",
              relatedTowerIds: ["tech-engineering"],
              l5: [
                { id: "tech-l4-code-development", name: "Code Development & Pair Programming" },
                { id: "tech-l4-code-review", name: "Code Review & Quality Assurance" },
                { id: "tech-l4-test-automation", name: "Testing & QA Automation" },
                { id: "tech-l4-architecture-design", name: "Architecture & Design" },
                { id: "tech-l4-tech-debt-mgmt", name: "Technical Debt Management" },
              ],
            },
            {
              id: "tech-l3-platform-engineering",
              name: "Platform Engineering",
              relatedTowerIds: ["tech-engineering"],
              l5: [
                { id: "tech-l4-cicd", name: "CI/CD & Deployment Management" },
                { id: "tech-l4-developer-experience", name: "Developer Experience & Tooling" },
                { id: "tech-l4-internal-platforms", name: "Internal Developer Platforms" },
              ],
            },
            {
              id: "tech-l3-sre-incident",
              name: "SRE & Incident",
              relatedTowerIds: ["tech-engineering"],
              l5: [
                { id: "tech-l4-incident-response", name: "Incident Detection & Response" },
                { id: "tech-l4-observability", name: "Observability & Monitoring" },
                { id: "tech-l4-sre-on-call", name: "SRE / On-Call Operations" },
                { id: "tech-l4-postmortems", name: "Post-Incident Review" },
              ],
            },
          ],
        },
        {
          id: "tech-l2-ai-ml-platform",
          name: "AI / ML Platform",
          l4: [
            {
              id: "tech-l3-mlops",
              name: "MLOps & Model Lifecycle",
              relatedTowerIds: ["tech-engineering"],
              l5: [
                { id: "tech-l4-mlops-platform", name: "ML Platform Operations (MLOps)" },
                { id: "tech-l4-model-registry", name: "Model Registry & Versioning" },
                { id: "tech-l4-training-pipelines", name: "Training Pipelines" },
                { id: "tech-l4-model-monitoring", name: "Model Performance Monitoring" },
              ],
            },
            {
              id: "tech-l3-llm-operations",
              name: "LLM Operations",
              relatedTowerIds: ["tech-engineering"],
              l5: [
                { id: "tech-l4-llm-gateway", name: "LLM Gateway & Cost Management" },
                { id: "tech-l4-prompt-rag-mgmt", name: "Prompt & RAG Asset Management" },
                { id: "tech-l4-eval-tooling", name: "Eval & Quality Tooling" },
              ],
            },
            {
              id: "tech-l3-ai-governance",
              name: "AI Governance",
              relatedTowerIds: ["tech-engineering"],
              l5: [
                { id: "tech-l4-ai-governance-tech", name: "AI Governance & Audit Trails" },
                { id: "tech-l4-responsible-ai", name: "Responsible AI Reviews" },
                { id: "tech-l4-data-science-enablement", name: "Data Science Enablement" },
              ],
            },
          ],
        },
        {
          id: "tech-l2-cybersecurity",
          name: "Cybersecurity",
          l4: [
            {
              id: "tech-l3-soc-threat",
              name: "SOC & Threat Operations",
              relatedTowerIds: ["tech-engineering"],
              l5: [
                { id: "tech-l4-threat-detection", name: "Threat Detection & Monitoring" },
                { id: "tech-l4-incident-triage-cyber", name: "Incident Triage & Response" },
                { id: "tech-l4-threat-hunting", name: "Threat Hunting" },
              ],
            },
            {
              id: "tech-l3-app-data-protection",
              name: "Application & Data Protection",
              relatedTowerIds: ["tech-engineering"],
              l5: [
                { id: "tech-l4-phishing-defense", name: "Phishing & Social Engineering Defense" },
                { id: "tech-l4-vuln-mgmt", name: "Vulnerability Management" },
                { id: "tech-l4-data-loss-prevention", name: "Data Loss Prevention" },
              ],
            },
            {
              id: "tech-l3-iam-grc",
              name: "IAM & GRC",
              relatedTowerIds: ["tech-engineering"],
              l5: [
                { id: "tech-l4-iam", name: "Identity & Access Management" },
                { id: "tech-l4-security-compliance", name: "Security Compliance & Audit" },
                { id: "tech-l4-security-awareness", name: "Security Awareness Training" },
              ],
            },
          ],
        },
            ],
    },
  ],
};
