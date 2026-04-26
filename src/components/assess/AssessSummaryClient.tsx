"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  Bar,
  BarChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageShell } from "@/components/PageShell";
import type { AssessProgramV2, GlobalAssessAssumptions, TowerId } from "@/data/assess/types";
import { getAssessProgram, setGlobalAssessAssumptions, setTowerScenario, subscribe } from "@/lib/localStore";
import { getPortalAudience, isInternalSurfaceAllowed } from "@/lib/portalAudience";
import {
  buildExportCsv,
  l2Concentration,
  sensitivityDeltas,
  towerOutcomeForState,
  towerPoolUsd,
} from "@/lib/assess/scenarioModel";
import { towers } from "@/data/towers";

export function AssessSummaryClient() {
  const [program, setProgram] = React.useState<AssessProgramV2>(getAssessProgram);
  const [chartReady, setChartReady] = React.useState(false);
  const showExport = isInternalSurfaceAllowed(getPortalAudience());

  React.useEffect(() => {
    setProgram(getAssessProgram());
    return subscribe("assessProgram", () => setProgram(getAssessProgram()));
  }, []);
  React.useEffect(() => {
    setChartReady(true);
  }, []);

  const withData = towers.filter(
    (t) => (program.towers[t.id as TowerId]?.l4Rows.length ?? 0) > 0,
  );

  const chartData = withData.map((t) => {
    const o = towerOutcomeForState(t.id as TowerId, program);
    return {
      name: t.name.slice(0, 18),
      pool: o?.pool ?? 0,
      baseline: o?.baseline.combined ?? 0,
      modeled: o?.scenario.combined ?? 0,
      id: t.id,
    };
  });

  const onExport = () => {
    const blob = new Blob([buildExportCsv(program)], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "forge-assess-summary.csv";
    a.click();
  };

  return (
    <PageShell>
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link href="/assess" className="text-xs text-forge-subtle underline">
            Tower list
          </Link>
          {showExport ? (
            <button
              type="button"
              onClick={onExport}
              className="rounded-lg border border-forge-border px-3 py-1.5 text-xs text-forge-body"
            >
              Export summary CSV
            </button>
          ) : null}
        </div>
        <h1 className="mt-3 font-display text-2xl font-semibold text-forge-ink">
          &gt; Scenario summary (by tower)
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-forge-body">
          Move the offshore and AI dials on any tower to stress-test modeled value. The
          baseline on each card is the cost-weighted roll-up from the L4 assessment you saved
          on the tower workflow.
        </p>
        <details className="mt-6 rounded-xl border border-forge-border bg-forge-surface p-4 text-sm">
          <summary className="cursor-pointer font-medium text-forge-ink">
            Global cost assumptions (blended $ / year, illustrative)
          </summary>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {(
              [
                ["blendedFteOnshore", "FTE onshore"],
                ["blendedFteOffshore", "FTE offshore"],
                ["blendedContractorOnshore", "Contractor onshore"],
                ["blendedContractorOffshore", "Contractor offshore"],
              ] as const
            ).map(([k, lab]) => (
              <label key={k} className="text-xs">
                {lab}
                <input
                  className="mt-1 w-full rounded border border-forge-border bg-forge-page px-2 py-1 font-mono"
                  type="number"
                  value={program.global[k]}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (!Number.isFinite(n) || n < 0) return;
                    setGlobalAssessAssumptions({ [k]: n } as Partial<GlobalAssessAssumptions>);
                    setProgram(getAssessProgram());
                  }}
                />
              </label>
            ))}
            <label className="text-xs sm:col-span-2">
              Offshore savings weight (0–1) × pool × (offshore %/100)
              <input
                className="mt-1 w-full rounded border border-forge-border bg-forge-page px-2 py-1 font-mono"
                type="number"
                step={0.05}
                min={0}
                max={1}
                value={program.global.offshoreLeverWeight}
                onChange={(e) => {
                  setGlobalAssessAssumptions({ offshoreLeverWeight: Number(e.target.value) });
                  setProgram(getAssessProgram());
                }}
              />
            </label>
            <label className="text-xs sm:col-span-2">
              AI weight (0–1) × pool × (AI %/100)
              <input
                className="mt-1 w-full rounded border border-forge-border bg-forge-page px-2 py-1 font-mono"
                type="number"
                step={0.05}
                min={0}
                max={1}
                value={program.global.aiLeverWeight}
                onChange={(e) => {
                  setGlobalAssessAssumptions({ aiLeverWeight: Number(e.target.value) });
                  setProgram(getAssessProgram());
                }}
              />
            </label>
          </div>
        </details>
        {withData.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-forge-border bg-forge-well/40 p-6 text-center">
            <p className="text-sm text-forge-subtle">
              No tower footprint loaded yet. Start by loading the sample workshop or picking a
              tower on the Assess hub.
            </p>
            <Link
              href="/assess"
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-accent-purple px-4 py-2 text-sm font-medium text-white hover:bg-accent-purple-dark"
            >
              Go to Assess hub
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <>
            {chartReady ? (
            <div className="mt-6 h-64 w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%" minHeight={240} minWidth={0}>
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: 4, bottom: 4 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: "hsl(220,6%,60%)" }} height={64} />
                  <YAxis
                    tick={{ fontSize: 9 }}
                    tickFormatter={(v) =>
                      (v as number) >= 1e6
                        ? `${((v as number) / 1e6).toFixed(1)}M`
                        : `${((v as number) / 1e3).toFixed(0)}k`
                    }
                  />
                  <Tooltip
                    contentStyle={{ background: "#1A1A2E", border: "1px solid #2d2d44" }}
                    formatter={(v, name) => [
                      typeof v === "number"
                        ? `$${(v as number).toLocaleString("en-US", { maximumFractionDigits: 0 })}`
                        : v,
                      String(name),
                    ]}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, color: "hsl(220,6%,70%)" }} />
                  <Bar dataKey="baseline" name="Baseline (L4 roll-up)" fill="#A100FF" />
                  <Bar dataKey="modeled" name="Scenario (dials)" fill="#00C853" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            ) : null}
            <p className="text-xs text-forge-subtle">
              Each tower: purple = baseline from L4 roll-up; green = scenario from dials below.
            </p>
            <ul className="mt-8 space-y-6">
              {withData.map((t) => {
                const id = t.id as TowerId;
                const st = program.towers[id]!;
                const o = towerOutcomeForState(id, program);
                if (!o) return null;
                const pool = towerPoolUsd(st.l4Rows, program.global);
                const s = program.scenarios[id] ?? {
                  scenarioOffshorePct: o.baseline.offshorePct,
                  scenarioAIPct: o.baseline.aiPct,
                };
                const sens = sensitivityDeltas(
                  pool,
                  s.scenarioOffshorePct,
                  s.scenarioAIPct,
                  program.global,
                );
                const l2c = l2Concentration(st.l4Rows, program.global);
                return (
                  <li
                    key={id}
                    className="rounded-2xl border border-forge-border bg-forge-surface p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="font-medium text-forge-ink">{t.name}</div>
                        <p className="text-xs text-forge-subtle">
                          Pool:{" "}
                          <span className="font-mono text-forge-body">
                            ${pool.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                          </span>{" "}
                          (illustrative)
                        </p>
                        <p className="mt-1 text-[11px] text-forge-hint">
                          Baseline (L4 roll-up): {o.baseline.offshorePct.toFixed(1)}% off /{" "}
                          {o.baseline.aiPct.toFixed(1)}% AI — modeled: $
                          {o.baseline.combined.toLocaleString("en-US", { maximumFractionDigits: 0 })}{" "}
                          | Scenario: $
                          {o.scenario.combined.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                        </p>
                        <p className="mt-1 text-[11px] text-forge-hint">
                          Sensitivity: +10 pts offshore: $
                          {sens.dOff10.toLocaleString("en-US", { maximumFractionDigits: 0 })}; +10 pts
                          AI: ${sens.dAi10.toLocaleString("en-US", { maximumFractionDigits: 0 })} to modeled
                        </p>
                        <p className="mt-2 text-[11px] text-forge-hint">
                          L2 value mix: {l2c[0] ? `${l2c[0].l2} ${l2c[0].sharePct.toFixed(0)}%` : "—"}
                          {l2c[1] ? ` · ${l2c[1].l2} ${l2c[1].sharePct.toFixed(0)}%` : ""}
                        </p>
                      </div>
                      <Link
                        href={`/tower/${id}`}
                        className="text-xs text-accent-purple underline"
                      >
                        AI Initiatives
                      </Link>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <label className="text-xs">
                        Scenario offshore %
                        <input
                          type="range"
                          min={0}
                          max={100}
                          className="mt-1 w-full"
                          value={s.scenarioOffshorePct}
                          onChange={(e) => {
                            setTowerScenario(id, {
                              ...s,
                              scenarioOffshorePct: Number(e.target.value),
                            });
                            setProgram(getAssessProgram());
                          }}
                        />
                        <span className="font-mono text-forge-ink">
                          {s.scenarioOffshorePct}
                        </span>
                      </label>
                      <label className="text-xs">
                        Scenario AI %
                        <input
                          type="range"
                          min={0}
                          max={100}
                          className="mt-1 w-full"
                          value={s.scenarioAIPct}
                          onChange={(e) => {
                            setTowerScenario(id, {
                              ...s,
                              scenarioAIPct: Number(e.target.value),
                            });
                            setProgram(getAssessProgram());
                          }}
                        />
                        <span className="font-mono text-forge-ink">
                          {s.scenarioAIPct}
                        </span>
                      </label>
                    </div>
                    <button
                      type="button"
                      className="mt-2 text-xs text-forge-subtle underline"
                      onClick={() => {
                        setTowerScenario(id, {
                          scenarioOffshorePct: o.baseline.offshorePct,
                          scenarioAIPct: o.baseline.aiPct,
                        });
                        setProgram(getAssessProgram());
                      }}
                    >
                      Reset scenario to L4 baseline
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
        <p className="mt-6 text-center text-xs text-forge-hint">
          Formulas: each lever applies weight × (pct/100) to the tower pool; combined is capped
          at {program.global.combinedCapPct}% of the pool in combine mode: capped.
        </p>
      </div>
    </PageShell>
  );
}
