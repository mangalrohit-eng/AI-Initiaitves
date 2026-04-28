import Link from "next/link";
import { TowerGridFilterable } from "@/components/towers/TowerGridFilterable";
import { PageShell } from "@/components/PageShell";
import { towers } from "@/data/towers";

export default function TowersPage() {
  return (
    <PageShell>
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 text-xs text-forge-subtle">
            <Link href="/" className="text-forge-body underline hover:text-accent-purple-dark">
              Program home
            </Link>
            <span className="text-forge-hint" aria-hidden>
              /
            </span>
            <span>AI Initiatives</span>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-purple/30 bg-accent-purple/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-accent-purple-dark">
              Step 4 of 5
            </span>
            <h1 className="font-display text-3xl font-semibold tracking-tight text-forge-ink sm:text-4xl">
              <span className="font-mono text-accent-purple-dark">&gt;</span> Design AI initiatives
            </h1>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-forge-body">
            Pick a tower to open its sequenced AI roadmap, four-lens initiative detail, and agent
            architecture. Every per-L3 dollar shown here is the modeled AI saving from the dial set
            on{" "}
            <Link
              href="/impact-levers"
              className="text-accent-purple-dark underline-offset-2 hover:underline"
            >
              Step 2 — Configure Impact Levers
            </Link>
            ; raise or lower a dial there and the corresponding capability immediately reflects on
            this view.
          </p>
        </div>

        <div className="mt-8">
          <TowerGridFilterable towers={towers} />
        </div>
      </div>
    </PageShell>
  );
}
