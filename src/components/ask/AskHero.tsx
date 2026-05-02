"use client";

import { motion } from "framer-motion";
import { MessagesSquare } from "lucide-react";

/**
 * Animated hero — Accenture chevron motif, subtle purple-glow gradient. Sits
 * above the conversation only when there are no turns yet.
 */
export function AskHero() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="relative overflow-hidden rounded-2xl border border-forge-border bg-forge-surface px-6 py-7 sm:px-8 sm:py-9"
    >
      {/* Soft purple glow — layered radial gradient absolutely positioned. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(620px circle at 12% -10%, rgba(161,0,255,0.10), transparent 50%), radial-gradient(420px circle at 90% 110%, rgba(0,191,165,0.08), transparent 55%)",
        }}
      />
      <div className="relative">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-accent-purple/30 bg-accent-purple/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-accent-purple-dark">
          <MessagesSquare className="h-3 w-3" aria-hidden />
          Ask Forge · LLM-powered analyst
        </div>
        <h1 className="mt-3 font-display text-3xl font-semibold leading-tight tracking-tight text-forge-ink sm:text-[2.25rem]">
          <span className="font-mono text-accent-purple-dark">&gt;</span> Ask anything across
          the Forge corpus
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-forge-subtle">
          Headcount, offshoring, modeled savings, P1 initiatives, and brand mentions —
          grounded in the Versant authored corpus and your live workshop data. Answers
          render as charts, snapshots, and sourced summaries, not flat text.
        </p>
      </div>
    </motion.section>
  );
}
