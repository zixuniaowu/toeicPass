import { describe, it, expect } from "vitest";
import {
  parseLearningAction,
  parseNumericFilter,
  resolvePartGroupFromPart,
  resolveViewTabForPart,
} from "../lib/learning-action";

describe("parseNumericFilter", () => {
  it("parses integer string", () => {
    expect(parseNumericFilter("5")).toBe(5);
  });

  it("parses string with surrounding text", () => {
    expect(parseNumericFilter("Part 3")).toBe(3);
  });

  it("returns undefined for empty string", () => {
    expect(parseNumericFilter("")).toBeUndefined();
  });

  it("returns undefined for null", () => {
    expect(parseNumericFilter(null)).toBeUndefined();
  });

  it("returns undefined for undefined", () => {
    expect(parseNumericFilter(undefined)).toBeUndefined();
  });

  it("returns undefined for non-numeric string", () => {
    expect(parseNumericFilter("abc")).toBeUndefined();
  });

  it("parses decimal value", () => {
    expect(parseNumericFilter("3.5")).toBe(3.5);
  });
});

describe("parseLearningAction", () => {
  it("parses practice:start without filters", () => {
    const result = parseLearningAction("practice:start");
    expect(result).toEqual({
      command: "practice:start",
      filters: { partNo: undefined, difficulty: undefined, partGroup: undefined },
    });
  });

  it("parses practice:start with part filter", () => {
    const result = parseLearningAction("practice:start?part=5");
    expect(result).toEqual({
      command: "practice:start",
      filters: { partNo: 5, difficulty: undefined, partGroup: undefined },
    });
  });

  it("parses practice:start with difficulty filter", () => {
    const result = parseLearningAction("practice:start?difficulty=3");
    expect(result).toEqual({
      command: "practice:start",
      filters: { partNo: undefined, difficulty: 3, partGroup: undefined },
    });
  });

  it("parses practice:start with partGroup filter", () => {
    const result = parseLearningAction("practice:start?partGroup=listening");
    expect(result).toEqual({
      command: "practice:start",
      filters: { partNo: undefined, difficulty: undefined, partGroup: "listening" },
    });
  });

  it("parses combined filters", () => {
    const result = parseLearningAction("practice:start?part=3&difficulty=2&partGroup=listening");
    expect(result).toEqual({
      command: "practice:start",
      filters: { partNo: 3, difficulty: 2, partGroup: "listening" },
    });
  });

  it("parses diagnostic:start", () => {
    const result = parseLearningAction("diagnostic:start");
    expect(result?.command).toBe("diagnostic:start");
  });

  it("parses mock:start", () => {
    const result = parseLearningAction("mock:start");
    expect(result?.command).toBe("mock:start");
  });

  it("parses mistakes:start", () => {
    const result = parseLearningAction("mistakes:start");
    expect(result?.command).toBe("mistakes:start");
  });

  it("parses vocab:start", () => {
    const result = parseLearningAction("vocab:start");
    expect(result?.command).toBe("vocab:start");
  });

  it("parses shadowing:start", () => {
    const result = parseLearningAction("shadowing:start");
    expect(result?.command).toBe("shadowing:start");
  });

  it("resolves alias 'practice' to practice:start", () => {
    const result = parseLearningAction("practice");
    expect(result?.command).toBe("practice:start");
  });

  it("resolves alias 'review' to mistakes:start", () => {
    const result = parseLearningAction("review");
    expect(result?.command).toBe("mistakes:start");
  });

  it("resolves alias 'review:start' to mistakes:start", () => {
    const result = parseLearningAction("review:start");
    expect(result?.command).toBe("mistakes:start");
  });

  it("resolves alias 'mistakes' to mistakes:start", () => {
    const result = parseLearningAction("mistakes");
    expect(result?.command).toBe("mistakes:start");
  });

  it("returns null for unknown command", () => {
    expect(parseLearningAction("unknown:action")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseLearningAction("")).toBeNull();
  });

  it("clamps part to valid range (1-7)", () => {
    const result = parseLearningAction("practice:start?part=10");
    expect(result?.filters.partNo).toBeUndefined();
  });

  it("clamps difficulty to valid range (1-5)", () => {
    const result = parseLearningAction("practice:start?difficulty=0");
    expect(result?.filters.difficulty).toBeUndefined();
  });

  it("ignores invalid partGroup values", () => {
    const result = parseLearningAction("practice:start?partGroup=invalid");
    expect(result?.filters.partGroup).toBeUndefined();
  });

  it("handles fullwidth spaces in action", () => {
    const result = parseLearningAction("　practice:start　");
    expect(result?.command).toBe("practice:start");
  });
});

describe("resolvePartGroupFromPart", () => {
  it("returns listening for parts 1-4", () => {
    expect(resolvePartGroupFromPart(1)).toBe("listening");
    expect(resolvePartGroupFromPart(2)).toBe("listening");
    expect(resolvePartGroupFromPart(3)).toBe("listening");
    expect(resolvePartGroupFromPart(4)).toBe("listening");
  });

  it("returns reading for parts 5-7", () => {
    expect(resolvePartGroupFromPart(5)).toBe("reading");
    expect(resolvePartGroupFromPart(6)).toBe("reading");
    expect(resolvePartGroupFromPart(7)).toBe("reading");
  });

  it("returns undefined for undefined", () => {
    expect(resolvePartGroupFromPart(undefined)).toBeUndefined();
  });
});

describe("resolveViewTabForPart", () => {
  it("returns listening for parts 1-4", () => {
    expect(resolveViewTabForPart(1)).toBe("listening");
    expect(resolveViewTabForPart(2)).toBe("listening");
    expect(resolveViewTabForPart(3)).toBe("listening");
    expect(resolveViewTabForPart(4)).toBe("listening");
  });

  it("returns grammar for part 5", () => {
    expect(resolveViewTabForPart(5)).toBe("grammar");
  });

  it("returns textcompletion for part 6", () => {
    expect(resolveViewTabForPart(6)).toBe("textcompletion");
  });

  it("returns reading for part 7", () => {
    expect(resolveViewTabForPart(7)).toBe("reading");
  });

  it("uses fallback when part is undefined", () => {
    expect(resolveViewTabForPart(undefined, "reading")).toBe("reading");
  });

  it("defaults fallback to listening", () => {
    expect(resolveViewTabForPart(undefined)).toBe("listening");
  });
});
