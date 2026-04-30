"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";

export type TabItem = { id: string; label: string; content: React.ReactNode };

/**
 * `TabGroup` works in either uncontrolled (default) or controlled mode.
 *
 *   - Uncontrolled: omit `value` and `onChange`. The component owns the
 *     active-tab state and resets to `tabs[0]` if the active id ever stops
 *     existing in the tab set.
 *   - Controlled: pass both `value` and `onChange`. Lets a parent component
 *     deep-link or programmatically switch tabs (e.g., the Offshore Plan's
 *     OffshoreActionBar jumps to the Assumptions tab from the page header).
 */
export function TabGroup({
  tabs,
  className,
  value,
  onChange,
}: {
  tabs: TabItem[];
  className?: string;
  value?: string;
  onChange?: (id: string) => void;
}) {
  const isControlled = value !== undefined && typeof onChange === "function";
  const [internalActive, setInternalActive] = React.useState(tabs[0]?.id ?? "");
  const active = isControlled ? (value as string) : internalActive;

  React.useEffect(() => {
    if (isControlled) return;
    if (!tabs.find((t) => t.id === internalActive) && tabs[0]) {
      setInternalActive(tabs[0].id);
    }
  }, [internalActive, tabs, isControlled]);

  const setActive = React.useCallback(
    (id: string) => {
      if (isControlled) {
        onChange?.(id);
      } else {
        setInternalActive(id);
      }
    },
    [isControlled, onChange],
  );

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
                  ? "border-accent-purple bg-forge-surface font-medium text-accent-purple-dark shadow-sm ring-1 ring-accent-purple/20"
                  : "border-forge-border bg-forge-well text-forge-body hover:border-forge-border-strong hover:text-forge-ink",
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
          className="rounded-2xl border border-forge-border bg-forge-surface p-4 shadow-card sm:p-6"
        >
          {activeTab?.content}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
