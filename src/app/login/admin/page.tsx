import { AdminLoginForm } from "@/app/login/admin/AdminLoginForm";

export default function AdminLoginPage({
  searchParams,
}: {
  searchParams?: { from?: string };
}) {
  const from =
    typeof searchParams?.from === "string" && searchParams.from.startsWith("/")
      ? searchParams.from
      : "/program/lead-deadlines";

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
                <rect x="4" y="4" width="16" height="16" rx="2" />
                <path d="M9 12h6" />
              </svg>
            </div>
            <div>
              <div className="text-base font-semibold tracking-tight text-white">
                Program admin
              </div>
              <div className="text-xs text-white/50">Sign in to edit lead deadlines</div>
            </div>
          </div>

          <AdminLoginForm redirectTo={from} />

          <p className="mt-6 text-[11px] leading-relaxed text-white/40">
            Sign in at <span className="font-mono">/login</span> first (workshop session,{" "}
            <span className="font-mono">AUTH_*</span>). This form uses{" "}
            <span className="font-mono">FORGE_ADMIN_*</span> for lead deadlines only.
          </p>
        </div>
      </div>
    </div>
  );
}
