// Typed, SSR-safe wrapper over localStorage for all P1 collaboration state.
import type {
  AssessProgramV2,
  GlobalAssessAssumptions,
  L3WorkforceRow,
  TowerId,
} from "@/data/assess/types";
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
  assessProgram: "forge.assessProgram.v2", // key is shared across v2 / v3 / v4 — see migrateAssessProgram
  myTowers: "forge.myTowers.v1", // TowerId[]
  persona: "forge.persona", // legacy unversioned key (raw string, not JSON-encoded)
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

// ----- assess program (13-tower, v4) -----------------------------------

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

type LegacyL4Row = {
  id?: unknown;
  l2?: unknown;
  l3?: unknown;
  l4?: unknown;
  fteOnshore?: unknown;
  fteOffshore?: unknown;
  contractorOnshore?: unknown;
  contractorOffshore?: unknown;
  annualSpendUsd?: unknown;
  l4OffshoreAssessmentPct?: unknown;
  l4AiImpactAssessmentPct?: unknown;
  offshoreAssessmentPct?: unknown;
  aiImpactAssessmentPct?: unknown;
  l4Activities?: unknown;
};

const numOr = (v: unknown, d: number): number =>
  typeof v === "number" && Number.isFinite(v) ? v : d;

const optNum = (v: unknown): number | undefined => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return undefined;
};

const slugify = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24) || "x";

/**
 * Group an array of legacy per-L4 rows into per-L3 rows by `(l2, l3)`. Used
 * by both the V3->V4 read-time migration and any file imports that arrive
 * in the legacy shape.
 *
 * Aggregation rules:
 *   - Headcount and spend are summed.
 *   - Offshore/AI percentages are cost-weighted (weighted by per-L4 pool $;
 *     when no rows have a pool, fall back to a simple average across rows
 *     that carry an explicit value). When no L4 in the group has an explicit
 *     value, the field is left undefined so the tower baseline still applies.
 *   - L4 names are preserved into `l4Activities` (de-duplicated, original
 *     order). This keeps the canonical activity list visible in the UI even
 *     after the math collapses to L3.
 */
