import type { LeadProgramStep } from "@/lib/program/leadStepStatus";

export type StepCompletionNudge = {
  title: string;
  description: string;
};

/**
 * Toast copy after a tower lead completes a program step. Declarative, Versant-grounded;
 * does not duplicate `ScreenGuidanceBar` / `resolveTowerJourneyGuidance` titles.
 */
export function stepCompletionNudge(
  completedStep: LeadProgramStep,
  towerName: string,
): StepCompletionNudge {
  if (completedStep === 1) {
    return {
      title: `L1–L3 confirmed for ${towerName}`,
      description:
        `Capability map and headcount for ${towerName} are locked in. Open Configure Impact Levers to dial offshore and AI impact per L3 — MS NOW, CNBC, and Golf Channel towers use the same lever pattern so the impact rolls up consistently across the program.`,
    };
  }
  if (completedStep === 2) {
    return {
      title: `${towerName} signed off on impact levers`,
      description:
        `Dial positions for ${towerName} now anchor the program impact estimate. Open Review impact estimate to see the impact roll-up by tower, then Design AI initiatives on ${towerName} to turn the AI dial into sequenced four-lens initiatives for client discussion.`,
    };
  }
  if (completedStep === 3) {
    return {
      title: `Impact estimate reviewed for ${towerName}`,
      description:
        `You have validated the impact view for ${towerName}. Open Design AI initiatives for that tower to sequence roadmap items and four-lens process detail — the numbers here stay tied to the dial set on Configure Impact Levers.`,
    };
  }
  return {
    title: `AI initiatives reviewed for ${towerName}`,
    description:
      `${towerName} is marked workshop-ready on initiatives. Revisit Configure Impact Levers only if dial changes are needed; otherwise use exports and pins to prep the Versant × Accenture Forge client conversation.`,
  };
}
