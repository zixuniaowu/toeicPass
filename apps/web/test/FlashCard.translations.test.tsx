import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FlashCard } from "../components/vocab/FlashCard";

const mockTranslateText = vi.fn();

vi.mock("../data/word-dictionary", () => ({
  annotateTerm: () => null,
}));

vi.mock("../lib/pronunciation", () => ({
  getWordIpa: vi.fn(async () => null),
}));

vi.mock("../lib/translate", () => ({
  translateText: (...args: unknown[]) => mockTranslateText(...args),
}));

describe("FlashCard structured translations", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("prefers structured translations over runtime translation", async () => {
    render(
      <FlashCard
        locale="ja"
        card={{
          id: "ja-1",
          term: "みず",
          pos: "noun",
          definition: "水",
          example: "みずを のみます。",
          sourcePart: 1,
          tags: ["jlpt", "n5"],
          targetLanguage: "ja",
          easeFactor: 2.3,
          intervalDays: 0,
          dueAt: "2026-05-06",
          due: true,
          translations: {
            definition: {
              zh: "水",
              ja: "飲み物としての水です。",
            },
            example: {
              ja: "水を飲みます。",
            },
          },
        }}
        isRevealed={true}
        isGrading={false}
        onToggleReveal={() => undefined}
        onGrade={() => undefined}
      />,
    );

    expect(await screen.findByText("飲み物としての水です。")).toBeInTheDocument();
    expect(screen.getByText("水を飲みます。", { selector: "p" })).toBeInTheDocument();
    expect(mockTranslateText).not.toHaveBeenCalled();
  });

  it("uses structured Chinese example translations for JLPT cards without runtime translation", async () => {
    render(
      <FlashCard
        locale="zh"
        card={{
          id: "ja-2",
          term: "みず",
          pos: "noun",
          definition: "水",
          example: "みずを のみます。",
          sourcePart: 1,
          tags: ["jlpt", "n5"],
          targetLanguage: "ja",
          easeFactor: 2.3,
          intervalDays: 0,
          dueAt: "2026-05-06",
          due: true,
          translations: {
            definition: {
              zh: "水",
              ja: "飲み物としての水です。",
              en: "water",
            },
            example: {
              zh: "喝水。",
              ja: "みずを のみます。",
              en: "I drink water.",
            },
          },
        }}
        isRevealed={true}
        isGrading={false}
        onToggleReveal={() => undefined}
        onGrade={() => undefined}
      />,
    );

    expect(await screen.findByText("喝水。")).toBeInTheDocument();
    expect(mockTranslateText).not.toHaveBeenCalled();
  });
});