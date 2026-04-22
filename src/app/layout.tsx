import type { Metadata } from "next";
import { DM_Sans, IBM_Plex_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { TopNav } from "@/components/layout/TopNav";
import { Footer } from "@/components/layout/Footer";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

const ibmPlex = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-ibm-plex",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Forge Program — Agentic AI Tower Explorer",
  description:
    "Versant Media Group Forge Program: interactive view of 13 functional towers, AI-eligible processes, and agent architectures.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${dmSans.variable} ${ibmPlex.variable} ${jetbrains.variable} min-h-screen bg-forge-page font-sans text-forge-ink antialiased`}
      >
        <div className="relative z-10 flex min-h-screen flex-col">
          <TopNav />
          <main className="flex-1">{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
