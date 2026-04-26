export type PortalAudience = "client" | "internal" | "full";

/** Reads `NEXT_PUBLIC_PORTAL_AUDIENCE` (default `full`). Server and client safe. */
export function getPortalAudience(): PortalAudience {
  const raw =
    typeof process !== "undefined" && process.env.NEXT_PUBLIC_PORTAL_AUDIENCE
      ? process.env.NEXT_PUBLIC_PORTAL_AUDIENCE.toLowerCase().trim()
      : "full";
  if (raw === "client" || raw === "internal" || raw === "full") return raw;
  return "full";
}

export function isAudienceMatch(
  productAudience: "client" | "internal" | "both",
  mode: PortalAudience,
): boolean {
  if (mode === "full") return true;
  if (productAudience === "both") return true;
  return productAudience === mode;
}

export function isInternalSurfaceAllowed(mode: PortalAudience): boolean {
  return mode === "internal" || mode === "full";
}
