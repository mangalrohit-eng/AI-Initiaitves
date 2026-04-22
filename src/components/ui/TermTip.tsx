"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { HelpCircle } from "lucide-react";
import { findTerm } from "@/data/glossary";
import { cn } from "@/lib/utils";

type Placement = "top" | "bottom";

// Lightweight tooltip built on framer-motion — no Radix dependency.
// Hover or focus to open; Escape or blur to close; click the icon to open
// the glossary anchored to the term.
export function TermTip({
  termKey,
  label,
  placement = "top",
  className,
  children,
}: {
  // Glossary term id OR human label that matches a term/alias.
  termKey: string;
  // Optional visible label override. If `children` is provided, it replaces this.
  label?: string;
  placement?: Placement;
  className?: string;
  children?: React.ReactNode;
}) {
  const term = findTerm(termKey);
  const [open, setOpen] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  function show() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(true), 80);
  }
  function hide() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(false), 80);
  }

  React.useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Graceful fallback if the term wasn't found — render plain content.
  if (!term) {
    return (
      <span className={className}>{children ?? label ?? termKey}</span>
    );
  }

  const content = children ?? label ?? term.term;

  return (
    <span
      className={cn("relative inline-flex items-center gap-1", className)}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      <span>{content}</span>
      <Link
        href={`/glossary#${term.id}`}
        aria-label={`Open glossary for ${term.term}`}
        className="inline-flex items-center rounded-full p-0.5 text-forge-hint transition hover:text-accent-purple-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-purple/40"
      >
        <HelpCircle className="h-3.5 w-3.5" />
      </Link>
      <AnimatePresence>
        {open ? (
          <motion.span
            role="tooltip"
            initial={{ opacity: 0, y: placement === "top" ? 4 : -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: placement === "top" ? 4 : -4 }}
            transition={{ duration: 0.15 }}
            className={cn(
              "pointer-events-none absolute left-1/2 z-30 w-64 -translate-x-1/2 rounded-lg border border-forge-border bg-forge-ink p-3 text-xs leading-relaxed text-white shadow-lg",
              placement === "top" ? "bottom-full mb-2" : "top-full mt-2",
            )}
          >
            <span className="block font-semibold text-white">{term.term}</span>
            <span className="mt-1 block text-white/85">{term.short}</span>
            <span className="mt-2 block text-[10px] uppercase tracking-wider text-white/60">
              Click {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-to-interactive-role */}
              <HelpCircle className="inline h-2.5 w-2.5" /> for the full glossary
            </span>
          </motion.span>
        ) : null}
      </AnimatePresence>
    </span>
  );
}
