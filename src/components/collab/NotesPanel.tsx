"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { NotebookPen, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  addNote,
  deleteNote,
  getDisplayName,
  getNotes,
  setDisplayName,
  subscribe,
  updateNote,
  type Note,
} from "@/lib/localStore";
import { useFocusTrap } from "@/lib/useFocusTrap";

type Props = {
  open: boolean;
  onClose: () => void;
  pageKey: string;
  pageTitle: string;
};

export function NotesPanel({ open, onClose, pageKey, pageTitle }: Props) {
  const [notes, setNotes] = React.useState<Note[]>([]);
  const [draft, setDraft] = React.useState("");
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editingText, setEditingText] = React.useState("");
  const [author, setAuthor] = React.useState("");
  const trapRef = useFocusTrap<HTMLDivElement>(open);

  const refresh = React.useCallback(() => setNotes(getNotes(pageKey)), [pageKey]);

  React.useEffect(() => {
    refresh();
    setAuthor(getDisplayName());
    return subscribe("notes", refresh);
  }, [refresh]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  function commitDraft() {
    const text = draft.trim();
    if (!text) return;
    if (author.trim()) setDisplayName(author);
    addNote(pageKey, text, author.trim() || undefined);
    setDraft("");
  }

  function commitEdit() {
    if (!editingId) return;
    const text = editingText.trim();
    if (!text) {
      setEditingId(null);
      setEditingText("");
      return;
    }
    updateNote(pageKey, editingId, text);
    setEditingId(null);
    setEditingText("");
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="notes-root"
          className="fixed inset-0 z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          role="dialog"
          aria-modal="true"
          aria-label={`Private notes — ${pageTitle}`}
        >
          <button
            type="button"
            aria-label="Close notes"
            onClick={onClose}
            className="absolute inset-0 bg-forge-ink/30 backdrop-blur-[1px]"
          />
          <motion.aside
            ref={trapRef}
            initial={{ x: 420 }}
            animate={{ x: 0 }}
            exit={{ x: 420 }}
            transition={{ type: "spring", stiffness: 360, damping: 34 }}
            tabIndex={-1}
            className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-forge-border bg-forge-surface shadow-2xl outline-none"
          >
            <header className="flex items-start justify-between gap-3 border-b border-forge-border px-5 py-4">
              <div className="flex items-start gap-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-accent-purple/30 bg-accent-purple/10 text-accent-purple-dark">
                  <NotebookPen className="h-4 w-4" aria-hidden />
                </div>
                <div>
                  <div className="font-display text-sm font-semibold text-forge-ink">
                    Private notes
                  </div>
                  <div className="text-[11px] text-forge-subtle line-clamp-2">
                    {pageTitle} · saved on this device
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
              {notes.length === 0 ? (
                <p className="rounded-xl border border-dashed border-forge-border bg-forge-well/60 p-4 text-xs leading-relaxed text-forge-subtle">
                  No notes yet. Capture what you want to raise with the tower
                  lead, questions to resolve, or decisions to validate.
                </p>
              ) : (
                <ul className="space-y-3">
                  {notes.map((n) => (
                    <li
                      key={n.id}
                      className="rounded-xl border border-forge-border bg-forge-well/60 p-3 shadow-sm"
                    >
                      {editingId === n.id ? (
                        <div className="space-y-2">
                          <textarea
                            value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                            rows={3}
                            className="w-full rounded-lg border border-forge-border bg-forge-surface px-2.5 py-1.5 text-sm text-forge-ink outline-none focus:border-accent-purple/50 focus:ring-2 focus:ring-accent-purple/20"
                            autoFocus
                          />
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(null);
                                setEditingText("");
                              }}
                              className="rounded-md border border-forge-border px-2.5 py-1 text-xs text-forge-subtle transition hover:text-forge-ink"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={commitEdit}
                              className="rounded-md bg-accent-purple px-2.5 py-1 text-xs font-medium text-white transition hover:bg-accent-purple-dark"
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="whitespace-pre-wrap text-sm text-forge-ink">
                            {n.text}
                          </p>
                          <div className="mt-2 flex items-center justify-between gap-2">
                            <span className="text-[11px] text-forge-hint">
                              {n.author ? `${n.author} · ` : ""}
                              {formatTimestamp(n.updatedAt)}
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingId(n.id);
                                  setEditingText(n.text);
                                }}
                                aria-label="Edit note"
                                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-forge-hint transition hover:bg-forge-surface hover:text-forge-ink"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteNote(pageKey, n.id)}
                                aria-label="Delete note"
                                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-forge-hint transition hover:bg-forge-surface hover:text-accent-red"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <footer className="border-t border-forge-border bg-forge-well/50 px-5 py-3">
              <label className="mb-1 block text-[11px] font-medium text-forge-subtle">
                Attribute as
                <input
                  type="text"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder="Your name (optional)"
                  className="mt-1 w-full rounded-md border border-forge-border bg-forge-surface px-2 py-1 text-xs text-forge-ink outline-none focus:border-accent-purple/50 focus:ring-2 focus:ring-accent-purple/20"
                />
              </label>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                    e.preventDefault();
                    commitDraft();
                  }
                }}
                rows={2}
                placeholder="Add a note… (Cmd/Ctrl + Enter to save)"
                className="mt-2 w-full rounded-lg border border-forge-border bg-forge-surface px-2.5 py-1.5 text-sm text-forge-ink outline-none focus:border-accent-purple/50 focus:ring-2 focus:ring-accent-purple/20"
              />
              <div className="mt-2 flex items-center justify-end">
                <button
                  type="button"
                  onClick={commitDraft}
                  disabled={!draft.trim()}
                  className="inline-flex items-center gap-1 rounded-md bg-accent-purple px-3 py-1.5 text-xs font-medium text-white transition hover:bg-accent-purple-dark disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add note
                </button>
              </div>
            </footer>
          </motion.aside>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}
