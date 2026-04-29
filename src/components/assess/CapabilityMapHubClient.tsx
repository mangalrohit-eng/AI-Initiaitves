"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  MoreHorizontal,
  Sparkles,
  Download,
  FileSpreadsheet,
} from "lucide-react";
import { useAssessSync } from "@/components/assess/AssessSyncProvider";
import { CapabilityScoreboard } from "@/components/assess/CapabilityScoreboard";
import { ProgramToolsDrawer } from "@/components/assess/ProgramToolsDrawer";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { PageShell } from "@/components/PageShell";
import { ScreenGuidanceBar } from "@/components/guidance/ScreenGuidanceBar";
import { useGuidanceCapabilityMapHub } from "@/lib/guidance/useJourneyGuidance";
import { Term } from "@/components/help/Term";
import { useToast } from "@/components/feedback/ToastProvider";
import { useAsyncOp } from "@/lib/feedback/useAsyncOp";
import { buildSeededAssessProgramV2 } from "@/data/assess/seedAssessProgram";
import { towers } from "@/data/towers";
import { downloadSingleTowerSampleCsv } from "@/lib/assess/downloadAssessSamples";
import {
  getAssessProgram,
  getAssessProgramHydrationSnapshot,
  getMyTowers,
  setAssessProgram,
  subscribe,
} from "@/lib/localStore";
import type { AssessProgramV2, TowerId } from "@/data/assess/types";
import { getTowerHref } from "@/lib/towerHref";
import { isCapabilityMapJourneyStepDone } from "@/lib/assess/capabilityMapStepStatus";
import { LeadDeadlineChip } from "@/components/program/LeadDeadlineChip";

type RowStatus = "not-started" | "in-progress" | "map-confirmed" | "complete";

function rowStatus(program: AssessProgramV2, towerId: TowerId): RowStatus {
  const t = program.towers[towerId];
  if (!t || !t.l3Rows.length) return "not-started";
  if (t.status === "complete") return "complete";
  if (isCapabilityMapJourneyStepDone(t)) return "map-confirmed";
  return "in-progress";
}

function statusCopy(s: RowStatus): { label: string; className: string } {
  if (s === "complete") return { label: "Reviewed by Tower Lead", className: "text-accent-green" };
  if (s === "map-confirmed")
    return { label: "L1–L3 confirmed", className: "text-accent-green" };
  if (s === "in-progress")
    return { label: "Pending map confirmation", className: "text-accent-amber" };
  return { label: "Not started", className: "text-forge-subtle" };
}

/**
 * Step 1 hub — Capability Map.
 *
 * Confirm the L1 to L4 tree and the headcount per tower. The hub
 * shows the program-wide capability scoreboard at the top, a focused "next
 * tower" CTA, and a tight tower list. Templates / backup / admin re-seed have
 * been demoted to `ProgramToolsDrawer` at the bottom so the page stays
 * focused on the assessment loop.
 */
