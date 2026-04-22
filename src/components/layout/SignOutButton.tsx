"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export function SignOutButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isRequesting, setIsRequesting] = useState(false);

  async function handleClick() {
    setIsRequesting(true);
    try {
      await fetch("/api/logout", { method: "POST" });
    } catch {
      // Even if the request fails the cookie will eventually expire; fall through.
    }
    startTransition(() => {
      router.replace("/login");
      router.refresh();
    });
    setIsRequesting(false);
  }

  const busy = isPending || isRequesting;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      title="Sign out"
      aria-label="Sign out"
      className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-forge-body transition hover:bg-forge-well hover:text-forge-ink disabled:opacity-60"
    >
      <LogOut className="h-4 w-4" aria-hidden />
      <span className="hidden sm:inline">Sign out</span>
    </button>
  );
}
