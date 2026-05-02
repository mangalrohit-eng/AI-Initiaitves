"use client";

import * as React from "react";
import type { AskMessage } from "./types";

const STORAGE_KEY = "askForge.history.v1";
const MAX_TURNS = 20;

function readStored(): AskMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(-MAX_TURNS) as AskMessage[];
  } catch {
    return [];
  }
}

function writeStored(messages: AskMessage[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_TURNS)));
  } catch {
    // Quota / private mode — silently no-op.
  }
}

/**
 * `localStorage`-backed conversation history. Hydrates after mount to avoid
 * SSR mismatches; writes are debounced via React state effects (one write per
 * render where messages change).
 */
export function usePersistedConversation(): {
  messages: AskMessage[];
  setMessages: React.Dispatch<React.SetStateAction<AskMessage[]>>;
  clear: () => void;
  hydrated: boolean;
} {
  const [messages, setMessages] = React.useState<AskMessage[]>([]);
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    setMessages(readStored());
    setHydrated(true);
  }, []);

  React.useEffect(() => {
    if (!hydrated) return;
    writeStored(messages);
  }, [messages, hydrated]);

  const clear = React.useCallback(() => {
    setMessages([]);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
    }
  }, []);

  return { messages, setMessages, clear, hydrated };
}
