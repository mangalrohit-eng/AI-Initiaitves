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
        forge: {
          canvas: "#FFFFFF",
          page: "#F5F5F5",
          /** App chrome / legacy alias — opaque (pairs with `surface` for panels). */
          bg: "#F5F5F5",
          surface: "#FFFFFF",
          well: "#F0F0F0",
          "well-strong": "#E8E8E8",
          border: "#E0E0E0",
          "border-strong": "#D0D0D0",
          ink: "#1A1A2E",
          body: "#3D3D4A",
          subtle: "#6B6B78",
          hint: "#8E8E9A",
        },
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
      boxShadow: {
        glow: "0 4px 20px rgba(0, 0, 0, 0.08)",
        card: "0 1px 2px rgba(0, 0, 0, 0.04), 0 4px 16px rgba(0, 0, 0, 0.04)",
      },
    },
  },
  plugins: [],
};
export default config;
