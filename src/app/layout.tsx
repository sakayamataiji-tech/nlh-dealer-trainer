import type { Metadata, Viewport } from "next";
import "./globals.css";
import { HtmlLang } from "@/i18n";

export const metadata: Metadata = {
  title: "NLH Dealer Trainer",
  description: "Fast. Accurate. Decisive. — 速く、正確に、判断する。NLH dealer judgment training.",
  appleWebApp: { capable: true, title: "Dealer Trainer", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0b0e0d",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="antialiased">
        <HtmlLang />
        {children}
      </body>
    </html>
  );
}
