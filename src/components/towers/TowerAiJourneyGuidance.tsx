"use client";

import type { Tower } from "@/data/types";
import { useGuidanceAiInitiatives } from "@/lib/guidance/useJourneyGuidance";
import { ScreenGuidanceBar } from "@/components/guidance/ScreenGuidanceBar";

export function TowerAiJourneyGuidance({ tower }: { tower: Tower }) {
  const g = useGuidanceAiInitiatives(tower);
  return <ScreenGuidanceBar guidance={g} className="mt-3" />;
}
