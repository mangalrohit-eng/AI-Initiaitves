import type {
  AssessProgramV2,
  GeneratedProcessCache,
  L4Item,
  TowerId,
} from "@/data/assess/types";

export type InferDefaultsRow = {
  /** L2 Job Grouping (prompt context). */
  l2: string;
  /** L3 Job Family (prompt context). */
  l3: string;
  /**
   * L4 Activity Group — the row whose dial pair (offshore + AI) is being
   * scored. Optional only for back-compat: legacy v4 callers omit this and
   * the server treats `l3` as the dial-row label.
   */
  l4?: string;
};

export type InferredDefault = {
  offshorePct: number;
  aiPct: number;
  /** ≤15-word LLM rationale for the offshore dial. Only present on `source: "llm"`. */
  offshoreRationale?: string;
  /** ≤15-word LLM rationale for the AI-impact dial. Only present on `source: "llm"`. */
  aiRationale?: string;
};

export type InferDefaultsSource = "llm" | "heuristic";

export type InferDefaultsResult = {
  source: InferDefaultsSource;
  defaults: InferredDefault[];
  warning?: string;
};

export type GetAssessResponse =
  | { ok: true; program: AssessProgramV2; db: "ok"; updatedAt: string | null }
  | { ok: true; program: null; db: "ok"; updatedAt: null }
  | { ok: true; program: null; db: "unconfigured" }
  /** DATABASE_URL is set but Postgres could not be reached (timeout, DNS, refused, etc.). */
  | { ok: true; program: null; db: "unavailable" };

export type AdminSessionStatusResponse = {
  ok: true;
  isAdmin: boolean;
  configured: boolean;
};

export async function clientGetAssess(): Promise<{
  ok: boolean;
  data?: GetAssessResponse;
  error?: string;
  status: number;
}> {
  let res: Response;
  try {
    res = await fetch("/api/assess", { method: "GET", credentials: "same-origin" });
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    const hint =
      raw === "Failed to fetch" || raw.includes("NetworkError")
        ? "Could not reach /api/assess (network). Confirm the Next dev server is running and you opened the app via http://localhost, not a file URL."
        : raw;
    return { ok: false, error: hint, status: 0 };
  }
  const text = await res.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    return { ok: false, error: "Invalid response", status: res.status };
  }
  if (!res.ok) {
    const err = (body as { error?: string })?.error ?? res.statusText;
    return { ok: false, error: err, status: res.status };
  }
  return { ok: true, data: body as GetAssessResponse, status: res.status };
}

export async function clientPutAssess(program: AssessProgramV2): Promise<{
  ok: boolean;
  error?: string;
  status: number;
}> {
  let res: Response;
  try {
    res = await fetch("/api/assess", {
      method: "PUT",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(program),
    });
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    const hint =
      raw === "Failed to fetch" || raw.includes("NetworkError")
        ? "Could not reach /api/assess (network). Confirm the Next dev server is running."
        : raw;
    return { ok: false, error: hint, status: 0 };
  }
  const text = await res.text();
  let body: { error?: string } = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    /* noop */
  }
  if (!res.ok) {
    return { ok: false, error: body.error ?? res.statusText, status: res.status };
  }
  return { ok: true, status: res.status };
}

export async function clientGetAdminSessionStatus(): Promise<{
  ok: boolean;
  data?: AdminSessionStatusResponse;
  error?: string;
  status: number;
}> {
  let res: Response;
  try {
    res = await fetch("/api/login/admin/session", {
      method: "GET",
      credentials: "same-origin",
    });
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    return { ok: false, error: raw, status: 0 };
  }
  const text = await res.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    return { ok: false, error: "Invalid response", status: res.status };
  }
  if (!res.ok) {
    const err = (body as { error?: string })?.error ?? res.statusText;
    return { ok: false, error: err, status: res.status };
  }
  const data = body as { ok?: boolean; isAdmin?: boolean; configured?: boolean };
  if (!data.ok || typeof data.isAdmin !== "boolean" || typeof data.configured !== "boolean") {
    return { ok: false, error: "Malformed admin session response", status: res.status };
  }
  return {
    ok: true,
    data: { ok: true, isAdmin: data.isAdmin, configured: data.configured },
    status: res.status,
  };
}

/**
 * Asks the server to score a tower's L3 rows for offshorePct + aiPct. Server
 * tries OpenAI first when OPENAI_API_KEY is set; falls back to the
 * deterministic heuristic. The response always includes one default per input
 * row, in order. `source` tells you which path won.
 */
export async function clientInferTowerDefaults(
  towerId: TowerId,
  rows: InferDefaultsRow[],
): Promise<{ ok: true; result: InferDefaultsResult } | { ok: false; error: string; status: number }> {
  const res = await fetch("/api/assess/infer-defaults", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ towerId, rows }),
  });
  const text = await res.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    return { ok: false, error: "Invalid response", status: res.status };
  }
  if (!res.ok) {
    const err = (body as { error?: string })?.error ?? res.statusText;
    return { ok: false, error: err, status: res.status };
  }
  const data = body as {
    ok?: boolean;
    source?: InferDefaultsSource;
    defaults?: InferredDefault[];
    warning?: string;
  };
  if (!data.ok || !Array.isArray(data.defaults) || !data.source) {
    return { ok: false, error: "Malformed defaults response", status: res.status };
  }
  return {
    ok: true,
    result: {
      source: data.source,
      defaults: data.defaults,
      warning: data.warning,
    },
  };
}

