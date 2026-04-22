"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  changedSince,
  getLastRead,
  pageKey,
  subscribe,
  type PinKind,
} from "@/lib/localStore";

type Props = {
  kind: PinKind;
  id: string;
  // ISO date-string indicating when this item was last updated on the
  // authoring side. If unset, the badge never renders.
  lastUpdated?: string;
  // Visual variant — "chip" for inline next to a title; "dot" for dense
  // surfaces like cards where the chip would crowd the layout.
  variant?: "chip" | "dot";
  className?: string;
};

// Renders "Updated" chip iff the user has seen this page before AND the
// content was republished since. SSR renders nothing; hydration fills in.
export function ChangedSinceBadge({
  kind,
  id,
  lastUpdated,
  variant = "chip",
  className,
}: Props) {
  const [show, setShow] = React.useState(false);

  const recompute = React.useCallback(() => {
    if (!lastUpdated) {
      setShow(false);
      return;
    }
    const last = getLastRead(pageKey(kind, id));
    setShow(changedSince(lastUpdated, last));
  }, [kind, id, lastUpdated]);

  React.useEffect(() => {
    recompute();
    return subscribe("reads", recompute);
  }, [recompute]);

  if (!lastUpdated || !show) return null;

  if (variant === "dot") {
    return (
      <span
        aria-label="Updated since your last visit"
        title="Updated since your last visit"
        className={cn(
          "inline-block h-2 w-2 shrink-0 rounded-full bg-accent-purple ring-2 ring-forge-surface",
          className,
        )}
      />
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-accent-purple/30 bg-accent-purple/10 px-2 py-0.5 text-[10.5px] font-semibold text-accent-purple-dark",
        className,
      )}
      aria-label={`Updated ${formatDate(lastUpdated)} — after your last visit`}
    >
      <Sparkles className="h-3 w-3" aria-hidden />
      Updated
    </span>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}
