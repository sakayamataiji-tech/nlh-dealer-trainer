import type { MetadataRoute } from "next";
import { ROUTES, SITE } from "@/config/site";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return ROUTES.map((r) => ({
    url: `${SITE.url}${r}`,
    changeFrequency: "monthly",
    priority: r === "/" ? 1 : r.startsWith("/train/") ? 0.8 : 0.3,
  }));
}
