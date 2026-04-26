import type { AssessProgramV2 } from "@/data/assess/types";

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
