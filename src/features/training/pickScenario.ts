import { generateScenario } from "@/engine/scenarioGenerator";
import { TRAINING_MODES, type Level, type Scenario, type TrainingMode } from "@/engine/scenarioTypes";
import { skillModes, type SkillTag } from "@/engine/skills";
import { pick, weightedPick, type Rng } from "@/engine/shuffle";
import { weaknesses } from "@/stats/aggregate";
import type { StatsData } from "@/stats/types";
import type { SessionModeKey } from "./modeMeta";

/** Chooses the next scenario for a session. Answers always come from the engine. */
export function pickScenario(modeKey: SessionModeKey, stats: StatsData, rng: Rng = Math.random): Scenario {
  const levelOf = (m: TrainingMode): Level => stats.settings.levels[m];
  if (modeKey === "quick") {
    const m = pick(rng, TRAINING_MODES);
    return generateScenario(m, levelOf(m), { rng });
  }
  if (modeKey === "weakness") {
    const weak = weaknesses(stats.records).slice(0, 4);
    if (weak.length === 0) {
      const m = pick(rng, TRAINING_MODES);
      return generateScenario(m, levelOf(m), { rng });
    }
    const item = weightedPick(rng, weak.map((w) => ({ value: w, weight: 1.1 - w.accuracy })));
    if (item.kind === "mode") {
      const m = item.key as TrainingMode;
      return generateScenario(m, levelOf(m), { rng });
    }
    const skill = item.key as SkillTag;
    const m = pick(rng, skillModes(skill));
    return generateScenario(m, levelOf(m), { rng, focus: skill });
  }
  return generateScenario(modeKey, levelOf(modeKey), { rng });
}
