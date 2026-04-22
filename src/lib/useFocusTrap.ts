"use client";

import * as React from "react";

const FOCUSABLE =
  'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])';

// Traps focus inside a container while `active` is true. Returns a ref to
// attach to the container. On activation, focuses the first focusable child.
// On deactivation, returns focus to the element that triggered activation.
export function useFocusTrap<T extends HTMLElement>(active: boolean) {
  const ref = React.useRef<T | null>(null);
  const previouslyFocused = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    if (!active) return;
    previouslyFocused.current = (document.activeElement as HTMLElement) ?? null;
    const node = ref.current;
    if (!node) return;

    const focusables = () =>
      Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => !el.hasAttribute("disabled") && el.offsetParent !== null,
      );

    // Focus the first focusable child, or the container itself.
    const first = focusables()[0];
    if (first) first.focus();
    else node.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const currentIdx = items.indexOf(document.activeElement as HTMLElement);
      if (e.shiftKey) {
        if (currentIdx <= 0) {
          e.preventDefault();
          items[items.length - 1].focus();
        }
      } else if (currentIdx === items.length - 1) {
        e.preventDefault();
        items[0].focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused.current?.focus?.();
    };
  }, [active]);

  return ref;
}
