/**
 * Step-5 (Offshore Plan) — single source of truth for GCC city labels.
 *
 * Reads `program.offshoreAssumptions` (defaulting to Bangalore + Pune + Manila)
 * and exposes pre-formatted strings + a destination-resolver. Every narrative
 * component on `/offshore-plan` imports from here — no hardcoded city names
 * outside this helper and the Assumptions tab (where the user picks them).
 *
 * Why a helper instead of reading `program.offshoreAssumptions` directly:
 *   - Centralizes the default-fallback so callers don't repeat
 *     `program.offshoreAssumptions ?? DEFAULT_OFFSHORE_ASSUMPTIONS`.
 *   - Provides composed strings the narrative needs ("Bangalore + Pune",
 *     "Bangalore + Pune + Manila") so changes propagate uniformly.
 *   - Resolves the role-based `GccDestination` enum to the configured city.
 */
import type {
  AssessProgramV2,
  ContactCenterHub,
  IndianGccCity,
  OffshoreAssumptions,
} from "@/data/assess/types";
import { DEFAULT_OFFSHORE_ASSUMPTIONS } from "@/data/assess/types";
import type { GccDestination } from "@/lib/offshore/selectOffshorePlan";

export type OffshoreLocationLabels = {
  /** Primary GCC city — e.g., "Bangalore". */
  primary: IndianGccCity;
  /** Secondary GCC city — e.g., "Pune". */
  secondary: IndianGccCity;
  /** Contact-center hub — e.g., "Manila", or "None" when disabled. */
  hub: ContactCenterHub;
  /** Composed string: "Bangalore + Pune". */
  primaryAndSecondary: string;
  /**
   * Composed string: "Bangalore + Pune + Manila" (with hub),
   * "Bangalore + Pune" when hub is "None".
   */
  allThree: string;
  /** "Manila contact center" — the hub line item with role suffix. */
  hubWithRole: string;
  /** Pretty-print a destination enum to a human-readable city label. */
  cityForDestination: (dest: GccDestination) => string;
  /** Whether a contact-center hub is configured (false when hub === "None"). */
  hasHub: boolean;
  /** Direct underlying assumption object — for components that need raw values. */
  assumptions: OffshoreAssumptions;
};

/**
 * Resolve the configured location labels for a program. Defaults to the
 * canonical Bangalore + Pune + Manila trio when the program has no
 * `offshoreAssumptions` overlay.
 */
export function offshoreLocationLabels(
  program: AssessProgramV2,
): OffshoreLocationLabels {
  const assumptions = program.offshoreAssumptions ?? DEFAULT_OFFSHORE_ASSUMPTIONS;
  return labelsFromAssumptions(assumptions);
}

/**
 * Variant for callers that already hold an `OffshoreAssumptions` value
 * (e.g., the Assumptions tab while previewing an unsaved change).
 */
export function labelsFromAssumptions(
  assumptions: OffshoreAssumptions,
): OffshoreLocationLabels {
  const { primaryGccCity, secondaryGccCity, contactCenterHub } = assumptions;
  const hasHub = contactCenterHub !== "None";

  const primaryAndSecondary = `${primaryGccCity} + ${secondaryGccCity}`;
  const allThree = hasHub
    ? `${primaryAndSecondary} + ${contactCenterHub}`
    : primaryAndSecondary;
  const hubWithRole = hasHub ? `${contactCenterHub} contact center` : "None";

  return {
    primary: primaryGccCity,
    secondary: secondaryGccCity,
    hub: contactCenterHub,
    primaryAndSecondary,
    allThree,
    hubWithRole,
    hasHub,
    assumptions,
    cityForDestination: (dest: GccDestination) => {
      switch (dest) {
        case "PrimaryGcc":
          return primaryGccCity;
        case "SecondaryGcc":
          return secondaryGccCity;
        case "ContactCenterHub":
          return hasHub ? contactCenterHub : primaryGccCity;
        case "OnshoreRetained":
          return "Onshore retained";
      }
    },
  };
}
