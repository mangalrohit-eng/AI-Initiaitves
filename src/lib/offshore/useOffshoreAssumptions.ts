"use client";

import * as React from "react";
import {
  getAssessProgram,
  getAssessProgramHydrationSnapshot,
  setOffshoreAssumptions,
  subscribe,
  updateAssessProgram,
} from "@/lib/localStore";
import {
  DEFAULT_OFFSHORE_ASSUMPTIONS,
  type AssessProgramV2,
  type ContactCenterHub,
  type IndianGccCity,
  type OffshoreAssumptions,
} from "@/data/assess/types";

export type UseOffshoreAssumptionsApi = {
  assumptions: OffshoreAssumptions;
  /** Distinct from defaults — drives the "Custom" indicator in the UI. */
  isDefault: boolean;
  setPrimaryGcc: (city: IndianGccCity) => void;
  setSecondaryGcc: (city: IndianGccCity) => void;
  setContactCenterHub: (hub: ContactCenterHub) => void;
  /** Drop the program-level overlay so reads return defaults again. */
  resetToDefaults: () => void;
};

/**
 * Step-5 GCC location store hook. Reads `program.offshoreAssumptions`
 * (defaulting to `DEFAULT_OFFSHORE_ASSUMPTIONS`) and exposes typed setters
 * that route through `setOffshoreAssumptions` — the AssessSyncProvider
 * debounces and flushes to the server.
 */
export function useOffshoreAssumptions(): UseOffshoreAssumptionsApi {
  const [program, setProgram] = React.useState<AssessProgramV2>(() =>
    getAssessProgramHydrationSnapshot(),
  );
  React.useEffect(() => {
    setProgram(getAssessProgram());
    return subscribe("assessProgram", () => setProgram(getAssessProgram()));
  }, []);

  const assumptions = program.offshoreAssumptions ?? DEFAULT_OFFSHORE_ASSUMPTIONS;
  const isDefault =
    assumptions.primaryGccCity === DEFAULT_OFFSHORE_ASSUMPTIONS.primaryGccCity &&
    assumptions.secondaryGccCity === DEFAULT_OFFSHORE_ASSUMPTIONS.secondaryGccCity &&
    assumptions.contactCenterHub === DEFAULT_OFFSHORE_ASSUMPTIONS.contactCenterHub;

  const setPrimaryGcc = React.useCallback((city: IndianGccCity) => {
    // Validation: secondary must differ from primary. If the user picks the
    // current secondary as primary, swap them so we never enter an invalid
    // state.
    const cur =
      getAssessProgram().offshoreAssumptions ?? DEFAULT_OFFSHORE_ASSUMPTIONS;
    if (cur.primaryGccCity === city) return;
    const patch: Partial<OffshoreAssumptions> = { primaryGccCity: city };
    if (cur.secondaryGccCity === city) {
      patch.secondaryGccCity = cur.primaryGccCity;
    }
    setOffshoreAssumptions(patch);
  }, []);

  const setSecondaryGcc = React.useCallback((city: IndianGccCity) => {
    const cur =
      getAssessProgram().offshoreAssumptions ?? DEFAULT_OFFSHORE_ASSUMPTIONS;
    if (cur.secondaryGccCity === city) return;
    const patch: Partial<OffshoreAssumptions> = { secondaryGccCity: city };
    if (cur.primaryGccCity === city) {
      patch.primaryGccCity = cur.secondaryGccCity;
    }
    setOffshoreAssumptions(patch);
  }, []);

  const setContactCenterHub = React.useCallback((hub: ContactCenterHub) => {
    setOffshoreAssumptions({ contactCenterHub: hub });
  }, []);

  const resetToDefaults = React.useCallback(() => {
    updateAssessProgram((p) => {
      const { offshoreAssumptions: _drop, ...rest } = p;
      void _drop;
      return rest as AssessProgramV2;
    });
  }, []);

  return {
    assumptions,
    isDefault,
    setPrimaryGcc,
    setSecondaryGcc,
    setContactCenterHub,
    resetToDefaults,
  };
}
