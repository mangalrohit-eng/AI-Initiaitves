import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Restricted access. Please sign in to continue.",
  robots: { index: false, follow: false },
};

// Unbranded sign-in screen. Deliberately contains no client or company names.
export default function LoginPage({
  searchParams,
}: {
  searchParams?: { from?: string };
}) {
  const from = typeof searchParams?.from === "string" ? searchParams.from : "/";
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0B0B14] px-4 py-12">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-white/10 bg-[#14141F] p-8 shadow-[0_20px_60px_rgba(0,0,0,0.45)] sm:p-10">
          <div className="mb-7 flex items-center gap-3">
            <div
              aria-hidden
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/15 bg-white/[0.04]"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5 text-white/80"
              >
                <rect x="4" y="11" width="16" height="9" rx="2" />
                <path d="M8 11V8a4 4 0 0 1 8 0v3" />
              </svg>
            </div>
            <div>
              <div className="text-base font-semibold tracking-tight text-white">
                Restricted access
              </div>
              <div className="text-xs text-white/50">Sign in to continue</div>
            </div>
          </div>

          <LoginForm redirectTo={from} />

          <p className="mt-6 text-[11px] leading-relaxed text-white/40">
            This environment is private. Unauthorized access is prohibited.
          </p>
        </div>
      </div>
    </div>
  );
}
