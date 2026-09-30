import { notFound } from "next/navigation";
import { TrainingSession } from "@/features/training/TrainingSession";
import { MODE_META, SLUG_TO_MODE } from "@/features/training/modeMeta";

export const dynamicParams = false;

export function generateStaticParams() {
  return Object.values(MODE_META).map((m) => ({ mode: m.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ mode: string }> }) {
  const { mode } = await params;
  const key = SLUG_TO_MODE[mode];
  return { title: key ? MODE_META[key].title : "Training", alternates: { canonical: `./` } };
}

export default async function TrainPage({ params }: { params: Promise<{ mode: string }> }) {
  const { mode } = await params;
  const key = SLUG_TO_MODE[mode];
  if (!key) notFound();
  return <TrainingSession modeKey={key} />;
}
