"use client";

import * as React from "react";
import type { AskProseBlock } from "@/lib/ask/types";

/**
 * Plain-text rendering with backtick markers converted to mono spans.
 *
 * Implementation: split on backticks, render odd indices as
 * `<span className="font-mono ...">...</span>`, even indices as plain text.
 * No markdown parser, no `dangerouslySetInnerHTML` — XSS-safe by construction.
 */
export function ProseBlock({ block }: { block: AskProseBlock }) {
  const segments = React.useMemo(() => parseBackticks(block.text), [block.text]);
  return (
    <div className="rounded-xl border border-forge-border bg-forge-surface px-5 py-4">
      <p className="text-[13px] leading-relaxed text-forge-body">
        {segments.map((seg, i) =>
          seg.kind === "mono" ? (
            <span
              key={i}
              className="rounded bg-forge-well px-1 py-0.5 font-mono text-[12px] text-accent-purple-dark"
            >
              {seg.text}
            </span>
          ) : (
            <React.Fragment key={i}>{seg.text}</React.Fragment>
          ),
        )}
      </p>
    </div>
  );
}

type Segment = { kind: "text" | "mono"; text: string };

function parseBackticks(input: string): Segment[] {
  if (!input) return [];
  const out: Segment[] = [];
  // Greedy: alternating text / mono / text / mono.
  let i = 0;
  let inMono = false;
  let buf = "";
  while (i < input.length) {
    const ch = input[i];
    if (ch === "`") {
      if (buf) {
        out.push({ kind: inMono ? "mono" : "text", text: buf });
        buf = "";
      }
      inMono = !inMono;
      i++;
      continue;
    }
    buf += ch;
    i++;
  }
  if (buf) {
    out.push({ kind: inMono ? "mono" : "text", text: buf });
  }
  return out;
}
