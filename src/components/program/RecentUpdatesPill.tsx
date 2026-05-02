"use client";

import * as React from "react";
import Link from "next/link";
import {
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  GanttChartSquare,
  Globe2,
  History,
  Map as MapIcon,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import type { ActivityEvent, ActivityEventKind } from "@/lib/activity/types";
import { activityVerb, formatExactTime, formatRelativeTime } from "@/lib/activity/labels";
import { useActivity } from "@/lib/activity/useActivity";

const MAX_ROWS = 6;

const ICON_BY_KIND: Record<ActivityEventKind, LucideIcon> = {
  "ai-initiatives-validated": Sparkles,
  "offshore-confirmed": Globe2,
  "headcount-confirmed": ClipboardCheck,
  "capability-map-confirmed": MapIcon,
  "impact-validated": GanttChartSquare,
  "ai-confirmed": CheckCircle2,
};

/**
 * Compact "Recent updates" pill matching `PresencePill` styling. Clicking
 * opens a popover that shows up to 6 real workshop events. Hides itself
 * entirely when there's nothing to show, so the home header stays clean
 * during fresh / quiet states.
 */
export function RecentUpdatesPill() {
  const { events, ready } = useActivity();
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const visible = events.slice(0, MAX_ROWS);

  React.useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  if (!ready || visible.length === 0) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-full border border-accent-purple/30 bg-accent-purple/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-accent-purple-dark transition hover:border-accent-purple/60 hover:bg-accent-purple/10"
      >
        <History className="h-3 w-3" aria-hidden />
        <span>Recent updates</span>
        <span className="font-mono text-[10px] text-accent-purple-dark/80">
          {events.length > 99 ? "99+" : events.length}
        </span>
        <ChevronDown
          className={
            "h-3 w-3 transition-transform " + (open ? "rotate-180" : "rotate-0")
          }
          aria-hidden
        />
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Recent program activity"
          className="absolute right-0 top-9 z-30 w-80 rounded-xl border border-forge-border bg-forge-surface p-1 shadow-card"
        >
          <div className="flex items-center justify-between px-3 py-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-forge-hint">
              <History className="h-3 w-3" aria-hidden />
              Recent program activity
            </span>
          </div>
          <ul className="max-h-80 overflow-y-auto">
            {visible.map((ev, i) => (
              <UpdateRow
                key={`${ev.towerId}:${ev.kind}:${ev.at}:${i}`}
                event={ev}
                onNavigate={() => setOpen(false)}
              />
            ))}
          </ul>
          <p className="border-t border-forge-border px-3 py-2 text-[10px] leading-relaxed text-forge-hint">
            Sourced from real tower-lead confirmations across the workshop.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function UpdateRow({
  event,
  onNavigate,
}: {
  event: ActivityEvent;
  onNavigate: () => void;
}) {
  const Icon = ICON_BY_KIND[event.kind];
  return (
    <li>
      <Link
        href={event.href}
        role="menuitem"
        onClick={onNavigate}
        className="group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition hover:bg-forge-well/60"
      >
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-accent-purple/20 bg-accent-purple/5 text-accent-purple-dark"
          aria-hidden
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
        <span className="min-w-0 flex-1 truncate text-forge-body group-hover:text-forge-ink">
          <span className="font-medium text-forge-ink">{event.towerName}</span>
          <span className="text-forge-subtle"> {activityVerb(event.kind)}</span>
        </span>
        <time
          dateTime={event.at}
          title={formatExactTime(event.at)}
          className="shrink-0 font-mono text-[11px] text-forge-hint"
        >
          {formatRelativeTime(event.at)}
        </time>
      </Link>
    </li>
  );
}
