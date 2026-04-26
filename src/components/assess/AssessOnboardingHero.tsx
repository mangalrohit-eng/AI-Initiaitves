"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Compass,
  Download,
  ListChecks,
  Sliders,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Term } from "@/components/help/Term";

const DISMISS_KEY = "forge.assess.onboarding.dismissed";

type Step = {
  icon: typeof Compass;
  title: string;
  body: React.ReactNode;
};

const STEPS: Step[] = [
  {
    icon: ListChecks,
    title: "Confirm the capability map",
    body: (
      <>
        Validate the L1 → <Term termKey="l3">L3 capabilities</Term> for your tower, then generate
        L4 reference activities for context. Add or rename anything missing.
      </>
    ),
  },
  {
    icon: Target,
    title: "Enter the headcount",
    body: <>Headcount, mix, and US/onshore split per L3 — straight from your operating plan.</>,
  },
  {
    icon: Sliders,
    title: "Set the offshore + AI dials",
    body: (
      <>
        Per <Term termKey="l3">L3 capability</Term>, dial in the{" "}
        <Term termKey="offshore dial">offshore %</Term> and{" "}
        <Term termKey="ai impact dial">AI impact %</Term>. Modeled value rolls up automatically.
      </>
    ),
  },
];

export function AssessOnboardingHero({
  onPickTowers,
  onLoadSample,
  loadingSample = false,
}: {
  onPickTowers?: () => void;
  onLoadSample?: () => void;
  loadingSample?: boolean;
}) {
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

  const dismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* noop */
    }
  };

  const reopen = () => {
    setDismissed(false);
    try {
      window.localStorage.removeItem(DISMISS_KEY);
    } catch {
      /* noop */
    }
  };

  if (mounted && dismissed) {
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

  return (
    <section
      aria-label="How to run the capability map workshop"
      className="relative overflow-hidden rounded-3xl border border-forge-border bg-gradient-to-br from-accent-purple/5 via-forge-surface to-forge-surface p-6 shadow-card sm:p-8"
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss walkthrough"
        className="absolute right-4 top-4 rounded-full border border-forge-border bg-forge-surface p-1.5 text-forge-subtle transition hover:border-accent-purple/40 hover:text-accent-purple-dark"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr] lg:gap-10">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-forge-border bg-forge-surface px-3 py-1 text-xs font-medium text-forge-subtle">
            <Sparkles className="h-3 w-3 text-accent-purple" />
            New here? Three steps and your tower is done.
          </div>
          <h2 className="mt-4 font-display text-xl font-semibold leading-tight text-forge-ink sm:text-2xl">
            Capability Map workshop — about 30 minutes per tower.
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-forge-body">
            Every tower lead does the same three things. The portal saves to the program database
            as you go — no copy-paste, no version churn.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            {onPickTowers ? (
              <button
                type="button"
                onClick={onPickTowers}
                className="inline-flex items-center gap-2 rounded-lg bg-accent-purple px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-purple-dark"
              >
                <Compass className="h-4 w-4" />
                Pick my towers
                <ArrowRight className="h-3.5 w-3.5 opacity-80" />
              </button>
            ) : null}
            {onLoadSample ? (
              <button
                type="button"
                onClick={onLoadSample}
                disabled={loadingSample}
                className="inline-flex items-center gap-2 rounded-lg border border-forge-border bg-forge-surface px-4 py-2 text-sm font-medium text-forge-body transition hover:border-accent-purple/40 hover:text-accent-purple-dark disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Download className="h-4 w-4" />
                {loadingSample ? "Loading sample..." : "Load 13-tower sample"}
              </button>
            ) : null}
            <Link
              href="/glossary"
              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-forge-subtle transition hover:text-accent-purple-dark"
            >
              Glossary of terms
            </Link>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2 text-[11px] text-forge-hint">
            <CheckCircle2 className="h-3 w-3 text-accent-green" />
            Saves automatically · workshop model only — not a system of record.
          </div>
        </div>

        <ol className="grid gap-3" aria-label="Workshop steps">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            return (
              <li
                key={s.title}
                className="flex gap-3 rounded-2xl border border-forge-border bg-forge-surface p-4 shadow-sm"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-accent-purple/30 bg-accent-purple/10 text-accent-purple-dark">
                  <Icon className={cn("h-4 w-4")} />
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-forge-hint">
                    Step {i + 1}
                  </div>
                  <div className="mt-0.5 font-display text-sm font-semibold text-forge-ink">
                    {s.title}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-forge-body">{s.body}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
