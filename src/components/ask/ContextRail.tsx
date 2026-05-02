"use client";

import { Building2, Database, Eye, EyeOff, Sparkles } from "lucide-react";
import type { ProgramDigest } from "@/lib/ask/types";

type Props = {
  digest: ProgramDigest;
  clientMode: boolean;
  briefCount: number;
};

export function ContextRail({ digest, clientMode, briefCount }: Props) {
  const lastUpdatedLabel = digest.lastUpdated ? formatRelative(digest.lastUpdated) : "no workshop saved yet";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Pill
        icon={<Building2 className="h-3 w-3" aria-hidden />}
        label={`${digest.totals.towerCount} towers`}
        sublabel={`${digest.totals.contributingTowerCount} populated`}
      />
      <Pill
        icon={<Database className="h-3 w-3" aria-hidden />}
        label={`${digest.totals.l4RowCount.toLocaleString()} L4 rows`}
        sublabel={lastUpdatedLabel}
      />
      <Pill
        icon={<Sparkles className="h-3 w-3" aria-hidden />}
        label={`${briefCount} AI briefs`}
        sublabel="authored"
      />
      <Pill
        icon={clientMode ? <EyeOff className="h-3 w-3" aria-hidden /> : <Eye className="h-3 w-3" aria-hidden />}
        label={clientMode ? "ClientMode ON" : "ClientMode OFF"}
        sublabel={clientMode ? "$ figures hidden" : "$ figures visible"}
        tone={clientMode ? "warn" : "default"}
      />
    </div>
  );
}

function Pill({
  icon,
  label,
  sublabel,
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  tone?: "default" | "warn";
}) {
  const toneClass =
    tone === "warn"
      ? "border-accent-amber/40 bg-accent-amber/5 text-accent-amber"
      : "border-forge-border bg-forge-canvas text-forge-body";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] ${toneClass}`}>
      <span className="text-forge-hint">{icon}</span>
      <span className="font-medium">{label}</span>
      {sublabel ? (
        <span className="text-[10px] uppercase tracking-wider text-forge-hint">{sublabel}</span>
      ) : null}
    </span>
  );
}

function formatRelative(iso: string): string {
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return "saved";
  const deltaMs = Date.now() - ts;
  const min = Math.round(deltaMs / 60_000);
  if (min < 1) return "saved just now";
  if (min < 60) return `saved ${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `saved ${hr}h ago`;
  const d = Math.round(hr / 24);
  return `saved ${d}d ago`;
}
