"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle, Quote, Reply, X } from "lucide-react";
import {
  ANNOTATION_QUERY_PARAM,
  ANNOTATION_MAX_TEXT,
  buildAnnotationUrl,
  decodeAnnotation,
  type AnnotationPayload,
} from "@/lib/annotation";
import { getDisplayName, setDisplayName } from "@/lib/localStore";

// Reads `?annot=…` from the URL, decodes the annotation, scrolls to the
// target anchor element, and pins a floating card next to it. Users can
// compose a reply that produces a new copy-able URL — purely client-side,
// no backend involved.
export function AnnotationOverlay() {
  const [payload, setPayload] = React.useState<AnnotationPayload | null>(null);
  const [anchorRect, setAnchorRect] = React.useState<DOMRect | null>(null);
  const [dismissed, setDismissed] = React.useState(false);
  const [replyOpen, setReplyOpen] = React.useState(false);

  // Read the annotation from window.location rather than useSearchParams so
  // statically generated pages don't fall back to dynamic rendering.
  React.useEffect(() => {
    setDismissed(false);
    setReplyOpen(false);
    if (typeof window === "undefined") return;
    const search = new URLSearchParams(window.location.search);
    const encoded = search.get(ANNOTATION_QUERY_PARAM);
    if (!encoded) {
      setPayload(null);
      return;
    }
    setPayload(decodeAnnotation(encoded));
  }, []);

  React.useEffect(() => {
    if (!payload || dismissed) {
      setAnchorRect(null);
      return;
    }
    const el = document.querySelector<HTMLElement>(
      `[data-annot-anchor="${payload.a}"]`,
    );
    if (!el) {
      setAnchorRect(null);
      return;
    }
    // Brief highlight + scroll on first mount.
    el.classList.add("annot-highlight");
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    const t = setTimeout(() => el.classList.remove("annot-highlight"), 2400);

    const updateRect = () => setAnchorRect(el.getBoundingClientRect());
    updateRect();
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);
    return () => {
      clearTimeout(t);
      el.classList.remove("annot-highlight");
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
    };
  }, [payload, dismissed]);

  if (!payload || dismissed) return null;

  return (
    <AnimatePresence>
      <motion.aside
        key="annot-card"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        transition={{ duration: 0.18 }}
        role="note"
        aria-label="Shared annotation"
        className="no-print fixed right-4 z-40 w-[320px] max-w-[calc(100vw-2rem)] sm:right-6"
        style={{
          top: positionTop(anchorRect),
        }}
      >
        <div className="rounded-2xl border border-accent-purple/40 bg-forge-surface shadow-xl ring-1 ring-accent-purple/10">
          <header className="flex items-start justify-between gap-2 border-b border-forge-border px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-purple/10 text-accent-purple-dark">
                <MessageCircle className="h-3.5 w-3.5" aria-hidden />
              </span>
              <div>
                <div className="text-xs font-semibold text-forge-ink">
                  {payload.u?.trim() || "Teammate"} shared an annotation
                </div>
                <div className="text-[10.5px] text-forge-hint">
                  {formatWhen(payload.ts)} · {labelFor(payload.a)}
                </div>
              </div>
            </div>
            <button
              type="button"
              aria-label="Dismiss annotation"
              onClick={() => setDismissed(true)}
              className="inline-flex h-6 w-6 items-center justify-center rounded-full text-forge-hint transition hover:bg-forge-well hover:text-forge-ink"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </header>
          <div className="px-4 py-3">
            <div className="flex gap-2 text-sm text-forge-body">
              <Quote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-forge-hint" aria-hidden />
              <p className="whitespace-pre-wrap">{payload.t}</p>
            </div>
          </div>
          <footer className="flex items-center justify-end gap-2 border-t border-forge-border px-4 py-2">
            <button
              type="button"
              onClick={() => setReplyOpen(true)}
              className="inline-flex items-center gap-1 rounded-md border border-forge-border bg-forge-surface px-2.5 py-1 text-[11px] font-medium text-forge-body transition hover:border-accent-purple/40 hover:text-accent-purple-dark"
            >
              <Reply className="h-3 w-3" />
              Reply with a new link
            </button>
          </footer>
        </div>
        <ReplyDialog
          open={replyOpen}
          onClose={() => setReplyOpen(false)}
          anchor={payload.a}
        />
      </motion.aside>
    </AnimatePresence>
  );
}

