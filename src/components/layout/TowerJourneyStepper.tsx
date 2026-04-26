import * as React from "react";
import Link from "next/link";
import { CalendarClock, Check } from "lucide-react";
import {
  getTowerHref,
  TOWER_JOURNEY_MODULES,
  type TowerScopedModule,
} from "@/lib/towerHref";
import type { TowerId } from "@/data/assess/types";

type Props = {
  towerId: TowerId;
  towerName: string;
  /** Current module the user is on. */
  current: TowerScopedModule;
  /** Modules the user has marked complete (drives the green check). */
  completed?: ReadonlyArray<TowerScopedModule>;
  className?: string;
};

/**
 * Cross-module breadcrumb-style stepper for a single tower's journey.
 * Restricted to tower-scoped modules — Prototypes and Delivery Plan are
 * program-scoped and live on the program-home journey instead.
 */
export function TowerJourneyStepper({
  towerId,
  towerName,
  current,
  completed = [],
  className,
}: Props) {
  return (
    <nav
      aria-label={`Journey for ${towerName}`}
      className={
        "no-print rounded-xl border border-forge-border bg-forge-surface/70 p-2 " +
        (className ?? "")
      }
    >
      <ol className="flex flex-wrap items-center gap-1.5 text-xs">
        <li className="px-2 py-1 text-forge-subtle">
          <span className="font-mono uppercase tracking-wider text-forge-hint">
            {towerName}
          </span>
        </li>
        <li aria-hidden className="font-mono text-forge-hint">
          &gt;
        </li>
        {TOWER_JOURNEY_MODULES.map((m, idx) => {
          const isCurrent = m.id === current;
          const isComplete = completed.includes(m.id);
          const href = m.active ? getTowerHref(towerId, m.id) : null;
          const className = [
            "inline-flex items-center gap-1.5 rounded-md px-2 py-1 transition",
            isCurrent
              ? "bg-accent-purple/10 text-accent-purple-dark"
              : isComplete
                ? "text-forge-body hover:bg-forge-well"
                : m.active
                  ? "text-forge-subtle hover:bg-forge-well hover:text-forge-body"
                  : "text-forge-hint",
          ].join(" ");
          const label = (
            <>
              <span
                className={
                  "flex h-4 w-4 items-center justify-center rounded-full text-[10px] " +
                  (isComplete
                    ? "bg-accent-green text-white"
                    : isCurrent
                      ? "bg-accent-purple text-white"
                      : "border border-forge-border-strong")
                }
                aria-hidden
              >
                {isComplete ? <Check className="h-2.5 w-2.5" /> : idx + 1}
              </span>
              <span className="font-medium">{m.label}</span>
              {!m.active ? (
                <span className="ml-1 inline-flex items-center gap-1 rounded-full border border-forge-border px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-forge-hint">
                  <CalendarClock className="h-2.5 w-2.5" />
                  Soon
                </span>
              ) : null}
            </>
          );
          return (
            <React.Fragment key={m.id}>
              <li>
                {href && !isCurrent ? (
                  <Link href={href} className={className} aria-current={undefined}>
                    {label}
                  </Link>
                ) : (
                  <span
                    className={className}
                    aria-current={isCurrent ? "step" : undefined}
                  >
                    {label}
                  </span>
                )}
              </li>
              {idx < TOWER_JOURNEY_MODULES.length - 1 ? (
                <li aria-hidden className="font-mono text-forge-hint">
                  &gt;
                </li>
              ) : null}
            </React.Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
