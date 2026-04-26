"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { ArrowDown, Compass, Map, Search, Sparkles, Target, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Persona = "versant" | "accenture" | "executive";

const PERSONAS: { id: Persona; label: string; cta: string; microcopy: string }[] = [
  {
    id: "versant",
    label: "Versant tower lead",
    cta: "Find my tower",
    microcopy: "Jump to your tower, review the roadmap, and share with your team.",
  },
  {
    id: "accenture",
    label: "Accenture tower lead",
    cta: "Open your tower",
    microcopy: "Validate the roadmap and business case with your Versant counterpart.",
  },
  {
    id: "executive",
    label: "Executive sponsor",
    cta: "See the portfolio",
    microcopy: "Start with the Executive Summary for the cross-tower view.",
  },
];

const STEPS = [
  {
    icon: Compass,
    title: "Find your tower",
    body: "Search or scroll the 13 towers below. Each card previews AI coverage, hours saved, and agents modeled.",
  },
  {
    icon: Map,
    title: "Review the roadmap",
    body: "Every tower has a sequenced plan: now (0–6mo), next (6–12mo), later (12–24mo).",
  },
  {
    icon: Target,
    title: "Drill into an initiative",
    body: "Open a process to see what changes for the team, the tools, the platform, and the business case.",
  },
];

const DISMISS_KEY = "forge.onboarding.dismissed";
const PERSONA_KEY = "forge.persona";

export function OnboardingHero({ onFocusSearch }: { onFocusSearch?: () => void }) {
  const [mounted, setMounted] = React.useState(false);
  const [dismissed, setDismissed] = React.useState(false);
  const [persona, setPersona] = React.useState<Persona | null>(null);

  React.useEffect(() => {
    setMounted(true);
    try {
      setDismissed(window.localStorage.getItem(DISMISS_KEY) === "1");
      const p = window.localStorage.getItem(PERSONA_KEY);
      if (p === "versant" || p === "accenture" || p === "executive") setPersona(p);
    } catch {
      /* localStorage unavailable — render default state */
    }
  }, []);

  function choosePersona(id: Persona) {
    setPersona(id);
    try {
      window.localStorage.setItem(PERSONA_KEY, id);
    } catch {
      /* noop */
    }
  }

  function dismiss() {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* noop */
    }
  }

  const activePersona = PERSONAS.find((p) => p.id === persona) ?? PERSONAS[0];

  if (mounted && dismissed) {
    return (
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={() => {
            setDismissed(false);
            try {
              window.localStorage.removeItem(DISMISS_KEY);
            } catch {
              /* noop */
            }
          }}
          className="inline-flex items-center gap-1.5 rounded-full border border-forge-border bg-forge-surface px-3 py-1 text-xs text-forge-subtle transition hover:border-accent-purple/40 hover:text-accent-purple-dark"
        >
          <Sparkles className="h-3 w-3" /> Show walkthrough
        </button>
      </div>
    );
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      aria-label="How to use Tower AI Initiatives"
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
            Start here — 60 seconds
          </div>
          <h2 className="mt-4 font-display text-xl font-semibold leading-tight text-forge-ink sm:text-2xl">
            {mounted && persona ? (
              <>Welcome back — pick up where you left off.</>
            ) : (
              <>New to Tower AI Initiatives? Three steps and you&apos;re oriented.</>
            )}
          </h2>

          <div
            className="mt-5 flex flex-wrap gap-2"
            role="group"
            aria-label="Who are you?"
          >
            <span className="self-center pr-1 text-xs text-forge-hint">I&apos;m a:</span>
            {PERSONAS.map((p) => {
              const selected = persona === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => choosePersona(p.id)}
                  aria-pressed={selected}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition",
                    selected
                      ? "border-accent-purple bg-accent-purple text-white shadow-sm"
                      : "border-forge-border bg-forge-surface text-forge-body hover:border-accent-purple/40 hover:text-accent-purple-dark",
                  )}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {mounted && persona ? (
            <p className="mt-4 text-sm leading-relaxed text-forge-body">
              {activePersona.microcopy}
            </p>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onFocusSearch}
              className="inline-flex items-center gap-2 rounded-lg bg-accent-purple px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-purple-dark"
            >
              <Search className="h-4 w-4" />
              {activePersona.cta}
              <ArrowDown className="h-3.5 w-3.5 opacity-80" />
            </button>
            <a
              href="/summary"
              className="inline-flex items-center gap-2 rounded-lg border border-forge-border bg-forge-surface px-4 py-2 text-sm font-medium text-forge-body transition hover:border-accent-purple/40 hover:text-accent-purple-dark"
            >
              Executive summary
            </a>
            <a
              href="/glossary"
              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-forge-subtle transition hover:text-accent-purple-dark"
            >
              Glossary of terms
            </a>
          </div>
        </div>

        <ol className="grid gap-3" aria-label="How to use this explorer">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            return (
              <motion.li
                key={s.title}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.08 + i * 0.08, duration: 0.3, ease: "easeOut" }}
                className="flex gap-3 rounded-2xl border border-forge-border bg-forge-surface p-4 shadow-sm"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-accent-purple/30 bg-accent-purple/10 text-accent-purple-dark">
                  <Icon className="h-4.5 w-4.5" />
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
              </motion.li>
            );
          })}
        </ol>
      </div>
    </motion.section>
  );
}
