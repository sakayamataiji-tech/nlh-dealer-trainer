/**
 * Site-wide settings for the production release.
 *
 * Fill in `operator` and `contact` before the public launch (see docs/RELEASE.md):
 * they appear in the privacy policy, the terms of use and the footer.
 */
export const SITE = {
  name: "NLH Dealer Trainer",
  /** Absolute site URL (set at build time from the custom domain; no trailing slash). */
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? "",
  version: process.env.NEXT_PUBLIC_APP_VERSION ?? "dev",
  /** Operator shown in the legal pages. TODO(release): replace before launch. */
  operator: { ja: "【運営者名】", en: "[Operator name]" },
  /** Contact (email address or form URL). TODO(release): replace before launch. */
  contact: "【お問い合わせ先】",
  /** Legal pages' effective date. */
  legalDate: "2026-10-01",
} as const;

/** True while the operator/contact placeholders are still in place. */
export const SITE_NEEDS_OPERATOR_INFO = SITE.operator.ja.startsWith("【") || SITE.contact.startsWith("【");

/** Public routes (used for the sitemap and offline precache). */
export const ROUTES = ["/", "/train/hand/", "/train/winner/", "/train/side-pot/", "/train/rake/", "/train/quick/", "/train/weakness/", "/stats/", "/privacy/", "/terms/"] as const;
