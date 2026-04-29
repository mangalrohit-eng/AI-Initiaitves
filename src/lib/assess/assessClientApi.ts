import type {
  AssessProgramV2,
  GeneratedProcessCache,
  L4Item,
  TowerId,
} from "@/data/assess/types";

export type InferDefaultsRow = { l2: string; l3: string };

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

export async function clientGetAssess(): Promise<{
  ok: boolean;
  data?: GetAssessResponse;
  error?: string;
  status: number;
}> {
  const res = await fetch("/api/assess", { method: "GET", credentials: "same-origin" });
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
  const res = await fetch("/api/assess", {
    method: "PUT",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(program),
  });
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

// ----- L4 activity generation ------------------------------------------

export type GenerateL4ActivitiesRow = {
  l2: string;
  l3: string;
};

export type GeneratedL4Group = {
  l2: string;
  l3: string;
  activities: string[];
};

export type GenerateL4ActivitiesSource = "llm" | "fallback";

export type GenerateL4ActivitiesResult = {
  source: GenerateL4ActivitiesSource;
  groups: GeneratedL4Group[];
  warning?: string;
};

/**
 * Asks the server to generate plausible L4 activity names for each L3 row.
 * Used by the Capability Map page after a tower lead uploads an L2/L3 template
 * — the heuristic + LLM fill in the activity list so the map below the L3 has
 * something to display. Generated lists are persisted via `l4Activities`.
 *
 * On any LLM failure the server returns a deterministic canonical-map-derived
 * fallback so the action never blocks the program.
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

// ----- L4 initiative curation (verdict + summary) ----------------------

export type CurateInitiativesRowInput = {
  /** L3 row id — round-tripped so the client can match results back without name fuzzing. */
  rowId: string;
  l2: string;
  l3: string;
  /** L4 activity names. The LLM scores one verdict + one summary per name. */
  l4Activities: string[];
};

/**
 * Server-shaped per-L4 curation. Mirrors the rich `L4Item` fields the LLM
 * is allowed to fill — `id` / `source` / `name` are stamped client-side
 * after the response lands so the server can stay stateless. `briefSlug`
 * and `initiativeId` are NEVER set by the LLM (overlay-only).
 */
export type CuratedL4 = Pick<
  L4Item,
  | "name"
  | "aiCurationStatus"
  | "aiEligible"
  | "aiPriority"
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
  l4Items: CuratedL4[];
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
): Promise<
  | { ok: true; result: CurateInitiativesResult }
  | { ok: false; error: string; status: number }
> {
  const res = await fetch("/api/assess/curate-initiatives", {
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
  l2: string;
  l3: string;
  l4Name: string;
  /** Stable L4 id for synthetic `Process.id` and cache keys. */
  l4Id: string;
  aiRationale: string;
  agentOneLine?: string;
  primaryVendor?: string;
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