// ----- L5 Activity generation ------------------------------------------
// Wire type names retain the historic `L4` suffix to avoid re-versioning
// the API surface mid-cutover. After the 5-layer migration the semantics
// are: L2 = Job Grouping, L3 = Job Family, L4 = Activity Group (the row
// being scored), and the returned `activities[]` are L5 Activity names.

export type GenerateL4ActivitiesRow = {
  /** L2 Job Grouping (prompt context). */
  l2: string;
  /** L3 Job Family (prompt context). */
  l3: string;
  /**
   * L4 Activity Group — the row whose L5 Activities the server should
   * generate. Optional only for back-compat: legacy v4 callers omit this
   * and the server treats `l3` as the parent.
   */
  l4?: string;
  /**
   * Optional qualitative feedback to steer the activity list (per-row
   * "Refine + regenerate" affordance on Step 4). Server clamps to ≤600 chars.
   */
  feedback?: string;
};

export type GeneratedL4Group = {
  l2: string;
  l3: string;
  /** L4 Activity Group; empty string for legacy v4 callers. */
  l4: string;
  /** L5 Activity names under the Activity Group. */
  activities: string[];
};

export type GenerateL4ActivitiesSource = "llm" | "fallback";

export type GenerateL4ActivitiesResult = {
  source: GenerateL4ActivitiesSource;
  groups: GeneratedL4Group[];
  warning?: string;
};

/**
 * Asks the server to generate plausible L5 Activity names for each L4
 * Activity Group row. Used by the Capability Map page after a tower lead
 * uploads an L2/L3/L4 template — the heuristic + LLM fill in the activity
 * list so the map below each Activity Group has something concrete to
 * display. Generated lists are persisted via `L4WorkforceRow.l5Activities`.
 *
 * On any LLM failure the server returns a deterministic canonical-map-
 * derived fallback so the action never blocks the program.
 */
export async function clientGenerateL4Activities(
  towerId: TowerId,
  rows: GenerateL4ActivitiesRow[],
): Promise<
  | { ok: true; result: GenerateL4ActivitiesResult }
  | { ok: false; error: string; status: number }
> {
  const res = await fetch("/api/assess/generate-l4", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ towerId, rows }),
  });
  const text = await res.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    return { ok: false, error: "Invalid response", status: res.status };
  }
  if (!res.ok) {
    const err = (body as { error?: string })?.error ?? res.statusText;
    return { ok: false, error: err, status: res.status };
  }
  const data = body as {
    ok?: boolean;
    source?: GenerateL4ActivitiesSource;
    groups?: GeneratedL4Group[];
    warning?: string;
  };
  if (!data.ok || !Array.isArray(data.groups) || !data.source) {
    return { ok: false, error: "Malformed L4 generation response", status: res.status };
  }
  return {
    ok: true,
    result: {
      source: data.source,
      groups: data.groups,
      warning: data.warning,
    },
  };
}

// ----- L5 Activity initiative curation (verdict + summary) -------------
// Naming note: the wire types still use the historic `CurateInitiatives*`
// / `CuratedL4` names so we don't have to re-version the API surface mid-
// migration. After the 5-layer cutover the field semantics are:
//   - `l2` -> Job Grouping (the dummy wrapper we stamp at seed time).
//   - `l3` -> Job Family (was Pillar pre-migration).
//   - `l4` -> Activity Group (was Capability pre-migration). REQUIRED for
//             accurate scoring — without it the LLM and the deterministic
//             rubric both misclassify the L5 leaves because they lose the
//             most informative grandparent → parent → leaf context.
//   - `l5Activities` -> L5 Activity names (was `l4Activities`).
//   - `l5Items` -> per-L5-Activity curation results (was `l4Items`).
// The deprecated `l4Activities` / `l4Items` aliases are retained
// transitionally so any in-flight requests during the cutover still parse.

export type CurateInitiativesRowInput = {
  /** L4 Activity-Group row id — round-tripped so the client can match results back without name fuzzing. */
  rowId: string;
  /** L2 Job Grouping label (for prompt context). */
  l2: string;
  /** L3 Job Family label (for prompt context). */
  l3: string;
  /**
   * L4 Activity Group label (the dial-bearing row the L5 Activities sit
   * under). Optional only for legacy callers that haven't been swept yet —
   * server falls back to using `l3` as the parent if absent, which loses
   * scoring fidelity.
   */
  l4?: string;
  /** L5 Activity names. The LLM scores one verdict + one summary per name. */
  l5Activities: string[];
  /**
   * Optional qualitative feedback to steer the curation (per-L4 "Refine +
   * regenerate" affordance on Step 4). Server clamps to ≤600 chars.
   */
  feedback?: string;
};

