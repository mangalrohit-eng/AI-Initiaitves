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
        "rounded-2xl border bg-forge-surface p-4 sm:p-5 shadow-sm",
        tone === "legacy" ? "border-forge-border" : "border-forge-border border-l-4 border-l-accent-purple",
      )}
    >
      <div className="text-xs font-semibold uppercase tracking-wide text-forge-hint">{title}</div>
      <div className="mt-4 space-y-3">
        {tools.map((t) => (
          <div key={t.tool} className="rounded-xl border border-forge-border bg-forge-well p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold text-forge-ink">{t.tool}</div>
              <span className="rounded-full border border-forge-border bg-forge-surface px-2 py-0.5 text-[10px] text-forge-subtle">
                {t.category}
              </span>
            </div>
            <div className="mt-2 text-xs text-forge-body">{t.usage}</div>
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
        <Column title="Tools today" tools={workbench.pre} tone="legacy" />
        <Column title="Tools with agentic AI" tools={workbench.post} tone="ai" />
      </div>
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-forge-hint">Key shifts</div>
        <ul className="mt-2 space-y-2 text-sm text-forge-body">
          {workbench.keyShifts.map((k) => (
            <li key={k} className="flex gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-purple" />
              <span>{k}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
