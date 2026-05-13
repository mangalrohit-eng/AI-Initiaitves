import type { Metadata } from "next";
import { cookies } from "next/headers";
import { DM_Sans, IBM_Plex_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { TopNav } from "@/components/layout/TopNav";
import { Footer } from "@/components/layout/Footer";
import { ChromeGate } from "@/components/layout/ChromeGate";
import { ToastProvider } from "@/components/feedback/ToastProvider";
import { ClientModeProvider } from "@/lib/clientMode";
import { ADMIN_AUTH_COOKIE_NAME, isValidAdminSessionToken } from "@/lib/auth";

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
  title: "Versant Forge Program",
  description:
    "Versant Forge Program — Accenture × Versant Media Group joint transformation. A 5-module portfolio (Tower Capability Map, Tower AI Initiatives, Offshore Plan, Prototypes, Delivery Plan) sized to reset operating cost and compound revenue across the 13 functional towers.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const adminTok = cookies().get(ADMIN_AUTH_COOKIE_NAME)?.value;
  const allowUnprotectedView = await isValidAdminSessionToken(adminTok);

  return (
    <html lang="en">
      <body
        className={`${dmSans.variable} ${ibmPlex.variable} ${jetbrains.variable} min-h-screen bg-forge-page font-sans text-forge-ink antialiased`}
      >
        <ClientModeProvider allowUnprotectedView={allowUnprotectedView}>
          <ToastProvider>
            <div className="relative z-10 flex min-h-screen flex-col">
              <ChromeGate>
                <TopNav />
              </ChromeGate>
              <main className="flex-1">{children}</main>
              <ChromeGate>
                <Footer />
              </ChromeGate>
            </div>
          </ToastProvider>
        </ClientModeProvider>
      </body>
    </html>
  );
}
