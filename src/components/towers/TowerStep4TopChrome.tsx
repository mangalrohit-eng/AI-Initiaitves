"use client";

import * as React from "react";
import { TowerJourneyStepper } from "@/components/layout/TowerJourneyStepper";
import { TowerLeadSignoffBar } from "@/components/towers/TowerLeadSignoffBar";
import {
  getAssessProgram,
  getAssessProgramHydrationSnapshot,
  subscribe,
} from "@/lib/localStore";
import { isCapabilityMapJourneyStepDone } from "@/lib/assess/capabilityMapStepStatus";
import type { TowerId } from "@/data/assess/types";
import type { TowerScopedModule } from "@/lib/towerHref";

/**
 * Top-of-page chrome for AI Initiatives (Step 4).
 *
 * Renders the cross-module journey stepper (with prior-step completion
 * checks lit up) and the inline tower-lead sign-off bar — matching the
 * placement convention from Capability Map (Step 1) and Impact Levers
 * (Step 2), where these two affordances anchor the top of the page
 * immediately under the breadcrumbs.
 *
 * Reads the live `assessProgram` so the stepper's completion ticks
 * reflect every cross-step click without a hard refresh.
 */
export function TowerStep4TopChrome({
  towerId,
  towerName,
}: {
  towerId: TowerId;
  towerName: string;
}) {
  const [program, setProgram] = React.useState(() =>
    getAssessProgramHydrationSnapshot(),
  );

  React.useEffect(() => {
    setProgram(getAssessProgram());
    return subscribe("assessProgram", () => setProgram(getAssessProgram()));
  }, []);

  const tState = program.towers[towerId];
  const completed: TowerScopedModule[] = [];
  if (isCapabilityMapJourneyStepDone(tState)) completed.push("capability-map");
  if (tState?.status === "complete") completed.push("impact-levers");
  if (tState?.aiInitiativesValidatedAt) completed.push("ai-initiatives");

  return (
    <div className="space-y-3">
      <TowerJourneyStepper
        towerId={towerId}
        towerName={towerName}
        current="ai-initiatives"
        completed={completed}
      />
      <TowerLeadSignoffBar towerId={towerId} towerName={towerName} />
    </div>
  );
}
