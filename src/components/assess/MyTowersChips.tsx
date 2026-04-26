"use client";

import * as React from "react";
import { Check, UserCircle2 } from "lucide-react";
import { towers } from "@/data/towers";
import type { TowerId } from "@/data/assess/types";
import { getMyTowers, setMyTowers, subscribe, toggleMyTower } from "@/lib/localStore";

type Props = {
  /** When the picker opens by default (e.g. via `?picker=open` query). */
  defaultOpen?: boolean;
  /** Compact mode: collapsed pill summary by default, expand on click. */
  compact?: boolean;
  className?: string;
};

/**
 * Chip multi-select for "the towers I own" — persists to `forge.myTowers.v1`
 * and is read by the assess hub + program home for the personalised view.
 *
 * Localised to this user's browser in this wave; will graduate to DB-backed
 * ownership when the Delivery Plan module ships.
 */
export function MyTowersChips({ defaultOpen, compact = false, className }: Props) {
  const [mine, setMine] = React.useState<TowerId[]>([]);
  const [open, setOpen] = React.useState<boolean>(!compact || !!defaultOpen);

  React.useEffect(() => {
    setMine(getMyTowers());
    const unsub = subscribe("myTowers", () => setMine(getMyTowers()));
    return unsub;
  }, []);

  React.useEffect(() => {
    if (defaultOpen) setOpen(true);
  }, [defaultOpen]);

  const summary =
    mine.length === 0
      ? "No towers picked yet"
      : mine.length === 1
        ? `${mine.length} tower picked`
        : `${mine.length} towers picked`;

  return (
    <section className={className}>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <UserCircle2 className="h-4 w-4 text-accent-purple-dark" aria-hidden />
          <h3 className="font-display text-sm font-semibold text-forge-ink">
            My towers
          </h3>
          <span className="text-xs text-forge-subtle">· {summary}</span>
        </div>
        {compact ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="text-xs text-accent-purple-dark hover:underline"
          >
            {open ? "Hide" : mine.length === 0 ? "Pick towers" : "Edit"}
          </button>
        ) : null}
      </header>

      {open ? (
        <>
          <p className="mt-1.5 text-xs text-forge-subtle">
            Tap the towers you own. Your picks pin them to the top of every list and unlock the personalised summary.
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {towers.map((tw) => {
              const isMine = mine.includes(tw.id as TowerId);
              return (
                <button
                  key={tw.id}
                  type="button"
                  aria-pressed={isMine}
                  onClick={() => setMine(toggleMyTower(tw.id as TowerId))}
                  className={
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition " +
                    (isMine
                      ? "border-accent-purple bg-accent-purple text-white shadow-sm"
                      : "border-forge-border bg-forge-surface text-forge-body hover:border-accent-purple/40")
                  }
                >
                  {isMine ? <Check className="h-3 w-3" aria-hidden /> : null}
                  {tw.name}
                </button>
              );
            })}
          </div>
          {mine.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <button
                type="button"
                onClick={() => setMine(setMyTowers([]))}
                className="text-forge-subtle hover:text-forge-ink"
              >
                Clear
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
