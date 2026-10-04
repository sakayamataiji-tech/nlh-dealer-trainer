import { notFound } from "next/navigation";
import { TrainingSession } from "@/features/training/TrainingSession";
import { MODE_META, SLUG_TO_MODE } from "@/features/training/modeMeta";

export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(SLUG_TO_MODE).map((slug) => ({ mode: slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ mode: string }> }) {
  const { mode } = await params;
  const key = SLUG_TO_MODE[mode];
  return { title: key ? MODE_META[key].title : "Training", alternates: { canonical: key ? `train/${MODE_META[key].slug}/` : "./" } };
}

export default async function TrainPage({ params }: { params: Promise<{ mode: string }> }) {
  const { mode } = await params;
  const key = SLUG_TO_MODE[mode];
  if (!key) notFound();
  return <TrainingSession modeKey={key} />;
}
