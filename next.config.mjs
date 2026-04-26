/** @type {import('next').NextConfig} */
const nextConfig = {
  // Avoid occasional Windows build races where webpack chunks resolve from the wrong cwd.
  experimental: {
    webpackBuildWorker: false,
  },
  serverExternalPackages: ["postgres"],
  async redirects() {
    return [
      // The original /assess hub split into /capability-map (step 1) and
      // /assessment (step 2). External links from older docs / decks land
      // on /capability-map by default — that's the workshop's first step.
      {
        source: "/assess",
        destination: "/capability-map",
        permanent: true,
      },
      {
        source: "/assess/summary",
        destination: "/assessment/summary",
        permanent: true,
      },
      {
        source: "/assess/tower/:towerId",
        destination: "/capability-map/tower/:towerId",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
