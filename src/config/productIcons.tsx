import type { LucideIcon } from "lucide-react";
import {
  Bell,
  BookOpen,
  Calculator,
  ClipboardList,
  FlaskConical,
  Globe2,
  Grid3X3,
  Map,
  SlidersHorizontal,
  Sparkles,
  UsersRound,
} from "lucide-react";
import * as React from "react";

const productIconMap: Record<string, LucideIcon> = {
  "grid-3x3": Grid3X3,
  map: Map,
  sparkles: Sparkles,
  "globe-2": Globe2,
  "flask-conical": FlaskConical,
  "clipboard-list": ClipboardList,
  sliders: SlidersHorizontal,
  "users-round": UsersRound,
};

const staticIconMap: Record<string, LucideIcon> = {
  "book-open": BookOpen,
  bell: Bell,
  calculator: Calculator,
};

export function getProductIcon(iconId: string): LucideIcon {
  return productIconMap[iconId] ?? Grid3X3;
}

export function getStaticLinkIcon(iconId: string | undefined, fallback: LucideIcon = BookOpen): LucideIcon {
  if (!iconId) return fallback;
  return staticIconMap[iconId] ?? fallback;
}

export function ProductIcon({ iconId, className }: { iconId: string; className?: string }) {
  const I = getProductIcon(iconId);
  return <I className={className} aria-hidden />;
}
