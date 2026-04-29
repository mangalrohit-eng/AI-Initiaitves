import * as React from "react";
import type { Tower } from "@/data/types";
import { TowerCard } from "./TowerCard";

export function TowerGrid({
  towers,
  footerByTowerId,
}: {
  towers: Tower[];
  footerByTowerId?: Partial<Record<string, React.ReactNode>>;
}) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
      {towers.map((t, i) => (
        <TowerCard key={t.id} tower={t} index={i} footer={footerByTowerId?.[t.id]} />
      ))}
    </div>
  );
}
