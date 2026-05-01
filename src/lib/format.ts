/**
 * Shared currency / number formatters.
 *
 * Every Step 2 / 3 / 4 surface (Impact Levers, Assessment Hub, AI Initiatives)
 * routes its $ rendering through these helpers so a single change of decimals
 * or unit thresholds is reflected on every screen.
 *
 * The canonical implementation lives in `MoneyCounter.tsx` (it powers the
 * animated counters as well); the named export here is a thin re-export so
 * non-counter consumers don't import a UI module just to format a number.
 */
import { formatMoney as formatMoneyImpl } from "@/components/ui/MoneyCounter";

export type FormatUsdOptions = {
  /** Whether to show the trailing currency unit (B / M / K). Defaults to true. */
  showUnit?: boolean;
  /** Force a specific unit; otherwise auto-picks B / M / K / raw. */
  forceUnit?: "B" | "M" | "K" | "raw";
  /** Decimals override (B/M default 2/1, K default 0). */
  decimals?: number;
  /** Whether to prefix the rendered string with `$`. Default true. */
  prefix?: boolean;
};

/**
 * Format a USD value with the same auto-unit selection used everywhere in the
 * app: ≥1B → `$X.XXB`, ≥1M → `$X.XM`, ≥1K → `$XK`, else raw `$X,XXX`.
 *
 * Drives Step 2 (Impact Levers — per-L4 Activity Group modeled $), Step 3
 * (Tower scoreboard), and Step 4 (AI Initiatives — per-L4 Activity Group AI $
 * and per-tower roll-up). Because all three step surfaces format the same
 * value through the same helper, identical numbers always render identically.
 */
export function formatUsdCompact(value: number, opts: FormatUsdOptions = {}): string {
  return formatMoneyImpl(value, opts);
}

/**
 * Compact USD with at most 1 decimal in millions (e.g. `$14M` for $14.2M).
 * Used in dense list contexts on Step 4 where 2 decimals add visual noise.
 */
export function formatUsdCompactTight(value: number): string {
  return formatMoneyImpl(value, { decimals: value >= 1_000_000_000 ? 1 : 0 });
}
