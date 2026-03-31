import { parseAttemptFilters } from "./session-filters";

describe("parseAttemptFilters", () => {
  it("returns empty filters for empty input", () => {
    const result = parseAttemptFilters({});
    expect(result).toEqual({
      partNo: undefined,
      difficulty: undefined,
      partGroup: undefined,
    });
  });

  it("parses valid part number", () => {
    expect(parseAttemptFilters({ part: "3" }).partNo).toBe(3);
  });

  it("rejects part number below 1", () => {
    expect(parseAttemptFilters({ part: "0" }).partNo).toBeUndefined();
  });

  it("rejects part number above 7", () => {
    expect(parseAttemptFilters({ part: "8" }).partNo).toBeUndefined();
  });

  it("rejects non-numeric part", () => {
    expect(parseAttemptFilters({ part: "abc" }).partNo).toBeUndefined();
  });

  it("rounds fractional part to nearest integer", () => {
    expect(parseAttemptFilters({ part: "3.7" }).partNo).toBe(4);
  });

  it("parses valid difficulty", () => {
    expect(parseAttemptFilters({ difficulty: "2" }).difficulty).toBe(2);
  });

  it("rejects difficulty below 1", () => {
    expect(parseAttemptFilters({ difficulty: "0" }).difficulty).toBeUndefined();
  });

  it("rejects difficulty above 5", () => {
    expect(parseAttemptFilters({ difficulty: "6" }).difficulty).toBeUndefined();
  });

  it("parses listening partGroup", () => {
    expect(parseAttemptFilters({ partGroup: "listening" }).partGroup).toBe("listening");
  });

  it("parses reading partGroup", () => {
    expect(parseAttemptFilters({ partGroup: "reading" }).partGroup).toBe("reading");
  });

  it("rejects invalid partGroup", () => {
    expect(parseAttemptFilters({ partGroup: "speaking" }).partGroup).toBeUndefined();
  });

  it("parses all filters together", () => {
    const result = parseAttemptFilters({ part: "5", difficulty: "3", partGroup: "reading" });
    expect(result).toEqual({
      partNo: 5,
      difficulty: 3,
      partGroup: "reading",
    });
  });

  it("handles Infinity as invalid", () => {
    expect(parseAttemptFilters({ part: "Infinity" }).partNo).toBeUndefined();
  });

  it("handles empty string as undefined", () => {
    expect(parseAttemptFilters({ part: "" }).partNo).toBeUndefined();
  });
});