export function CapabilityMapHubClient() {
  const sync = useAssessSync();
  const toast = useToast();
  const capGuidance = useGuidanceCapabilityMapHub();
  const [program, setProgram] = React.useState<AssessProgramV2>(() => getAssessProgramHydrationSnapshot());
  const [mine, setMine] = React.useState<TowerId[]>([]);

  React.useEffect(() => {
    setProgram(getAssessProgram());
    return subscribe("assessProgram", () => setProgram(getAssessProgram()));
  }, []);
  React.useEffect(() => {
    setMine(getMyTowers());
    return subscribe("myTowers", () => setMine(getMyTowers()));
  }, []);

  const sampleLoadOp = useAsyncOp<void, []>({
    run: async () => {
      setAssessProgram(buildSeededAssessProgramV2());
      if (sync?.canSync) await sync.flushSave();
    },
    messages: {
      loadingTitle: "Loading sample program across 13 towers",
      successTitle: "Sample program loaded",
      successDescription:
        "All 13 towers seeded with capability maps, headcount, and starter dials.",
      errorTitle: "Couldn't load sample",
    },
  });

  const minePicked = mine.length > 0;
  const orderedTowers = React.useMemo(() => {
    if (!minePicked) return towers;
    const mineSet = new Set(mine);
    const minedFirst = towers.filter((t) => mineSet.has(t.id as TowerId));
    const rest = towers.filter((t) => !mineSet.has(t.id as TowerId));
    return [...minedFirst, ...rest];
  }, [mine, minePicked]);

  const statuses = orderedTowers.map((tw) => ({
    tower: tw,
    status: rowStatus(program, tw.id as TowerId),
    isMine: minePicked && mine.includes(tw.id as TowerId),
  }));
  const mapConfirmed = statuses.filter(
    (s) => s.status === "map-confirmed" || s.status === "complete",
  ).length;
  const inProgress = statuses.filter((s) => s.status === "in-progress").length;
  const notStarted = statuses.filter((s) => s.status === "not-started").length;

  const hasAnyData = mapConfirmed + inProgress > 0;

  return (
    <PageShell>
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <Breadcrumbs
          items={[
            { label: "Program home", href: "/" },
            { label: "Capability Map" },
          ]}
        />
        <ScreenGuidanceBar guidance={capGuidance} className="mt-3" />
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-accent-purple/30 bg-accent-purple/5 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-accent-purple-dark">
              <span className="font-mono">&gt;</span>
              Step 1
            </div>
            <h1 className="mt-2 font-display text-3xl font-semibold text-forge-ink">
              &gt; Tower Capability Map
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-forge-body">
              For each tower, confirm the in-scope <Term termKey="capability map">L1 to L4 capability tree</Term>{" "}
              and the headcount that delivers it. Once a tower&apos;s capability map &amp; headcount is in,{" "}
              <Link href="/impact-levers" className="text-accent-purple-dark underline">
                step 2 — Configure Impact Levers
              </Link>{" "}
              lights up.
            </p>
          </div>
          <span
            className="rounded-full border border-forge-hint/40 bg-forge-well/50 px-3 py-1 text-[11px] font-medium text-forge-subtle"
            title="Illustrative model — figures are not Versant-reported and not a system of record."
          >
            Illustrative — not Versant-reported
          </span>
        </div>

        {/* KEY METRICS — top of page */}
        <div className="mt-5">
          <CapabilityScoreboard variant="program" program={program} />
        </div>

        {/* Hero CTA */}
        {!hasAnyData ? (
          <div className="mt-6 rounded-2xl border border-accent-purple/40 bg-accent-purple/5 p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-xl">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-accent-purple/15 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-accent-purple-dark">
                  <Sparkles className="h-3 w-3" />
                  Start here
                </div>
                <h2 className="mt-2 font-display text-lg font-semibold text-forge-ink">
                  See the assessment in action
                </h2>
                <p className="mt-1 text-sm text-forge-body">
                  Load the illustrative sample across all 13 towers, then jump to any tower
                  to confirm its capability map.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void sampleLoadOp.fire()}
                  disabled={sampleLoadOp.state === "loading"}
                  className="inline-flex items-center gap-2 rounded-lg bg-accent-purple px-4 py-2 text-sm font-medium text-white hover:bg-accent-purple-dark disabled:opacity-60"
                >
                  <Sparkles className="h-4 w-4" />
                  {sampleLoadOp.state === "loading" ? "Loading..." : "Load sample program"}
                </button>
                <a
                  href="#tower-list"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-forge-border bg-forge-surface px-3 py-2 text-sm text-forge-body hover:border-accent-purple/30"
                >
                  I have my own data
                  <ArrowRight className="h-4 w-4" />
                </a>
              </div>
            </div>
          </div>
        ) : null}

        {/* Tower grid */}
        <div className="mt-8 flex flex-wrap items-baseline justify-between gap-2">
          <h2
            id="tower-list"
            className="font-display text-sm font-semibold uppercase tracking-wider text-forge-subtle"
          >
            &gt; Towers ({towers.length}){minePicked ? " · my towers first" : ""}
          </h2>
          <span className="font-mono text-[11px] tabular-nums text-forge-hint">
            {mapConfirmed} L1–L3 confirmed · {inProgress} in progress · {notStarted} not started
          </span>
        </div>
        <ul
          className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3"
          role="list"
        >
          {statuses.map(({ tower: tw, status, isMine }) => {
            const s = statusCopy(status);
            const href = getTowerHref(tw.id as TowerId, "capability-map");
            return (
              <li key={tw.id} className="relative">
                <Link
                  href={href}
                  className={
                    "group flex h-full flex-col gap-1.5 rounded-xl border p-3 transition " +
                    (isMine
                      ? "border-accent-purple/30 bg-forge-surface hover:border-accent-purple/55 hover:bg-accent-purple/5"
                      : "border-forge-border bg-forge-surface hover:border-accent-purple/35 hover:bg-forge-well/40")
                  }
                >
                  <div className="flex min-w-0 items-start gap-1.5 pr-7">
                    {isMine ? (
                      <span
                        className="shrink-0 rounded-full bg-accent-purple/15 px-1.5 py-0.5 font-mono text-[9px] font-medium uppercase tracking-wider text-accent-purple-dark"
                        title="Marked as one of your towers"
                      >
                        Mine
                      </span>
                    ) : null}
                    <span className="min-w-0 flex-1 truncate font-display text-sm font-semibold text-forge-ink">
                      {tw.name}
                    </span>
                  </div>
                  <div className={`flex flex-wrap items-center gap-2 text-[11px] ${s.className}`}>
                    {status === "not-started" || status === "in-progress" ? (
                      <Circle className="h-3 w-3" />
                    ) : (
                      <CheckCircle2 className="h-3 w-3" />
                    )}
                    <span className="truncate">{s.label}</span>
                    <LeadDeadlineChip
                      towerName={tw.name}
                      towerId={tw.id as TowerId}
                      step={1}
                      program={program}
                    />
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-[11px] font-medium text-accent-purple-dark group-hover:text-accent-purple">
                      {status === "not-started" ? "Start" : "Continue"}
                      <ArrowRight className="ml-0.5 inline h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </Link>
                <div className="absolute right-2 top-2">
                  <RowMenu towerId={tw.id as TowerId} towerName={tw.name} toast={toast} />
                </div>
              </li>
            );
          })}
        </ul>

        <ProgramToolsDrawer />
      </div>
    </PageShell>
  );
}

