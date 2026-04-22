"use client";

import * as React from "react";
import { markChangelogVisited } from "@/lib/localStore";

// Headless — stamps "last visited" when the user opens /changelog so the
// top-nav's unread dot clears. Placed on the changelog page only.
export function ChangelogClient() {
  React.useEffect(() => {
    markChangelogVisited();
  }, []);
  return null;
}
