"use client";

import * as React from "react";
import { markRead, pushRecent, type PinKind } from "@/lib/localStore";

type Props = {
  kind: PinKind;
  id: string;
  href: string;
  title: string;
  subtitle?: string;
};

// Headless component: on mount, records the page in the "Recently viewed"
// rail and timestamps the "last read" marker so ChangedSinceBadge can
// decide whether to show an "Updated" indicator on the user's next visit.
export function ViewTracker({ kind, id, href, title, subtitle }: Props) {
  React.useEffect(() => {
    pushRecent({ kind, id, href, title, subtitle });
    markRead(`${kind}:${id}`);
  }, [kind, id, href, title, subtitle]);
  return null;
}
