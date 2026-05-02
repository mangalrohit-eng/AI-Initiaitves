"use client";

import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { useRedactDollars } from "@/lib/clientMode";
import type { AskMetricBlock } from "@/lib/ask/types";

export function MetricBlock({ block }: { block: AskMetricBlock }) {
  const redact = useRedactDollars();
  const isDollar = block.unit === "$";
  const showRedacted = isDollar && redact;

  const trend = block.trend;
  const TrendIcon = trend === "up" ? ArrowUpRight : trend === "down" ? ArrowDownRight : trend === "flat" ? Minus : null;
  const trendClass =
    trend === "up"
      ? "text-accent-green"
      : trend === "down"
        ? "text-accent-red"
        : trend === "flat"
          ? "text-forge-subtle"
          : "";

  return (
    <div className="rounded-xl border border-forge-border bg-forge-surface p-5">
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-forge-subtle">
        {block.label}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="font-mono text-3xl font-semibold leading-none text-forge-ink">
          {showRedacted ? (
            <span className="text-forge-subtle">—</span>
          ) : block.numericValue != null ? (
            <>
              {isDollar ? "$" : ""}
              <AnimatedNumber value={block.numericValue} />
            </>
          ) : (
            block.value
          )}
        </span>
        {block.unit && !isDollar ? (
          <span className="text-xs font-medium uppercase tracking-wider text-forge-hint">
            {block.unit}
          </span>
        ) : null}
        {TrendIcon ? <TrendIcon className={`h-4 w-4 ${trendClass}`} aria-hidden /> : null}
      </div>
      {block.subtext ? (
        <div className="mt-1.5 text-xs leading-relaxed text-forge-subtle">
          {block.subtext}
        </div>
      ) : null}
    </div>
  );
}
