/**
 * ScoreCalculator
 *
 * Computes a weighted composite score for a shadowing practice attempt.
 *
 * Default weighting (configurable):
 *   - Pronunciation : 60%
 *   - Fluency       : 40%
 *
 * An optional completeness penalty is applied when the user covers less than
 * a configurable threshold of the reference transcript.
 *
 * Usage:
 *   const calc = new ScoreCalculator();
 *   const result = calc.compute({ pronunciationScore: 72, fluencyScore: 88, completenessScore: 95 });
 *   // → { total: 79, grade: 'B', breakdown: { ... } }
 */

import type { ShadowingAttemptMetrics } from "@toeicpass/shared";

export interface ScoreWeights {
  /** Weight applied to pronunciation score (0–1). */
  pronunciation: number;
  /** Weight applied to fluency score (0–1). */
  fluency: number;
}

export interface ScoreResult {
  /** Final composite score 0–100, rounded to one decimal place. */
  total: number;
  /** Letter grade: S (≥90), A (≥80), B (≥70), C (≥60), D (<60). */
  grade: "S" | "A" | "B" | "C" | "D";
  /** Per-component scores after weighting, before penalty. */
  breakdown: {
    pronunciationWeighted: number;
    fluencyWeighted: number;
    completenessPenalty: number;
  };
}

export interface ScoreCalculatorOptions {
  weights?: Partial<ScoreWeights>;
  /**
   * If completeness is below this threshold (0–100), a penalty proportional
   * to the deficit is subtracted from the total.
   * Set to 0 to disable the completeness penalty.
   * Default: 70
   */
  completenessThreshold?: number;
  /**
   * Maximum score points deducted for completeness below the threshold.
   * Default: 15
   */
  maxCompletenessPenalty?: number;
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
    // Normalize weights so they always sum to 1
    const sum = w.pronunciation + w.fluency;
    this.weights = {
      pronunciation: sum > 0 ? w.pronunciation / sum : DEFAULT_WEIGHTS.pronunciation,
      fluency: sum > 0 ? w.fluency / sum : DEFAULT_WEIGHTS.fluency,
    };
    this.completenessThreshold = options.completenessThreshold ?? 70;
    this.maxCompletenessPenalty = options.maxCompletenessPenalty ?? 15;
  }

  /**
   * Compute the composite score from raw attempt metrics.
   */
  compute(metrics: ShadowingAttemptMetrics): ScoreResult {
    const clamp = (v: number) => Math.max(0, Math.min(100, v));
    const pronunciation = clamp(metrics.pronunciationScore);
    const fluency = clamp(metrics.fluencyScore);
    const completeness = clamp(metrics.completenessScore);

    const pronunciationWeighted = pronunciation * this.weights.pronunciation;
    const fluencyWeighted = fluency * this.weights.fluency;

    // Completeness penalty: proportional deduction below threshold
    let completenessPenalty = 0;
    if (
      this.completenessThreshold > 0 &&
      completeness < this.completenessThreshold
    ) {
      const deficit = (this.completenessThreshold - completeness) / this.completenessThreshold;
      completenessPenalty = deficit * this.maxCompletenessPenalty;
    }

    const raw = pronunciationWeighted + fluencyWeighted - completenessPenalty;
    const total = Math.round(clamp(raw) * 10) / 10;

    return {
      total,
      grade: this.toGrade(total),
      breakdown: {
        pronunciationWeighted: Math.round(pronunciationWeighted * 10) / 10,
        fluencyWeighted: Math.round(fluencyWeighted * 10) / 10,
        completenessPenalty: Math.round(completenessPenalty * 10) / 10,
      },
    };
  }

  private toGrade(score: number): ScoreResult["grade"] {
    if (score >= 90) return "S";
    if (score >= 80) return "A";
    if (score >= 70) return "B";
    if (score >= 60) return "C";
    return "D";
  }
}