function groupLegacyL4RowsToL3(input: LegacyL4Row[]): L3WorkforceRow[] {
  type Acc = {
    id: string;
    l2: string;
    l3: string;
    fteOnshore: number;
    fteOffshore: number;
    contractorOnshore: number;
    contractorOffshore: number;
    annualSpendUsd: number;
    hasSpend: boolean;
    weightedOffshore: number;
    weightedAi: number;
    weightedDen: number;
    plainOffshoreSum: number;
    plainOffshoreN: number;
    plainAiSum: number;
    plainAiN: number;
    activities: string[];
    seenActivities: Set<string>;
  };
  const order: string[] = [];
  const groups = new Map<string, Acc>();

  for (const raw of input) {
    const l2 = typeof raw.l2 === "string" ? raw.l2 : "";
    const l3 = typeof raw.l3 === "string" ? raw.l3 : "";
    if (!l2.trim() || !l3.trim()) continue;
    const l2Norm = l2.trim();
    const l3Norm = l3.trim();
    const key = `${l2Norm.toLowerCase()}\u0000${l3Norm.toLowerCase()}`;
    let acc = groups.get(key);
    if (!acc) {
      acc = {
        id: `${slugify(l2Norm)}::${slugify(l3Norm)}`,
        l2: l2Norm,
        l3: l3Norm,
        fteOnshore: 0,
        fteOffshore: 0,
        contractorOnshore: 0,
        contractorOffshore: 0,
        annualSpendUsd: 0,
        hasSpend: false,
        weightedOffshore: 0,
        weightedAi: 0,
        weightedDen: 0,
        plainOffshoreSum: 0,
        plainOffshoreN: 0,
        plainAiSum: 0,
        plainAiN: 0,
        activities: [],
        seenActivities: new Set(),
      };
      groups.set(key, acc);
      order.push(key);
    }

    const fteOn = numOr(raw.fteOnshore, 0);
    const fteOff = numOr(raw.fteOffshore, 0);
    const ctrOn = numOr(raw.contractorOnshore, 0);
    const ctrOff = numOr(raw.contractorOffshore, 0);
    acc.fteOnshore += fteOn;
    acc.fteOffshore += fteOff;
    acc.contractorOnshore += ctrOn;
    acc.contractorOffshore += ctrOff;

    const spend = optNum(raw.annualSpendUsd);
    if (spend != null && spend > 0) {
      acc.annualSpendUsd += spend;
      acc.hasSpend = true;
    }

    // Cost weight per L4 — same formula as `rowAnnualCost` but with
    // illustrative defaults (we don't have access to the active rates here,
    // and the migration shouldn't depend on them). Falls back to row count
    // when neither headcount nor spend is present.
    const weight =
      spend != null && spend > 0
        ? spend
        : fteOn + fteOff + ctrOn + ctrOff > 0
          ? fteOn + fteOff + ctrOn + ctrOff
          : 1;

    const offRaw =
      raw.offshoreAssessmentPct != null
        ? optNum(raw.offshoreAssessmentPct)
        : optNum(raw.l4OffshoreAssessmentPct);
    if (offRaw != null) {
      acc.weightedOffshore += offRaw * weight;
      acc.weightedDen += weight;
      acc.plainOffshoreSum += offRaw;
      acc.plainOffshoreN += 1;
    }
    const aiRaw =
      raw.aiImpactAssessmentPct != null
        ? optNum(raw.aiImpactAssessmentPct)
        : optNum(raw.l4AiImpactAssessmentPct);
    if (aiRaw != null) {
      acc.weightedAi += aiRaw * weight;
      acc.plainAiSum += aiRaw;
      acc.plainAiN += 1;
    }

    const l4Name = typeof raw.l4 === "string" ? raw.l4.trim() : "";
    if (l4Name) {
      const k = l4Name.toLowerCase();
      if (!acc.seenActivities.has(k)) {
        acc.seenActivities.add(k);
        acc.activities.push(l4Name);
      }
    }
    if (Array.isArray(raw.l4Activities)) {
      for (const x of raw.l4Activities) {
        if (typeof x !== "string") continue;
        const name = x.trim();
        if (!name) continue;
        const k = name.toLowerCase();
        if (!acc.seenActivities.has(k)) {
          acc.seenActivities.add(k);
          acc.activities.push(name);
        }
      }
    }
  }

  return order.map((k) => {
    const a = groups.get(k)!;
    const offWeighted =
      a.weightedDen > 0 ? Math.round(a.weightedOffshore / a.weightedDen) : undefined;
    const aiWeighted =
      a.weightedDen > 0 ? Math.round(a.weightedAi / a.weightedDen) : undefined;
    const offFallback =
      a.plainOffshoreN > 0 ? Math.round(a.plainOffshoreSum / a.plainOffshoreN) : undefined;
    const aiFallback =
      a.plainAiN > 0 ? Math.round(a.plainAiSum / a.plainAiN) : undefined;
    const out: L3WorkforceRow = {
      id: a.id,
      l2: a.l2,
      l3: a.l3,
      fteOnshore: a.fteOnshore,
      fteOffshore: a.fteOffshore,
      contractorOnshore: a.contractorOnshore,
      contractorOffshore: a.contractorOffshore,
    };
    if (a.hasSpend) out.annualSpendUsd = a.annualSpendUsd;
    const off = offWeighted ?? offFallback;
    const ai = aiWeighted ?? aiFallback;
    if (off != null) out.offshoreAssessmentPct = clamp01Pct(off);
    if (ai != null) out.aiImpactAssessmentPct = clamp01Pct(ai);
    if (a.activities.length > 0) out.l4Activities = a.activities;
    return out;
  });
}

function clamp01Pct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 100) return 100;
  return n;
}

/**
 * Read-time migration from any prior snapshot to the current V4.
 *
 *   V2 -> V3: dropped scenarios + lever weights (already happened in prior
 *     releases; we still tolerate v2 input here for safety).
 *   V3 -> V4: per-L4 footprint collapses to per-L3 rows.
 *     - Old `l4Rows` becomes `l3Rows` after `groupLegacyL4RowsToL3`.
 *     - Old `l4OffshoreAssessmentPct` / `l4AiImpactAssessmentPct` become
 *       cost-weighted `offshoreAssessmentPct` / `aiImpactAssessmentPct`.
 *     - L4 activity names are preserved into `l4Activities` for display.
 *
 * Side-effect free — we don't write back here, so actual user actions are
 * still the only thing that persists state changes. The migrated shape is
 * saved on the next mutation.
 */
