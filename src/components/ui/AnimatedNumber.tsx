"use client";

import { animate, useInView } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { formatHours } from "@/lib/utils";

export function AnimatedNumber({
  value,
  variant = "plain",
  className,
}: {
  value: number;
  variant?: "plain" | "hours";
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  // Initialize with the final value so SSR and the pre-hydration paint show
  // the correct number. The count-up animation briefly resets to 0 once the
  // element is confirmed in view, preserving the original motion without
  // leaving the tile stuck at 0 if the observer never fires (slow hydration,
  // reduced-motion setups, short viewports near the top of the page, etc.).
  const [display, setDisplay] = useState(value);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (!inView || hasAnimated.current) return;
    hasAnimated.current = true;
    setDisplay(0);
    const controls = animate(0, value, {
      duration: 1.15,
      ease: "easeOut",
      onUpdate: (v) => setDisplay(v),
    });
    return () => controls.stop();
  }, [inView, value]);

  const text =
    variant === "hours" ? formatHours(display) : Math.round(display).toLocaleString();

  return (
    <span ref={ref} className={className}>
      {text}
    </span>
  );
}
