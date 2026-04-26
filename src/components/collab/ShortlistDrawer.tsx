"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Bookmark,
  Building2,
  Calculator,
  FileText,
  Layers,
  Map as MapIcon,
  Pin,
  Sliders,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  clearPins,
  getPins,
  removePin,
  subscribe,
  type PinKind,
  type PinRef,
} from "@/lib/localStore";
import { useFocusTrap } from "@/lib/useFocusTrap";
import { RecentlyViewed } from "./RecentlyViewed";

const KIND_META: Record<
  PinKind,
  { label: string; plural: string; icon: typeof Building2 }
> = {
  tower: { label: "Tower", plural: "Towers", icon: Building2 },
  initiative: { label: "Initiative", plural: "Initiatives", icon: Layers },
  brief: { label: "Brief", plural: "Briefs", icon: FileText },
};

type Props = {
  open: boolean;
  onClose: () => void;
};

export function ShortlistDrawer({ open, onClose }: Props) {
  const [pins, setPins] = React.useState<PinRef[]>([]);
  const trapRef = useFocusTrap<HTMLDivElement>(open);

  const refresh = React.useCallback(() => setPins(getPins()), []);

  React.useEffect(() => {
    refresh();
    return subscribe("pins", refresh);
  }, [refresh]);

  React.useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const grouped = React.useMemo(() => {
    const map: Record<PinKind, PinRef[]> = { tower: [], initiative: [], brief: [] };
    for (const p of pins) map[p.kind].push(p);
    return map;
  }, [pins]);

  const onClearAll = React.useCallback(() => {
    if (pins.length === 0) return;
    if (
      window.confirm(
        `Remove all ${pins.length} pin${pins.length === 1 ? "" : "s"} from My program? This can't be undone.`,
      )
    ) {
      clearPins();
    }
  }, [pins.length]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="drawer-root"
          className="fixed inset-0 z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          role="dialog"
          aria-modal="true"
          aria-label="My program"
        >
          <button
            type="button"
            aria-label="Close My program"
            onClick={onClose}
            className="absolute inset-0 bg-forge-ink/40 backdrop-blur-[2px]"
          />
          <motion.aside
            ref={trapRef}
            key="drawer-panel"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 360, damping: 34 }}
            tabIndex={-1}
            className="absolute inset-y-0 right-0 flex w-full max-w-lg flex-col border-l border-forge-border bg-forge-surface shadow-2xl outline-none sm:max-w-xl"
          >
            <header className="flex items-center justify-between gap-3 border-b border-forge-border px-5 py-4 sm:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-accent-purple/30 bg-accent-purple/10 text-accent-purple-dark">
                  <Bookmark className="h-4 w-4" aria-hidden />
                </div>
                <div className="min-w-0">
                  <div className="font-display text-base font-semibold text-forge-ink">
                    My program
                  </div>
                  <div className="truncate text-[11px] text-forge-subtle">
                    {pins.length === 0
                      ? "Pin towers, initiatives, and briefs to come back to"
                      : `${pins.length} pinned item${pins.length === 1 ? "" : "s"} · saved on this device`}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {pins.length > 0 ? (
                  <button
                    type="button"
                    onClick={onClearAll}
                    aria-label="Clear all pins"
                    className="inline-flex items-center gap-1 rounded-md border border-forge-border bg-forge-surface px-2 py-1.5 text-[11px] font-medium text-forge-subtle transition hover:border-accent-red/40 hover:text-accent-red"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    <span className="hidden sm:inline">Clear all</span>
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-forge-border text-forge-subtle transition hover:border-accent-purple/40 hover:text-accent-purple-dark"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
              {pins.length === 0 ? (
                <EmptyState onClose={onClose} />
              ) : (
                <div className="space-y-7">
                  {(Object.keys(grouped) as PinKind[]).map((kind) => {
                    const items = grouped[kind];
                    if (items.length === 0) return null;
                    const meta = KIND_META[kind];
                    const Icon = meta.icon;
                    return (
                      <section key={kind} aria-label={meta.plural}>
                        <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-forge-hint">
                          <Icon className="h-3.5 w-3.5" aria-hidden />
                          {meta.plural}
                          <span className="rounded-full bg-forge-well px-1.5 py-0.5 font-mono text-[10px] text-forge-subtle">
                            {items.length}
                          </span>
                        </div>
                        <ul className="space-y-2">
                          {items.map((p) => (
                            <li
                              key={`${p.kind}:${p.id}`}
                              className="group flex items-start gap-2 rounded-xl border border-forge-border bg-forge-well/60 p-3 shadow-sm transition hover:border-accent-purple/40"
                            >
                              <Link
                                href={p.href}
                                onClick={onClose}
                                className="min-w-0 flex-1 outline-none"
                              >
                                <span className="block truncate text-sm font-semibold text-forge-ink transition group-hover:text-accent-purple-dark">
                                  {p.title}
                                </span>
                                {p.subtitle ? (
                                  <span className="mt-0.5 block truncate text-[11px] text-forge-subtle">
                                    {p.subtitle}
                                  </span>
                                ) : null}
                              </Link>
                              <button
                                type="button"
                                onClick={() => removePin(p.kind, p.id)}
                                aria-label={`Remove ${p.title} from My program`}
                                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-transparent text-forge-hint transition hover:border-forge-border hover:bg-forge-surface hover:text-accent-red"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      </section>
                    );
                  })}

                  <section aria-label="Recently viewed">
                    <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-forge-hint">
                      Recently viewed
                    </div>
                    <RecentlyViewed onNavigate={onClose} />
                  </section>
                </div>
              )}
            </div>

            <footer className="border-t border-forge-border bg-forge-well/40 px-5 py-3 text-[11px] leading-relaxed text-forge-subtle sm:px-6">
              <span className="inline-flex items-center gap-1.5">
                <Pin className="h-3 w-3 text-accent-purple-dark" aria-hidden />
                My program is saved on this device only — no account, no sync. Use the share bar on a page to send a teammate a link.
              </span>
            </footer>
          </motion.aside>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

/* ============== EMPTY STATE ============== */

const QUICK_STARTS: ReadonlyArray<{
  href: string;
  label: string;
  description: string;
  Icon: typeof Building2;
}> = [
  {
    href: "/towers",
    label: "Browse towers",
    description: "13 functional towers · pin the ones you own",
    Icon: Building2,
  },
  {
    href: "/capability-map",
    label: "Capability Map",
    description: "Confirm capabilities and headcount",
    Icon: MapIcon,
  },
  {
    href: "/assessment",
    label: "Assessment",
    description: "Dial offshore + AI per L4",
    Icon: Sliders,
  },
  {
    href: "/towers",
    label: "AI Initiatives",
    description: "Tower roadmaps and 4-lens detail",
    Icon: Sparkles,
  },
  {
    href: "/assumptions",
    label: "Assumptions",
    description: "Blended rates, lever weights, cap",
    Icon: Calculator,
  },
];

function EmptyState({ onClose }: { onClose: () => void }) {
  return (
    <div className="space-y-5">
      <section
        aria-label="What is My program"
        className="rounded-2xl border border-dashed border-forge-border bg-forge-well/50 p-4"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-accent-purple/30 bg-accent-purple/10 text-accent-purple-dark">
            <Pin className="h-4 w-4" aria-hidden />
          </div>
          <div className="min-w-0">
            <h3 className="font-display text-sm font-semibold text-forge-ink">
              Pin work as you explore
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-forge-subtle">
              Hit the pin icon on any tower, initiative, or brief to keep it one click away from the top bar. Pins are saved on this device — no account needed.
            </p>
          </div>
        </div>
      </section>

      <section aria-label="Start exploring">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-forge-hint">
          Start exploring
        </div>
        <ul className="grid gap-2 sm:grid-cols-2">
          {QUICK_STARTS.map((q) => (
            <li key={q.href + q.label}>
              <Link
                href={q.href}
                onClick={onClose}
                className="group flex h-full items-start gap-3 rounded-xl border border-forge-border bg-forge-surface p-3 shadow-sm transition hover:border-accent-purple/45 hover:shadow-[0_0_0_1px_rgba(161,0,255,0.15)]"
              >
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-forge-border bg-forge-well/70 text-accent-purple-dark"
                  aria-hidden
                >
                  <q.Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="block truncate text-sm font-semibold text-forge-ink transition group-hover:text-accent-purple-dark">
                      {q.label}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-forge-subtle transition group-hover:translate-x-0.5 group-hover:text-accent-purple-dark" />
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-forge-subtle">
                    {q.description}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Recently viewed">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-forge-hint">
          Recently viewed
        </div>
        <RecentlyViewed onNavigate={onClose} />
      </section>
    </div>
  );
}
