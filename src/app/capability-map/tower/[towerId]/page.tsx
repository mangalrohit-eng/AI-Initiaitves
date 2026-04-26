import { notFound } from "next/navigation";
import { getTowerBySlug } from "@/lib/utils";
import { CapabilityMapTowerClient } from "@/components/assess/CapabilityMapTowerClient";
import type { TowerId } from "@/data/assess/types";
import { towers } from "@/data/towers";

const ids = new Set(towers.map((t) => t.id));

type Props = { params: { towerId: string } };

export default function CapabilityMapTowerPage({ params }: Props) {
  if (!ids.has(params.towerId)) notFound();
  const t = getTowerBySlug(params.towerId);
  if (!t) notFound();
  return (
    <CapabilityMapTowerClient
      towerId={params.towerId as TowerId}
      towerName={t.name}
    />
  );
}
