"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type Props = {
  value: number;
  /** Called on every drag tick for smooth live recalculation. */
  onChange: (value: number) => void;
  /** Called on commit (mouse up / blur). Optional — wire when expensive persistence runs. */
  onCommit?: (value: number) => void;
  /** Min / max in 0-100 percent space. */
  min?: number;
  max?: number;
  step?: number;
  /** Visual hue: purple is the offshore lever, teal is the AI lever. */
  hue?: "purple" | "teal";
  ariaLabel: string;
  /** Renders the value below the track in mono ("28%"). Defaults to true. */
  showValue?: boolean;
  /** Disable interaction and grey the track. */
  disabled?: boolean;
  /** Compact (used inside dense tower-page lever rows). */
  compact?: boolean;
  /** Optional starter-default tick rendered as a faint vertical mark on the track. */
  defaultMark?: number;
  /** Optional id for label / aria wiring. */
  id?: string;
  className?: string;
};

/**
 * Premium per-L4 lever slider — purple for offshore, teal for AI.
 *
 * Replaces the Excel-grade <input type="number"> with a range control that:
 *   - emits onChange on every drag tick (live $ recalc),
 *   - paints a coloured fill behind the thumb keyed off `value`,
 *   - shows a faint tick at the starter default so users see how far they've
 *     moved off the seeded heuristic without losing the explicit override.
 *
 * Built on `<input type="range">` so it's accessible by default (screen readers
 * + keyboard arrows) and the styles are entirely CSS — no new dependency.
 */
export function PercentSlider({
  value,
  onChange,
  onCommit,
  min = 0,
  max = 100,
  step = 1,
  hue = "purple",
  ariaLabel,
  showValue = true,
  disabled = false,
  compact = false,
  defaultMark,
  id,
  className,
}: Props) {
  const clamped = Math.max(min, Math.min(max, value));
  const fillPct = ((clamped - min) / (max - min)) * 100;

  const trackBg =
    hue === "purple"
      ? "linear-gradient(to right, #A100FF 0%, #A100FF " +
        fillPct +
        "%, rgba(255,255,255,0.08) " +
        fillPct +
        "%, rgba(255,255,255,0.08) 100%)"
      : "linear-gradient(to right, #00BFA5 0%, #00BFA5 " +
        fillPct +
        "%, rgba(255,255,255,0.08) " +
        fillPct +
        "%, rgba(255,255,255,0.08) 100%)";

  const valueClass =
    hue === "purple" ? "text-accent-purple-dark" : "text-accent-teal";

  const defaultMarkPct =
    defaultMark != null
      ? Math.max(0, Math.min(100, ((defaultMark - min) / (max - min)) * 100))
      : null;

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className={cn("relative", compact ? "h-5" : "h-6")}>
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={clamped}
          onChange={(e) => onChange(Number(e.target.value))}
          onMouseUp={(e) => onCommit?.(Number((e.target as HTMLInputElement).value))}
          onTouchEnd={(e) => onCommit?.(Number((e.target as HTMLInputElement).value))}
          onKeyUp={(e) => {
            if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)) {
              onCommit?.(Number((e.target as HTMLInputElement).value));
            }
          }}
          disabled={disabled}
          aria-label={ariaLabel}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={clamped}
          className={cn(
            "percent-slider w-full appearance-none rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-purple/40 disabled:cursor-not-allowed disabled:opacity-40",
            compact ? "h-2" : "h-2.5",
          )}
          style={{ background: trackBg }}
        />
        {defaultMarkPct != null ? (
          <span
            aria-hidden
            className="pointer-events-none absolute top-1/2 h-3 w-px -translate-y-1/2 bg-forge-hint/70"
            style={{ left: `calc(${defaultMarkPct}% - 0.5px)` }}
            title={`Starter default ${defaultMark}%`}
          />
        ) : null}
      </div>
      {showValue ? (
        <div className="flex items-center justify-between text-[10px]">
          <span className="font-mono text-forge-hint">{min}%</span>
          <span className={cn("font-mono text-xs font-semibold tabular-nums", valueClass)}>
            {Math.round(clamped)}%
          </span>
          <span className="font-mono text-forge-hint">{max}%</span>
        </div>
      ) : null}
      <style jsx>{`
        .percent-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: ${compact ? "14px" : "16px"};
          height: ${compact ? "14px" : "16px"};
          border-radius: 50%;
          background: #ffffff;
          border: 2px solid ${hue === "purple" ? "#A100FF" : "#00BFA5"};
          box-shadow: 0 0 0 4px ${
            hue === "purple" ? "rgba(161, 0, 255, 0.18)" : "rgba(0, 191, 165, 0.18)"
          };
          cursor: pointer;
          transition: transform 0.12s ease;
        }
        .percent-slider:active::-webkit-slider-thumb,
        .percent-slider:focus-visible::-webkit-slider-thumb {
          transform: scale(1.12);
        }
        .percent-slider::-moz-range-thumb {
          width: ${compact ? "14px" : "16px"};
          height: ${compact ? "14px" : "16px"};
          border-radius: 50%;
          background: #ffffff;
          border: 2px solid ${hue === "purple" ? "#A100FF" : "#00BFA5"};
          box-shadow: 0 0 0 4px ${
            hue === "purple" ? "rgba(161, 0, 255, 0.18)" : "rgba(0, 191, 165, 0.18)"
          };
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}
