import type { ShadowingAttemptMetrics } from "./types";
import { ScoreCalculator, type ScoreResult, suggestShadowingMetrics, estimateReferenceDurationSec } from "./shadowing-score";

export type ShadowingSentenceLike = {
  text: string;
};

export type ShadowingMaterialLike<TSentence extends ShadowingSentenceLike = ShadowingSentenceLike> = {
  id: string;
  sentences: TSentence[];
};

export type ShadowingReview = {
  recordedDurationMs: number;
  referenceDurationSec: number;
  metrics: ShadowingAttemptMetrics;
  score: ScoreResult;
};

export function selectActiveShadowingMaterial<TMaterial extends { id: string }>(
  materials: TMaterial[],
  materialId: string,
): TMaterial | null {
  return materials.find((material) => material.id === materialId) ?? null;
}

export function selectActiveShadowingSentence<
  TSentence extends ShadowingSentenceLike,
>(
  material: ShadowingMaterialLike<TSentence> | null,
  sentenceIndex: number,
): TSentence | null {
  if (!material || material.sentences.length === 0) {
    return null;
  }
  const boundedIndex = Math.min(sentenceIndex, Math.max(material.sentences.length - 1, 0));
  return material.sentences[boundedIndex] ?? null;
}

export function createShadowingReview(
  input: {
    referenceText: string;
    recordedDurationMs: number;
    language: "en" | "ja";
  },
  calculator: ScoreCalculator = new ScoreCalculator(),
): ShadowingReview | null {
  const referenceText = input.referenceText.trim();
  if (!referenceText) {
    return null;
  }

  const referenceDurationSec = estimateReferenceDurationSec(referenceText, input.language);
  const metrics = suggestShadowingMetrics({
    referenceText,
    recordedDurationMs: input.recordedDurationMs,
    language: input.language,
  });

  return {
    recordedDurationMs: input.recordedDurationMs,
    referenceDurationSec,
    metrics,
    score: calculator.compute(metrics),
  };
}

export function updateShadowingReviewMetric(
  review: ShadowingReview,
  metric: keyof Pick<ShadowingAttemptMetrics, "pronunciationScore" | "fluencyScore" | "completenessScore">,
  value: number,
  calculator: ScoreCalculator = new ScoreCalculator(),
): ShadowingReview {
  const metrics = {
    ...review.metrics,
    [metric]: value,
  };

  return {
    ...review,
    metrics,
    score: calculator.compute(metrics),
  };
}
