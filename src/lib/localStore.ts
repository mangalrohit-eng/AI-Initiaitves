// Typed, SSR-safe wrapper over localStorage for all P1 collaboration state.
import type { AssessProgramV2, GlobalAssessAssumptions, TowerId } from "@/data/assess/types";
import { buildSeededAssessProgramV2 } from "@/data/assess/seedAssessProgram";
import { defaultTowerState, type TowerAssessState } from "@/data/assess/types";
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
  assessProgram: "forge.assessProgram.v2", // key is shared across v2 + v3 — see migrateAssessProgram
  myTowers: "forge.myTowers.v1", // TowerId[]
  persona: "forge.persona", // legacy unversioned key from OnboardingHero
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

export function clearPins(): void {
  safeSet(KEYS.pins, []);
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

// ----- assess program (13-tower, v3) -----------------------------------

/**
 * Read-time migration for snapshots seeded by the original (buggy) seed
 * builder, which marked every tower `status: "complete"` even though no tower
 * lead had reviewed anything. A genuine Mark-complete requires all four
 * `*ConfirmedAt` timestamps (gated by the checklist), so any "complete" tower
 * with zero `*ConfirmedAt` stamps is a buggy-seed leftover and should be
 * demoted to `"data"` (= "Pending Tower Lead review").
 *
 * Idempotent and side-effect free at read time — we don't write back here so
 * actual user actions (Mark complete, edits) are still the only thing that
 * persists state changes. The corrected status will be saved next time the
 * user mutates the program.
 */
function migrateBuggySeedComplete(program: AssessProgramV2): AssessProgramV2 {
  let touched = false;
  const towers: AssessProgramV2["towers"] = {};
  for (const [k, t] of Object.entries(program.towers)) {
    if (!t) continue;
    const noStamps =
      !t.capabilityMapConfirmedAt &&
      !t.headcountConfirmedAt &&
      !t.offshoreConfirmedAt &&
      !t.aiConfirmedAt;
    if (t.status === "complete" && noStamps) {
      towers[k as TowerId] = { ...t, status: "data" };
      touched = true;
    } else {
      towers[k as TowerId] = t;
    }
  }
  if (!touched) return program;
  return { ...program, towers };
}

/**
 * Read-time migration from V2 -> V3:
 *   - drops `scenarios` (per-tower stress-test slice)
 *   - drops `offshoreLeverWeight`, `aiLeverWeight`, `combineMode`,
 *     `combinedCapPct` from `global`
 *   - bumps `version` to 3
 *
 * Side-effect free — we don't write back here, so actual user actions are
 * still the only thing that persists state changes. The migrated shape will
 * be saved on the next mutation.
 */
function migrateV2ToV3(raw: unknown): AssessProgramV2 {
  if (raw === null || typeof raw !== "object") return buildSeededAssessProgramV2();
  const r = raw as Record<string, unknown>;
  const versionRaw = r.version;
  const towersRaw =
    r.towers && typeof r.towers === "object"
      ? (r.towers as AssessProgramV2["towers"])
      : {};
  const globalRaw =
    r.global && typeof r.global === "object" ? (r.global as Record<string, unknown>) : {};

  const num = (v: unknown, d: number) =>
    typeof v === "number" && Number.isFinite(v) ? v : d;

  const seed = buildSeededAssessProgramV2();
  const global: GlobalAssessAssumptions = {
    blendedFteOnshore: num(globalRaw.blendedFteOnshore, seed.global.blendedFteOnshore),
    blendedFteOffshore: num(globalRaw.blendedFteOffshore, seed.global.blendedFteOffshore),
    blendedContractorOnshore: num(
      globalRaw.blendedContractorOnshore,
      seed.global.blendedContractorOnshore,
    ),
    blendedContractorOffshore: num(
      globalRaw.blendedContractorOffshore,
      seed.global.blendedContractorOffshore,
    ),
  };

  if (versionRaw === 3) {
    return { version: 3, towers: towersRaw, global };
  }
  return { version: 3, towers: towersRaw, global };
}

export function getAssessProgram(): AssessProgramV2 {
  const raw = safeGet<unknown>(KEYS.assessProgram, buildSeededAssessProgramV2());
  return migrateBuggySeedComplete(migrateV2ToV3(raw));
}

export function setAssessProgram(next: AssessProgramV2): void {
  safeSet(KEYS.assessProgram, next);
}

export function updateAssessProgram(
  fn: (cur: AssessProgramV2) => AssessProgramV2,
): AssessProgramV2 {
  const next = fn(getAssessProgram());
  setAssessProgram(next);
  return next;
}

export function setTowerAssess(towerId: TowerId, patch: Partial<TowerAssessState>): void {
  updateAssessProgram((p) => {
    const cur = p.towers[towerId] ?? { ...defaultTowerState() };
    return {
      ...p,
      towers: {
        ...p.towers,
        [towerId]: {
          ...cur,
          ...patch,
          l4Rows: patch.l4Rows ?? cur.l4Rows,
          baseline: patch.baseline ? { ...cur.baseline, ...patch.baseline } : cur.baseline,
          status: patch.status ?? cur.status,
          lastUpdated: new Date().toISOString(),
        },
      },
    };
  });
}

export function setGlobalAssessAssumptions(patch: Partial<GlobalAssessAssumptions>): void {
  updateAssessProgram((p) => ({
    ...p,
    global: { ...p.global, ...patch },
  }));
}

// ----- "my towers" personalisation -------------------------------------

export function getMyTowers(): TowerId[] {
  return safeGet<TowerId[]>(KEYS.myTowers, []);
}

export function setMyTowers(ids: TowerId[]): TowerId[] {
  // Deduplicate while preserving insertion order.
  const seen = new Set<TowerId>();
  const next = ids.filter((id) => {
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  safeSet(KEYS.myTowers, next);
  return next;
}

export function toggleMyTower(id: TowerId): TowerId[] {
  const cur = getMyTowers();
  const exists = cur.includes(id);
  const next = exists ? cur.filter((t) => t !== id) : [...cur, id];
  safeSet(KEYS.myTowers, next);
  return next;
}

// ----- persona (executive / Versant lead / Accenture lead) -------------

export type Persona = "versant" | "accenture" | "executive";

export function getPersona(): Persona | null {
  // Stored as a raw string by OnboardingHero historically; safeGet wraps in
  // JSON.parse, so we read with a manual fallback for the legacy raw value.
  if (!canUse()) return null;
  try {
    const raw = window.localStorage.getItem(KEYS.persona);
    if (!raw) return null;
    const value = raw.startsWith('"') ? (JSON.parse(raw) as string) : raw;
    if (value === "versant" || value === "accenture" || value === "executive") return value;
  } catch {
    /* noop */
  }
  return null;
}

export function setPersona(p: Persona | null): void {
  if (!canUse()) return;
  try {
    if (p === null) {
      window.localStorage.removeItem(KEYS.persona);
    } else {
      // Match the OnboardingHero legacy format (raw string, not JSON-encoded).
      window.localStorage.setItem(KEYS.persona, p);
    }
    emit(KEYS.persona);
  } catch {
    /* noop */
  }
}

export const LOCAL_STORE_KEYS = KEYS;
