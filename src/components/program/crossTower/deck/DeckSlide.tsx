"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export function DeckSlide({
  children,
  isLast,
  className,
}: {
  children: React.ReactNode;
  isLast?: boolean;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "deck-slide relative mx-auto mb-6 flex min-h-[min(72vw,540px)] w-full max-w-[960px] flex-col rounded-xl border border-forge-border bg-forge-surface p-6 shadow-card print:mb-0 print:max-w-none print:min-h-0 print:rounded-none print:border-0 print:p-0 print:shadow-none",
        isLast && "deck-slide-last mb-0",
        className,
      )}
    >
      {children}
    </section>
  );
}
