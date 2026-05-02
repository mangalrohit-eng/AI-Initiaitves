"use client";

import { AlertTriangle, Info } from "lucide-react";
import type { AskNoteBlock } from "@/lib/ask/types";

export function NoteBlock({ block }: { block: AskNoteBlock }) {
  const isWarn = block.severity === "warn";
  const Icon = isWarn ? AlertTriangle : Info;
  const tone = isWarn
    ? "border-accent-amber/40 bg-accent-amber/10 text-accent-amber"
    : "border-forge-border bg-forge-well/40 text-forge-body";
  const iconTone = isWarn ? "text-accent-amber" : "text-forge-hint";
  return (
    <div className={`flex items-start gap-2.5 rounded-lg border px-4 py-3 ${tone}`}>
      <Icon className={`mt-0.5 h-4 w-4 flex-shrink-0 ${iconTone}`} aria-hidden />
      <p className="text-xs leading-relaxed">{block.text}</p>
    </div>
  );
}
