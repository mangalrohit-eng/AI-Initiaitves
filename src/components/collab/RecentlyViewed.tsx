"use client";

import * as React from "react";
import Link from "next/link";
import { Clock } from "lucide-react";
import { getRecent, subscribe, type RecentRef } from "@/lib/localStore";

const KIND_LABEL: Record<RecentRef["kind"], string> = {
  tower: "Tower",
  initiative: "Initiative",
  brief: "Brief",
};

export function RecentlyViewed({ onNavigate }: { onNavigate?: () => void }) {
  const [items, setItems] = React.useState<RecentRef[]>([]);

  const recompute = React.useCallback(() => setItems(getRecent()), []);

  React.useEffect(() => {
    recompute();
    return subscribe("recent", recompute);
  }, [recompute]);

  if (items.length === 0) {
    return (
      <p className="text-xs text-forge-subtle">
        The last tower, initiative, or brief you open will appear here.
      </p>
    );
  }

  return (
    <ul className="space-y-1.5">
      {items.map((r) => (
        <li key={`${r.kind}:${r.id}`}>
          <Link
            href={r.href}
            onClick={onNavigate}
            className="flex items-start gap-2 rounded-lg px-2 py-1.5 text-sm text-forge-body transition hover:bg-forge-well hover:text-forge-ink"
          >
            <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-forge-hint" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium text-forge-ink">{r.title}</span>
              <span className="block truncate text-[11px] text-forge-subtle">
                {KIND_LABEL[r.kind]}
                {r.subtitle ? ` · ${r.subtitle}` : ""}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
