"use client";
import { LegalPage } from "@/components/LegalPage";
import { privacyPolicy } from "@/content/legal";

export default function PrivacyPage() {
  return <LegalPage doc={privacyPolicy} />;
}
