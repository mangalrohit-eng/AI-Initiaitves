import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/data/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        accent: {
          purple: "#A100FF",
          "purple-dark": "#7500C0",
          "purple-light": "#D966FF",
          surface: "#16213E",
          ink: "#1A1A2E",
          mist: "#F5F5F7",
          green: "#00C853",
          amber: "#FFB300",
          red: "#FF3D00",
          teal: "#00BFA5",
        },
      },
      fontFamily: {
        display: ["var(--font-dm-sans)", "system-ui", "sans-serif"],
        sans: ["var(--font-ibm-plex)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains)", "ui-monospace", "monospace"],
      },
      backgroundImage: {
        "hero-glow":
          "radial-gradient(ellipse at 20% 0%, rgba(161,0,255,0.35), transparent 55%), radial-gradient(ellipse at 80% 20%, rgba(0,191,165,0.12), transparent 50%)",
        "card-border":
          "linear-gradient(135deg, rgba(161,0,255,0.9), rgba(0,191,165,0.35), rgba(161,0,255,0.55))",
      },
      boxShadow: {
        glow: "0 0 40px rgba(161,0,255,0.25)",
      },
    },
  },
  plugins: [],
};
export default config;
