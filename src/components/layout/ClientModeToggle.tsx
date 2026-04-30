"use client";

import * as React from "react";
import { Shield, ShieldCheck } from "lucide-react";
import { useClientMode } from "@/lib/clientMode";

/**
 * Discreet top-nav button that toggles between Normal and Protected
 * presentation. Icon-only by design — the active state is communicated
 * through colour and a subtle indicator dot, not a visible label, so a
 * client looking at the screen has no obvious cue that an alternate view
 * exists. The accessible label is delivered through the `title` and
 * `aria-pressed` attributes.
 */
export function ClientModeToggle() {
  const { clientMode, mounted, toggleClientMode } = useClientMode();
  const isOn = mounted && clientMode;

  return (
    <button
      type="button"
      onClick={toggleClientMode}
      aria-pressed={isOn}
      aria-label={isOn ? "Switch to Normal mode" : "Switch to Protected mode"}
      title={isOn ? "Protected mode" : "Normal mode"}
      className={
        "relative inline-flex h-9 w-9 items-center justify-center rounded-md border transition " +
        (isOn
          ? "border-accent-purple/40 bg-accent-purple/10 text-accent-purple-dark hover:bg-accent-purple/20"
          : "border-forge-border bg-forge-surface text-forge-subtle hover:border-accent-purple/30 hover:text-accent-purple-dark")
      }
    >
      {isOn ? (
        <ShieldCheck className="h-4 w-4" aria-hidden />
      ) : (
        <Shield className="h-4 w-4" aria-hidden />
      )}
      {isOn ? (
        <span
          className="absolute -right-0.5 -top-0.5 inline-flex h-2 w-2 rounded-full bg-accent-purple ring-2 ring-forge-surface"
          aria-hidden
        />
      ) : null}
    </button>
  );
}
