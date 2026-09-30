import type { NextConfig } from "next";
import { execSync } from "node:child_process";
import pkg from "./package.json";

// Deploy workflow sets these: "/<repo>" on github.io, "" on a custom domain.
const basePath = process.env.PAGES_BASE_PATH ?? "";
const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";

function commit(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "local";
  }
}

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  basePath,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
    NEXT_PUBLIC_SITE_URL: siteUrl,
    NEXT_PUBLIC_APP_VERSION: `${pkg.version}+${commit()}`,
  },
};

export default nextConfig;
