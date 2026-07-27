import type { Metadata, Viewport } from "next";
import { PWARegister } from "@/components/pwa/PWARegister";
import "./globals.css";

export const metadata: Metadata = {
  title: "EMAB ERP — Gestion commerciale multi-magasins",
  description: "Plateforme de gestion commerciale pour réseaux de boutiques",
  manifest: "/manifest.json",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "EMAB ERP" },
};

export const viewport: Viewport = {
  themeColor: "#1f63e0",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <PWARegister />
        {children}
      </body>
    </html>
  );
}
