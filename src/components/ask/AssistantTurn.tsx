"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { AlertCircle, RefreshCw, Sparkles } from "lucide-react";
import { BlockRenderer } from "./blocks/BlockRenderer";
import { CitationChips } from "./CitationChips";
import type { AskBlock, AskCitation, AskErrorCode, AskMessage } from "@/lib/ask/types";

type Props = {
  message: Extract<AskMessage, { role: "assistant" }>;
  onRetry?: () => void;
  onSelectCitation?: (c: AskCitation) => void;
  onFollowUp?: (prompt: string) => void;
};

export function AssistantTurn({ message, onRetry, onSelectCitation, onFollowUp }: Props) {
  const blocks = message.response.blocks;
  const citations = message.response.citations;
  const followUps = message.response.followUps;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="space-y-3"
    >
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-forge-subtle">
        <Sparkles className="h-3 w-3 text-accent-purple-dark" aria-hidden />
        Forge Insights
        {message.modelId ? (
          <span className="font-mono text-[10px] text-forge-hint">{message.modelId}</span>
        ) : null}
        {typeof message.latencyMs === "number" && message.latencyMs > 0 ? (
          <span className="font-mono text-[10px] text-forge-hint">
            {(message.latencyMs / 1000).toFixed(1)}s
          </span>
        ) : null}
      </div>

      {message.error ? (
        <ErrorBanner code={message.error.code} message={message.error.message} onRetry={onRetry} />
      ) : null}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {blocks.map((block, idx) => (
          <BlockEntry key={idx} block={block} index={idx} onSelectCitation={onSelectCitation} />
        ))}
      </div>

      {citations.length > 0 ? (
        <div className="pt-1">
          <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-forge-subtle">
            Sources
          </div>
          <CitationChips citations={citations} onSelect={onSelectCitation} />
        </div>
      ) : null}

      {followUps.length > 0 && onFollowUp ? (
        <div className="pt-1">
          <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-forge-subtle">
            Suggested follow-ups
          </div>
          <div className="flex flex-wrap gap-1.5">
            {followUps.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => onFollowUp(q)}
                className="rounded-full border border-forge-border bg-forge-canvas px-3 py-1 text-[12px] text-forge-body transition hover:border-accent-purple/40 hover:bg-accent-purple/5 hover:text-accent-purple-dark"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </motion.div>
  );
}

function BlockEntry({
  block,
  index,
  onSelectCitation,
}: {
  block: AskBlock;
  index: number;
  onSelectCitation?: (c: AskCitation) => void;
}) {
  // Heavy blocks (charts, tower snapshots) span both columns; lighter blocks
  // (metric, prose, note) stay single-column when possible.
  const wide =
    block.kind === "ranking" ||
    block.kind === "breakdown" ||
    block.kind === "compare" ||
    block.kind === "towerSnapshot" ||
    block.kind === "brandLens";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay: index * 0.05, ease: "easeOut" }}
      className={wide ? "lg:col-span-2" : "lg:col-span-1"}
    >
      <BlockRenderer block={block} />
      {block.citations && block.citations.length > 0 ? (
        <div className="mt-1.5">
          <CitationChips citations={block.citations} onSelect={onSelectCitation} />
        </div>
      ) : null}
    </motion.div>
  );
}

function ErrorBanner({
  code,
  message,
  onRetry,
}: {
  code: AskErrorCode;
  message: string;
  onRetry?: () => void;
}) {
  const friendly = friendlyMessage(code, message);
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-accent-red/40 bg-accent-red/5 px-4 py-3">
      <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-accent-red" aria-hidden />
      <div className="flex-1">
        <div className="text-xs font-semibold text-accent-red">{friendly.title}</div>
        <div className="mt-0.5 text-xs leading-relaxed text-forge-body">{friendly.body}</div>
      </div>
      {onRetry && code !== "api_key_missing" ? (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1 rounded-md border border-forge-border bg-forge-surface px-2 py-1 text-[11px] font-medium text-forge-body transition hover:border-accent-purple/40 hover:text-accent-purple-dark"
        >
          <RefreshCw className="h-3 w-3" aria-hidden />
          Retry
        </button>
      ) : null}
    </div>
  );
}

function friendlyMessage(code: AskErrorCode, raw: string): { title: string; body: string } {
  switch (code) {
    case "api_key_missing":
      return {
        title: "Ask Forge isn't configured on this deployment",
        body: "Set OPENAI_API_KEY (and optionally OPENAI_ASK_MODEL) and redeploy. The rest of the app is unaffected.",
      };
    case "rate_limit":
      return {
        title: "Rate-limited by the model provider",
        body: "Wait a moment and retry. Cross-Tower Plan and Curate Brief share the same key.",
      };
    case "prompt_too_large":
      return {
        title: "Prompt exceeded the model's context",
        body: "Clear the conversation to drop history, or ask a more focused question.",
      };
    case "user_aborted":
      return {
        title: "You stopped this request",
        body: "Click retry to ask again with the same input.",
      };
    case "validation_failed":
      return {
        title: "The model returned an invalid response",
        body: "Sometimes the schema validator rejects a malformed answer. Retry usually works.",
      };
    case "timeout":
      return {
        title: "The model took too long",
        body: "Retry, or simplify the question. Heavy reasoning answers may need 60 seconds.",
      };
    default:
      return {
        title: "Couldn't complete the answer",
        body: raw || "Something went wrong. Retry or ask a simpler question.",
      };
  }
}
