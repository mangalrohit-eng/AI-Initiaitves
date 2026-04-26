"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  Download,
  FileSpreadsheet,
  MoreHorizontal,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { AssessPersistencePanel } from "@/components/assess/AssessPersistencePanel";
import { AssessSeedAdminPanel } from "@/components/assess/AssessSeedAdminPanel";
import { AssessWalkthrough } from "@/components/assess/AssessWalkthrough";
import { MyTowersChips } from "@/components/assess/MyTowersChips";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { PageShell } from "@/components/PageShell";
import { Term } from "@/components/help/Term";
import { useToast } from "@/components/feedback/ToastProvider";
import { useAsyncOp } from "@/lib/feedback/useAsyncOp";
import { useAssessSync } from "@/components/assess/AssessSyncProvider";
import { buildSeededAssessProgramV2 } from "@/data/assess/seedAssessProgram";
import { towers } from "@/data/towers";
import {
  downloadAllTowersSampleWorkbook,
  downloadSingleTowerSampleCsv,
} from "@/lib/assess/downloadAssessSamples";
import {
  getAssessProgram,
  getMyTowers,
  setAssessProgram,
  subscribe,
} from "@/lib/localStore";
import type { TowerId } from "@/data/assess/types";
import { getTowerHref } from "@/lib/towerHref";

type RowStatus = "not-started" | "in-progress" | "complete";

function rowStatus(towerId: TowerId): RowStatus {
  const t = getAssessProgram().towers[towerId];
  if (!t || !t.l4Rows.length) return "not-started";
  return t.status === "complete" ? "complete" : "in-progress";
}

function statusCopy(s: RowStatus): { label: string; className: string } {
  if (s === "complete") return { label: "Complete", className: "text-accent-green" };
  if (s === "in-progress") return { label: "In progress", className: "text-accent-amber" };
  return { label: "Not started", className: "text-forge-subtle" };
}

