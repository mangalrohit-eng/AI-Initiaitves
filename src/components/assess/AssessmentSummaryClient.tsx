"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  Camera,
  Maximize2,
  Minimize2,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ImpactHero } from "@/components/assess/ImpactHero";
import { MoneyCounter, formatMoney } from "@/components/ui/MoneyCounter";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { PageShell } from "@/components/PageShell";
import { useToast } from "@/components/feedback/ToastProvider";
import { towers } from "@/data/towers";
import type { AssessProgramV2, TowerId } from "@/data/assess/types";
import {
  buildExportCsv,
  l2Concentration,
  programImpactSummary,
  programSensitivityDeltas,
  towerOutcomeForState,
  towerPoolUsd,
} from "@/lib/assess/scenarioModel";
import { getAssessProgram, subscribe } from "@/lib/localStore";
import { getPortalAudience, isInternalSurfaceAllowed } from "@/lib/portalAudience";
import { cn } from "@/lib/utils";

/**
 * Step-3 — Impact Estimate.
 *
 * One job: show what the per-L4 dials roll up to, program-wide and per
 * tower. No scenario presets, no per-tower stress-test sliders, no inline
 * lever-weight editors. To change a dial, the user opens the per-tower
 * Configure Impact Levers page. To change a rate, they open Assumptions.
 */
