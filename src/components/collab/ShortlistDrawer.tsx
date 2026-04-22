"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bookmark,
  Building2,
  FileText,
  Layers,
  Pin,
  X,
} from "lucide-react";
import {
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
            className="absolute inset-0 bg-forge-ink/30 backdrop-blur-[1px]"
          />
          <motion.aside
            ref={trapRef}
            key="drawer-panel"
            initial={{ x: 420 }}
            animate={{ x: 0 }}
            exit={{ x: 420 }}
            transition={{ type: "spring", stiffness: 360, damping: 34 }}
            tabIndex={-1}
            className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-forge-border bg-forge-surface shadow-2xl outline-none"
          >
            <header className="flex items-center justify-between gap-3 border-b border-forge-border px-5 py-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-accent-purple/30 bg-accent-purple/10 text-accent-purple-dark">
                  <Bookmark className="h-4 w-4" aria-hidden />
                </div>
                <div>
                  <div className="font-display text-sm font-semibold text-forge-ink">
                    My program
                  </div>
                  <div className="text-[11px] text-forge-subtle">
                    {pins.length === 0
                      ? "Nothing pinned yet"
                      : `${pins.length} pinned item${pins.length === 1 ? "" : "s"} — saved on this device`}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-forge-border text-forge-subtle transition hover:border-accent-purple/40 hover:text-accent-purple-dark"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {pins.length === 0 ? (
                <EmptyState onClose={onClose} />
              ) : (
                <div className="space-y-6">
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
                                className="min-w-0 flex-1"
                              >
                                <span className="block truncate text-sm font-semibold text-forge-ink transition group-hover:text-accent-purple-dark">
                                  {p.title}
                                </span>
                                {p.subtitle ? (
                                  <span className="block truncate text-[11px] text-forge-subtle">
                                    {p.subtitle}
                                  </span>
                                ) : null}
                              </Link>
                              <button
                                type="button"
                                onClick={() => removePin(p.kind, p.id)}
                                aria-label={`Remove ${p.title} from My program`}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-transparent text-forge-hint transition hover:border-forge-border hover:bg-forge-surface hover:text-forge-ink"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      </section>
                    );
                  })}
                </div>
              )}

              <section className="mt-8" aria-label="Recently viewed">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-forge-hint">
                  Recently viewed
                </div>
                <RecentlyViewed onNavigate={onClose} />
              </section>
            </div>

            <footer className="border-t border-forge-border px-5 py-3 text-[11px] leading-relaxed text-forge-subtle">
              My program is saved on this device only. Share a page via the
              share bar if you want a teammate to see it.
            </footer>
          </motion.aside>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function EmptyState({ onClose }: { onClose: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-forge-border bg-forge-well/60 p-5 text-sm">
      <div className="flex items-center gap-2 text-forge-ink">
        <Pin className="h-4 w-4 text-accent-purple" aria-hidden />
        <span className="font-semibold">Nothing pinned yet</span>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-forge-subtle">
        Pin the towers and initiatives you&apos;re responsible for so they&apos;re
        one click away from the top bar.
      </p>
      <Link
        href="/"
        onClick={onClose}
        className="mt-4 inline-flex items-center gap-1 rounded-lg border border-forge-border bg-forge-surface px-3 py-1.5 text-xs font-medium text-forge-body transition hover:border-accent-purple/40 hover:text-accent-purple-dark"
      >
        Browse towers
      </Link>
    </div>
  );
}
