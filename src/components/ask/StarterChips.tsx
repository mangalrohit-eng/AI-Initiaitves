"use client";

import { motion } from "framer-motion";
import { Building2, Globe2, Sparkles, TrendingDown, Users, type LucideIcon } from "lucide-react";
import {
  STARTER_CATEGORY_META,
  STARTER_CATEGORY_ORDER,
  STARTER_QUESTIONS,
  type StarterCategory,
} from "@/lib/ask/starterQuestions";

const CATEGORY_ICON: Record<StarterCategory, LucideIcon> = {
  headcount: Users,
  offshoring: Globe2,
  savings: TrendingDown,
  initiatives: Sparkles,
  brands: Building2,
};

type Props = {
  hasWorkshopData: boolean;
  onSelect: (prompt: string) => void;
};

export function StarterChips({ hasWorkshopData, onSelect }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.05 }}
      className="space-y-3"
    >
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-forge-subtle">
        Try a starter question
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
        {STARTER_CATEGORY_ORDER.map((cat) => {
          const meta = STARTER_CATEGORY_META[cat];
          const Icon = CATEGORY_ICON[cat];
          const items = STARTER_QUESTIONS.filter((q) => q.category === cat);
          return (
            <div
              key={cat}
              className="flex flex-col gap-2 rounded-xl border border-forge-border bg-forge-surface/70 p-3 backdrop-blur"
            >
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-md border border-accent-purple/30 bg-accent-purple/10 text-accent-purple-dark">
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                </span>
                <div>
                  <div className="text-xs font-semibold text-forge-ink">{meta.title}</div>
                  <div className="text-[10px] text-forge-hint">{meta.subtitle}</div>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                {items.map((q) => {
                  const blocked = q.needsWorkshop && !hasWorkshopData;
                  return (
                    <button
                      key={q.prompt}
                      type="button"
                      disabled={blocked}
                      onClick={() => onSelect(q.prompt)}
                      title={blocked ? "Needs workshop data — load Step 1/2 first" : q.prompt}
                      className="group rounded-md border border-forge-border bg-forge-canvas px-2.5 py-1.5 text-left text-[12px] leading-snug text-forge-body transition hover:border-accent-purple/40 hover:bg-accent-purple/5 hover:text-accent-purple-dark disabled:cursor-not-allowed disabled:border-forge-border/50 disabled:bg-forge-well/40 disabled:text-forge-hint"
                    >
                      {q.prompt}
                      {blocked ? (
                        <span className="ml-1 text-[10px] uppercase tracking-wider text-forge-hint">
                          · workshop
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