/**
 * Server-shaped per-L5 curation. Mirrors the rich `L5Item` fields the LLM
 * is allowed to fill — `id` / `source` / `name` are stamped client-side
 * after the response lands so the server can stay stateless. `briefSlug`
 * and `initiativeId` are NEVER set by the LLM (overlay-only).
 *
 * NOTE: kept the historic name `CuratedL4` to minimise the surface-area
 * churn; the shape now describes a curated L5 Activity record.
 */
export type CuratedL4 = Pick<
  L4Item,
  | "name"
  | "aiCurationStatus"
  | "aiEligible"
  | "feasibility"
  | "aiRationale"
  | "notEligibleReason"
  | "frequency"
  | "criticality"
  | "currentMaturity"
  | "primaryVendor"
  | "agentOneLine"
>;

export type CuratedRow = {
  rowId: string;
  /** Per-L5-Activity curation results. */
  l5Items: CuratedL4[];
};

export type CurateInitiativesSource = "llm" | "fallback";

export type CurateInitiativesResult = {
  source: CurateInitiativesSource;
  rows: CuratedRow[];
  warning?: string;
};

/**
 * Asks the server to score every L4 on every queued row in a single batched
 * call — verdict + Versant-grounded summary content. Returns one
 * `CuratedRow` per input row, one `CuratedL4` per L4 name. The client owns
 * stamping `L4Item.id` (deterministic hash), `source` (`"llm"` /
 * `"fallback"`), and the click-through `briefSlug` / `initiativeId`
 * overlay match. Falls back to deterministic verdict composition on any
 * LLM failure — mirrors the contract of `/api/assess/infer-defaults`.
 */
export async function clientCurateInitiatives(
  towerId: TowerId,
  rows: CurateInitiativesRowInput[],
  opts?: { towerIntakeDigest?: string },
): Promise<
  | { ok: true; result: CurateInitiativesResult }
  | { ok: false; error: string; status: number }
> {
  const res = await fetch("/api/assess/curate-initiatives", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      towerId,
      rows,
      ...(opts?.towerIntakeDigest ? { towerIntakeDigest: opts.towerIntakeDigest } : {}),
    }),
  });
  const text = await res.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    return { ok: false, error: "Invalid response", status: res.status };
  }
  if (!res.ok) {
    const err = (body as { error?: string })?.error ?? res.statusText;
    return { ok: false, error: err, status: res.status };
  }
  const data = body as {
    ok?: boolean;
    source?: CurateInitiativesSource;
    rows?: CuratedRow[];
    warning?: string;
  };
  if (!data.ok || !Array.isArray(data.rows) || !data.source) {
    return { ok: false, error: "Malformed curation response", status: res.status };
  }
  return {
    ok: true,
    result: {
      source: data.source,
      rows: data.rows,
      warning: data.warning,
    },
  };
}

// ----- Lazy AIProcessBrief generation ----------------------------------

export type CurateBriefInput = {
  towerId: TowerId;
  /** L2 Job Grouping (5-layer map). */
  l2: string;
  /** L3 Job Family (5-layer map). */
  l3: string;
  /**
   * L4 Activity Group — parent of the L5 Activity being briefed. Optional
   * for back-compat with legacy V4 callers.
   */
  l4?: string;
  /**
   * Display label for the leaf being briefed. Under V5 this is the **L5
   * Activity** name; field name preserved for wire-format back-compat.
   */
  l4Name: string;
  /**
   * Stable id for the leaf being briefed (V5: L5 Activity id) — used for
   * synthetic `Process.id` and cache keys.
   */
  l4Id: string;
  aiRationale: string;
  agentOneLine?: string;
  primaryVendor?: string;
  /** Optional tower AI readiness digest for Workbench / Digital Core grounding. */
  towerIntakeDigest?: string;
};

export type CurateBriefSource = "llm" | "fallback";

export type CurateBriefResult = {
  source: CurateBriefSource;
  generatedProcess: GeneratedProcessCache;
  warning?: string;
};

/**
 * Asks the server to generate a Versant-grounded full `Process` for a single
 * LLM-curated L4. Called lazily by the LLM-brief page on the user's first
 * click; the result is cached on `L4Item.generatedProcess` and flows through
 * `localStore` + `assess_workshop` persistence.
 */
export async function clientCurateBrief(
  input: CurateBriefInput,
): Promise<
  | { ok: true; result: CurateBriefResult }
  | { ok: false; error: string; status: number }
> {
  const res = await fetch("/api/assess/curate-brief", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const text = await res.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    return { ok: false, error: "Invalid response", status: res.status };
  }
  if (!res.ok) {
    const err = (body as { error?: string })?.error ?? res.statusText;
    return { ok: false, error: err, status: res.status };
  }
  const data = body as {
    ok?: boolean;
    source?: CurateBriefSource;
    generatedProcess?: GeneratedProcessCache;
    warning?: string;
  };
  if (!data.ok || !data.generatedProcess || !data.source) {
    return { ok: false, error: "Malformed curate-brief response", status: res.status };
  }
  return {
    ok: true,
    result: {
      source: data.source,
      generatedProcess: data.generatedProcess,
      warning: data.warning,
    },
  };
}
