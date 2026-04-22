import type { Process } from "@/data/types";
import { Badge } from "@/components/ui/Badge";

export function DigitalCoreTab({ process }: { process: Process }) {
  const d = process.digitalCore;
  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-white/45">Platform requirements</div>
        <div className="mt-3 overflow-x-auto rounded-xl border border-white/10">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-white/45">
              <tr>
                <th className="px-4 py-3">Platform</th>
                <th className="px-4 py-3">Purpose</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Examples</th>
              </tr>
            </thead>
            <tbody>
              {d.requiredPlatforms.map((p) => (
                <tr key={p.platform} className="border-t border-white/10">
                  <td className="px-4 py-3 font-medium text-white">{p.platform}</td>
                  <td className="px-4 py-3 text-white/65">{p.purpose}</td>
                  <td className="px-4 py-3">
                    <Badge tone={p.priority}>{p.priority}</Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-white/55">{p.examples.join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-white/45">Data requirements</div>
          <ul className="mt-2 space-y-2 text-sm text-white/70">
            {d.dataRequirements.map((x) => (
              <li key={x} className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
                {x}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-white/45">Security considerations</div>
          <ul className="mt-2 space-y-2 text-sm text-white/70">
            {d.securityConsiderations.map((x) => (
              <li key={x} className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
                {x}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-white/45">Integrations (conceptual)</div>
        <div className="mt-3 flex flex-wrap gap-2">
          {d.integrations.map((edge) => (
            <div
              key={edge}
              className="rounded-full border border-accent-teal/25 bg-accent-teal/[0.06] px-3 py-1 text-xs text-white/75"
            >
              {edge}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-sm text-white/75">
        <span className="font-semibold text-white">Estimated build effort: </span>
        {d.estimatedBuildEffort}
      </div>
    </div>
  );
}
