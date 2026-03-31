import {
  isQuestionEligible,
  isAttemptSelectableQuestion,
  isDisplayablePart1Image,
  isTrustedPart1VisualQuestion,
} from "./question-policy";
import { Question } from "./types";

function makeQuestion(overrides: Partial<Question> = {}): Question {
  return {
    id: "q-1",
    tenantId: "t-1",
    partNo: 5,
    skillTag: "reading",
    difficulty: 3,
    stem: "The manager ___ the report before the meeting.",
    explanation: "The email discusses project timelines.",
    status: "published",
    createdAt: new Date().toISOString(),
    options: [
      { key: "A", text: "To request a meeting", isCorrect: false },
      { key: "B", text: "To discuss timelines", isCorrect: true },
      { key: "C", text: "To cancel a project", isCorrect: false },
      { key: "D", text: "To introduce a colleague", isCorrect: false },
    ],
    ...overrides,
  };
}

describe("isQuestionEligible", () => {
  it("returns true for a well-formed reading question", () => {
    expect(isQuestionEligible(makeQuestion())).toBe(true);
  });

  it("returns false when stem is too short", () => {
    expect(isQuestionEligible(makeQuestion({ stem: "Hi" }))).toBe(false);
  });

  it("returns false when options count is wrong", () => {
    expect(
      isQuestionEligible(
        makeQuestion({
          options: [
            { key: "A", text: "Option A", isCorrect: true },
            { key: "B", text: "Option B", isCorrect: false },
          ],
        }),
      ),
    ).toBe(false);
  });

  it("returns false when no correct option", () => {
    expect(
      isQuestionEligible(
        makeQuestion({
          options: [
            { key: "A", text: "Option A", isCorrect: false },
            { key: "B", text: "Option B", isCorrect: false },
            { key: "C", text: "Option C", isCorrect: false },
            { key: "D", text: "Option D", isCorrect: false },
          ],
        }),
      ),
    ).toBe(false);
  });

  it("returns false when option text is empty", () => {
    expect(
      isQuestionEligible(
        makeQuestion({
          options: [
            { key: "A", text: "", isCorrect: false },
            { key: "B", text: "Option B", isCorrect: true },
            { key: "C", text: "Option C", isCorrect: false },
            { key: "D", text: "Option D", isCorrect: false },
          ],
        }),
      ),
    ).toBe(false);
  });

  it("allows Part 2 with 3 options", () => {
    expect(
      isQuestionEligible(
        makeQuestion({
          partNo: 2,
          mediaUrl: "https://example.com/audio.mp3#t=1,5",
          stem: "Where is the nearest bus stop?",
          options: [
            { key: "A", text: "Around the corner", isCorrect: true },
            { key: "B", text: "At 3 o'clock", isCorrect: false },
            { key: "C", text: "Yes, I did", isCorrect: false },
          ],
        }),
      ),
    ).toBe(true);
  });
});

describe("isAttemptSelectableQuestion", () => {
  it("returns true for eligible reading question (part 5+)", () => {
    expect(isAttemptSelectableQuestion(makeQuestion({ partNo: 5 }))).toBe(true);
  });

  it("returns false for listening question without media", () => {
    expect(
      isAttemptSelectableQuestion(makeQuestion({ partNo: 3, mediaUrl: undefined })),
    ).toBe(false);
  });

  it("returns false for listening question with media but no time fragment", () => {
    expect(
      isAttemptSelectableQuestion(
        makeQuestion({ partNo: 3, mediaUrl: "https://example.com/audio.mp3" }),
      ),
    ).toBe(false);
  });

  it("returns true for listening question with time-fragmented media", () => {
    expect(
      isAttemptSelectableQuestion(
        makeQuestion({ partNo: 2, stem: "Where is the meeting room?", mediaUrl: "https://example.com/audio.mp3#t=10.5,25.0",
          options: [
            { key: "A", text: "On the second floor.", isCorrect: true },
            { key: "B", text: "At 3 o'clock.", isCorrect: false },
            { key: "C", text: "Yes, I will.", isCorrect: false },
          ],
        }),
      ),
    ).toBe(true);
  });

  it("returns false for ineligible question even with media", () => {
    expect(
      isAttemptSelectableQuestion(
        makeQuestion({ partNo: 3, stem: "Hi", mediaUrl: "https://example.com/audio.mp3#t=1,5" }),
      ),
    ).toBe(false);
  });
});

describe("isDisplayablePart1Image", () => {
  it("returns false for non-Part-1 questions", () => {
    expect(isDisplayablePart1Image(makeQuestion({ partNo: 3, imageUrl: "https://img.com/a.jpg" }))).toBe(false);
  });

  it("returns false for Part 1 without imageUrl", () => {
    expect(isDisplayablePart1Image(makeQuestion({ partNo: 1, imageUrl: undefined }))).toBe(false);
  });

  it("returns false for data URI images", () => {
    expect(
      isDisplayablePart1Image(makeQuestion({ partNo: 1, imageUrl: "data:image/png;base64,abc" })),
    ).toBe(false);
  });

  it("returns true for Part 1 with valid image URL", () => {
    expect(
      isDisplayablePart1Image(makeQuestion({ partNo: 1, imageUrl: "https://example.com/photo.jpg" })),
    ).toBe(true);
  });
});

describe("isTrustedPart1VisualQuestion", () => {
  const basePart1 = {
    partNo: 1,
    source: "official_pack" as const,
    stem: "Look at the bicycle parked near the fence.",
  };

  it("returns true for bicycle-themed image with matching corpus", () => {
    expect(
      isTrustedPart1VisualQuestion(
        makeQuestion({
          ...basePart1,
          imageUrl: "https://example.com/bicycles.jpg",
          options: [
            { key: "A", text: "A bicycle is parked near a fence.", isCorrect: true },
            { key: "B", text: "A car is in the garage.", isCorrect: false },
            { key: "C", text: "A man is walking.", isCorrect: false },
            { key: "D", text: "Trees line the road.", isCorrect: false },
          ],
        }),
      ),
    ).toBe(true);
  });

  it("returns false for bicycle image with unrelated corpus", () => {
    expect(
      isTrustedPart1VisualQuestion(
        makeQuestion({
          ...basePart1,
          stem: "Look at the picture and choose the best description.",
          imageUrl: "https://example.com/bicycles.jpg",
          options: [
            { key: "A", text: "A man is cooking dinner.", isCorrect: true },
            { key: "B", text: "The sun is setting.", isCorrect: false },
            { key: "C", text: "A cat is sleeping.", isCorrect: false },
            { key: "D", text: "Stars are visible.", isCorrect: false },
          ],
        }),
      ),
    ).toBe(false);
  });

  it("returns true for truck-themed image with matching corpus", () => {
    expect(
      isTrustedPart1VisualQuestion(
        makeQuestion({
          ...basePart1,
          stem: "Look at the truck at the loading dock.",
          imageUrl: "https://example.com/truck-loading.jpg",
          options: [
            { key: "A", text: "Crates are being unloading from a delivery truck.", isCorrect: true },
            { key: "B", text: "A woman reads at a desk.", isCorrect: false },
            { key: "C", text: "Children play in the park.", isCorrect: false },
            { key: "D", text: "A boat is docked.", isCorrect: false },
          ],
        }),
      ),
    ).toBe(true);
  });

  it("returns false for non-Part-1 questions", () => {
    expect(
      isTrustedPart1VisualQuestion(makeQuestion({ partNo: 3, imageUrl: "https://example.com/bicycles.jpg" })),
    ).toBe(false);
  });
});
