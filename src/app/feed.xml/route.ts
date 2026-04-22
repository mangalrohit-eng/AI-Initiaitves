import { changelog } from "@/data/changelog";

// Static Atom feed built at compile time. Deploys as a flat asset so feed
// readers (Outlook, Teams, Slack's /feed, Feedly) can poll it cheaply.
export const dynamic = "force-static";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://forge.example.com").replace(/\/$/, "");

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toAtomDate(iso: string): string {
  try {
    return new Date(iso).toISOString();
  } catch {
    return new Date().toISOString();
  }
}

function toEntry(entry: (typeof changelog)[number]): string {
  const url = entry.href ? `${APP_URL}${entry.href}` : `${APP_URL}/changelog#${entry.id}`;
  const updated = toAtomDate(entry.date);
  return `  <entry>
    <id>${escapeXml(`${APP_URL}/changelog#${entry.id}`)}</id>
    <title>${escapeXml(entry.title)}</title>
    <link rel="alternate" type="text/html" href="${escapeXml(url)}"/>
    <updated>${updated}</updated>
    <category term="${escapeXml(entry.kind)}"/>
    <summary type="text">${escapeXml(entry.summary)}</summary>
  </entry>`;
}

export function GET(): Response {
  const sorted = [...changelog].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
  const newest = sorted[0]?.date ?? new Date().toISOString();
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Forge program — what's new</title>
  <subtitle>Changes to Versant's AI operating-model explorer</subtitle>
  <link rel="alternate" type="text/html" href="${escapeXml(APP_URL)}"/>
  <link rel="self" type="application/atom+xml" href="${escapeXml(`${APP_URL}/feed.xml`)}"/>
  <id>${escapeXml(`${APP_URL}/feed.xml`)}</id>
  <updated>${toAtomDate(newest)}</updated>
${sorted.map(toEntry).join("\n")}
</feed>
`;
  return new Response(xml, {
    headers: {
      "content-type": "application/atom+xml; charset=utf-8",
      "cache-control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
