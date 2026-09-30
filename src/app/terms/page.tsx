"use client";
import { LegalPage } from "@/components/LegalPage";
import { termsOfUse } from "@/content/legal";

export default function TermsPage() {
  return <LegalPage doc={termsOfUse} />;
}
