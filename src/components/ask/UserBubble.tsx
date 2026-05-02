"use client";

import { motion } from "framer-motion";

export function UserBubble({ content }: { content: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="flex justify-end"
    >
      <div className="max-w-[80%] rounded-2xl rounded-tr-md border border-accent-purple/30 bg-accent-purple/5 px-4 py-2.5 text-sm leading-relaxed text-forge-ink">
        {content}
      </div>
    </motion.div>
  );
}
