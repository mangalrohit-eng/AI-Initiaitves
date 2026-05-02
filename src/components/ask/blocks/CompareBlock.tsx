"use client";

import type { AskCompareBlock } from "@/lib/ask/types";

export function CompareBlock({ block }: { block: AskCompareBlock }) {
  return (
    <div className="rounded-xl border border-forge-border bg-forge-surface">
      <div className="grid grid-cols-1 divide-y divide-forge-border md:grid-cols-2 md:divide-x md:divide-y-0">
        <CompareSide title={block.left.title} lines={block.left.lines} accent="purple" />
        <CompareSide title={block.right.title} lines={block.right.lines} accent="teal" />
      </div>
    </div>
  );
}

function CompareSide({
  title,
  lines,
  accent,
}: {
  title: string;
  lines: string[];
  accent: "purple" | "teal";
}) {
  const ringClass =
    accent === "purple" ? "border-l-accent-purple" : "border-l-accent-teal";
  return (
    <div className={`border-l-2 p-5 ${ringClass}`}>
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-forge-subtle">
        {title}
      </div>
      <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-forge-body">
        {lines.map((line, i) => (
          <li key={i} className="flex gap-2">
            <span aria-hidden className="mt-1 inline-block h-1 w-1 flex-shrink-0 rounded-full bg-forge-hint" />
            <span>{line}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