function migrateAssessProgram(raw: unknown): AssessProgramV2 {
  if (raw === null || typeof raw !== "object") return buildSeededAssessProgramV2();
  const r = raw as Record<string, unknown>;
  const versionRaw = typeof r.version === "number" ? r.version : 0;
  const towersRaw =
    r.towers && typeof r.towers === "object" ? (r.towers as Record<string, unknown>) : {};
  const globalRaw =
    r.global && typeof r.global === "object" ? (r.global as Record<string, unknown>) : {};

  const seed = buildSeededAssessProgramV2();
  const global: GlobalAssessAssumptions = {
    blendedFteOnshore: numOr(globalRaw.blendedFteOnshore, seed.global.blendedFteOnshore),
    blendedFteOffshore: numOr(globalRaw.blendedFteOffshore, seed.global.blendedFteOffshore),
    blendedContractorOnshore: numOr(
      globalRaw.blendedContractorOnshore,
      seed.global.blendedContractorOnshore,
    ),
    blendedContractorOffshore: numOr(
      globalRaw.blendedContractorOffshore,
      seed.global.blendedContractorOffshore,
    ),
  };

  const towers: AssessProgramV2["towers"] = {};
  for (const [k, vRaw] of Object.entries(towersRaw)) {
    if (!vRaw || typeof vRaw !== "object") continue;
    const v = vRaw as Record<string, unknown>;
    const baselineRaw =
      v.baseline && typeof v.baseline === "object"
        ? (v.baseline as Record<string, unknown>)
        : {};
    const baseline = {
      baselineOffshorePct: numOr(
        baselineRaw.baselineOffshorePct,
        seed.towers[k as TowerId]?.baseline.baselineOffshorePct ?? 20,
      ),
      baselineAIPct: numOr(
        baselineRaw.baselineAIPct,
        seed.towers[k as TowerId]?.baseline.baselineAIPct ?? 15,
      ),
    };
    const status =
      v.status === "empty" || v.status === "data" || v.status === "complete"
        ? v.status
        : "empty";

    let l3Rows: L3WorkforceRow[];
    if (versionRaw >= 4 && Array.isArray(v.l3Rows)) {
      // Already V4 — just sanity-coerce.
      l3Rows = (v.l3Rows as unknown[])
        .map((rawRow) => {
          if (!rawRow || typeof rawRow !== "object") return null;
          const x = rawRow as Record<string, unknown>;
          if (typeof x.l2 !== "string" || typeof x.l3 !== "string") return null;
          const out: L3WorkforceRow = {
            id:
              typeof x.id === "string" && x.id
                ? x.id
                : `${slugify(x.l2)}::${slugify(x.l3)}`,
            l2: x.l2,
            l3: x.l3,
            fteOnshore: numOr(x.fteOnshore, 0),
            fteOffshore: numOr(x.fteOffshore, 0),
            contractorOnshore: numOr(x.contractorOnshore, 0),
            contractorOffshore: numOr(x.contractorOffshore, 0),
          };
          const sp = optNum(x.annualSpendUsd);
          if (sp != null && sp > 0) out.annualSpendUsd = sp;
          const off = optNum(x.offshoreAssessmentPct);
          if (off != null) out.offshoreAssessmentPct = clamp01Pct(off);
          const ai = optNum(x.aiImpactAssessmentPct);
          if (ai != null) out.aiImpactAssessmentPct = clamp01Pct(ai);
          if (Array.isArray(x.l4Activities)) {
            const names = (x.l4Activities as unknown[])
              .filter((n): n is string => typeof n === "string" && n.trim().length > 0)
              .map((n) => n.trim());
            if (names.length > 0) out.l4Activities = names;
          }
          return out;
        })
        .filter((r): r is L3WorkforceRow => r != null);
    } else {
      // Legacy v2/v3 shape — group L4 rows into L3 rows.
      const legacyRows = Array.isArray(v.l4Rows)
        ? (v.l4Rows as unknown[]).filter(
            (x): x is LegacyL4Row => x != null && typeof x === "object",
          )
        : [];
      l3Rows = groupLegacyL4RowsToL3(legacyRows);
    }

    towers[k as TowerId] = {
      l3Rows,
      baseline,
      status,
      lastUpdated:
        typeof v.lastUpdated === "string" ? v.lastUpdated : undefined,
      capabilityMapConfirmedAt:
        typeof v.capabilityMapConfirmedAt === "string"
          ? v.capabilityMapConfirmedAt
          : undefined,
      headcountConfirmedAt:
        typeof v.headcountConfirmedAt === "string" ? v.headcountConfirmedAt : undefined,
      offshoreConfirmedAt:
        typeof v.offshoreConfirmedAt === "string" ? v.offshoreConfirmedAt : undefined,
      aiConfirmedAt:
        typeof v.aiConfirmedAt === "string" ? v.aiConfirmedAt : undefined,
    };
  }

  return { version: 4, towers, global };
}

export function getAssessProgram(): AssessProgramV2 {
  const raw = safeGet<unknown>(KEYS.assessProgram, buildSeededAssessProgramV2());
  return migrateBuggySeedComplete(migrateAssessProgram(raw));
}

/**
 * Group a flat list of legacy per-L4 records into the new per-L3 shape. Used
 * by file-import flows (`assessProgramIO`) so JSON exports written before V4
 * still load cleanly.
 */
export function groupL4RowsToL3RowsForImport(
  rows: ReadonlyArray<unknown>,
): L3WorkforceRow[] {
  return groupLegacyL4RowsToL3(
    rows.filter((x): x is LegacyL4Row => x != null && typeof x === "object"),
  );
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
          l3Rows: patch.l3Rows ?? cur.l3Rows,
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
  // Stored historically as a raw string; safeGet wraps in JSON.parse, so we
  // read with a manual fallback for the legacy raw value.
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
      // Match the legacy storage format (raw string, not JSON-encoded).
      window.localStorage.setItem(KEYS.persona, p);
    }
    emit(KEYS.persona);
  } catch {
    /* noop */
  }
}

export const LOCAL_STORE_KEYS = KEYS;
