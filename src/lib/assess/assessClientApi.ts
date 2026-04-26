import type { AssessProgramV2, TowerId } from "@/data/assess/types";

export type InferDefaultsRow = { l2: string; l3: string; l4: string };

export type InferredDefault = {
  offshorePct: number;
  aiPct: number;
  rationale?: string;
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
  | { ok: true; program: null; db: "unconfigured" };

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
 * Asks the server to score a tower's L4 rows for offshorePct + aiPct. Server
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
