"use client";

import type { AskBlock } from "@/lib/ask/types";
import { MetricBlock } from "./MetricBlock";
import { RankingBlock } from "./RankingBlock";
import { BreakdownBlock } from "./BreakdownBlock";
import { CompareBlock } from "./CompareBlock";
import { TowerSnapshotBlock } from "./TowerSnapshotBlock";
import { InitiativeBlock } from "./InitiativeBlock";
import { BrandLensBlock } from "./BrandLensBlock";
import { ProseBlock } from "./ProseBlock";
import { NoteBlock } from "./NoteBlock";

export function BlockRenderer({ block }: { block: AskBlock }) {
  switch (block.kind) {
    case "metric":
      return <MetricBlock block={block} />;
    case "ranking":
      return <RankingBlock block={block} />;
    case "breakdown":
      return <BreakdownBlock block={block} />;
    case "compare":
      return <CompareBlock block={block} />;
    case "towerSnapshot":
      return <TowerSnapshotBlock block={block} />;
    case "initiative":
      return <InitiativeBlock block={block} />;
    case "brandLens":
      return <BrandLensBlock block={block} />;
    case "prose":
      return <ProseBlock block={block} />;
    case "note":
      return <NoteBlock block={block} />;
    default: {
      const _exhaustive: never = block;
      void _exhaustive;
      return null;
    }
  }
}
