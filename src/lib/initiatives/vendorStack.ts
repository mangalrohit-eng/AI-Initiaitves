import type { CommittedVendor } from "@/data/types";

/**
 * Split a `primaryVendor` string into the individual named vendors.
 *
 * The curator LLM is told to use ` + ` as the separator between stack
 * components ("BlackLine + HighRadius"); we also tolerate `,` and `&`
 * as legacy separators in case older cached entries used them.
 *
 * Returns an empty array for `undefined` / "TBD …" placeholders so
 * those don't pollute downstream lookups (filters, confirmation
 * checks, etc.).
 *
 * Previously lived locally in `SolutionsGallery`; lifted here so the
 * deep-dive page's committed-vendor check uses byte-identical
 * splitting semantics.
 */
export function splitVendors(s: string | undefined): string[] {
  if (!s) return [];
  const cleaned = s.trim();
  if (!cleaned) return [];
  if (/^TBD/i.test(cleaned)) return [];
  return cleaned
    .split(/\s*[+,&]\s*/g)
    .map((v) => v.trim())
    .filter((v) => v.length > 0 && !/^TBD/i.test(v));
}

export type VendorConfirmation = {
  /**
   * True only when *every* component of the vendor stack matches a
   * `CommittedVendor.vendor` for this tower. Partial matches stay
   * `false` — confirming part of a stack is not the same as Versant
   * having procured the full solution.
   */
  confirmed: boolean;
  /**
   * The `capability` values from the matching `CommittedVendor`
   * entries, deduped and in insertion order. Used by the deep-dive
   * pill tooltip to surface the audit trail (e.g.,
   * `"Confirmed pick for: Close orchestration"`).
   */
  matchedCapabilities: string[];
};

/**
 * Decide whether `primaryVendor` is a Versant-confirmed pick (renders
 * definitively in the UI) or an illustrative anchor (renders as
 * "Indicative vendor · …").
 *
 * Confirmation is **all-or-nothing per stack** — see `VendorConfirmation.confirmed`
 * for the rationale.
 */
export function isVendorConfirmed(
  primaryVendor: string | undefined,
  committed: CommittedVendor[] | undefined,
): VendorConfirmation {
  const empty: VendorConfirmation = {
    confirmed: false,
    matchedCapabilities: [],
  };
  const components = splitVendors(primaryVendor);
  if (components.length === 0) return empty;
  if (!committed || committed.length === 0) return empty;

  const byVendor = new Map<string, string>();
  for (const c of committed) {
    if (!c.vendor || !c.capability) continue;
    byVendor.set(c.vendor.trim().toLowerCase(), c.capability);
  }
  if (byVendor.size === 0) return empty;

  const matched: string[] = [];
  for (const comp of components) {
    const cap = byVendor.get(comp.toLowerCase());
    if (!cap) return empty;
    if (!matched.includes(cap)) matched.push(cap);
  }

  return { confirmed: true, matchedCapabilities: matched };
}
