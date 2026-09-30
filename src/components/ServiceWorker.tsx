"use client";
import { useEffect } from "react";
import { SITE } from "@/config/site";

/** Registers the offline service worker in production builds. */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register(`${SITE.basePath}/sw.js`, { scope: `${SITE.basePath}/` }).catch(() => undefined);
  }, []);
  return null;
}
