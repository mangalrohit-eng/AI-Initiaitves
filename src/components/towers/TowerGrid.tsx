import type { Tower } from "@/data/types";
import { TowerCard } from "./TowerCard";

export function TowerGrid({ towers }: { towers: Tower[] }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
      {towers.map((t, i) => (
        <TowerCard key={t.id} tower={t} index={i} />
      ))}
    </div>
  );
}
