import { AssessSyncProvider } from "@/components/assess/AssessSyncProvider";

/**
 * Tower routes (`/tower/[slug]`, plus deep-dive `process` and `brief` pages)
 * read AND write the AssessProgramV4 envelope via `localStore` — the AI
 * Initiatives section now lets a Tower Lead validate or reject ideas, and
 * those decisions ride on `TowerAssessState.initiativeReviews`.
 *
 * `AssessSyncProvider` is what hydrates localStorage from `/api/assess` on
 * mount and debounced-PUTs writes back. Without it on this route, reviews
 * would persist locally but never reach Postgres — and a later visit to
 * `/capability-map` (which DOES mount the provider) would overwrite the
 * unsynced reviews with the older DB state on its load() call. Mounting it
 * here keeps cross-session, cross-browser persistence working end-to-end.
 *
 * Same shell as `app/capability-map/layout.tsx` and `app/impact-levers/layout.tsx`.
 */
export default function TowerLayout({ children }: { children: React.ReactNode }) {
  return <AssessSyncProvider>{children}</AssessSyncProvider>;
}
