import type { Process } from "@/data/types";
import { cn } from "@/lib/utils";

function Column({
  title,
  tools,
  tone,
}: {
  title: string;
  tools: Process["workbench"]["pre"];
  tone: "legacy" | "ai";
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-4 sm:p-5",
        tone === "legacy" ? "border-white/10 bg-white/[0.02]" : "border-accent-purple/25 bg-accent-purple/[0.06]",
      )}
    >
      <div className="text-xs font-semibold uppercase tracking-wide text-white/45">{title}</div>
      <div className="mt-4 space-y-3">
        {tools.map((t) => (
          <div key={t.tool} className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold text-white">{t.tool}</div>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] text-white/60">
                {t.category}
              </span>
            </div>
            <div className="mt-2 text-xs text-white/60">{t.usage}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function WorkbenchTab({ process }: { process: Process }) {
  const { workbench } = process;
  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <Column title="Pre-state workbench" tools={workbench.pre} tone="legacy" />
        <Column title="Post-state workbench" tools={workbench.post} tone="ai" />
      </div>
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-white/45">Key shifts</div>
        <ul className="mt-2 space-y-2 text-sm text-white/75">
          {workbench.keyShifts.map((k) => (
            <li key={k} className="flex gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-purple-light" />
              <span>{k}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
