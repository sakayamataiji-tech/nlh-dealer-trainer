import type { Metadata, Viewport } from "next";
import "./globals.css";
import { HtmlLang } from "@/i18n";
import { ServiceWorker } from "@/components/ServiceWorker";
import { SITE } from "@/config/site";

const description =
  "NLHディーラーのための判断力トレーニング。役判定・勝者判定・ポット計算・サイドポット計算を、実際の卓に近い形で練習できる無料アプリ。/ Free training app for No-Limit Hold'em dealers: hand reading, winner judgment, pot and side pot calculation.";

export const metadata: Metadata = {
  metadataBase: new URL(`${SITE.url}/`),
  title: { default: `${SITE.name} — 速く、正確に、判断する。`, template: `%s | ${SITE.name}` },
  description,
  applicationName: SITE.name,
  keywords: ["poker dealer", "NLH", "No-Limit Hold'em", "side pot", "pot calculation", "ポーカー", "ディーラー", "サイドポット", "トレーニング"],
  alternates: { canonical: "./" },
  openGraph: {
    type: "website",
    siteName: SITE.name,
    title: SITE.name,
    description,
    url: "./",
    images: [{ url: "og.png", width: 1200, height: 630, alt: SITE.name }],
    locale: "ja_JP",
    alternateLocale: ["en_US"],
  },
  twitter: { card: "summary_large_image", title: SITE.name, description, images: ["og.png"] },
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
        <ServiceWorker />
        {children}
      </body>
    </html>
  );
}
