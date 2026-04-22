// Compact, shareable annotation payloads encoded into a single URL parameter.
//
// We choose base64url over a JSON query string for two reasons:
//   - survives paste flows (Teams/Outlook auto-link detection) better
//   - keeps the text to the right of `?annot=` unambiguous and terse
//
// Shape is intentionally small and versioned so we can evolve without
// breaking older links floating around inboxes.

export const ANNOTATION_QUERY_PARAM = "annot";
export const ANNOTATION_MAX_TEXT = 400;

export type AnnotationPayload = {
  // Payload schema version. Increment + branch when the shape changes.
  v: 1;
  // Stable anchor key — matches `data-annot-anchor` on the target element.
  a: string;
  // Human text (<= ANNOTATION_MAX_TEXT chars once normalised).
  t: string;
  // Author display name. Optional — empty string when the viewer hasn't
  // set a name yet.
  u?: string;
  // ISO timestamp the annotation was composed at.
  ts: string;
};

function toBase64Url(input: string): string {
  if (typeof window === "undefined") {
    // Node path — only hit during build or server components.
    return Buffer.from(input, "utf8")
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
  }
  const bytes = new TextEncoder().encode(input);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return window
    .btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(input: string): string {
  const padded = input
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(input.length / 4) * 4, "=");
  if (typeof window === "undefined") {
    return Buffer.from(padded, "base64").toString("utf8");
  }
  const binary = window.atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function encodeAnnotation(p: Omit<AnnotationPayload, "v" | "ts"> & { ts?: string }): string {
  const payload: AnnotationPayload = {
    v: 1,
    a: p.a,
    t: p.t.slice(0, ANNOTATION_MAX_TEXT),
    u: p.u?.trim() || undefined,
    ts: p.ts ?? new Date().toISOString(),
  };
  return toBase64Url(JSON.stringify(payload));
}

export function decodeAnnotation(raw: string): AnnotationPayload | null {
  try {
    const json = fromBase64Url(raw);
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== "object") return null;
    if (parsed.v !== 1) return null;
    if (typeof parsed.a !== "string" || typeof parsed.t !== "string") return null;
    return {
      v: 1,
      a: parsed.a,
      t: String(parsed.t).slice(0, ANNOTATION_MAX_TEXT),
      u: typeof parsed.u === "string" ? parsed.u : undefined,
      ts: typeof parsed.ts === "string" ? parsed.ts : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

// Produces a shareable URL for the current page with the annotation attached.
// Preserves any other query params already on the URL.
export function buildAnnotationUrl(baseUrl: string, payload: Omit<AnnotationPayload, "v" | "ts"> & { ts?: string }): string {
  try {
    const url = new URL(baseUrl);
    url.searchParams.set(ANNOTATION_QUERY_PARAM, encodeAnnotation(payload));
    return url.toString();
  } catch {
    // Fallback for malformed base URLs (e.g. during SSR when window.location is unset).
    const sep = baseUrl.includes("?") ? "&" : "?";
    return `${baseUrl}${sep}${ANNOTATION_QUERY_PARAM}=${encodeAnnotation(payload)}`;
  }
}
