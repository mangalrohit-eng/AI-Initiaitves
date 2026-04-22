import type { Process } from "@/data/types";
import { Badge } from "@/components/ui/Badge";

export function DigitalCoreTab({ process }: { process: Process }) {
  const d = process.digitalCore;
  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-forge-hint">Platform requirements</div>
        <div className="mt-3 overflow-x-auto rounded-xl border border-forge-border bg-forge-surface shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-forge-well text-xs uppercase tracking-wide text-forge-subtle">
              <tr>
                <th className="px-4 py-3">Platform</th>
                <th className="px-4 py-3">Purpose</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Examples</th>
              </tr>
            </thead>
            <tbody>
              {d.requiredPlatforms.map((p) => (
                <tr key={p.platform} className="border-t border-forge-border">
                  <td className="px-4 py-3 font-medium text-forge-ink">{p.platform}</td>
                  <td className="px-4 py-3 text-forge-body">{p.purpose}</td>
                  <td className="px-4 py-3">
                    <Badge tone={p.priority}>{p.priority}</Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-forge-subtle">{p.examples.join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-forge-hint">Data requirements</div>
          <ul className="mt-2 space-y-2 text-sm text-forge-body">
            {d.dataRequirements.map((x) => (
              <li key={x} className="rounded-lg border border-forge-border bg-forge-well px-3 py-2">
                {x}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-forge-hint">Security considerations</div>
          <ul className="mt-2 space-y-2 text-sm text-forge-body">
            {d.securityConsiderations.map((x) => (
              <li key={x} className="rounded-lg border border-forge-border bg-forge-well px-3 py-2">
                {x}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-forge-hint">Integrations (conceptual)</div>
        <div className="mt-3 flex flex-wrap gap-2">
          {d.integrations.map((edge) => (
            <div
              key={edge}
              className="rounded-full border border-accent-purple/25 bg-forge-surface px-3 py-1 text-xs text-forge-body"
            >
              {edge}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-forge-border bg-forge-well p-4 text-sm text-forge-body">
        <span className="font-semibold text-forge-ink">Estimated build effort: </span>
        {d.estimatedBuildEffort}
      </div>
    </div>
  );
}
