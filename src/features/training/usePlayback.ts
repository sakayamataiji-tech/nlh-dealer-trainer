"use client";
import { useCallback, useEffect, useState } from "react";
import type { PlaybackFrame } from "@/engine/playback";

const DURATION: Record<PlaybackFrame["phase"], number> = {
  start: 800,
  action: 700,
  return: 800,
  collect: 650,
  deal: 450,
};

/** Steps through playback frames; `done` once the last frame is reached. */
export function usePlayback(frames: PlaybackFrame[], speed: number) {
  const [index, setIndex] = useState(0);
  const last = frames.length - 1;
  const done = index >= last;

  useEffect(() => {
    if (index >= last) return;
    const id = setTimeout(() => setIndex((i) => Math.min(i + 1, last)), DURATION[frames[index].phase] / speed);
    return () => clearTimeout(id);
  }, [index, last, frames, speed]);

  const skip = useCallback(() => setIndex(last), [last]);
  const replay = useCallback(() => setIndex(0), []);
  return { frame: frames[Math.min(index, last)], prev: index > 0 ? frames[index - 1] : null, index, done, skip, replay };
}
