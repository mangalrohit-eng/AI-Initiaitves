"use client";

import * as React from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  /** Short label for the popover header (eg. "Why 50% offshore?"). */
  title: string;
  /** Body — one or two sentences. Versant-aware, no hedge language. */
  body: React.ReactNode;
  /** Visual hue. Purple = offshore, teal = AI. */
  hue?: "purple" | "teal" | "neutral";
  className?: string;
};

/**
 * Tiny inline "i" popover that explains the heuristic behind a starter
 * default — the answer to "why this number?" without making the user read the
 * heuristic file or rebuild it in Excel.
 *
 * Implemented as a click + hover-to-open popover with explicit close on click
 * outside and Escape, no extra dep needed.
 */
export function RationalePopover({ title, body, hue = "purple", className }: Props) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

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

  const tint =
    hue === "purple"
      ? "border-accent-purple/30 bg-accent-purple/5 text-accent-purple-dark"
      : hue === "teal"
        ? "border-accent-teal/30 bg-accent-teal/5 text-accent-teal"
        : "border-forge-border bg-forge-surface text-forge-subtle";

  return (
    <div ref={ref} className={cn("relative inline-flex", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={title}
        title={title}
        className={cn(
          "inline-flex h-4 w-4 items-center justify-center rounded-full border transition hover:scale-110",
          tint,
        )}
      >
        <Info className="h-2.5 w-2.5" aria-hidden />
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label={title}
          className="absolute left-0 top-5 z-30 w-64 rounded-xl border border-forge-border bg-forge-surface p-3 text-left shadow-xl shadow-black/20"
        >
          <div className="text-[11px] font-semibold uppercase tracking-wider text-forge-subtle">
            {title}
          </div>
          <div className="mt-1.5 text-xs leading-relaxed text-forge-body">{body}</div>
        </div>
      ) : null}
    </div>
  );
}