function RowMenu({
  towerId,
  towerName,
  toast,
}: {
  towerId: TowerId;
  towerName: string;
  toast: ReturnType<typeof useToast>;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`More actions for ${towerName}`}
        title="More actions"
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-forge-border text-forge-subtle hover:border-accent-purple/30 hover:text-forge-ink"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-9 z-20 w-56 rounded-xl border border-forge-border bg-forge-page p-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              try {
                downloadSingleTowerSampleCsv(towerId, towerName);
                toast.success({
                  title: `Sample CSV for ${towerName} downloaded`,
                });
              } catch (e) {
                toast.error({
                  title: "Couldn't download sample",
                  description: e instanceof Error ? e.message : undefined,
                });
              }
              setOpen(false);
            }}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs text-forge-body hover:bg-forge-well/60"
          >
            <Download className="h-3.5 w-3.5 text-accent-teal" />
            Download sample CSV
          </button>
          <a
            href="/assess-tower-template.xlsx"
            download
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs text-forge-body hover:bg-forge-well/60"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-accent-purple" />
            Download empty template
          </a>
          <Link
            href={getTowerHref(towerId, "ai-initiatives")}
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs text-forge-body hover:bg-forge-well/60"
          >
            <ArrowRight className="h-3.5 w-3.5 text-forge-subtle" />
            Open in AI Initiatives
          </Link>
        </div>
      ) : null}
    </div>
  );
}
