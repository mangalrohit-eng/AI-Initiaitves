import type { Process } from "@/data/types";
import { ProcessCard } from "./ProcessCard";

export function ProcessList({ towerSlug, processes }: { towerSlug: string; processes: Process[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {processes.map((p) => (
        <ProcessCard key={p.id} towerSlug={towerSlug} process={p} />
      ))}
    </div>
  );
}
