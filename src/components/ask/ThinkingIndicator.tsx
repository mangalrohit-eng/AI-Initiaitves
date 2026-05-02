"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

const SIM_LABELS = [
  "Reading workshop rows…",
  "Cross-referencing tower briefs…",
  "Compiling rankings…",
  "Drafting answer…",
  "Resolving citations…",
  "Validating output…",
];

/**
 * Three-dot shimmer + auto-rotating sub-stage label. The server may emit
 * its own `stage` events — pass them via `serverLabel` and they win over
 * the simulated rotation.
 */
export function ThinkingIndicator({
  serverLabel,
}: {
  /** When set, displays the server's stage label; otherwise rotates through a simulated list. */
  serverLabel?: string;
}) {
  const [tick, setTick] = React.useState(0);

  React.useEffect(() => {
    if (serverLabel) return;
    const id = setInterval(() => setTick((t) => t + 1), 1_400);
    return () => clearInterval(id);
  }, [serverLabel]);

  const label = serverLabel ?? SIM_LABELS[tick % SIM_LABELS.length];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="flex items-center gap-2.5 rounded-full border border-accent-purple/30 bg-accent-purple/5 px-3 py-1.5"
    >
      <Sparkles className="h-3.5 w-3.5 text-accent-purple-dark" aria-hidden />
      <span className="flex items-center gap-1" aria-hidden>
        <Dot delay={0} />
        <Dot delay={0.18} />
        <Dot delay={0.36} />
      </span>
      <motion.span
        key={label}
        initial={{ opacity: 0, y: 2 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="text-xs font-medium text-accent-purple-dark"
      >
        {label}
      </motion.span>
    </motion.div>
  );
}

function Dot({ delay }: { delay: number }) {
  return (
    <motion.span
      className="inline-block h-1.5 w-1.5 rounded-full bg-accent-purple"
      animate={{ opacity: [0.25, 1, 0.25], y: [0, -1, 0] }}
      transition={{ duration: 0.9, delay, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}
