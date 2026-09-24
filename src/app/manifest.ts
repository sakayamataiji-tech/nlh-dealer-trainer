import type { MetadataRoute } from "next";

export const dynamic = "force-static";

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Installable on phones ("Add to Home Screen") and launches full-screen. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "NLH Dealer Trainer",
    short_name: "Dealer Trainer",
    description: "速く、正確に、判断する。",
    start_url: `${base}/`,
    scope: `${base}/`,
    display: "standalone",
    orientation: "any",
    background_color: "#0b0e0d",
    theme_color: "#0b0e0d",
    icons: [
      { src: `${base}/icons/icon-192.png`, sizes: "192x192", type: "image/png" },
      { src: `${base}/icons/icon-512.png`, sizes: "512x512", type: "image/png" },
      { src: `${base}/icons/icon-512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
