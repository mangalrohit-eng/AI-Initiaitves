import type { Agent } from "@/data/types";

/**
 * Presentational agent node metadata helper (diagram renders SVG nodes inline).
 */
export function agentNodeLabel(agent: Agent) {
  return `${agent.name} · ${agent.type}`;
}
