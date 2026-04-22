"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  ChevronDown,
  Clipboard,
  Link2,
  Mail,
  MessageSquare,
  NotebookPen,
  Printer,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PinButton } from "@/components/collab/PinButton";
import { NotesPanel } from "@/components/collab/NotesPanel";
import {
  notesCount,
  pageKey as makePageKey,
  subscribe,
  type PinKind,
} from "@/lib/localStore";

// Fallback — the deployed app should set NEXT_PUBLIC_FEEDBACK_EMAIL.
const FEEDBACK_EMAIL =
  process.env.NEXT_PUBLIC_FEEDBACK_EMAIL || "forge-program@example.com";

type PinProps =
  | {
      kind: PinKind;
      id: string;
      href: string;
      title: string;
      subtitle?: string;
    }
  | undefined;

// Lightweight action bar shared across tower, initiative, and brief pages.
// Handles copy link, print/PDF, pin, private notes, share to teammate, and
// leave feedback. Hidden in printed output via `no-print`.
export function ShareBar({
  title,
  pin,
  className,
}: {
  title?: string;
  pin?: PinProps;
  className?: string;
}) {
  const [toast, setToast] = React.useState<string | null>(null);
  const [shareOpen, setShareOpen] = React.useState(false);
  const [notesOpen, setNotesOpen] = React.useState(false);
  const [notes, setNotes] = React.useState(0);
  const [mounted, setMounted] = React.useState(false);
  const shareMenuRef = React.useRef<HTMLDivElement | null>(null);

  const pageKey = pin ? makePageKey(pin.kind, pin.id) : undefined;

  React.useEffect(() => {
    setMounted(true);
    if (!pageKey) return;
    const recompute = () => setNotes(notesCount(pageKey));
    recompute();
    return subscribe("notes", recompute);
  }, [pageKey]);

  React.useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  // Close share menu on outside click / Escape.
  React.useEffect(() => {
    if (!shareOpen) return;
    const onClick = (e: MouseEvent) => {
      if (!shareMenuRef.current) return;
      if (!shareMenuRef.current.contains(e.target as Node)) setShareOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShareOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [shareOpen]);

  function currentHref(): string {
    return typeof window !== "undefined" ? window.location.href : "";
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(currentHref());
      setToast("Link copied");
    } catch {
      setToast("Copy blocked by browser");
    }
  }

  function printPage() {
    if (typeof window !== "undefined") window.print();
  }

  async function copyRichForSlack() {
    const body = `${title ?? "Forge program"}\n${currentHref()}`;
    try {
      await navigator.clipboard.writeText(body);
      setToast("Copied for Slack");
    } catch {
      setToast("Copy blocked by browser");
    }
    setShareOpen(false);
  }

  function openOutlook() {
    const subject = encodeURIComponent(title ? `Forge: ${title}` : "Forge program");
    const body = encodeURIComponent(
      `Have a look when you get a moment:\n\n${currentHref()}\n\n— sent from the Forge explorer`,
    );
    if (typeof window !== "undefined") {
      window.location.href = `mailto:?subject=${subject}&body=${body}`;
    }
    setShareOpen(false);
  }

  function openTeams() {
    const url = encodeURIComponent(currentHref());
    const text = encodeURIComponent(
      title ? `Forge: ${title}` : "Forge program page",
    );
    // Teams deep-link — if the client is not installed, the OS gracefully
    // surfaces a "no app" dialog rather than erroring.
    const deep = `msteams:/l/chat/0/0?users=&message=${text}%20${url}`;
    if (typeof window !== "undefined") window.location.href = deep;
    setShareOpen(false);
  }

  function openFeedback() {
    const subject = encodeURIComponent(
      title ? `Forge feedback: ${title}` : "Forge feedback",
    );
    const body = encodeURIComponent(
      `What worked, what didn't, what would help:\n\n\nPage: ${currentHref()}`,
    );
    if (typeof window !== "undefined") {
      window.location.href = `mailto:${FEEDBACK_EMAIL}?subject=${subject}&body=${body}`;
    }
  }

  return (
    <div
      className={cn("no-print relative inline-flex flex-wrap items-center gap-2", className)}
    >
      <button
        type="button"
        onClick={copyLink}
        className="inline-flex items-center gap-1.5 rounded-lg border border-forge-border bg-forge-surface px-3 py-1.5 text-xs font-medium text-forge-body shadow-sm transition hover:border-accent-purple/40 hover:text-accent-purple-dark"
        aria-label={title ? `Copy link to ${title}` : "Copy page link"}
      >
        <Link2 className="h-3.5 w-3.5" />
        Copy link
      </button>

      <div ref={shareMenuRef} className="relative">
        <button
          type="button"
          onClick={() => setShareOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={shareOpen}
          className="inline-flex items-center gap-1.5 rounded-lg border border-forge-border bg-forge-surface px-3 py-1.5 text-xs font-medium text-forge-body shadow-sm transition hover:border-accent-purple/40 hover:text-accent-purple-dark"
        >
          <Send className="h-3.5 w-3.5" />
          Share
          <ChevronDown className="h-3 w-3 opacity-70" aria-hidden />
        </button>
        <AnimatePresence>
          {shareOpen ? (
            <motion.div
              role="menu"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.14 }}
              className="absolute right-0 top-full z-20 mt-1 w-52 overflow-hidden rounded-xl border border-forge-border bg-forge-surface shadow-lg"
            >
              <MenuItem onClick={openOutlook} icon={<Mail className="h-3.5 w-3.5" />}>
                Email (Outlook)
              </MenuItem>
              <MenuItem onClick={openTeams} icon={<MessageSquare className="h-3.5 w-3.5" />}>
                Microsoft Teams
              </MenuItem>
              <MenuItem onClick={copyRichForSlack} icon={<Clipboard className="h-3.5 w-3.5" />}>
                Copy for Slack
              </MenuItem>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {pin ? (
        <PinButton
          kind={pin.kind}
          id={pin.id}
          href={pin.href}
          title={pin.title}
          subtitle={pin.subtitle}
        />
      ) : null}

      {pin ? (
        <button
          type="button"
          onClick={() => setNotesOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={notesOpen}
          className="inline-flex items-center gap-1.5 rounded-lg border border-forge-border bg-forge-surface px-3 py-1.5 text-xs font-medium text-forge-body shadow-sm transition hover:border-accent-purple/40 hover:text-accent-purple-dark"
        >
          <NotebookPen className="h-3.5 w-3.5" />
          Notes
          {mounted && notes > 0 ? (
            <span className="rounded-full bg-accent-purple/15 px-1.5 py-0.5 font-mono text-[10px] text-accent-purple-dark">
              {notes}
            </span>
          ) : null}
        </button>
      ) : null}

      <button
        type="button"
        onClick={printPage}
        className="inline-flex items-center gap-1.5 rounded-lg border border-forge-border bg-forge-surface px-3 py-1.5 text-xs font-medium text-forge-body shadow-sm transition hover:border-accent-purple/40 hover:text-accent-purple-dark"
        aria-label="Print or save as PDF"
      >
        <Printer className="h-3.5 w-3.5" />
        Print / PDF
      </button>

      <button
        type="button"
        onClick={openFeedback}
        className="inline-flex items-center gap-1.5 rounded-lg border border-transparent px-3 py-1.5 text-xs font-medium text-forge-subtle transition hover:border-forge-border hover:text-forge-ink"
      >
        <Mail className="h-3.5 w-3.5" />
        Feedback
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

      {pin && pageKey ? (
        <NotesPanel
          open={notesOpen}
          onClose={() => setNotesOpen(false)}
          pageKey={pageKey}
          pageTitle={title ?? pin.title}
        />
      ) : null}
    </div>
  );
}

function MenuItem({
  children,
  icon,
  onClick,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      role="menuitem"
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-forge-body transition hover:bg-forge-well hover:text-forge-ink"
    >
      <span className="text-forge-hint">{icon}</span>
      {children}
    </button>
  );
}
