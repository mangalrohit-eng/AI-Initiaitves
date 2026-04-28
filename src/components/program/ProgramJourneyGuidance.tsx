"use client";

import { useProgramHomeGuidance } from "@/lib/guidance/useJourneyGuidance";
import { ScreenGuidanceBar } from "@/components/guidance/ScreenGuidanceBar";

export function ProgramJourneyGuidance() {
  const g = useProgramHomeGuidance();
  return <ScreenGuidanceBar guidance={g} className="mt-3" />;
}
