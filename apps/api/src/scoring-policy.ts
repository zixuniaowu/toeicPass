import { clamp } from "./utils";
import { AttemptItem, AttemptMode } from "./types";

export function estimateRawCorrect(items: AttemptItem[], targetRaw: number): number {
  if (items.length === 0) {
    return 0;
  }
  const correct = items.filter((item) => item.isCorrect).length;
  return clamp(Math.round((correct / items.length) * targetRaw), 0, targetRaw);
}

export function toToeicScaledListening(rawCorrect: number): number {
  const ratio = clamp(rawCorrect / 100, 0, 1);
  const curved = Math.pow(ratio, 0.88);
  return clamp(Math.round(5 + curved * 490), 5, 495);
}

export function toToeicScaledReading(rawCorrect: number): number {
  const ratio = clamp(rawCorrect / 100, 0, 1);
  const curved = Math.pow(ratio, 0.9);
  return clamp(Math.round(5 + curved * 490), 5, 495);
}

export interface PredictionInput {
  baselineAnchor: number | null;
  scoredAttempts: Array<{
    scoreTotal: number;
    mode: AttemptMode;
    isRepresentative: boolean;
  }>;
}

export interface PredictionResult {
  predictedTotal: number;
  confidence: number;
  factors: {
    attemptsUsed: number;
    recentScore: number;
    baseline: number;
    baselineAnchor?: number;
    trend: number;
    variance: number;
  };
}

const MODE_WEIGHT: Record<AttemptMode, number> = {
  diagnostic: 0.85,
  practice: 0.7,
  mock: 1.0,
  ip_simulation: 0.95,
};

export function calculatePrediction(input: PredictionInput): PredictionResult {
  const { baselineAnchor, scoredAttempts } = input;

  const representative = scoredAttempts.filter((item) => item.isRepresentative);
  const completed = (representative.length > 0 ? representative : scoredAttempts).slice(0, 5);

  const weighted = completed.map((item, index) => {
    const recency = Math.max(0.6, 1 - index * 0.1);
    const quality = MODE_WEIGHT[item.mode];
    const weight = recency * quality;
    return { score: item.scoreTotal, weight };
  });
  const weightedSum = weighted.reduce((sum, item) => sum + item.score * item.weight, 0);
  const weightTotal = weighted.reduce((sum, item) => sum + item.weight, 0);
  const computedBaseline = weightTotal > 0 ? Math.round(weightedSum / weightTotal) : baselineAnchor ?? 400;
  const baseline =
    typeof baselineAnchor === "number"
      ? Math.round(computedBaseline * 0.65 + baselineAnchor * 0.35)
      : computedBaseline;
  const recent = completed[0]?.scoreTotal ?? baselineAnchor ?? baseline;
  const trend = completed.length >= 2 ? recent - (completed[1]?.scoreTotal ?? recent) : 0;
  let predictedTotal = clamp(Math.round(baseline * 0.7 + recent * 0.25 + trend * 0.05), 10, 990);
  if (typeof baselineAnchor === "number" && completed.length < 3) {
    predictedTotal = Math.max(predictedTotal, baselineAnchor - 10);
  }
  if (typeof baselineAnchor === "number") {
    predictedTotal = clamp(predictedTotal, baselineAnchor - 60, baselineAnchor + 180);
  }

  const variance =
    weighted.length <= 1
      ? 0
      : Math.round(
          weighted.reduce((sum, item) => sum + (item.score - baseline) ** 2, 0) / weighted.length,
        );
  const stability = clamp(1 - variance / 30000, 0.35, 1);
  const confidence = clamp(0.45 + completed.length * 0.07 * stability, 0.45, 0.93);

  return {
    predictedTotal,
    confidence,
    factors: {
      attemptsUsed: completed.length,
      recentScore: recent,
      baseline,
      ...(typeof baselineAnchor === "number" ? { baselineAnchor } : {}),
      trend,
      variance,
    },
  };
}
