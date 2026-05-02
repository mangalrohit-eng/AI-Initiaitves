"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { UserBubble } from "./UserBubble";
import { AssistantTurn } from "./AssistantTurn";
import { ThinkingIndicator } from "./ThinkingIndicator";
import type { AskCitation, AskMessage } from "@/lib/ask/types";

type Props = {
  messages: AskMessage[];
  pending: boolean;
  pendingLabel?: string;
  onRetry: () => void;
  onSelectCitation: (c: AskCitation) => void;
  onFollowUp: (prompt: string) => void;
};

export function ConversationView({
  messages,
  pending,
  pendingLabel,
  onRetry,
  onSelectCitation,
  onFollowUp,
}: Props) {
  const endRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    // Window-level smooth scroll via a sentinel. `scrollMarginBottom` (set
    // inline below) keeps the latest message above the fixed input bar so
    // new answers always land in view, not behind the chrome.
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, pending]);

  return (
    <div className="space-y-5">
      {messages.map((m) => (
        <div key={m.id}>
          {m.role === "user" ? (
            <UserBubble content={m.content} />
          ) : (
            <AssistantTurn
              message={m}
              onRetry={onRetry}
              onSelectCitation={onSelectCitation}
              onFollowUp={onFollowUp}
            />
          )}
        </div>
      ))}
      <AnimatePresence>
        {pending ? (
          <motion.div
            key="pending"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <ThinkingIndicator serverLabel={pendingLabel} />
          </motion.div>
        ) : null}
      </AnimatePresence>
      {/*
        Sentinel for window scrollIntoView — height 1px so it doesn't add
        visible space; scrollMarginBottom is sized to clear the fixed input
        (~96px input + 16px gap + breathing room).
      */}
      <div
        ref={endRef}
        aria-hidden
        className="pointer-events-none"
        style={{ height: 1, scrollMarginBottom: "11rem" }}
      />
    </div>
  );
}
