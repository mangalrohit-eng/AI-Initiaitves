"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, X } from "lucide-react";
import type {
  AskCitation,
  ProgramDigest,
  StaticBriefDigest,
  StaticTowerDigest,
} from "@/lib/ask/types";

type Props = {
  citation: AskCitation | null;
  digest: ProgramDigest;
  staticTowers: StaticTowerDigest[];
  staticBriefs: StaticBriefDigest[];
  onClose: () => void;
};

export function ProvenanceDrawer({
  citation,
  digest,
  staticTowers,
  staticBriefs,
  onClose,
}: Props) {
  React.useEffect(() => {
    if (!citation) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [citation, onClose]);

  return (
    <AnimatePresence>
      {citation ? (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/30"
            aria-hidden
          />
          <motion.aside
            key="drawer"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-forge-border bg-forge-surface shadow-card"
            role="dialog"
            aria-label="Source detail"
          >
            <header className="flex items-start justify-between gap-3 border-b border-forge-border px-5 py-4">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-forge-subtle">
                  Source · {citation.kind}
                </div>
                <div className="mt-0.5 font-display text-base font-semibold leading-tight text-forge-ink">
                  {citation.label}
                </div>
                <div className="mt-1 font-mono text-[11px] text-forge-hint">{citation.id}</div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-forge-border bg-forge-canvas p-1.5 text-forge-body transition hover:border-accent-purple/40 hover:text-accent-purple-dark"
                aria-label="Close"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-5 py-4 text-sm leading-relaxed text-forge-body">
              <SourceBody
                citation={citation}
                digest={digest}
                staticTowers={staticTowers}
                staticBriefs={staticBriefs}
              />
            </div>

            {citation.href ? (
              <footer className="border-t border-forge-border bg-forge-well/40 px-5 py-3">
                <Link
                  href={citation.href}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-accent-purple-dark hover:text-accent-purple"
                >
                  Jump to source
                  <ArrowRight className="h-3 w-3" aria-hidden />
                </Link>
              </footer>
            ) : null}
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}

function SourceBody({
  citation,
  digest,
  staticTowers,
  staticBriefs,
}: {
  citation: AskCitation;
  digest: ProgramDigest;
  staticTowers: StaticTowerDigest[];
  staticBriefs: StaticBriefDigest[];
}) {
  if (citation.kind === "tower") {
    const t = staticTowers.find((x) => x.id === citation.id);
    if (!t) return <p className="text-xs text-forge-subtle">Tower not found in corpus.</p>;
    return (
      <div className="space-y-3">
        <KvRow k="Impact tier" v={t.impactTier} />
        <KvRow k="Versant leads" v={t.versantLeads.join(", ")} />
        <KvRow k="Accenture leads" v={t.accentureLeads.join(", ")} />
        <KvRow
          k="Total processes"
          v={`${t.totalProcesses} (${t.aiEligibleProcesses} AI-eligible)`}
        />
        <KvRow k="Top opportunity" v={t.topOpportunityHeadline} />
        {t.narrativeSummary ? <KvRow k="Narrative" v={t.narrativeSummary} /> : null}
      </div>
    );
  }

  if (citation.kind === "brief") {
    const b = staticBriefs.find((x) => x.id === citation.id);
    if (!b) return <p className="text-xs text-forge-subtle">Brief not found in corpus.</p>;
    return (
      <div className="space-y-3">
        <KvRow k="Tower" v={b.towerId} />
        <KvRow k="Tier" v={b.briefRoutingTier} />
        <KvRow k="Impact" v={b.impactTier} />
        <KvRow k="Key metric" v={b.keyMetric} />
        <KvRow k="Agents" v={b.agents.join(", ")} />
        <KvRow k="Tools" v={b.tools.join(", ")} />
      </div>
    );
  }

  if (citation.kind === "workshopRow") {
    const row = findWorkshopRow(citation.id, digest);
    if (!row) {
      return (
        <p className="text-xs text-forge-subtle">
          Row not in the live workshop digest. The model may have summarized a
          program-level aggregate rather than a single L4 row.
        </p>
      );
    }
    return (
      <div className="space-y-3">
        <KvRow k="Tower" v={row.towerName} />
        <KvRow k="L3" v={row.l3} />
        <KvRow k="L4" v={row.l4} />
        <KvRow k="Headcount" v={row.totalHeadcount.toLocaleString()} />
        <KvRow k="Offshore plan %" v={`${row.offshorePct}%`} />
        <KvRow
          k="Modeled saving (combined)"
          v={
            row.modeledCombinedUsd == null
              ? "redacted (ClientMode)"
              : `$${Math.round(row.modeledCombinedUsd).toLocaleString()}`
          }
        />
      </div>
    );
  }

  if (citation.kind === "versantContext") {
    return (
      <div className="text-xs leading-relaxed text-forge-body">
        Public 10-K narrative figure — sourced from Versant Media Group filings. These
        figures are not redacted by ClientMode because they are public. The full context
        pack lives in <span className="font-mono">src/lib/ask/buildVersantContext.ts</span>.
      </div>
    );
  }

  return (
    <div className="text-xs text-forge-subtle">
      Source detail not available for this citation kind.
    </div>
  );
}

function findWorkshopRow(rowId: string, digest: ProgramDigest) {
  for (const r of digest.topAggregates.topL4sByOffshorePct) {
    if (r.l4Id === rowId) {
      return {
        towerName: r.towerName,
        l3: r.l3,
        l4: r.l4,
        totalHeadcount: r.totalHeadcount,
        offshorePct: r.offshorePct,
        modeledCombinedUsd: null as number | null,
      };
    }
  }
  for (const r of digest.topAggregates.topL4sByModeledSaving) {
    if (r.l4Id === rowId) {
      return {
        towerName: r.towerName,
        l3: r.l3,
        l4: r.l4,
        totalHeadcount: r.totalHeadcount,
        offshorePct: 0,
        modeledCombinedUsd: r.modeledCombinedUsd,
      };
    }
  }
  for (const t of digest.perTower) {
    for (const r of t.topL4sByOffshorePct) {
      if (r.l4Id === rowId) {
        return {
          towerName: t.towerName,
          l3: r.l3,
          l4: r.l4,
          totalHeadcount: r.totalHeadcount,
          offshorePct: r.offshorePct,
          modeledCombinedUsd: null,
        };
      }
    }
    for (const r of t.topL4sByModeledSaving) {
      if (r.l4Id === rowId) {
        return {
          towerName: t.towerName,
          l3: r.l3,
          l4: r.l4,
          totalHeadcount: r.totalHeadcount,
          offshorePct: 0,
          modeledCombinedUsd: r.modeledCombinedUsd,
        };
      }
    }
  }
  return null;
}

function KvRow({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-forge-subtle">
        {k}
      </div>
      <div className="mt-0.5 text-[13px] leading-relaxed text-forge-body">{v}</div>
    </div>
  );
}
