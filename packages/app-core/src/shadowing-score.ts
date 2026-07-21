import type { ShadowingAttemptMetrics } from "@toeicpass/shared";

export interface ScoreWeights {
  pronunciation: number;
  fluency: number;
}

export interface ScoreResult {
  total: number;
  grade: "S" | "A" | "B" | "C" | "D";
  breakdown: {
    pronunciationWeighted: number;
    fluencyWeighted: number;
    completenessPenalty: number;
  };
}

export interface ScoreCalculatorOptions {
  weights?: Partial<ScoreWeights>;
  completenessThreshold?: number;
  maxCompletenessPenalty?: number;
}

export interface ShadowingMetricSuggestionInput {
  referenceText: string;
  recordedDurationMs: number;
  language: "en" | "ja";
}

const DEFAULT_WEIGHTS: ScoreWeights = {
  pronunciation: 0.6,
  fluency: 0.4,
};

export class ScoreCalculator {
  private readonly weights: ScoreWeights;
  private readonly completenessThreshold: number;
  private readonly maxCompletenessPenalty: number;

  constructor(options: ScoreCalculatorOptions = {}) {
    const w = { ...DEFAULT_WEIGHTS, ...(options.weights ?? {}) };
    const sum = w.pronunciation + w.fluency;
    this.weights = {
      pronunciation: sum > 0 ? w.pronunciation / sum : DEFAULT_WEIGHTS.pronunciation,
      fluency: sum > 0 ? w.fluency / sum : DEFAULT_WEIGHTS.fluency,
    };
    this.completenessThreshold = options.completenessThreshold ?? 70;
    this.maxCompletenessPenalty = options.maxCompletenessPenalty ?? 15;
  }

  compute(metrics: ShadowingAttemptMetrics): ScoreResult {
    const pronunciation = clampScore(metrics.pronunciationScore);
    const fluency = clampScore(metrics.fluencyScore);
    const completeness = clampScore(metrics.completenessScore);

    const pronunciationWeighted = pronunciation * this.weights.pronunciation;
    const fluencyWeighted = fluency * this.weights.fluency;

    let completenessPenalty = 0;
    if (this.completenessThreshold > 0 && completeness < this.completenessThreshold) {
      const deficit = (this.completenessThreshold - completeness) / this.completenessThreshold;
      completenessPenalty = deficit * this.maxCompletenessPenalty;
    }

    const raw = pronunciationWeighted + fluencyWeighted - completenessPenalty;
    const total = Math.round(clampScore(raw) * 10) / 10;

    return {
      total,
      grade: toGrade(total),
      breakdown: {
        pronunciationWeighted: Math.round(pronunciationWeighted * 10) / 10,
        fluencyWeighted: Math.round(fluencyWeighted * 10) / 10,
        completenessPenalty: Math.round(completenessPenalty * 10) / 10,
      },
    };
  }
}

export function estimateReferenceDurationSec(text: string, language: "en" | "ja"): number {
  const normalized = text.trim();
  if (!normalized) {
    return 1.5;
  }
  if (language === "ja") {
    const compact = normalized.replace(/\s+/g, "");
    const contentLength = compact.replace(/[。、！？,.!?]/g, "").length;
    return Math.max(1.5, contentLength / 5.5);
  }

  const words = normalized.split(/\s+/).filter(Boolean).length;
  return Math.max(1.5, words / 2.8);
}

export function suggestShadowingMetrics(input: ShadowingMetricSuggestionInput): ShadowingAttemptMetrics {
  const referenceDurationSec = estimateReferenceDurationSec(input.referenceText, input.language);
  const recordedDurationSec = Math.max(0.2, input.recordedDurationMs / 1000);
  const ratio = recordedDurationSec / referenceDurationSec;
  const closeness = Math.max(0, Math.min(1, Math.min(ratio, 1 / ratio)));
  const completenessScore = Math.round(closeness * 100);
  const fluencyScore = Math.round(Math.max(50, Math.min(100, 55 + closeness * 40)));
  const pronunciationScore = Math.round(Math.max(60, Math.min(92, 65 + closeness * 22)));

  return {
    pronunciationScore,
    fluencyScore,
    completenessScore,
    wpm: input.language === "en" ? estimateWordsPerMinute(input.referenceText, recordedDurationSec) : undefined,
    pauseCount: 0,
  };
}

function estimateWordsPerMinute(text: string, durationSec: number): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  if (!words || durationSec <= 0) {
    return 0;
  }
  return Math.round((words / durationSec) * 60);
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function toGrade(score: number): ScoreResult["grade"] {
  if (score >= 90) return "S";
  if (score >= 80) return "A";
  if (score >= 70) return "B";
  if (score >= 60) return "C";
  return "D";
}
