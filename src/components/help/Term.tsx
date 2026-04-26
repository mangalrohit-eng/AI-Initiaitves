"use client";

import * as React from "react";
import { getGlossaryEntry } from "@/data/glossary";

type Props = {
  /**
   * Glossary key to look up. Defaults to the rendered children when they are a
   * single string.
   */
  termKey?: string;
  children: React.ReactNode;
  /** Override the inline label without changing the lookup key. */
  className?: string;
};

/**
 * Wraps a term with a dotted underline and an on-hover / on-focus glossary
 * popover. Lookups are case-insensitive against `src/data/glossary.ts`.
 *
 * Renders the children unchanged if no glossary entry matches — safe to use
 * speculatively without breaking copy.
 */
export function Term({ termKey, children, className }: Props) {
  const inferredKey = typeof children === "string" ? children : undefined;
  const entry = getGlossaryEntry(termKey ?? inferredKey ?? "");
  const [open, setOpen] = React.useState(false);
  const wrapRef = React.useRef<HTMLSpanElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
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

  if (!entry) {
    return <span className={className}>{children}</span>;
  }

  return (
    <span ref={wrapRef} className={`relative inline ${className ?? ""}`}>
      <button
        type="button"
        aria-expanded={open}
        aria-describedby={open ? `glossary-${entry.term}` : undefined}
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setOpen(true)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onMouseLeave={() => setOpen(false)}
        className="cursor-help border-b border-dotted border-forge-hint align-baseline text-inherit hover:border-accent-purple-dark focus:outline-none focus-visible:border-accent-purple-dark focus-visible:ring-1 focus-visible:ring-accent-purple/30"
      >
        {children}
      </button>
      {open ? (
        <span
          id={`glossary-${entry.term}`}
          role="tooltip"
          className="absolute left-1/2 top-full z-30 mt-1 w-64 -translate-x-1/2 rounded-lg border border-forge-border bg-forge-surface p-3 text-left text-xs leading-relaxed text-forge-body shadow-card"
        >
          <span className="block font-display text-[11px] font-semibold uppercase tracking-wider text-accent-purple-dark">
            {entry.term}
          </span>
          <span className="mt-1 block text-forge-ink">{entry.short}</span>
          {entry.long ? (
            <span className="mt-1 block text-forge-subtle">{entry.long}</span>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}
