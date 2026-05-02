"use client";

import Link from "next/link";
import { Building2, FileText, Map as MapIcon, Sparkles, Database, BookOpen } from "lucide-react";
import type { AskCitation } from "@/lib/ask/types";

const KIND_ICONS: Record<AskCitation["kind"], React.ComponentType<{ className?: string }>> = {
  tower: Building2,
  process: FileText,
  brief: Sparkles,
  workshopRow: Database,
  capNode: MapIcon,
  versantContext: BookOpen,
};

const KIND_LABELS: Record<AskCitation["kind"], string> = {
  tower: "tower",
  process: "process",
  brief: "brief",
  workshopRow: "workshop row",
  capNode: "capability",
  versantContext: "Versant 10-K",
};

export function CitationChips({
  citations,
  onSelect,
}: {
  citations: AskCitation[];
  onSelect?: (c: AskCitation) => void;
}) {
  if (!citations || citations.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {citations.map((c) => {
        const Icon = KIND_ICONS[c.kind];
        const inner = (
          <span className="inline-flex max-w-[260px] items-center gap-1.5 rounded-full border border-forge-border bg-forge-canvas px-2.5 py-1 text-[11px] font-medium text-forge-body transition hover:border-accent-purple/40 hover:text-accent-purple-dark">
            <Icon className="h-3 w-3 flex-shrink-0 text-forge-hint" aria-hidden />
            <span className="truncate">{c.label}</span>
            <span className="font-mono text-[10px] uppercase tracking-wider text-forge-hint">
              {KIND_LABELS[c.kind]}
            </span>
          </span>
        );
        if (onSelect) {
          return (
            <button
              key={`${c.kind}-${c.id}`}
              type="button"
              onClick={() => onSelect(c)}
              className="cursor-pointer"
            >
              {inner}
            </button>
          );
        }
        if (c.href) {
          return (
            <Link key={`${c.kind}-${c.id}`} href={c.href}>
              {inner}
            </Link>
          );
        }
        return <span key={`${c.kind}-${c.id}`}>{inner}</span>;
      })}
    </div>
  );
}
