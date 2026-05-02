"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Trash2 } from "lucide-react";
import { ConversationView } from "./ConversationView";
import { MessageInput } from "./MessageInput";
import { AskHero } from "./AskHero";
import { ContextRail } from "./ContextRail";
import { StarterChips } from "./StarterChips";
import { ProvenanceDrawer } from "./ProvenanceDrawer";
import { usePersistedConversation } from "@/lib/ask/usePersistedConversation";
import { buildProgramDigest } from "@/lib/ask/buildProgramDigest";
import { decodeEventStream } from "@/lib/ask/streamProtocol";
import { useRedactDollars } from "@/lib/clientMode";
import { getAssessProgram, getAssessProgramHydrationSnapshot, subscribe } from "@/lib/localStore";
import { useToast } from "@/components/feedback/ToastProvider";
import type {
  AskAssistantResponse,
  AskBlock,
  AskCitation,
  AskErrorCode,
  AskMessage,
  AskRequestBody,
  AskRequestMessage,
  ProgramDigest,
  StaticCorpusDigest,
} from "@/lib/ask/types";

const EMPTY_RESPONSE: AskAssistantResponse = { blocks: [], citations: [], followUps: [] };

export function AskClient() {
  const redact = useRedactDollars();
  const toast = useToast();

  const [program, setProgram] = React.useState(() => getAssessProgramHydrationSnapshot());
  const [staticCorpus, setStaticCorpus] = React.useState<StaticCorpusDigest | null>(null);
  const [activeCitation, setActiveCitation] = React.useState<AskCitation | null>(null);
  const [pending, setPending] = React.useState(false);
  const [pendingLabel, setPendingLabel] = React.useState<string | undefined>(undefined);
  const [prefill, setPrefill] = React.useState<string>("");

  const abortRef = React.useRef<AbortController | null>(null);
  const lastUserPromptRef = React.useRef<string>("");

  const { messages, setMessages, clear, hydrated } = usePersistedConversation();

  // Hydrate workshop state from localStorage and stay in sync with subsequent
  // workshop saves (Step 1/2 changes update Ask Forge in real time).
  React.useEffect(() => {
    setProgram(getAssessProgram());
    return subscribe("assessProgram", () => {
      setProgram(getAssessProgram());
    });
  }, []);

  // One-shot fetch of the static corpus for the provenance drawer.
  React.useEffect(() => {
    let alive = true;
    fetch("/api/ask/corpus", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: StaticCorpusDigest | null) => {
        if (alive && data) setStaticCorpus(data);
      })
      .catch(() => {
        // Drawer will fall back to id-only display.
      });
    return () => {
      alive = false;
    };
  }, []);

  const programDigest = React.useMemo<ProgramDigest>(
    () => buildProgramDigest(program, { clientMode: redact }),
    [program, redact],
  );

  const handleSend = React.useCallback(
    async (content: string) => {
      if (!content.trim() || pending) return;
      lastUserPromptRef.current = content;

      const userMsg: AskMessage = {
        role: "user",
        id: makeId(),
        content,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);
      await streamAnswer([...messages, userMsg]);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [messages, pending, programDigest, redact, setMessages],
  );

  const streamAnswer = React.useCallback(
    async (turns: AskMessage[]) => {
      const controller = new AbortController();
      abortRef.current = controller;
      setPending(true);
      setPendingLabel("Sending question…");

      const requestMessages: AskRequestMessage[] = turns
        .map((t) =>
          t.role === "user"
            ? { role: "user" as const, content: t.content }
            : {
                role: "assistant" as const,
                content: summarizeAssistant(t.response),
              },
        )
        .slice(-12);

      const body: AskRequestBody = {
        messages: requestMessages,
        programDigest,
        clientMode: redact,
      };

      const assistantId = makeId();
      // Pre-create a draft assistant message so blocks can stream into it.
      type AssistantMsg = Extract<AskMessage, { role: "assistant" }>;
      const draft: AssistantMsg = {
        role: "assistant",
        id: assistantId,
        response: EMPTY_RESPONSE,
        createdAt: new Date().toISOString(),
      };

      let receivedBlocks: AskBlock[] = [];
      let receivedCitations: AskCitation[] = [];
      let receivedFollowUps: string[] = [];
      let modelId: string | undefined;
      let latencyMs: number | undefined;
      let errorPayload: { code: AskErrorCode; message: string } | undefined;

      try {
        const res = await fetch("/api/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
          credentials: "include",
        });
        if (!res.ok || !res.body) {
          const txt = await res.text().catch(() => "");
          throw new Error(`Ask Forge: ${res.status} ${txt.slice(0, 200)}`);
        }

        for await (const ev of decodeEventStream(res.body)) {
          if (ev.kind === "stage") {
            setPendingLabel(ev.label);
          } else if (ev.kind === "blocks") {
            receivedBlocks = ev.blocks;
          } else if (ev.kind === "citations") {
            receivedCitations = ev.citations;
          } else if (ev.kind === "followUps") {
            receivedFollowUps = ev.followUps;
          } else if (ev.kind === "meta") {
            modelId = ev.modelId;
            latencyMs = ev.latencyMs;
          } else if (ev.kind === "error") {
            errorPayload = { code: ev.code, message: ev.message };
          } else if (ev.kind === "done") {
            break;
          }
        }
      } catch (err) {
        if ((err as { name?: string })?.name === "AbortError") {
          errorPayload = {
            code: "user_aborted",
            message: "Stopped by user.",
          };
        } else {
          errorPayload = {
            code: "network",
            message: err instanceof Error ? err.message : "Network error",
          };
        }
      }

      // If we got nothing at all (no blocks AND an error), still render the
      // turn so the user sees the error banner with retry.
      if (receivedBlocks.length === 0 && !errorPayload) {
        errorPayload = {
          code: "validation_failed",
          message: "Empty response — retry usually works.",
        };
      }

      const finalMsg: AssistantMsg = {
        role: "assistant",
        id: draft.id,
        createdAt: draft.createdAt,
        response: {
          blocks: receivedBlocks,
          citations: receivedCitations,
          followUps: receivedFollowUps,
        },
        modelId,
        latencyMs,
        error: errorPayload,
      };

      setMessages((prev) => [...prev, finalMsg]);
      setPending(false);
      setPendingLabel(undefined);
      abortRef.current = null;
    },
    [programDigest, redact, setMessages],
  );

  const handleStop = React.useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const handleRetry = React.useCallback(() => {
    if (pending) return;
    const last = lastUserPromptRef.current;
    if (!last) return;
    // Drop the last assistant turn (which carried the error) and re-stream.
    setMessages((prev) => {
      const trimmed = [...prev];
      while (trimmed.length > 0 && trimmed[trimmed.length - 1].role === "assistant") {
        trimmed.pop();
      }
      return trimmed;
    });
    void handleSend(last);
  }, [pending, setMessages, handleSend]);

  const handleClear = React.useCallback(() => {
    if (pending) {
      handleStop();
    }
    clear();
    toast.info({ title: "Conversation cleared" });
  }, [pending, handleStop, clear, toast]);

  const handleStarter = React.useCallback(
    (prompt: string) => {
      if (pending) return;
      void handleSend(prompt);
    },
    [pending, handleSend],
  );

  const handleFollowUp = React.useCallback(
    (prompt: string) => {
      // Prefill the input so the user can edit before sending.
      setPrefill(prompt + " ");
      // Reset prefill on next tick so re-clicks of the same chip refresh focus.
      requestAnimationFrame(() => setPrefill(""));
    },
    [],
  );

  const showHero = hydrated && messages.length === 0;

  return (
    <div className="space-y-5">
      {showHero ? <AskHero /> : null}

      <ContextRail
        digest={programDigest}
        clientMode={redact}
        briefCount={staticCorpus?.briefs.length ?? 0}
      />

      {showHero ? (
        <StarterChips
          hasWorkshopData={programDigest.hasWorkshopData}
          onSelect={handleStarter}
        />
      ) : null}

      <ConversationView
        messages={messages}
        pending={pending}
        pendingLabel={pendingLabel}
        onRetry={handleRetry}
        onSelectCitation={(c) => setActiveCitation(c)}
        onFollowUp={handleFollowUp}
      />

      {!showHero ? (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleClear}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-md border border-forge-border bg-forge-canvas px-2.5 py-1 text-[11px] font-medium text-forge-subtle transition hover:border-accent-purple/40 hover:text-accent-purple-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Trash2 className="h-3 w-3" aria-hidden />
            Clear conversation
          </button>
        </div>
      ) : null}

      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.05 }}
        className="sticky bottom-4 z-10"
      >
        <MessageInput
          onSend={handleSend}
          onStop={handleStop}
          disabled={!hydrated}
          pending={pending}
          prefill={prefill}
        />
      </motion.div>

      <ProvenanceDrawer
        citation={activeCitation}
        digest={programDigest}
        staticTowers={staticCorpus?.towers ?? []}
        staticBriefs={staticCorpus?.briefs ?? []}
        onClose={() => setActiveCitation(null)}
      />
    </div>
  );
}

