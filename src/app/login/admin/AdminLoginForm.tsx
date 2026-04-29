"use client";

import { useState } from "react";

export function AdminLoginForm({ redirectTo }: { redirectTo: string }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const safeRedirect =
    redirectTo && redirectTo.startsWith("/") && !redirectTo.startsWith("//")
      ? redirectTo
      : "/program/lead-deadlines";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/login/admin", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (res.status === 503) {
        setError(data.error ?? "Admin login is not configured on this deployment.");
        return;
      }
      if (!res.ok || !data.ok) {
        setError(data.error || "Sign in failed. Please try again.");
        return;
      }
      window.location.assign(safeRedirect);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const busy = isSubmitting;

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div>
        <label htmlFor="admin-username" className="mb-1.5 block text-xs font-medium text-white/70">
          Admin username
        </label>
        <input
          id="admin-username"
          name="username"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-white placeholder-white/30 outline-none transition focus:border-white/30 focus:bg-white/[0.06] focus:ring-2 focus:ring-white/10"
          placeholder="Admin username"
          disabled={busy}
        />
      </div>

      <div>
        <label htmlFor="admin-password" className="mb-1.5 block text-xs font-medium text-white/70">
          Admin password
        </label>
        <div className="relative">
          <input
            id="admin-password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-2.5 pr-20 text-sm text-white placeholder-white/30 outline-none transition focus:border-white/30 focus:bg-white/[0.06] focus:ring-2 focus:ring-white/10"
            placeholder="Admin password"
            disabled={busy}
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-[11px] font-medium text-white/50 transition hover:bg-white/5 hover:text-white/80"
            tabIndex={-1}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200"
        >
          {error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={busy || !username || !password}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-[#0B0B14] transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? "Signing in…" : "Sign in as program admin"}
      </button>
    </form>
  );
}
