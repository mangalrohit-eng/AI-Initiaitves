"use client";

import { ArrowRight, Cpu, ShieldCheck, UserCheck, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  REQUEST_FLOW_STEPS,
  type RequestFlowStep,
} from "@/lib/techView/architectureBlueprint";

/**
 * End-to-end request flow — eight numbered cards in sequence with arrow
 * connectors. Each step carries a determinism-boundary tag so the executive
 * sees which side of the contract owns the step (deterministic / LLM /
 * guardrail / human).
 *
 * Fully deterministic — no LLM authorship.
 */
export function RequestFlowDiagram() {
  return (
    <div className="space-y-3">
      <header>
        <h3 className="font-display text-base font-semibold text-forge-ink">
          <span className="font-mono text-accent-purple-dark">&gt;</span> End-to-end request flow
        </h3>
        <p className="mt-1 text-xs text-forge-subtle">
          From a tower-lead question to an audited agent action. Determinism
          boundary annotated under each step — the LLM authors prose only;
          numerics, ids, lookups, and approvals stay deterministic.
        </p>
      </header>

      {/* Horizontal stepper — wraps to multiple rows on narrow screens. */}
      <ol className="flex flex-wrap items-stretch gap-2">
        {REQUEST_FLOW_STEPS.map((step, idx) => (
          <li
            key={step.index}
            className="flex flex-1 items-stretch gap-2"
            style={{ minWidth: "200px" }}
          >
            <StepCard step={step} />
            {idx < REQUEST_FLOW_STEPS.length - 1 ? (
              <div className="hidden flex-shrink-0 items-center md:flex">
                <ArrowRight className="h-4 w-4 text-forge-hint" aria-hidden />
              </div>
            ) : null}
          </li>
        ))}
      </ol>

      <DeterminismLegend />
    </div>
  );
}

function StepCard({ step }: { step: RequestFlowStep }) {
  const meta = determinismMeta(step.determinism);
  const Icon = meta.icon;
  return (
    <div
      className={`flex min-w-0 flex-1 flex-col rounded-xl border bg-forge-surface p-3 ${meta.borderClass}`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md font-mono text-xs font-semibold ${meta.iconBg} ${meta.iconText}`}
        >
          {String(step.index).padStart(2, "0")}
        </span>
        <div className="min-w-0">
          <div className="text-xs font-semibold text-forge-ink">{step.title}</div>
        </div>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-forge-body">{step.detail}</p>
      <div className="mt-2 inline-flex items-center gap-1 self-start rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
        style={{}}
      >
        <span className={`inline-flex items-center gap-1 ${meta.tagText}`}>
          <Icon className="h-2.5 w-2.5" aria-hidden />
          {meta.label}
        </span>
      </div>
    </div>
  );
}

function DeterminismLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-forge-border bg-forge-well/30 px-3 py-2 text-[11px] text-forge-subtle">
      <span className="text-forge-hint">Determinism boundary:</span>
      <Swatch label="Deterministic" variant="deterministic" />
      <Swatch label="LLM" variant="llm" />
      <Swatch label="Guardrail" variant="guardrail" />
      <Swatch label="Human-in-loop" variant="human" />
      <span className="ml-auto max-w-md text-right text-[10px] text-forge-hint">
        The LLM never authors numerics, ids, or financial figures. Only the
        single step tagged <span className="text-forge-body">LLM</span>{" "}
        produces synthesis text — and the guardrail step validates it.
      </span>
    </div>
  );
}

function Swatch({
  label,
  variant,
}: {
  label: string;
  variant: RequestFlowStep["determinism"];
}) {
  const meta = determinismMeta(variant);
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block h-2 w-4 rounded-sm ${meta.swatch}`} aria-hidden />
      <span className={meta.tagText}>{label}</span>
    </span>
  );
}

type DeterminismMeta = {
  label: string;
  icon: LucideIcon;
  borderClass: string;
  iconBg: string;
  iconText: string;
  tagText: string;
  swatch: string;
};

function determinismMeta(d: RequestFlowStep["determinism"]): DeterminismMeta {
  switch (d) {
    case "llm":
      return {
        label: "LLM authors",
        icon: Cpu,
        borderClass: "border-accent-purple/35",
        iconBg: "bg-accent-purple/15",
        iconText: "text-accent-purple-dark",
        tagText: "text-accent-purple-dark",
        swatch: "bg-accent-purple/60",
      };
    case "guardrail":
      return {
        label: "Guardrail",
        icon: ShieldCheck,
        borderClass: "border-accent-teal/35",
        iconBg: "bg-accent-teal/15",
        iconText: "text-emerald-900",
        tagText: "text-emerald-900",
        swatch: "bg-accent-teal/70",
      };
    case "human":
      return {
        label: "Human-in-loop",
        icon: UserCheck,
        borderClass: "border-accent-amber/35",
        iconBg: "bg-accent-amber/15",
        iconText: "text-amber-900",
        tagText: "text-amber-900",
        swatch: "bg-accent-amber/70",
      };
    case "deterministic":
    default:
      return {
        label: "Deterministic",
        icon: Wrench,
        borderClass: "border-forge-border",
        iconBg: "bg-forge-well",
        iconText: "text-forge-body",
        tagText: "text-forge-body",
        swatch: "bg-forge-border-strong",
      };
  }
}
