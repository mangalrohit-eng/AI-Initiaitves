"use client";

import { usePathname } from "next/navigation";

// Hides its children on unbranded routes (currently only /login).
// Used to suppress the branded TopNav/Footer on the sign-in screen.
export function ChromeGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/login") return null;
  return <>{children}</>;
}
