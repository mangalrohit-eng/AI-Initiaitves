"use client";

import * as React from "react";
import { Globe2, ShieldCheck } from "lucide-react";
import {
  baseScopeDescription,
  baseScopeLabel,
  useBaseScope,
  type BaseScope,
} from "@/lib/scope/baseScope";
import { cn } from "@/lib/utils";

const OPTIONS: ReadonlyArray<{
  value: BaseScope;
  Icon: typeof Globe2;
}> = [
  { value: "all-org", Icon: Globe2 },
  { value: "retained-only", Icon: ShieldCheck },
];

/**
 * Program-scoped "All of Versant" vs "Retained org only" pill toggle.
 * Rendered in the Cross-Tower AI Plan header. Persists to localStorage
 * via `useBaseScope` and mirrors the choice to `?scope=retained-only`.
 *
 * Visually a single-row segmented control — premium, editorial, never
 * a dashboardy dropdown.
 */
export function BaseScopeSelector({ className }: { className?: string }) {
  const [scope, setScope] = useBaseScope();
  return (
    <div className={cn("flex flex-col items-end gap-1", className)}>
      <div
        role="radiogroup"
        aria-label="Strategist scope"
        className="inline-flex items-stretch rounded-lg border border-forge-border bg-forge-surface p-0.5 shadow-sm"
      >
        {OPTIONS.map(({ value, Icon }) => {
          const active = scope === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setScope(value)}
              title={baseScopeDescription(value)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition",
                active
                  ? "bg-accent-purple text-white shadow-sm"
                  : "text-forge-subtle hover:bg-forge-well/60 hover:text-forge-body",
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {baseScopeLabel(value)}
            </button>
          );
        })}
      </div>
      <p className="max-w-xs text-right text-[11px] leading-snug text-forge-hint">
        {baseScopeDescription(scope)}
      </p>
    </div>
  );
}
