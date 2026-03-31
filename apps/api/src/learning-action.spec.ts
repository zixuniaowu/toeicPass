import { sanitizeLearningAction } from "./learning-action";

describe("sanitizeLearningAction", () => {
  it("passes through a valid action unchanged", () => {
    expect(sanitizeLearningAction("practice:start")).toBe("practice:start");
  });

  it("passes through action with query params", () => {
    expect(sanitizeLearningAction("practice:start?part=3&difficulty=2")).toBe(
      "practice:start?part=3&difficulty=2",
    );
  });

  it("defaults to practice:start for empty input", () => {
    expect(sanitizeLearningAction("")).toBe("practice:start");
  });

  it("defaults to practice:start for unknown commands", () => {
    expect(sanitizeLearningAction("unknown:command")).toBe("practice:start");
  });

  it("resolves alias 'practice' to 'practice:start'", () => {
    expect(sanitizeLearningAction("practice")).toBe("practice:start");
  });

  it("resolves alias 'diagnostic' to 'diagnostic:start'", () => {
    expect(sanitizeLearningAction("diagnostic")).toBe("diagnostic:start");
  });

  it("resolves alias 'mock' to 'mock:start'", () => {
    expect(sanitizeLearningAction("mock")).toBe("mock:start");
  });

  it("resolves alias 'vocab' to 'vocab:start'", () => {
    expect(sanitizeLearningAction("vocab")).toBe("vocab:start");
  });

  it("normalizes full-width spaces", () => {
    expect(sanitizeLearningAction("\u3000practice:start\u3000")).toBe("practice:start");
  });

  it("normalizes multiple spaces", () => {
    expect(sanitizeLearningAction("  practice:start  ")).toBe("practice:start");
  });

  it("parses partGroup filter", () => {
    expect(sanitizeLearningAction("practice:start?partGroup=listening")).toBe(
      "practice:start?partGroup=listening",
    );
  });

  it("ignores invalid partGroup", () => {
    expect(sanitizeLearningAction("practice:start?partGroup=speaking")).toBe("practice:start");
  });

  it("clamps part below 1 to undefined", () => {
    expect(sanitizeLearningAction("practice:start?part=0")).toBe("practice:start");
  });

  it("clamps part above 7 to undefined", () => {
    expect(sanitizeLearningAction("practice:start?part=8")).toBe("practice:start");
  });

  it("clamps difficulty below 1 to undefined", () => {
    expect(sanitizeLearningAction("practice:start?part=3&difficulty=0")).toBe(
      "practice:start?part=3",
    );
  });

  it("clamps difficulty above 5 to undefined", () => {
    expect(sanitizeLearningAction("practice:start?part=3&difficulty=6")).toBe(
      "practice:start?part=3",
    );
  });

  it("handles all valid commands", () => {
    const commands = [
      "practice:start",
      "diagnostic:start",
      "mock:start",
      "mistakes:start",
      "vocab:start",
      "shadowing:start",
    ];
    for (const cmd of commands) {
      expect(sanitizeLearningAction(cmd)).toBe(cmd);
    }
  });

  it("aliases review:start to mistakes:start", () => {
    expect(sanitizeLearningAction("review:start")).toBe("mistakes:start");
    expect(sanitizeLearningAction("review")).toBe("mistakes:start");
  });

  it("ignores non-numeric part", () => {
    expect(sanitizeLearningAction("practice:start?part=abc")).toBe("practice:start");
  });

  it("preserves valid combined filters", () => {
    const result = sanitizeLearningAction("practice:start?part=5&difficulty=3&partGroup=reading");
    expect(result).toContain("part=5");
    expect(result).toContain("difficulty=3");
    expect(result).toContain("partGroup=reading");
  });
});
