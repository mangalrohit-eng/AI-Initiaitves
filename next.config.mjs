/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow `next build` to write into a separate output dir from `next dev` so a
  // local build-check doesn't fight the running dev server for file locks on
  // `.next/`. Vercel and `next start` use the default `.next` because the env
  // var is unset there. Locally: `npm run build:check` sets it to `.next-build`.
  distDir: process.env.NEXT_BUILD_DIR || ".next",
  // Avoid occasional Windows build races where webpack chunks resolve from the wrong cwd.
  experimental: {
    webpackBuildWorker: false,
    // Next 14: use experimental key. (`serverExternalPackages` is Next 15+.)
    serverComponentsExternalPackages: ["postgres"],
  },
  async redirects() {
    return [
      // The original /assess hub split into /capability-map (step 1) and
      // /impact-levers (step 2). External links from older docs / decks land
      // on /capability-map by default — that's the assessment's first step.
      {
        source: "/assess",
        destination: "/capability-map",
        permanent: true,
      },
      {
        source: "/assess/summary",
        destination: "/impact-levers/summary",
        permanent: true,
      },
      {
        source: "/assess/tower/:towerId",
        destination: "/capability-map/tower/:towerId",
        permanent: true,
      },
      // Step 2 was renamed from "Assessment" to "Configure Impact Levers".
      // Keep the old paths working so deep links and bookmarks survive.
      {
        source: "/assessment",
        destination: "/impact-levers",
        permanent: true,
      },
      {
        source: "/assessment/summary",
        destination: "/impact-levers/summary",
        permanent: true,
      },
      {
        source: "/assessment/tower/:towerId",
        destination: "/impact-levers/tower/:towerId",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
