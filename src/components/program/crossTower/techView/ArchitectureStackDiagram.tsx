"use client";

import { AlertTriangle, Boxes, Cloud, Cpu, Database, ServerCog, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  ARCHITECTURE_LAYERS,
  type ArchitectureLayer,
} from "@/lib/techView/architectureBlueprint";

/**
 * Layered architecture stack — six top-down bands, each labeled with vendors
 * + a one-line role. Layers affected by the NBCU TSA carve-out get a small
 * inline callout so the executive sees where shared-services dependency
 * still gates the design.
 *
 * Fully deterministic — no LLM authorship.
 */
export function ArchitectureStackDiagram() {
  return (
    <div className="space-y-3">
      <header>
        <h3 className="font-display text-base font-semibold text-forge-ink">
          <span className="font-mono text-accent-purple-dark">&gt;</span> Architecture stack
        </h3>
        <p className="mt-1 text-xs text-forge-subtle">
          Six layers, top-down. Each layer&apos;s role is independent and replaceable;
          all layers run on the same identity, observability, and audit substrate.
        </p>
      </header>

      <ul className="space-y-2">
        {ARCHITECTURE_LAYERS.map((layer) => (
          <LayerBand key={layer.id} layer={layer} />
        ))}
      </ul>

      <div className="rounded-xl border border-accent-amber/35 bg-accent-amber/[0.04] px-3 py-2 text-[11px] leading-relaxed text-forge-body">
        <span className="inline-flex items-center gap-1.5 font-semibold text-forge-ink">
          <AlertTriangle className="h-3.5 w-3.5 text-accent-amber" aria-hidden />
          NBCU TSA carve-out
        </span>{" "}
        — Data fabric, source systems, and cloud foundation flow through NBCU
        shared services until the Transition Services Agreement expires
        (~2028). Each layer must reach standalone Versant capability before the
        carve-out, or the program slips.
      </div>
    </div>
  );
}

function LayerBand({ layer }: { layer: ArchitectureLayer }) {
  const Icon = layerIcon(layer.id);
  return (
    <li
      className={`overflow-hidden rounded-xl border bg-forge-surface ${
        layer.affectedByTSA ? "border-accent-amber/30" : "border-forge-border"
      }`}
    >
      <div className="grid gap-3 px-3 py-3 lg:grid-cols-[260px_minmax(0,1fr)]">
        <div className="flex items-start gap-2.5">
          <span
            className={`inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${
              layer.affectedByTSA
                ? "bg-accent-amber/15 text-accent-amber"
                : "bg-accent-purple/10 text-accent-purple-dark"
            }`}
          >
            <Icon className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-forge-ink">{layer.name}</div>
            <p className="mt-0.5 text-[11px] leading-relaxed text-forge-body">
              {layer.summary}
            </p>
            {layer.affectedByTSA ? (
              <div className="mt-1 inline-flex items-center gap-1 rounded-full border border-accent-amber/40 bg-accent-amber/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-900">
                <AlertTriangle className="h-2.5 w-2.5" aria-hidden />
                TSA carve-out
              </div>
            ) : null}
          </div>
        </div>

        <ul className="flex flex-wrap content-start gap-1.5">
          {layer.vendors.map((v) => (
            <li
              key={v.name}
              title={v.role}
              className="rounded-md border border-forge-border bg-forge-well/50 px-2 py-0.5 text-[11px] text-forge-body"
            >
              {v.name}
            </li>
          ))}
        </ul>
      </div>
    </li>
  );
}

function layerIcon(id: string): LucideIcon {
  switch (id) {
    case "workbench":
      return Sparkles;
    case "agents":
      return Boxes;
    case "ai-platform":
      return Cpu;
    case "data-fabric":
      return Database;
    case "source-systems":
      return ServerCog;
    case "cloud-foundation":
    default:
      return Cloud;
  }
}