export function AssessHubClient() {
  const sync = useAssessSync();
  const toast = useToast();
  const params = useSearchParams();
  const [, setTick] = React.useState(0);
  const [mine, setMine] = React.useState<TowerId[]>([]);

  React.useEffect(
    () => subscribe("assessProgram", () => setTick((n) => n + 1)),
    [],
  );
  React.useEffect(() => {
    setMine(getMyTowers());
    return subscribe("myTowers", () => setMine(getMyTowers()));
  }, []);

  const sampleLoadOp = useAsyncOp<void, []>({
    run: async () => {
      setAssessProgram(buildSeededAssessProgramV2());
      setTick((n) => n + 1);
      if (sync?.canSync) await sync.flushSave();
    },
    messages: {
      loadingTitle: "Loading sample workshop across 13 towers",
      successTitle: "Sample workshop loaded",
      successDescription:
        "All 13 towers seeded with capability maps, footprint, and starter dials.",
      errorTitle: "Couldn't load sample",
    },
  });

  const sampleWorkbookOp = useAsyncOp<void, []>({
    run: async () => {
      await downloadAllTowersSampleWorkbook();
    },
    messages: {
      loadingTitle: "Building 13-tower sample workbook...",
      successTitle: "Sample workbook downloaded",
      successDescription: "Excel file with one sheet per tower.",
      errorTitle: "Couldn't generate workbook",
    },
  });

  // ---- ordering ---------------------------------------------------------

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
    status: rowStatus(tw.id as TowerId),
    isMine: minePicked && mine.includes(tw.id as TowerId),
  }));
  const completed = statuses.filter((s) => s.status === "complete").length;
  const inProgress = statuses.filter((s) => s.status === "in-progress").length;

  // Next recommended: prefer mine, then in-progress, then not-started.
  const nextRecommended = React.useMemo(() => {
    const myList = statuses.filter((s) => s.isMine);
    return (
      myList.find((s) => s.status === "in-progress")?.tower
      ?? myList.find((s) => s.status === "not-started")?.tower
      ?? statuses.find((s) => s.status === "in-progress")?.tower
      ?? statuses.find((s) => s.status === "not-started")?.tower
      ?? null
    );
  }, [statuses]);
  const hasAnyData = completed + inProgress > 0;

  // Auto-open the My Towers picker if the URL says so (used by the program-home CTA).
  const autoOpenPicker = params?.get("picker") === "open";

  return (
    <PageShell>
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <Breadcrumbs
          items={[
            { label: "Program home", href: "/" },
            { label: "Capability Map" },
          ]}
        />
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-semibold text-forge-ink">
              &gt; Tower Capability Map &amp; Opportunity Sizing
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-forge-body">
              In about 30 minutes per tower, confirm the{" "}
              <Term termKey="capability map">capability map</Term>, enter the workforce footprint, and set the{" "}
              <Term termKey="offshore dial">offshore dial</Term> and{" "}
              <Term termKey="ai impact dial">AI impact dial</Term> per L4 activity. Roll up to the scenario summary to see where the OpEx reduction concentrates.
            </p>
          </div>
          <span
            className="rounded-full border border-forge-hint/40 bg-forge-well/50 px-3 py-1 text-[11px] font-medium text-forge-subtle"
            title="Workshop model — figures are not Versant-reported and not a system of record."
          >
            Workshop — illustrative, not reported
          </span>
        </div>

        {/* First-visit walkthrough — collapsible, persona-aware */}
        <div className="mt-5">
          <AssessWalkthrough />
        </div>

        {/* Personalisation */}
        <div className="mt-5 rounded-2xl border border-forge-border bg-forge-surface/70 p-4">
          <MyTowersChips compact defaultOpen={autoOpenPicker} />
        </div>

        {/* Progress */}
        <div className="mt-5 rounded-2xl border border-forge-border bg-forge-surface/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-forge-subtle">
              Program progress ·{" "}
              <span className="font-mono text-forge-body">{completed}</span> of{" "}
              <span className="font-mono">{towers.length}</span> towers complete
              {inProgress > 0 ? (
                <>
                  {" "}· <span className="font-mono text-forge-body">{inProgress}</span>{" "}
                  in progress
                </>
              ) : null}
            </div>
            <Link
              href="/assess/summary"
              className="inline-flex items-center gap-1.5 rounded-lg border border-accent-purple/40 bg-accent-purple/10 px-3 py-1.5 text-xs font-medium text-accent-purple-dark hover:bg-accent-purple/20"
            >
              Open scenario summary
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div
            className="mt-3 h-2 w-full overflow-hidden rounded-full bg-forge-well/80"
            aria-label={`${completed} of ${towers.length} towers complete`}
          >
            <div
              className="h-full rounded-full bg-accent-purple transition-[width]"
              style={{ width: `${(completed / towers.length) * 100}%` }}
            />
          </div>
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
                  See the workshop in action
                </h2>
                <p className="mt-1 text-sm text-forge-body">
                  Load the illustrative sample across all 13 towers, then open any tower or
                  jump straight to the scenario summary.
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
                  {sampleLoadOp.state === "loading" ? "Loading..." : "Load sample workshop"}
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
        ) : nextRecommended ? (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-forge-border bg-forge-surface/70 p-4">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wider text-forge-subtle">
                Next recommended
              </div>
              <div className="mt-0.5 text-sm font-medium text-forge-ink">
                {nextRecommended.name}
                {minePicked && mine.includes(nextRecommended.id as TowerId) ? (
                  <span className="ml-2 rounded-full bg-accent-purple/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-accent-purple-dark">
                    Mine
                  </span>
                ) : null}
              </div>
              <div className="text-xs text-forge-subtle">
                {rowStatus(nextRecommended.id as TowerId) === "in-progress"
                  ? "Resume the tower assessment."
                  : "Start the next tower assessment."}
              </div>
            </div>
            <Link
              href={`/assess/tower/${nextRecommended.id}`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent-purple px-4 py-2 text-sm font-medium text-white hover:bg-accent-purple-dark"
            >
              {rowStatus(nextRecommended.id as TowerId) === "in-progress"
                ? "Continue"
                : "Start"}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : null}

        {/* Secondary actions */}
        <details className="mt-6 rounded-2xl border border-forge-border bg-forge-surface/60">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-forge-ink">
            <span className="inline-flex items-center gap-2">
              <Download className="h-4 w-4 text-forge-subtle" />
              Templates and samples
              <span className="ml-1 text-xs text-forge-subtle">
                (empty Excel / CSV, sample workbook, reload sample)
              </span>
            </span>
          </summary>
          <div className="border-t border-forge-border px-4 py-3">
            <p className="text-xs font-medium text-forge-subtle">
              Empty templates (per-tower)
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <a
                href="/assess-tower-template.xlsx"
                className="inline-flex items-center gap-2 rounded-lg border border-forge-border bg-forge-surface px-3 py-2 text-sm text-forge-body"
                download
              >
                <FileSpreadsheet className="h-4 w-4 text-accent-purple" />
                Empty template (Excel)
              </a>
              <a
                href="/assess-tower-template.csv"
                className="inline-flex items-center gap-2 rounded-lg border border-forge-border bg-forge-surface px-3 py-2 text-sm text-forge-body"
                download
              >
                Empty template (CSV)
              </a>
            </div>
            <p className="mt-4 text-xs font-medium text-forge-subtle">
              Samples (illustrative)
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void sampleWorkbookOp.fire()}
                disabled={sampleWorkbookOp.state === "loading"}
                className="inline-flex items-center gap-2 rounded-lg border border-forge-border bg-forge-surface px-3 py-2 text-sm text-forge-body hover:border-accent-purple/30 disabled:opacity-60"
              >
                <Download className="h-4 w-4 text-accent-teal" />
                {sampleWorkbookOp.state === "loading"
                  ? "Building..."
                  : "13-tower sample workbook (Excel)"}
              </button>
              <button
                type="button"
                onClick={() => void sampleLoadOp.fire()}
                disabled={sampleLoadOp.state === "loading"}
                className="inline-flex items-center gap-2 rounded-lg border border-forge-border bg-forge-well/60 px-3 py-2 text-sm text-forge-body hover:border-white/20 disabled:opacity-60"
              >
                <RefreshCw className="h-4 w-4 text-forge-subtle" />
                {sampleLoadOp.state === "loading" ? "Loading..." : "Load sample workshop"}
              </button>
            </div>
          </div>
        </details>

        <AssessPersistencePanel />
        <AssessSeedAdminPanel />

        <h2
          id="tower-list"
          className="mt-10 font-display text-sm font-semibold uppercase tracking-wider text-forge-subtle"
        >
          &gt; Towers ({towers.length}){minePicked ? " · my towers first" : ""}
        </h2>
        <ul className="mt-3 space-y-2">
          {statuses.map(({ tower: tw, status, isMine }) => {
            const s = statusCopy(status);
            const isRecommended = nextRecommended?.id === tw.id && hasAnyData;
            return (
              <li
                key={tw.id}
                className={
                  "flex flex-col gap-2 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between " +
                  (isRecommended
                    ? "border-accent-purple/40 bg-accent-purple/5"
                    : isMine
                      ? "border-accent-purple/20 bg-forge-surface"
                      : "border-forge-border bg-forge-surface")
                }
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-forge-ink">{tw.name}</span>
                    {isMine ? (
                      <span className="rounded-full bg-accent-purple/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-accent-purple-dark">
                        Mine
                      </span>
                    ) : null}
                    {isRecommended ? (
                      <span className="rounded-full bg-accent-purple/20 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-accent-purple-dark">
                        Next
                      </span>
                    ) : null}
                  </div>
                  <div
                    className={`mt-0.5 flex items-center gap-1.5 text-xs ${s.className}`}
                  >
                    {status === "complete" ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : (
                      <Circle className="h-3.5 w-3.5" />
                    )}
                    {s.label}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={getTowerHref(tw.id as TowerId, "capability-map")}
                    className="inline-flex items-center gap-1 rounded-lg bg-accent-purple px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-purple-dark"
                  >
                    {status === "not-started" ? "Start" : "Continue"}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <RowMenu towerId={tw.id as TowerId} towerName={tw.name} toast={toast} />
                </div>
              </li>
            );
          })}
        </ul>
        <p className="mt-8 text-center text-xs text-forge-subtle">
          Single-tower (HR) map from earlier build:{" "}
          <Link href="/assess/legacy" className="text-forge-body underline">
            open legacy view
          </Link>
        </p>
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
