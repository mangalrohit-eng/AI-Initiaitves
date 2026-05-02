"use client";

import * as React from "react";
import { Send, Square } from "lucide-react";

type Props = {
  onSend: (content: string) => void;
  onStop: () => void;
  disabled: boolean;
  pending: boolean;
  /** When set, prefills the input on next render. Cleared after focus. */
  prefill?: string;
};

const MAX_LEN = 2_000;

export function MessageInput({ onSend, onStop, disabled, pending, prefill }: Props) {
  const [value, setValue] = React.useState("");
  const taRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    if (prefill && prefill.trim()) {
      setValue(prefill);
      requestAnimationFrame(() => {
        const ta = taRef.current;
        if (ta) {
          ta.focus();
          ta.setSelectionRange(ta.value.length, ta.value.length);
        }
      });
    }
    // We deliberately depend only on `prefill` so external prefills win.
  }, [prefill]);

  // Auto-resize textarea up to ~6 rows.
  React.useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  }, [value]);

  function send() {
    const trimmed = value.trim();
    if (!trimmed || pending) return;
    onSend(trimmed);
    setValue("");
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      send();
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  const remaining = MAX_LEN - value.length;
  const tooLong = remaining < 0;

  return (
    <div className="rounded-2xl border border-forge-border bg-forge-surface p-3 shadow-card focus-within:border-accent-purple/40 focus-within:shadow-[0_0_0_1px_rgba(161,0,255,0.18)]">
      <textarea
        ref={taRef}
        value={value}
        onChange={(e) => setValue(e.target.value.slice(0, MAX_LEN + 1))}
        onKeyDown={handleKey}
        placeholder="Ask about headcount, offshoring, savings, P1 initiatives, brands…"
        disabled={disabled}
        rows={1}
        className="block w-full resize-none bg-transparent px-1 py-1.5 text-sm leading-relaxed text-forge-ink placeholder:text-forge-hint focus:outline-none"
        style={{ minHeight: 36 }}
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-[10px] uppercase tracking-wider text-forge-hint">
          <span>
            <span className="font-mono text-forge-subtle">Enter</span> to send ·{" "}
            <span className="font-mono text-forge-subtle">Shift+Enter</span> for newline
          </span>
          <span className={tooLong ? "text-accent-red" : remaining < 200 ? "text-accent-amber" : ""}>
            {value.length}/{MAX_LEN}
          </span>
        </div>
        {pending ? (
          <button
            type="button"
            onClick={onStop}
            className="inline-flex items-center gap-1.5 rounded-lg border border-accent-red/40 bg-accent-red/5 px-3 py-1.5 text-xs font-medium text-accent-red transition hover:bg-accent-red/10"
          >
            <Square className="h-3 w-3 fill-current" aria-hidden />
            Stop
          </button>
        ) : (
          <button
            type="button"
            onClick={send}
            disabled={disabled || tooLong || value.trim().length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-accent-purple bg-accent-purple px-3 py-1.5 text-xs font-medium text-white transition hover:bg-accent-purple-dark disabled:cursor-not-allowed disabled:border-forge-border disabled:bg-forge-well disabled:text-forge-hint"
          >
            <Send className="h-3 w-3" aria-hidden />
            Send
          </button>
        )}
      </div>
    </div>
  );
}
