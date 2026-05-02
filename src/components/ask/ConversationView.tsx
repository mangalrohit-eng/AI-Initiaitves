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
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // Smooth-scroll to bottom on new turn / pending state.
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  return (
    <div ref={scrollRef} className="space-y-5">
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
    </div>
  );
}
