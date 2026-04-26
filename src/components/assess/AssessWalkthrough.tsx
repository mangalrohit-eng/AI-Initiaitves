"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { ClipboardList, Layers, Sparkles, Sliders, X } from "lucide-react";
import { getPersona } from "@/lib/localStore";

const DISMISS_KEY = "forge.assessOnboarding.dismissed";

const STEPS: { Icon: typeof Layers; title: string; body: string }[] = [
  {
    Icon: Layers,
    title: "Confirm capability map",
    body: "Pull in your tower's L1 → L3 capabilities, or load the sample. L4 activity lists are generated for context.",
  },
  {
    Icon: ClipboardList,
    title: "Enter headcount",
    body: "Headcount and average loaded cost per L3 capability. Rough is fine — the dials matter more.",
  },
  {
    Icon: Sliders,
    title: "Set offshore + AI dials",
    body: "Per L3 capability: how much can move offshore, how much AI displaces. Re-seed defaults any time.",
  },
];

export function AssessWalkthrough() {
  const params = useSearchParams();
  const forceOpen = params?.get("walkthrough") === "open";
  const [mounted, setMounted] = React.useState(false);
  const [dismissed, setDismissed] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    try {
      setDismissed(window.localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      /* noop */
    }
  }, []);

  React.useEffect(() => {
    if (forceOpen) {
      setDismissed(false);
      try {
        window.localStorage.removeItem(DISMISS_KEY);
      } catch {
        /* noop */
      }
    }
  }, [forceOpen]);

  const persona = mounted ? getPersona() : null;

  function dismiss() {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* noop */
    }
  }
  function reopen() {
    setDismissed(false);
    try {
      window.localStorage.removeItem(DISMISS_KEY);
    } catch {
      /* noop */
    }
  }

  if (!mounted) return null;

  if (dismissed) {
    return (
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={reopen}
          className="inline-flex items-center gap-1.5 rounded-full border border-forge-border bg-forge-surface px-3 py-1 text-xs text-forge-subtle transition hover:border-accent-purple/40 hover:text-accent-purple-dark"
        >
          <Sparkles className="h-3 w-3" /> Show walkthrough
        </button>
      </div>
    );
  }

  const headline =
    persona === "accenture"
      ? "Three steps to land a tower with your Versant counterpart."
      : persona === "versant"
        ? "Three steps and your tower is done."
        : "Three steps per tower — and the OpEx number rolls up automatically.";

  return (
    <section
      aria-label="How to run the workshop"
      className="relative overflow-hidden rounded-3xl border border-forge-border bg-gradient-to-br from-accent-purple/5 via-forge-surface to-forge-surface p-5 shadow-card sm:p-6"
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss walkthrough"
        className="absolute right-4 top-4 rounded-full border border-forge-border bg-forge-surface p-1.5 text-forge-subtle transition hover:border-accent-purple/40 hover:text-accent-purple-dark"
      >
        <X className="h-3.5 w-3.5" aria-hidden />
      </button>
      <div className="inline-flex items-center gap-2 rounded-full border border-forge-border bg-forge-surface px-3 py-1 text-xs font-medium text-forge-subtle">
        <Sparkles className="h-3 w-3 text-accent-purple" aria-hidden />
        Workshop walkthrough — 60 seconds
      </div>
      <h2 className="mt-3 max-w-2xl font-display text-lg font-semibold leading-tight text-forge-ink sm:text-xl">
        {headline}
      </h2>
      <p className="mt-2 max-w-2xl text-xs leading-relaxed text-forge-subtle">
        Pick a tower below, confirm its capability map, set the dials, and mark it complete.
        You can re-seed defaults any time and edit until you&apos;re happy.
      </p>
      <ol className="mt-4 grid gap-3 sm:grid-cols-3">
        {STEPS.map((s, i) => (
          <li
            key={s.title}
            className="flex gap-3 rounded-2xl border border-forge-border bg-forge-surface p-3"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-accent-purple/30 bg-accent-purple/10 text-accent-purple-dark">
              <s.Icon className="h-4 w-4" aria-hidden />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-forge-hint">
                Step {i + 1}
              </div>
              <div className="mt-0.5 font-display text-sm font-semibold text-forge-ink">
                {s.title}
              </div>
              <p className="mt-0.5 text-[11px] leading-relaxed text-forge-body">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
