import * as React from "react";
import {
  Database,
  Cpu,
  Send,
  Users,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import type { SolutionBrief } from "@/data/types";
import { cn } from "@/lib/utils";
import { SectionShell } from "./sectionShell";

/**
 * Section E — Plain-language reference architecture.
 *
 * Three column-stacks (Sources → AI layer → Targets) plus a Users
 * stripe and a 2-3 sentence data-flow summary. No box-and-line
 * engineering diagram — workshop attendees should be able to read it
 * left-to-right without prior context.
 */
export function ReferenceArchitectureSection({
  brief,
}: {
  brief: SolutionBrief;
}) {
  const arch = brief.referenceArchitecture;
  return (
    <SectionShell
      letter="E"
      title="Reference architecture"
      subtitle="Source systems → AI layer → target systems"
    >
      <div className="space-y-5">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1.2fr)_auto_minmax(0,1fr)] lg:items-stretch">
          <ArchColumn
            label="Source systems"
            tone="source"
            Icon={Database}
            items={arch.sourceSystems}
          />
          <Connector />
          <ArchColumn
            label="AI layer"
            tone="ai"
            Icon={Cpu}
            items={arch.aiLayer.components}
            footer={arch.aiLayer.description}
          />
          <Connector />
          <ArchColumn
            label="Target systems"
            tone="target"
            Icon={Send}
            items={arch.targetSystems}
          />
        </div>
        <div className="rounded-xl border border-forge-border/60 bg-near-black/30 p-4">
          <h3 className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-forge-hint">
            <Users className="h-3 w-3 text-accent-purple-light" aria-hidden />
            Users
          </h3>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {arch.users.map((u, i) => (
              <li
                key={i}
                className="rounded-full border border-forge-border bg-near-black/50 px-2.5 py-0.5 font-mono text-[11px] text-forge-body"
              >
                {u}
              </li>
            ))}
          </ul>
        </div>
        <p className="rounded-xl border-l-4 border-accent-purple/50 bg-near-black/20 px-4 py-3 text-sm leading-relaxed text-forge-body">
          {arch.dataFlowSummary}
        </p>
      </div>
    </SectionShell>
  );
}

function ArchColumn({
  label,
  Icon,
  items,
  tone,
  footer,
}: {
  label: string;
  Icon: LucideIcon;
  items: string[];
  tone: "source" | "ai" | "target";
  footer?: string;
}) {
  const TONE: Record<typeof tone, { wrap: string; head: string }> = {
    source: {
      wrap: "border-forge-border/70 bg-near-black/30",
      head: "text-forge-hint",
    },
    ai: {
      wrap: "border-accent-purple/30 bg-accent-purple/5",
      head: "text-accent-purple-light",
    },
    target: {
      wrap: "border-forge-border/70 bg-near-black/30",
      head: "text-forge-hint",
    },
  };
  const t = TONE[tone];
  return (
    <div
      className={cn(
        "flex flex-col rounded-xl border p-3.5",
        t.wrap,
      )}
    >
      <h3
        className={cn(
          "flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em]",
          t.head,
        )}
      >
        <Icon className="h-3 w-3" aria-hidden />
        {label}
      </h3>
      <ul className="mt-2.5 space-y-1.5">
        {items.map((item, i) => (
          <li
            key={i}
            className="rounded-md border border-forge-border/50 bg-near-black/40 px-2.5 py-1.5 text-xs leading-snug text-forge-body"
          >
            {item}
          </li>
        ))}
      </ul>
      {footer ? (
        <p className="mt-3 text-[11px] leading-relaxed text-forge-subtle">
          {footer}
        </p>
      ) : null}
    </div>
  );
}

function Connector() {
  return (
    <div className="hidden self-center text-accent-purple-light lg:flex">
      <ArrowRight className="h-4 w-4" aria-hidden />
    </div>
  );
}
