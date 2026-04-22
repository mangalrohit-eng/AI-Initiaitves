"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Link2, Printer } from "lucide-react";
import { cn } from "@/lib/utils";

// Lightweight action bar for tower and initiative pages. Handles:
//   - copy link to clipboard
//   - print / save-as-PDF (triggers the browser print dialog)
// Shows a brief inline toast on success. Hidden from printed output via `no-print`.
export function ShareBar({
  title,
  className,
}: {
  title?: string;
  className?: string;
}) {
  const [toast, setToast] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  async function copyLink() {
    try {
      const href = typeof window !== "undefined" ? window.location.href : "";
      await navigator.clipboard.writeText(href);
      setToast("Link copied");
    } catch {
      setToast("Copy blocked by browser");
    }
  }

  function printPage() {
    if (typeof window !== "undefined") window.print();
  }

  return (
    <div className={cn("no-print relative inline-flex items-center gap-2", className)}>
      <button
        type="button"
        onClick={copyLink}
        className="inline-flex items-center gap-1.5 rounded-lg border border-forge-border bg-forge-surface px-3 py-1.5 text-xs font-medium text-forge-body shadow-sm transition hover:border-accent-purple/40 hover:text-accent-purple-dark"
        aria-label={title ? `Copy link to ${title}` : "Copy page link"}
      >
        <Link2 className="h-3.5 w-3.5" />
        Copy link
      </button>
      <button
        type="button"
        onClick={printPage}
        className="inline-flex items-center gap-1.5 rounded-lg border border-forge-border bg-forge-surface px-3 py-1.5 text-xs font-medium text-forge-body shadow-sm transition hover:border-accent-purple/40 hover:text-accent-purple-dark"
        aria-label="Print or save as PDF"
      >
        <Printer className="h-3.5 w-3.5" />
        Print / PDF
      </button>
      <AnimatePresence>
        {toast ? (
          <motion.div
            role="status"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            className="pointer-events-none absolute -bottom-8 right-0 inline-flex items-center gap-1.5 rounded-full bg-forge-ink px-3 py-1 text-[11px] font-medium text-white shadow-lg"
          >
            <Check className="h-3 w-3" />
            {toast}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
