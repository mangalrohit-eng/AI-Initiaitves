/** @type {import('next').NextConfig} */
const nextConfig = {
  // Avoid occasional Windows build races where webpack chunks resolve from the wrong cwd.
  experimental: {
    webpackBuildWorker: false,
  },
};

export default nextConfig;
