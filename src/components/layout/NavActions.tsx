"use client";

import * as React from "react";
import { Check, ChevronDown, UserCircle2 } from "lucide-react";
import { towers } from "@/data/towers";
import type { TowerId } from "@/data/assess/types";
import {
  getMyTowers,
  setMyTowers,
  subscribe,
  toggleMyTower,
} from "@/lib/localStore";

/**
 * Top-nav "My towers" multi-select. Replaces the older "My program"
 * shortlist drawer — the user lives in the Capability Map / Assessment
 * workflow now, and tower ownership is the most meaningful piece of
 * personalisation. On click this opens a popover with all 13 towers; clicks
 * persist via `forge.myTowers.v1` (same store the hub reads).
 */
export function NavActions() {
  const [mine, setMine] = React.useState<TowerId[]>([]);
  const [open, setOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const wrapRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setMounted(true);
    setMine(getMyTowers());
    return subscribe("myTowers", () => setMine(getMyTowers()));
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const count = mine.length;
  const showCount = mounted && count > 0;

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-forge-border bg-forge-surface px-2 py-2 text-forge-body shadow-sm transition hover:border-accent-purple/40 hover:text-accent-purple-dark sm:px-3"
      >
        <UserCircle2 className="h-4 w-4 flex-shrink-0" aria-hidden />
        <span className="hidden sm:inline">
          My towers
          {showCount ? (
            <span className="ml-1 rounded-full bg-accent-purple/15 px-1.5 py-0.5 font-mono text-[11px] text-accent-purple-dark">
              {count}
            </span>
          ) : null}
        </span>
        {showCount ? (
          <span className="font-mono text-[11px] text-accent-purple-dark sm:hidden">
            ({count})
          </span>
        ) : null}
        <ChevronDown
          className={
            "hidden h-3.5 w-3.5 text-forge-subtle transition-transform sm:inline " +
            (open ? "rotate-180" : "")
          }
          aria-hidden
        />
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Pick the towers you own"
          className="absolute right-0 top-11 z-30 w-80 rounded-xl border border-forge-border bg-forge-surface p-3 shadow-card"
        >
          <div className="flex items-baseline justify-between gap-2">
            <div>
              <h3 className="font-display text-sm font-semibold text-forge-ink">
                My towers
              </h3>
              <p className="mt-0.5 text-[11px] text-forge-subtle">
                Pin the towers you own. They sort first across the program.
              </p>
            </div>
            {count > 0 ? (
              <button
                type="button"
                onClick={() => setMine(setMyTowers([]))}
                className="text-[11px] text-forge-subtle hover:text-accent-purple-dark"
              >
                Clear
              </button>
            ) : null}
          </div>

          <ul
            role="listbox"
            aria-multiselectable="true"
            className="mt-3 grid max-h-72 grid-cols-1 gap-1 overflow-auto pr-1"
          >
            {towers.map((tw) => {
              const isMine = mine.includes(tw.id as TowerId);
              return (
                <li key={tw.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isMine}
                    onClick={() => setMine(toggleMyTower(tw.id as TowerId))}
                    className={
                      "flex w-full items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-left text-xs transition " +
                      (isMine
                        ? "border-accent-purple/55 bg-accent-purple/10 text-forge-ink"
                        : "border-forge-border bg-forge-surface text-forge-body hover:border-accent-purple/35 hover:bg-forge-well/60")
                    }
                  >
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {tw.name}
                    </span>
                    <span
                      className={
                        "flex h-4 w-4 items-center justify-center rounded border " +
                        (isMine
                          ? "border-accent-purple bg-accent-purple text-white"
                          : "border-forge-border-strong bg-forge-surface")
                      }
                      aria-hidden
                    >
                      {isMine ? <Check className="h-3 w-3" /> : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="mt-2 flex items-center justify-between border-t border-forge-border pt-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-forge-hint">
              {count} of {towers.length} picked
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md border border-forge-border bg-forge-surface px-2 py-1 text-[11px] font-medium text-forge-body hover:border-accent-purple/35"
            >
              Done
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
