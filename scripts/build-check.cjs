/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * Local build verification that does NOT collide with a running `next dev`.
 *
 * Why this exists:
 *   `next build` and `next dev` both write to whatever `distDir` resolves to in
 *   `next.config.mjs`. If the dev server is up on .next/, a parallel
 *   `next build` will trip over locked webpack chunks (Windows file locks) or
 *   silently corrupt the dev cache. There is no port conflict — `next build`
 *   doesn't bind a port — only a filesystem conflict.
 *
 * Fix: this script sets NEXT_BUILD_DIR=.next-build before spawning `next build`.
 * `next.config.mjs` reads that env var and points `distDir` at `.next-build/`,
 * so dev keeps using `.next/` undisturbed and the build artefacts land in a
 * sibling folder that is gitignored.
 *
 * Vercel still calls `npm run build` (NOT this script), which leaves
 * NEXT_BUILD_DIR unset and writes to the default `.next/` — production
 * deploys are unaffected.
 */
const { spawn } = require("node:child_process");
const path = require("node:path");

const env = { ...process.env, NEXT_BUILD_DIR: ".next-build" };
const isWindows = process.platform === "win32";
const nextBin = path.join(
  "node_modules",
  ".bin",
  isWindows ? "next.cmd" : "next",
);

const child = spawn(nextBin, ["build"], {
  stdio: "inherit",
  env,
  shell: isWindows,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.exit(1);
  }
  process.exit(code ?? 0);
});
