import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Shared section wrapper for the AI Solution detail page. All six
 * narrative sections (What it does, How it works, Sourcing, Buy options,
 * Reference architecture, Agents to develop) wrap their content in this
 * shell so the page reads as one editorial scroll with consistent
 * spacing, dark surfaces, and the Accenture chevron motif on the heading.
 */
export function SectionShell({
  letter,
  title,
  subtitle,
  className,
  children,
}: {
  /** "A" / "B" / ... — index letter for the chevron prefix. */
  letter: string;
  /** Section heading. */
  title: string;
  /** Optional one-line subtitle under the heading. */
  subtitle?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-forge-border bg-forge-surface/70 p-5 sm:p-6",
        className,
      )}
    >
      <header className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent-purple-light">
          &gt; Section {letter}
        </span>
        <h2 className="font-display text-xl font-semibold text-forge-ink">
          {title}
        </h2>
        {subtitle ? (
          <p className="text-xs text-forge-subtle">{subtitle}</p>
        ) : null}
      </header>
      {children}
    </section>
  );
}
