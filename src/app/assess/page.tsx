import { Suspense } from "react";
import { AssessHubClient } from "@/components/assess/AssessHubClient";

export default function AssessHubPage() {
  return (
    <Suspense fallback={<div className="px-6 py-12 text-sm text-forge-subtle">Loading…</div>}>
      <AssessHubClient />
    </Suspense>
  );
}
