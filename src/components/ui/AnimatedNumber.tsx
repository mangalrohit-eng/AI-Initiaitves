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
  const inView = useInView(ref, { once: true, margin: "-10%" });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;
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
