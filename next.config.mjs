/** @type {import('next').NextConfig} */
const nextConfig = {
  // Avoid occasional Windows build races where webpack chunks resolve from the wrong cwd.
  experimental: {
    webpackBuildWorker: false,
  },
  serverExternalPackages: ["postgres"],
};

export default nextConfig;
