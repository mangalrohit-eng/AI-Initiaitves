import Link from "next/link";
import { Rss } from "lucide-react";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { PageShell } from "@/components/PageShell";
import { changelog, type ChangelogKind } from "@/data/changelog";
import { ChangelogClient } from "@/components/collab/ChangelogClient";

export const metadata = {
  title: "What's new — Forge Program portal",
  description:
    "Human-readable history of updates to the Versant Forge Program portal.",
};

const KIND_LABEL: Record<ChangelogKind, string> = {
  release: "Release",
  tower: "Tower",
  initiative: "Initiative",
  brief: "Brief",
  fix: "Polish",
};

const KIND_STYLES: Record<ChangelogKind, string> = {
  release:
    "border-accent-purple/30 bg-accent-purple/10 text-accent-purple-dark",
  tower: "border-forge-border bg-forge-well text-forge-body",
  initiative: "border-forge-border bg-forge-well text-forge-body",
  brief: "border-forge-border bg-forge-well text-forge-body",
  fix: "border-emerald-200 bg-emerald-50 text-emerald-900",
};

export default function ChangelogPage() {
  const entries = [...changelog].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
  return (
    <PageShell>
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "What's new" }]} />
        <ChangelogClient />

        <header className="mt-6 flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <h1 className="font-display text-3xl font-semibold tracking-tight text-forge-ink sm:text-4xl">
              What&apos;s new
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-forge-body">
              A running log of meaningful changes to the portal — new releases,
              polish, and tower-level content updates. Subscribe to the RSS
              feed to get alerts in Outlook, Teams, or Slack without us having
              to send another email.
            </p>
          </div>
          <Link
            href="/feed.xml"
            className="inline-flex items-center gap-1.5 rounded-lg border border-forge-border bg-forge-surface px-3 py-1.5 text-xs font-medium text-forge-body shadow-sm transition hover:border-accent-purple/40 hover:text-accent-purple-dark"
          >
            <Rss className="h-3.5 w-3.5" />
            Subscribe (RSS)
          </Link>
        </header>

        <section className="mt-10">
          <ol className="relative space-y-6 border-l border-forge-border pl-6">
            {entries.map((e) => (
              <li
                key={e.id}
                id={e.id}
                className="scroll-mt-24 rounded-2xl border border-forge-border bg-forge-surface p-5 shadow-card"
              >
                <span
                  className="absolute -left-[7px] mt-1 inline-flex h-3 w-3 rounded-full bg-accent-purple ring-4 ring-forge-page"
                  aria-hidden
                />
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  <time
                    dateTime={e.date}
                    className="font-mono text-forge-subtle"
                  >
                    {formatDate(e.date)}
                  </time>
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 font-semibold ${KIND_STYLES[e.kind]}`}
                  >
                    {KIND_LABEL[e.kind]}
                  </span>
                </div>
                <h2 className="mt-2 font-display text-lg font-semibold text-forge-ink">
                  {e.title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-forge-body">
                  {e.summary}
                </p>
                {e.href ? (
                  <Link
                    href={e.href}
                    className="mt-3 inline-flex text-xs font-medium text-accent-purple-dark hover:underline"
                  >
                    Read more →
                  </Link>
                ) : null}
              </li>
            ))}
          </ol>
        </section>
      </div>
    </PageShell>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}
