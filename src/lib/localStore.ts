// Typed, SSR-safe wrapper over localStorage for all P1 collaboration state.
//
// Conventions:
//   - Every key is prefixed `forge.` to avoid collisions with other apps.
//   - Every read guards `typeof window`; every write is wrapped in try/catch.
//   - Events are emitted via a tiny pub/sub so drawers and badges can react
//     without passing props through every layer (see `subscribe`).
//   - Shapes are chosen so they map 1:1 to future Supabase rows.

export type PinKind = "tower" | "initiative" | "brief";

export type PinRef = {
  kind: PinKind;
  id: string; // stable id within kind (tower slug, process id, brief id)
  href: string; // canonical in-app href
  title: string;
  subtitle?: string; // e.g. tower name for initiatives and briefs
  pinnedAt: string; // ISO timestamp
};

export type Note = {
  id: string;
  text: string;
  author?: string;
  createdAt: string;
  updatedAt: string;
};

// Minimum index of recently-viewed pages.
export type RecentRef = {
  kind: PinKind;
  id: string;
  href: string;
  title: string;
  subtitle?: string;
  viewedAt: string;
};

const KEYS = {
  pins: "forge.pins.v1",
  notes: "forge.notes.v1", // JSON: Record<pageKey, Note[]>
  reads: "forge.reads.v1", // JSON: Record<pageKey, ISO timestamp>
  recent: "forge.recent.v1", // JSON: RecentRef[] (capped)
  displayName: "forge.displayName.v1",
  lastChangelogVisit: "forge.lastChangelogVisit.v1",
} as const;

const RECENT_CAP = 12;

// ----- low-level helpers ------------------------------------------------

function canUse(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function safeGet<T>(key: string, fallback: T): T {
  if (!canUse()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeSet(key: string, value: unknown): void {
  if (!canUse()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    emit(key);
  } catch {
    // Quota exceeded / private mode — silently no-op.
  }
}

// ----- pub/sub ---------------------------------------------------------

type Listener = () => void;
const listeners = new Map<string, Set<Listener>>();

function emit(key: string) {
  listeners.get(key)?.forEach((l) => l());
}

export function subscribe(key: keyof typeof KEYS, listener: Listener): () => void {
  const k = KEYS[key];
  if (!listeners.has(k)) listeners.set(k, new Set());
  listeners.get(k)!.add(listener);
  // Also listen to cross-tab updates via the storage event.
  const onStorage = (e: StorageEvent) => {
    if (e.key === k) listener();
  };
  if (canUse()) window.addEventListener("storage", onStorage);
  return () => {
    listeners.get(k)?.delete(listener);
    if (canUse()) window.removeEventListener("storage", onStorage);
  };
}

// ----- pins ------------------------------------------------------------

export function getPins(): PinRef[] {
  return safeGet<PinRef[]>(KEYS.pins, []);
}

export function isPinned(kind: PinKind, id: string): boolean {
  return getPins().some((p) => p.kind === kind && p.id === id);
}

// Adds or removes depending on current state. Returns the new list.
export function togglePin(ref: Omit<PinRef, "pinnedAt">): PinRef[] {
  const pins = getPins();
  const existing = pins.findIndex((p) => p.kind === ref.kind && p.id === ref.id);
  let next: PinRef[];
  if (existing >= 0) {
    next = pins.filter((_, i) => i !== existing);
  } else {
    next = [{ ...ref, pinnedAt: new Date().toISOString() }, ...pins];
  }
  safeSet(KEYS.pins, next);
  return next;
}

export function removePin(kind: PinKind, id: string): PinRef[] {
  const next = getPins().filter((p) => !(p.kind === kind && p.id === id));
  safeSet(KEYS.pins, next);
  return next;
}

// ----- notes -----------------------------------------------------------

type NotesBook = Record<string, Note[]>;

export function getNotes(pageKey: string): Note[] {
  const book = safeGet<NotesBook>(KEYS.notes, {});
  return book[pageKey] ?? [];
}

export function addNote(pageKey: string, text: string, author?: string): Note[] {
  const book = safeGet<NotesBook>(KEYS.notes, {});
  const now = new Date().toISOString();
  const note: Note = {
    id: cryptoId(),
    text: text.trim(),
    author: author?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  };
  const list = [...(book[pageKey] ?? []), note];
  book[pageKey] = list;
  safeSet(KEYS.notes, book);
  return list;
}

export function updateNote(pageKey: string, noteId: string, text: string): Note[] {
  const book = safeGet<NotesBook>(KEYS.notes, {});
  const list = (book[pageKey] ?? []).map((n) =>
    n.id === noteId ? { ...n, text: text.trim(), updatedAt: new Date().toISOString() } : n,
  );
  book[pageKey] = list;
  safeSet(KEYS.notes, book);
  return list;
}

export function deleteNote(pageKey: string, noteId: string): Note[] {
  const book = safeGet<NotesBook>(KEYS.notes, {});
  const list = (book[pageKey] ?? []).filter((n) => n.id !== noteId);
  book[pageKey] = list;
  safeSet(KEYS.notes, book);
  return list;
}

export function notesCount(pageKey: string): number {
  return getNotes(pageKey).length;
}

// ----- reads / "changed since last visit" ------------------------------

type ReadsMap = Record<string, string>;

export function markRead(pageKey: string, at: string = new Date().toISOString()): void {
  const map = safeGet<ReadsMap>(KEYS.reads, {});
  map[pageKey] = at;
  safeSet(KEYS.reads, map);
}

export function getLastRead(pageKey: string): string | undefined {
  const map = safeGet<ReadsMap>(KEYS.reads, {});
  return map[pageKey];
}

export function changedSince(
  lastUpdatedISO?: string,
  lastReadISO?: string,
): boolean {
  if (!lastUpdatedISO) return false;
  if (!lastReadISO) return true; // never seen → always "new" to the user
  return new Date(lastUpdatedISO).getTime() > new Date(lastReadISO).getTime();
}

// ----- recently viewed -------------------------------------------------

export function getRecent(): RecentRef[] {
  return safeGet<RecentRef[]>(KEYS.recent, []);
}

export function pushRecent(ref: Omit<RecentRef, "viewedAt">): RecentRef[] {
  const now = new Date().toISOString();
  const deduped = getRecent().filter((r) => !(r.kind === ref.kind && r.id === ref.id));
  const next = [{ ...ref, viewedAt: now }, ...deduped].slice(0, RECENT_CAP);
  safeSet(KEYS.recent, next);
  return next;
}

// ----- display name ----------------------------------------------------

export function getDisplayName(): string {
  return safeGet<string>(KEYS.displayName, "");
}

export function setDisplayName(name: string): void {
  safeSet(KEYS.displayName, name.trim());
}

// ----- changelog unread dot -------------------------------------------

export function getLastChangelogVisit(): string | undefined {
  return safeGet<string | undefined>(KEYS.lastChangelogVisit, undefined);
}

export function markChangelogVisited(): void {
  safeSet(KEYS.lastChangelogVisit, new Date().toISOString());
}

// ----- page key helpers -----------------------------------------------

export function pageKey(kind: PinKind, id: string): string {
  return `${kind}:${id}`;
}

// ----- id generator ----------------------------------------------------

function cryptoId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    try {
      return crypto.randomUUID();
    } catch {
      /* noop */
    }
  }
  return `n_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export const LOCAL_STORE_KEYS = KEYS;
