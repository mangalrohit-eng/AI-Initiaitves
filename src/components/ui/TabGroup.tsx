"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";

export type TabItem = { id: string; label: string; content: React.ReactNode };

export function TabGroup({ tabs, className }: { tabs: TabItem[]; className?: string }) {
  const [active, setActive] = React.useState(tabs[0]?.id ?? "");

  React.useEffect(() => {
    if (!tabs.find((t) => t.id === active) && tabs[0]) setActive(tabs[0].id);
  }, [active, tabs]);

  const index = Math.max(
    0,
    tabs.findIndex((t) => t.id === active),
  );
  const activeTab = tabs[index];

  return (
    <div className={cn("space-y-4", className)}>
      <div
        className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap"
        role="tablist"
        aria-label="Lens tabs"
      >
        {tabs.map((t) => {
          const selected = t.id === active;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActive(t.id)}
              className={cn(
                "whitespace-nowrap rounded-full border px-4 py-2 text-sm transition",
                selected
                  ? "border-accent-purple/60 bg-accent-purple/15 text-white shadow-glow"
                  : "border-white/10 bg-white/[0.02] text-white/65 hover:border-white/20 hover:text-white",
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab?.id}
          initial={{ opacity: 0, x: index % 2 === 0 ? -12 : 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: index % 2 === 0 ? 12 : -12 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          role="tabpanel"
          className="rounded-2xl border border-white/10 bg-[#121225]/60 p-4 sm:p-6"
        >
          {activeTab?.content}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