function makeId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** Compact text summary of an assistant turn for re-injection into the LLM context. */
function summarizeAssistant(resp: AskAssistantResponse): string {
  if (!resp.blocks || resp.blocks.length === 0) return "(no answer)";
  const lines: string[] = [];
  for (const b of resp.blocks) {
    switch (b.kind) {
      case "metric":
        lines.push(`Metric ${b.label} = ${b.value}${b.unit ? " " + b.unit : ""}`);
        break;
      case "ranking":
        lines.push(
          `Ranking "${b.title}" (${b.unit}): ${b.items
            .slice(0, 5)
            .map((i) => `${i.label}=${i.value}`)
            .join(", ")}`,
        );
        break;
      case "breakdown":
        lines.push(`Breakdown "${b.title}" with ${b.rows.length} rows`);
        break;
      case "compare":
        lines.push(`Compare ${b.left.title} vs ${b.right.title}`);
        break;
      case "towerSnapshot":
        lines.push(`TowerSnapshot ${b.name} (${b.towerId}, impact=${b.impactTier})`);
        break;
      case "initiative":
        lines.push(`Initiative ${b.name} (${b.briefId}, ${b.tier})`);
        break;
      case "brandLens":
        lines.push(`BrandLens ${b.brand} — ${b.mentions.length} mentions`);
        break;
      case "prose":
        lines.push(b.text.slice(0, 240));
        break;
      case "note":
        lines.push(`Note (${b.severity}): ${b.text}`);
        break;
    }
  }
  return lines.join("\n").slice(0, 1200);
}
