"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, ChevronDown, ChevronsUpDown, Search } from "lucide-react";
import { towers } from "@/data/towers";
import type { Tower } from "@/data/types";
import type { TowerId } from "@/data/assess/types";
import { resolveSolutionIcon } from "@/lib/initiatives/solutionIconAllowlist";
import { getTowerHref } from "@/lib/towerHref";
import { cn } from "@/lib/utils";

/**
 * Compact tower switcher: a button-styled combobox that pops a panel
 * listing all 13 towers (with their motif icons). Selecting a tower
 * navigates to that tower's Step 4 page (`/tower/[slug]`), preserving
 * the user's spot in the journey.
 *
 * Why a switcher (not just breadcrumbs):
 *   - Workshop attendees often want to pivot between towers without
 *     bouncing back to `/towers`.
 *   - The motif icons make the list scannable across 13 towers.
 *   - Keyboard navigation: ArrowDown / ArrowUp / Enter / Escape.
 */
export function TowerSwitcher({ active }: { active: Tower }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [highlight, setHighlight] = React.useState(0);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return towers;
    return towers.filter((t) => t.name.toLowerCase().includes(q));
  }, [query]);

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

  const goTo = React.useCallback(
    (id: TowerId) => {
      setOpen(false);
      router.push(getTowerHref(id, "ai-initiatives"));
    },
    [router],
  );

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
      if (target) goTo(target.id as TowerId);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  };

  const ActiveIcon = resolveSolutionIcon(active.iconKey, "ship-ready");

  return (
    <div
      ref={containerRef}
      className="relative inline-flex"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "inline-flex items-center gap-2 rounded-full border border-forge-border bg-forge-surface px-3 py-1.5 text-xs text-forge-body transition",
          "hover:border-accent-purple/40 hover:text-forge-ink",
          open ? "border-accent-purple/40 text-forge-ink" : "",
        )}
        title="Switch tower"
      >
        <span
          aria-hidden
          className="inline-flex h-5 w-5 items-center justify-center rounded-md border border-accent-purple/30 bg-accent-purple/10 text-accent-purple-light"
        >
          <ActiveIcon className="h-3 w-3" aria-hidden />
        </span>
        <span className="font-mono uppercase tracking-[0.14em] text-forge-hint">
          Tower
        </span>
        <span className="font-medium">{active.name}</span>
        <ChevronsUpDown
          className="h-3.5 w-3.5 text-forge-hint"
          aria-hidden
        />
      </button>
      {open ? (
        <div
          role="listbox"
          aria-label="Switch to another tower"
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
              placeholder="Filter towers..."
              className="w-full bg-transparent text-xs text-forge-ink placeholder:text-forge-hint focus:outline-none"
            />
          </div>
          <ul className="mt-1 max-h-72 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-xs text-forge-subtle">
                No tower matches &ldquo;{query}&rdquo;.
              </li>
            ) : (
              filtered.map((t, idx) => {
                const Icon = resolveSolutionIcon(t.iconKey, "ship-ready");
                const isActive = t.id === active.id;
                const isHighlighted = idx === highlight;
                return (
                  <li key={t.id} role="option" aria-selected={isActive}>
                    <Link
                      href={getTowerHref(t.id as TowerId, "ai-initiatives")}
                      onClick={(e) => {
                        e.preventDefault();
                        goTo(t.id as TowerId);
                      }}
                      onMouseEnter={() => setHighlight(idx)}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs transition",
                        isHighlighted
                          ? "bg-accent-purple/15 text-forge-ink"
                          : "text-forge-body hover:bg-forge-well/60",
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "inline-flex h-6 w-6 items-center justify-center rounded-md border",
                          isActive
                            ? "border-accent-purple/40 bg-accent-purple/10 text-accent-purple-light"
                            : "border-forge-border bg-near-black/50 text-forge-body",
                        )}
                      >
                        <Icon className="h-3 w-3" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {t.name}
                      </span>
                      {isActive ? (
                        <Check
                          className="h-3.5 w-3.5 text-accent-purple-light"
                          aria-hidden
                        />
                      ) : (
                        <ChevronDown
                          className="h-3 w-3 -rotate-90 text-forge-hint"
                          aria-hidden
                        />
                      )}
                    </Link>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
