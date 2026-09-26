export const PERIOD = 840;
export const DURATION = 60_000;
export type Grade = "perfect" | "good" | "soft";
export type HitEvent = { t: number };
export function judgeHit(elapsed: number): { grade: Grade; base: number; error: number } {
  const error = Math.abs(elapsed % PERIOD - PERIOD / 2);
  return { grade: error <= 58 ? "perfect" : error <= 140 ? "good" : "soft", base: error <= 58 ? 100 : error <= 140 ? 40 : 10, error };
}
export function scoreRun(events: HitEvent[]) {
  let score = 0, combo = 0, maxCombo = 0, perfect = 0, good = 0, lastBeat = -2;
  for (const { t } of events) {
    const beat = Math.floor(t / PERIOD);
    if (beat === lastBeat) continue;
    const result = judgeHit(t);
    combo = result.grade === "soft" ? 0 : (beat === lastBeat + 1 ? combo : 0) + 1;
    maxCombo = Math.max(maxCombo, combo);
    if (result.grade === "perfect") perfect++;
    if (result.grade === "good") good++;
    score += result.base + Math.min(combo * 2, 100);
    lastBeat = beat;
  }
  return { score, maxCombo, perfect, good, hits: events.length };
}
