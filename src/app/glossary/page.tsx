import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { PageShell } from "@/components/PageShell";
import { glossary, type GlossaryCategory } from "@/data/glossary";

const CATEGORY_ORDER: GlossaryCategory[] = [
  "Agents & architecture",
  "Operating model",
  "Prioritisation & delivery",
  "People & change",
];

export const metadata = {
  title: "Glossary — Forge Tower Explorer",
  description:
    "Plain-English definitions of the terms used across the Tower Explorer — agents, orchestration, lenses, priority tiers, and more.",
};

export default function GlossaryPage() {
  const grouped = CATEGORY_ORDER.map((c) => ({
    category: c,
    terms: glossary.filter((t) => t.category === c),
  }));

  return (
    <PageShell>
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Glossary" }]} />

        <div className="mt-6 max-w-3xl">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-forge-ink sm:text-4xl">
            Glossary
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-forge-body">
            Plain-English definitions of the terms used across the explorer. Hover the{" "}
            <span className="font-semibold">?</span> icon anywhere in the app to see the
            short version; this page has the full set.
          </p>
        </div>

        <nav
          aria-label="Glossary categories"
          className="mt-8 flex flex-wrap gap-2 rounded-2xl border border-forge-border bg-forge-surface p-3 shadow-sm"
        >
          {CATEGORY_ORDER.map((c) => (
            <a
              key={c}
              href={`#cat-${c.replace(/\s+/g, "-").replace(/&/g, "and").toLowerCase()}`}
              className="rounded-full border border-forge-border bg-forge-well px-3 py-1 text-xs font-medium text-forge-body transition hover:border-accent-purple/40 hover:text-accent-purple-dark"
            >
              {c}
            </a>
          ))}
        </nav>

        <div className="mt-10 space-y-12">
          {grouped.map(({ category, terms }) => {
            const anchor = `cat-${category.replace(/\s+/g, "-").replace(/&/g, "and").toLowerCase()}`;
            return (
              <section key={category} id={anchor}>
                <h2 className="font-display text-lg font-semibold text-forge-ink">{category}</h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {terms.map((t) => (
                    <article
                      key={t.id}
                      id={t.id}
                      className="scroll-mt-24 rounded-2xl border border-forge-border bg-forge-surface p-4 shadow-sm"
                    >
                      <div className="font-display text-sm font-semibold text-forge-ink">
                        {t.term}
                      </div>
                      <p className="mt-1 text-sm leading-relaxed text-forge-body">{t.short}</p>
                      {t.long ? (
                        <p className="mt-2 text-xs leading-relaxed text-forge-subtle">{t.long}</p>
                      ) : null}
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </PageShell>
  );
}
