"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Compact multi-select dropdown used by `SolutionsGallery` for the
 * Job Family and Vendor filters.
 *
 * Replaces a horizontal chip wall with a single pill-trigger that opens
 * a panel containing:
 *   - search input filtering the visible options,
 *   - scrollable checkbox list (`max-h-72`),
 *   - footer with Clear (deselects all) + visible-count summary.
 *
 * Toggling an option does NOT close the panel — workshop attendees
 * routinely flip multiple filters in one pass. Click-away or `Escape`
 * closes.
 */
export type MultiSelectOption = {
  /** Stable id matched against `selected[]`. */
  id: string;
  /** Display label rendered next to the checkbox. */
  label: string;
  /** Optional secondary line (e.g. count) rendered as muted hint. */
  hint?: React.ReactNode;
};

export function MultiSelectFilter({
  label,
  options,
  selected,
  onChange,
  triggerIcon,
  emptyHint,
  className,
}: {
  /** Trigger label (e.g. "Job Family"). */
  label: string;
  options: ReadonlyArray<MultiSelectOption>;
  /** Selected option ids. */
  selected: string[];
  onChange: (next: string[]) => void;
  /** Optional Lucide-style component rendered inside the trigger. */
  triggerIcon?: React.ComponentType<{ className?: string }>;
  /** Copy shown when search produces zero results. */
  emptyHint?: string;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [highlight, setHighlight] = React.useState(0);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  const selectedSet = React.useMemo(() => new Set(selected), [selected]);

  React.useEffect(() => {
    setHighlight(0);
  }, [query, open]);

  React.useEffect(() => {
    if (!open) return;
    function onClickAway(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickAway);
    return () => document.removeEventListener("mousedown", onClickAway);
  }, [open]);

  React.useEffect(() => {
    if (open) {
      const id = window.setTimeout(() => inputRef.current?.focus(), 30);
      return () => window.clearTimeout(id);
    }
  }, [open]);

  const toggleOption = (id: string) => {
    if (selectedSet.has(id)) {
      onChange(selected.filter((s) => s !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(filtered.length - 1, h + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(0, h - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = filtered[highlight];
      if (target) toggleOption(target.id);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  };

  const TriggerIcon = triggerIcon;

  return (
    <div ref={containerRef} className={cn("relative inline-flex", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition",
          selected.length > 0 || open
            ? "border-accent-purple/40 bg-accent-purple/10 text-forge-ink"
            : "border-forge-border bg-forge-well/40 text-forge-body hover:border-accent-purple/30 hover:text-forge-ink",
        )}
      >
        {TriggerIcon ? (
          <TriggerIcon className="h-3.5 w-3.5 text-forge-hint" aria-hidden />
        ) : null}
        <span className="font-mono uppercase tracking-[0.14em] text-forge-hint">
          {label}
        </span>
        {selected.length > 0 ? (
          <span
            aria-hidden
            className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-accent-purple px-1 font-mono text-[10px] font-semibold text-white"
          >
            {selected.length}
          </span>
        ) : null}
        <ChevronsUpDown className="h-3 w-3 text-forge-hint" aria-hidden />
      </button>
      {open ? (
        <div
          role="listbox"
          aria-label={`Filter by ${label}`}
          aria-multiselectable="true"
          className={cn(
            "absolute left-0 top-[calc(100%+6px)] z-30 w-72 max-w-[88vw] rounded-xl border border-forge-border bg-near-black/95 p-1.5 shadow-xl backdrop-blur",
          )}
        >
          <div className="flex items-center gap-2 rounded-lg border border-forge-border/60 bg-forge-well/60 px-2.5 py-1.5">
            <Search className="h-3.5 w-3.5 text-forge-hint" aria-hidden />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={`Filter ${label.toLowerCase()}...`}
              className="w-full bg-transparent text-xs text-forge-ink placeholder:text-forge-hint focus:outline-none"
            />
          </div>
          <ul className="mt-1 max-h-72 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-xs text-forge-subtle">
                {emptyHint ?? `No ${label.toLowerCase()} matches "${query}".`}
              </li>
            ) : (
              filtered.map((opt, idx) => {
                const isSelected = selectedSet.has(opt.id);
                const isHighlighted = idx === highlight;
                return (
                  <li key={opt.id} role="option" aria-selected={isSelected}>
                    <button
                      type="button"
                      onMouseEnter={() => setHighlight(idx)}
                      onClick={() => toggleOption(opt.id)}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-xs transition",
                        isHighlighted
                          ? "bg-accent-purple/15 text-forge-ink"
                          : "text-forge-body hover:bg-forge-well/60",
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border transition",
                          isSelected
                            ? "border-accent-purple bg-accent-purple text-white"
                            : "border-forge-border bg-near-black/40",
                        )}
                      >
                        {isSelected ? (
                          <Check className="h-3 w-3" aria-hidden />
                        ) : null}
                      </span>
                      <span className="min-w-0 flex-1 truncate">
                        {opt.label}
                      </span>
                      {opt.hint ? (
                        <span className="font-mono text-[10px] text-forge-hint">
                          {opt.hint}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
          <div className="mt-1 flex items-center justify-between gap-2 border-t border-forge-border/60 px-2 py-1.5 text-[10px] text-forge-hint">
            <span className="font-mono uppercase tracking-[0.16em]">
              {selected.length} of {options.length} selected
            </span>
            {selected.length > 0 ? (
              <button
                type="button"
                onClick={() => onChange([])}
                className="inline-flex items-center gap-1 rounded-full border border-forge-border bg-forge-well/50 px-2 py-0.5 text-[10px] uppercase tracking-wider text-forge-body transition hover:border-accent-purple/40 hover:text-forge-ink"
              >
                <X className="h-2.5 w-2.5" aria-hidden /> Clear
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