function positionTop(rect: DOMRect | null): number {
  if (!rect) return 96;
  // Try to align with the anchor; clamp so we never escape the viewport.
  const desired = Math.max(96, rect.top);
  const max = window.innerHeight - 240;
  return Math.min(desired, Math.max(96, max));
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

const ANCHOR_LABELS: Record<string, string> = {
  "business-case": "Business case",
  "pain-points": "Pain points",
  "lens-work": "Work lens",
  "lens-team": "Team lens",
  "lens-tools": "Tools & apps lens",
  "lens-platform": "Platform lens",
  "technical-arch": "Technical architecture",
};

function labelFor(key: string): string {
  return ANCHOR_LABELS[key] ?? key;
}

// ---------- Reply dialog -----------------------------------------------

function ReplyDialog({
  open,
  onClose,
  anchor,
}: {
  open: boolean;
  onClose: () => void;
  anchor: string;
}) {
  const [text, setText] = React.useState("");
  const [author, setAuthor] = React.useState("");
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setText("");
    setCopied(false);
    setAuthor(getDisplayName());
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function copy() {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (author.trim()) setDisplayName(author);
    const url = buildAnnotationUrl(window.location.href, {
      a: anchor,
      t: trimmed,
      u: author.trim() || undefined,
    });
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // fallback: surface the URL so the user can copy it manually
      window.prompt("Copy this link:", url);
      setCopied(true);
    }
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          role="dialog"
          aria-modal="true"
          aria-label="Reply with a new annotation link"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="absolute inset-0 bg-forge-ink/40"
          />
          <motion.div
            initial={{ scale: 0.97, y: 8 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.97, y: 8 }}
            className="relative w-full max-w-md rounded-2xl border border-forge-border bg-forge-surface p-5 shadow-2xl"
          >
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <h3 className="font-display text-sm font-semibold text-forge-ink">
                  Reply with a new link
                </h3>
                <p className="mt-1 text-[11px] leading-relaxed text-forge-subtle">
                  We don&apos;t have a backend — your reply becomes a copy-able
                  URL the teammate can open.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full text-forge-hint transition hover:bg-forge-well hover:text-forge-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <label className="mb-2 block text-[11px] font-medium text-forge-subtle">
              Your name
              <input
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="Optional"
                className="mt-1 w-full rounded-md border border-forge-border bg-forge-surface px-2 py-1 text-xs text-forge-ink outline-none focus:border-accent-purple/50 focus:ring-2 focus:ring-accent-purple/20"
              />
            </label>
            <label className="block text-[11px] font-medium text-forge-subtle">
              Reply
              <textarea
                value={text}
                maxLength={ANNOTATION_MAX_TEXT}
                onChange={(e) => setText(e.target.value)}
                rows={4}
                autoFocus
                className="mt-1 w-full rounded-lg border border-forge-border bg-forge-surface px-2.5 py-1.5 text-sm text-forge-ink outline-none focus:border-accent-purple/50 focus:ring-2 focus:ring-accent-purple/20"
                placeholder={`Type your response… (max ${ANNOTATION_MAX_TEXT} chars)`}
              />
              <span className="mt-1 block text-right text-[10px] text-forge-hint">
                {text.length} / {ANNOTATION_MAX_TEXT}
              </span>
            </label>
            <div className="mt-3 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-forge-border px-3 py-1.5 text-xs text-forge-subtle transition hover:text-forge-ink"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={copy}
                disabled={!text.trim()}
                className="inline-flex items-center gap-1 rounded-md bg-accent-purple px-3 py-1.5 text-xs font-medium text-white transition hover:bg-accent-purple-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                {copied ? "Link copied — paste into Teams" : "Copy reply link"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