export function AssessmentSummaryClient() {
  const toast = useToast();
  const [program, setProgram] = React.useState<AssessProgramV2>(getAssessProgram);
  const [chartReady, setChartReady] = React.useState(false);
  const [presentMode, setPresentMode] = React.useState(false);
  const showExport = isInternalSurfaceAllowed(getPortalAudience());
  const snapshotRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setProgram(getAssessProgram());
    return subscribe("assessProgram", () => setProgram(getAssessProgram()));
  }, []);
  React.useEffect(() => {
    setChartReady(true);
  }, []);

  const summary = React.useMemo(() => programImpactSummary(program), [program]);
  const sens = React.useMemo(() => programSensitivityDeltas(program), [program]);

  const withData = React.useMemo(
    () =>
      towers.filter(
        (t) => (program.towers[t.id as TowerId]?.l4Rows.length ?? 0) > 0,
      ),
    [program],
  );

  const chartData = React.useMemo(
    () =>
      withData.map((t) => {
        const o = towerOutcomeForState(t.id as TowerId, program);
        return {
          name: t.name.length > 18 ? `${t.name.slice(0, 16)}...` : t.name,
          offshore: o?.offshore ?? 0,
          ai: o?.ai ?? 0,
          combined: o?.combined ?? 0,
          id: t.id,
        };
      }),
    [withData, program],
  );

  const onExportCsv = () => {
    const blob = new Blob([buildExportCsv(program)], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "forge-impact-estimate.csv";
    a.click();
  };

  const onSnapshot = async () => {
    if (!snapshotRef.current) return;
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(snapshotRef.current, {
        backgroundColor: "#1A1A2E",
        pixelRatio: 2,
        cacheBust: true,
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `forge-impact-estimate-${new Date().toISOString().slice(0, 10)}.png`;
      a.click();
      toast.success({
        title: "Snapshot saved",
        description: "Drop the PNG straight into a deck or email.",
      });
    } catch (e) {
      toast.error({
        title: "Couldn't capture snapshot",
        description: e instanceof Error ? e.message : undefined,
      });
    }
  };

  return (
    <PageShell>
      <div
        className={cn(
          "mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8",
          presentMode && "max-w-6xl",
        )}
      >
        {!presentMode ? (
          <Breadcrumbs
            items={[
              { label: "Program home", href: "/" },
              { label: "Impact Levers", href: "/impact-levers" },
              { label: "Impact Estimate" },
            ]}
          />
        ) : null}

        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-accent-purple/30 bg-accent-purple/5 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-accent-purple-dark">
              <span className="font-mono">&gt;</span>
              Step 3 — Impact Estimate
            </div>
            <h1 className="mt-2 font-display text-2xl font-semibold text-forge-ink">
              &gt; Where the modeled value lands
            </h1>
            {!presentMode ? (
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-forge-body">
                Roll-up of every tower&apos;s per-L4 offshore + AI dials at the current{" "}
                <Link href="/assumptions" className="text-accent-purple-dark underline">
                  blended rates
                </Link>
                . Open a tower&apos;s Configure Impact Levers page to move dials. Snapshot to
                PNG when you&apos;re ready for the deck.
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={onSnapshot}
              className="inline-flex items-center gap-1.5 rounded-lg border border-accent-purple/40 bg-accent-purple/10 px-3 py-1.5 text-xs font-medium text-accent-purple-dark hover:bg-accent-purple/20"
              title="Capture the hero + chart as a PNG for decks"
            >
              <Camera className="h-3.5 w-3.5" />
              Snapshot PNG
            </button>
            <button
              type="button"
              onClick={() => setPresentMode((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-forge-border bg-forge-surface px-3 py-1.5 text-xs text-forge-body hover:border-accent-purple/40"
              title="Hide chrome and widen for projection"
            >
              {presentMode ? (
                <>
                  <Minimize2 className="h-3.5 w-3.5" /> Exit present
                </>
              ) : (
                <>
                  <Maximize2 className="h-3.5 w-3.5" /> Present mode
                </>
              )}
            </button>
            {showExport && !presentMode ? (
              <button
                type="button"
                onClick={onExportCsv}
                className="rounded-lg border border-forge-border bg-forge-surface px-3 py-1.5 text-xs text-forge-body hover:border-accent-purple/40"
              >
                Export CSV
              </button>
            ) : null}
          </div>
        </div>

        {/* Snapshot block — hero + chart wrapped so it captures cleanly */}
        <div ref={snapshotRef} className="mt-5 rounded-3xl bg-forge-page/30 p-1">
          <ImpactHero program={program} variant="hero" />

          {chartReady && chartData.length > 0 ? (
            <div className="mt-4 rounded-2xl border border-forge-border bg-forge-surface/60 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-display text-sm font-semibold text-forge-ink">
                  Modeled $ by tower
                </h2>
                <span className="font-mono text-[10px] uppercase tracking-wider text-forge-hint">
                  offshore (purple) + AI (teal)
                </span>
              </div>
              <div className="mt-2 h-64 w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%" minHeight={240} minWidth={0}>
                  <BarChart data={chartData} margin={{ top: 8, right: 8, left: 4, bottom: 4 }}>
                    <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 9, fill: "hsl(220,6%,60%)" }}
                      height={64}
                      angle={-15}
                      textAnchor="end"
                      interval={0}
                    />
                    <YAxis
                      tick={{ fontSize: 9, fill: "hsl(220,6%,60%)" }}
                      tickFormatter={(v) =>
                        (v as number) >= 1e6
                          ? `${((v as number) / 1e6).toFixed(1)}M`
                          : `${((v as number) / 1e3).toFixed(0)}k`
                      }
                    />
                    <Tooltip
                      contentStyle={{ background: "#1A1A2E", border: "1px solid #2d2d44", borderRadius: 8 }}
                      formatter={(v, name) => [
                        typeof v === "number"
                          ? `$${(v as number).toLocaleString("en-US", { maximumFractionDigits: 0 })}`
                          : v,
                        String(name),
                      ]}
                    />
                    <Legend wrapperStyle={{ fontSize: 11, color: "hsl(220,6%,70%)" }} />
                    <Bar dataKey="offshore" name="Offshore" stackId="modeled" fill="#A100FF" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="ai" name="AI" stackId="modeled" fill="#00BFA5" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : null}
        </div>

        {!presentMode ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-forge-border bg-forge-surface/60 p-3">
            <div className="text-xs text-forge-body">
              <span className="font-mono uppercase tracking-wider text-forge-hint">
                Sensitivity
              </span>
              <span className="ml-2">
                +10 pts on every L4 offshore dial &asymp;{" "}
                <span className="font-mono text-accent-green">
                  {formatMoney(sens.dOff10, { decimals: sens.dOff10 >= 1_000_000 ? 1 : 0 })}
                </span>
              </span>
              <span className="mx-2 text-forge-hint">·</span>
              <span>
                +10 pts on every L4 AI dial &asymp;{" "}
                <span className="font-mono text-accent-green">
                  {formatMoney(sens.dAi10, { decimals: sens.dAi10 >= 1_000_000 ? 1 : 0 })}
                </span>
              </span>
            </div>
            <div className="text-[11px] text-forge-hint">
              Live · {summary.contributingTowers.length} towers contributing ·{" "}
              <span className="font-mono">
                pool {formatMoney(summary.totalPool, { decimals: 1 })}
              </span>
            </div>
          </div>
        ) : null}

        {withData.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-forge-border bg-forge-well/40 p-6 text-center">
            <p className="text-sm text-forge-subtle">
              No tower capability map &amp; headcount loaded yet. Start by loading the sample
              workshop or picking a tower on the Capability Map.
            </p>
            <Link
              href="/capability-map"
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-accent-purple px-4 py-2 text-sm font-medium text-white hover:bg-accent-purple-dark"
            >
              Open Capability Map
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <ul className="mt-6 space-y-4">
            {withData.map((t) => (
              <TowerCard
                key={t.id}
                towerId={t.id as TowerId}
                towerName={t.name}
                program={program}
                presentMode={presentMode}
              />
            ))}
          </ul>
        )}

        {!presentMode ? (
          <p className="mt-8 text-center text-xs text-forge-hint">
            Math:{" "}
            <Link href="/assumptions" className="text-forge-body underline">
              How impact is calculated
            </Link>{" "}
            · combined = AI + offshore × (1 − AI dial). All rates pulled from the Assumptions
            tab.
          </p>
        ) : null}
      </div>
    </PageShell>
  );
}

function TowerCard({
  towerId,
  towerName,
  program,
  presentMode,
}: {
  towerId: TowerId;
  towerName: string;
  program: AssessProgramV2;
  presentMode: boolean;
}) {
  const o = towerOutcomeForState(towerId, program);
  const st = program.towers[towerId];
  if (!o || !st) return null;
  const pool = towerPoolUsd(st.l4Rows, program.global);
  const l2c = l2Concentration(st.l4Rows, program.global);
  const isComplete = st.status === "complete";

  const offSharePct = o.combined > 0 ? (o.offshore / (o.offshore + o.ai)) * 100 : 0;
  const aiSharePct = o.combined > 0 ? (o.ai / (o.offshore + o.ai)) * 100 : 0;

  return (
    <li className="rounded-2xl border border-forge-border bg-forge-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-forge-ink">{towerName}</span>
            <span
              className={
                "rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider " +
                (isComplete
                  ? "bg-accent-green/15 text-accent-green"
                  : "bg-accent-amber/15 text-accent-amber")
              }
              title={
                isComplete
                  ? "Tower lead has reviewed and locked the baseline."
                  : "Awaiting tower lead review — figures shown are illustrative defaults."
              }
            >
              {isComplete ? "Reviewed by Tower Lead" : "Pending Tower Lead review"}
            </span>
          </div>
          <p className="mt-1 text-xs text-forge-subtle">
            Pool{" "}
            <span className="font-mono text-forge-body">
              {formatMoney(pool, { decimals: 1 })}
            </span>{" "}
            · weighted {o.offshorePct.toFixed(0)}% offshore · {o.aiPct.toFixed(0)}% AI
          </p>
          {!presentMode ? (
            <p className="mt-1 text-[11px] text-forge-hint">
              L2 mix: {l2c[0] ? `${l2c[0].l2} ${l2c[0].sharePct.toFixed(0)}%` : "—"}
              {l2c[1] ? ` · ${l2c[1].l2} ${l2c[1].sharePct.toFixed(0)}%` : ""}
              {l2c[2] ? ` · ${l2c[2].l2} ${l2c[2].sharePct.toFixed(0)}%` : ""}
            </p>
          ) : null}
        </div>
        <div className="text-right">
          <div className="text-[10px] font-medium uppercase tracking-wider text-forge-hint">
            Modeled
          </div>
          <div className="font-display text-2xl font-semibold text-accent-green tabular-nums">
            <MoneyCounter
              value={o.combined}
              decimals={o.combined >= 1_000_000 ? 1 : 0}
            />
          </div>
          <div className="font-mono text-[10px] text-forge-hint">
            off {formatMoney(o.offshore, { decimals: 0 })} · AI{" "}
            {formatMoney(o.ai, { decimals: 0 })}
          </div>
        </div>
      </div>

      <div className="mt-3">
        <div className="flex h-2 overflow-hidden rounded-full bg-forge-page/60">
          <div
            className="bg-accent-purple"
            style={{ width: `${offSharePct.toFixed(2)}%` }}
            aria-label={`Offshore share ${offSharePct.toFixed(0)}%`}
          />
          <div
            className="bg-accent-teal"
            style={{ width: `${aiSharePct.toFixed(2)}%` }}
            aria-label={`AI share ${aiSharePct.toFixed(0)}%`}
          />
        </div>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[10px] text-forge-hint">
          <span>
            Offshore {offSharePct.toFixed(0)}% · AI {aiSharePct.toFixed(0)}% of pre-overlap
            modeled $
          </span>
          <span className="font-mono">
            combined / pool = {pool > 0 ? ((o.combined / pool) * 100).toFixed(0) : 0}%
          </span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-end gap-2 text-xs">
        <Link
          href={`/impact-levers/tower/${towerId}`}
          className="text-accent-purple-dark underline"
        >
          Open dials
        </Link>
        <span className="text-forge-hint">·</span>
        <Link href={`/tower/${towerId}`} className="text-forge-body underline">
          AI Initiatives
        </Link>
      </div>
    </li>
  );
}
