import {
  estimateRawCorrect,
  toToeicScaledListening,
  toToeicScaledReading,
  calculatePrediction,
} from "./scoring-policy";
import { AttemptItem } from "./types";

function makeItem(overrides: Partial<AttemptItem> = {}): AttemptItem {
  return {
    id: "item-1",
    attemptId: "att-1",
    questionId: "q-1",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("estimateRawCorrect", () => {
  it("returns 0 for empty items", () => {
    expect(estimateRawCorrect([], 100)).toBe(0);
  });

  it("scales to target raw when all correct", () => {
    const items = Array.from({ length: 10 }, (_, i) =>
      makeItem({ id: `item-${i}`, isCorrect: true }),
    );
    expect(estimateRawCorrect(items, 100)).toBe(100);
  });

  it("scales to 0 when none correct", () => {
    const items = Array.from({ length: 10 }, (_, i) =>
      makeItem({ id: `item-${i}`, isCorrect: false }),
    );
    expect(estimateRawCorrect(items, 100)).toBe(0);
  });

  it("scales proportionally", () => {
    const items = [
      makeItem({ id: "1", isCorrect: true }),
      makeItem({ id: "2", isCorrect: false }),
      makeItem({ id: "3", isCorrect: true }),
      makeItem({ id: "4", isCorrect: false }),
    ];
    expect(estimateRawCorrect(items, 100)).toBe(50);
  });

  it("clamps to targetRaw ceiling", () => {
    const items = [makeItem({ isCorrect: true })];
    expect(estimateRawCorrect(items, 50)).toBe(50);
  });
});

describe("toToeicScaledListening", () => {
  it("returns 5 for 0 raw correct", () => {
    expect(toToeicScaledListening(0)).toBe(5);
  });

  it("returns 495 for 100 raw correct", () => {
    expect(toToeicScaledListening(100)).toBe(495);
  });

  it("returns a value in valid TOEIC range for mid-level", () => {
    const score = toToeicScaledListening(50);
    expect(score).toBeGreaterThanOrEqual(5);
    expect(score).toBeLessThanOrEqual(495);
  });

  it("uses power curve — 50 raw should score above linear midpoint", () => {
    const score = toToeicScaledListening(50);
    const linearMid = Math.round(5 + 0.5 * 490);
    expect(score).toBeGreaterThan(linearMid);
  });

  it("clamps negative input to 5", () => {
    expect(toToeicScaledListening(-10)).toBe(5);
  });

  it("clamps input above 100 to 495", () => {
    expect(toToeicScaledListening(200)).toBe(495);
  });
});

describe("toToeicScaledReading", () => {
  it("returns 5 for 0 raw correct", () => {
    expect(toToeicScaledReading(0)).toBe(5);
  });

  it("returns 495 for 100 raw correct", () => {
    expect(toToeicScaledReading(100)).toBe(495);
  });

  it("reading curve is slightly steeper than listening (exponent 0.9 vs 0.88)", () => {
    const listening50 = toToeicScaledListening(50);
    const reading50 = toToeicScaledReading(50);
    expect(reading50).toBeLessThanOrEqual(listening50);
  });
});

describe("calculatePrediction", () => {
  it("returns near 400 baseline with no attempts and no anchor", () => {
    const result = calculatePrediction({ baselineAnchor: null, scoredAttempts: [] });
    expect(result.predictedTotal).toBeGreaterThanOrEqual(350);
    expect(result.predictedTotal).toBeLessThanOrEqual(400);
    expect(result.confidence).toBeCloseTo(0.45, 2);
    expect(result.factors.attemptsUsed).toBe(0);
  });

  it("uses baselineAnchor when no attempts", () => {
    const result = calculatePrediction({ baselineAnchor: 600, scoredAttempts: [] });
    expect(result.predictedTotal).toBeGreaterThanOrEqual(540);
    expect(result.predictedTotal).toBeLessThanOrEqual(780);
  });

  it("predicts near recent score with single mock attempt", () => {
    const result = calculatePrediction({
      baselineAnchor: null,
      scoredAttempts: [{ scoreTotal: 700, mode: "mock", isRepresentative: true }],
    });
    expect(result.predictedTotal).toBeGreaterThanOrEqual(600);
    expect(result.predictedTotal).toBeLessThanOrEqual(750);
  });

  it("confidence increases with more attempts", () => {
    const single = calculatePrediction({
      baselineAnchor: null,
      scoredAttempts: [{ scoreTotal: 700, mode: "mock", isRepresentative: true }],
    });
    const multi = calculatePrediction({
      baselineAnchor: null,
      scoredAttempts: [
        { scoreTotal: 700, mode: "mock", isRepresentative: true },
        { scoreTotal: 680, mode: "mock", isRepresentative: true },
        { scoreTotal: 690, mode: "mock", isRepresentative: true },
      ],
    });
    expect(multi.confidence).toBeGreaterThan(single.confidence);
  });

  it("clamps prediction within baseline anchor band", () => {
    const result = calculatePrediction({
      baselineAnchor: 500,
      scoredAttempts: [
        { scoreTotal: 200, mode: "practice", isRepresentative: false },
        { scoreTotal: 200, mode: "practice", isRepresentative: false },
        { scoreTotal: 200, mode: "practice", isRepresentative: false },
        { scoreTotal: 200, mode: "practice", isRepresentative: false },
        { scoreTotal: 200, mode: "practice", isRepresentative: false },
      ],
    });
    expect(result.predictedTotal).toBeGreaterThanOrEqual(440);
  });

  it("prefers representative attempts over non-representative", () => {
    const withRep = calculatePrediction({
      baselineAnchor: null,
      scoredAttempts: [
        { scoreTotal: 300, mode: "practice", isRepresentative: false },
        { scoreTotal: 700, mode: "mock", isRepresentative: true },
      ],
    });
    expect(withRep.predictedTotal).toBeGreaterThanOrEqual(600);
  });

  it("prediction stays in 10-990 range", () => {
    const low = calculatePrediction({
      baselineAnchor: null,
      scoredAttempts: [{ scoreTotal: 10, mode: "practice", isRepresentative: true }],
    });
    expect(low.predictedTotal).toBeGreaterThanOrEqual(10);

    const high = calculatePrediction({
      baselineAnchor: null,
      scoredAttempts: [{ scoreTotal: 990, mode: "mock", isRepresentative: true }],
    });
    expect(high.predictedTotal).toBeLessThanOrEqual(990);
  });

  it("confidence stays in 0.45-0.93 range", () => {
    const result = calculatePrediction({
      baselineAnchor: null,
      scoredAttempts: Array.from({ length: 10 }, () => ({
        scoreTotal: 800,
        mode: "mock" as const,
        isRepresentative: true,
      })),
    });
    expect(result.confidence).toBeGreaterThanOrEqual(0.45);
    expect(result.confidence).toBeLessThanOrEqual(0.93);
  });
});
