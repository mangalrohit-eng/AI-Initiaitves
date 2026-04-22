"use client";

import * as React from "react";
import { Pin, PinOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { isPinned, togglePin, type PinKind, type PinRef, subscribe } from "@/lib/localStore";

type Props = {
  kind: PinKind;
  id: string;
  href: string;
  title: string;
  subtitle?: string;
  variant?: "chip" | "icon";
  className?: string;
};

export function PinButton({
  kind,
  id,
  href,
  title,
  subtitle,
  variant = "chip",
  className,
}: Props) {
  // SSR-safe: always render the unpinned state on the server, hydrate state
  // from localStorage on the client inside useEffect.
  const [pinned, setPinned] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  const recompute = React.useCallback(() => {
    setPinned(isPinned(kind, id));
  }, [kind, id]);

  React.useEffect(() => {
    setMounted(true);
    recompute();
    return subscribe("pins", recompute);
  }, [recompute]);

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    togglePin({ kind, id, href, title, subtitle });
  }

  const label = pinned ? "Remove from My program" : "Add to My program";

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={handleClick}
        aria-label={label}
        aria-pressed={mounted ? pinned : undefined}
        className={cn(
          "inline-flex h-8 w-8 items-center justify-center rounded-full border border-forge-border bg-forge-surface text-forge-subtle shadow-sm transition hover:border-accent-purple/40 hover:text-accent-purple-dark",
          mounted && pinned
            ? "border-accent-purple/60 bg-accent-purple/10 text-accent-purple-dark"
            : "",
          className,
        )}
      >
        {mounted && pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={label}
      aria-pressed={mounted ? pinned : undefined}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border bg-forge-surface px-3 py-1.5 text-xs font-medium shadow-sm transition",
        mounted && pinned
          ? "border-accent-purple/50 bg-accent-purple/10 text-accent-purple-dark"
          : "border-forge-border text-forge-body hover:border-accent-purple/40 hover:text-accent-purple-dark",
        className,
      )}
    >
      {mounted && pinned ? (
        <>
          <PinOff className="h-3.5 w-3.5" />
          Pinned
        </>
      ) : (
        <>
          <Pin className="h-3.5 w-3.5" />
          Pin
        </>
      )}
    </button>
  );
}

// Re-export the type so consumers that only want the shape don't need to
// import from `localStore` directly.
export type { PinRef };
