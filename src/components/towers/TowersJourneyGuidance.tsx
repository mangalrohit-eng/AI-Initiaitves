"use client";

import { useGuidanceTowersList } from "@/lib/guidance/useJourneyGuidance";
import { ScreenGuidanceBar } from "@/components/guidance/ScreenGuidanceBar";

export function TowersJourneyGuidance() {
  const g = useGuidanceTowersList();
  return <ScreenGuidanceBar guidance={g} className="mt-4" />;
}
