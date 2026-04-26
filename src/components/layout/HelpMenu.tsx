"use client";

import * as React from "react";
import Link from "next/link";
import {
  Bell,
  BookOpen,
  Compass,
  Download,
  HelpCircle,
  Mail,
  MessageCircle,
} from "lucide-react";
import { getPortalAudience, isInternalSurfaceAllowed } from "@/lib/portalAudience";

type HelpItem = {
  id: string;
  label: string;
  description: string;
  href: string;
  Icon: typeof BookOpen;
  /** When set, only render in internal builds. */
  internalOnly?: boolean;
  /** When set, render an external <a> instead of <Link>. */
  external?: boolean;
};

const ITEMS: HelpItem[] = [
  {
    id: "walkthrough",
    label: "How to use this portal",
    description: "60-second workshop walkthrough — capability map, footprint, dials, complete.",
    href: "/capability-map?walkthrough=open",
    Icon: Compass,
  },
  {
    id: "glossary",
    label: "Glossary",
    description: "L2 / L3 / L4, offshore dial, AI dial, modeled value — the workshop vocabulary.",
    href: "/glossary",
    Icon: BookOpen,
  },
  {
    id: "changelog",
    label: "What's new",
    description: "Release notes for the program portal.",
    href: "/changelog",
    Icon: Bell,
    internalOnly: true,
  },
  {
    id: "sample",
    label: "Sample workbook",
    description: "13-tower Excel sample — one sheet per tower, ready to drop into the workshop.",
    href: "/capability-map?sample=open",
    Icon: Download,
  },
  {
    id: "contact",
    label: "Contact the program team",
    description: "Reach the Accenture × Versant Forge program team.",
    href: "mailto:forge-program@accenture.com",
    Icon: Mail,
    external: true,
  },
];

export function HelpMenu() {
  const audience = getPortalAudience();
  const showInternal = isInternalSurfaceAllowed(audience);
  const items = ITEMS.filter((i) => !i.internalOnly || showInternal);
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Help and resources"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-forge-border bg-forge-surface text-forge-body transition hover:border-accent-purple/40 hover:text-accent-purple-dark"
      >
        <HelpCircle className="h-4 w-4" aria-hidden />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-11 z-30 w-72 rounded-xl border border-forge-border bg-forge-surface p-1 shadow-card"
        >
          <div className="px-3 py-2">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-forge-hint">
              <MessageCircle className="h-3 w-3" aria-hidden />
              Help &amp; resources
            </div>
          </div>
          {items.map((item) => {
            const I = item.Icon;
            const inner = (
              <span className="flex w-full items-start gap-3 rounded-md px-3 py-2 text-left transition hover:bg-forge-well/60">
                <I className="mt-0.5 h-4 w-4 flex-shrink-0 text-accent-purple-dark" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-forge-ink">{item.label}</span>
                  <span className="mt-0.5 block text-[11px] leading-relaxed text-forge-subtle">
                    {item.description}
                  </span>
                </span>
              </span>
            );
            if (item.external) {
              return (
                <a
                  key={item.id}
                  href={item.href}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="block w-full text-forge-body"
                >
                  {inner}
                </a>
              );
            }
            return (
              <Link
                key={item.id}
                href={item.href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="block w-full text-forge-body"
              >
                {inner}
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
