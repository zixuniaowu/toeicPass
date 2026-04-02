import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useVocab } from "../hooks/useVocab";
import type { VocabCard } from "../types";

vi.mock("../lib/api", () => ({
  fetchVocabularyCards: vi.fn(),
  gradeVocabularyCard: vi.fn(),
}));

import * as api from "../lib/api";

const mockFetchCards = vi.mocked(api.fetchVocabularyCards);
const mockGradeCard = vi.mocked(api.gradeVocabularyCard);

const mockEnsureSession = vi.fn<() => Promise<string | null>>();
const mockGetRequestOptions = vi.fn((token?: string) => ({
  token: token ?? "jwt-abc",
  tenantCode: "demo",
}));
const mockSetMessage = vi.fn();

function makeCard(id: string, due = false): VocabCard {
  return {
    id,
    term: `word-${id}`,
    definition: `Definition of ${id}`,
    pos: "noun",
    example: `Example sentence for ${id}`,
    sourcePart: 5,
    due,
    intervalDays: due ? 1 : 14,
    easeFactor: 2.5,
    lastGrade: due ? 2 : 4,
    tags: ["toeic"],
  } as VocabCard;
}

function setup(locale: "zh" | "ja" = "zh") {
  return renderHook(() =>
    useVocab(mockEnsureSession, mockGetRequestOptions, mockSetMessage, locale),
  );
}

describe("useVocab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnsureSession.mockResolvedValue("jwt-abc");
  });

  it("starts with empty cards", () => {
    const { result } = setup();
    expect(result.current.cards).toEqual([]);
    expect(result.current.dueCards).toEqual([]);
    expect(result.current.activeCard).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.summary).toBeNull();
  });

  it("loadCards fetches cards and summary", async () => {
    const cards = [makeCard("c1", true), makeCard("c2", false)];
    mockFetchCards.mockResolvedValueOnce({
      summary: { total: 2, due: 1, learning: 1, mastered: 1 },
      cards,
    });
    const { result } = setup();

    await act(async () => {
      await result.current.loadCards();
    });

    expect(result.current.cards).toHaveLength(2);
    expect(result.current.summary!.total).toBe(2);
    expect(result.current.isLoading).toBe(false);
  });

  it("dueCards filters only due cards", async () => {
    const cards = [makeCard("c1", true), makeCard("c2", false), makeCard("c3", true)];
    mockFetchCards.mockResolvedValueOnce({
      summary: { total: 3, due: 2, learning: 1, mastered: 0 },
      cards,
    });
    const { result } = setup();

    await act(async () => {
      await result.current.loadCards();
    });

    expect(result.current.dueCards).toHaveLength(2);
    expect(result.current.dueCards.every((c) => c.due)).toBe(true);
  });

  it("activeCard is first due card when available", async () => {
    const cards = [makeCard("c1", false), makeCard("c2", true)];
    mockFetchCards.mockResolvedValueOnce({
      summary: { total: 2, due: 1, learning: 1, mastered: 0 },
      cards,
    });
    const { result } = setup();

    await act(async () => {
      await result.current.loadCards();
    });

    expect(result.current.activeCard!.id).toBe("c2");
  });

  it("activeCard falls back to first card when no due cards", async () => {
    const cards = [makeCard("c1", false), makeCard("c2", false)];
    mockFetchCards.mockResolvedValueOnce({
      summary: { total: 2, due: 0, learning: 0, mastered: 2 },
      cards,
    });
    const { result } = setup();

    await act(async () => {
      await result.current.loadCards();
    });

    expect(result.current.activeCard!.id).toBe("c1");
  });

  it("loadCards handles API error", async () => {
    mockFetchCards.mockRejectedValueOnce(new Error("Timeout"));
    const { result } = setup();

    await act(async () => {
      await result.current.loadCards();
    });

    expect(result.current.cards).toEqual([]);
    expect(mockSetMessage).toHaveBeenCalledWith(expect.stringContaining("Timeout"));
  });

  it("loadCards does nothing when not logged in", async () => {
    mockEnsureSession.mockResolvedValueOnce(null);
    const { result } = setup();

    await act(async () => {
      await result.current.loadCards();
    });

    expect(mockFetchCards).not.toHaveBeenCalled();
  });

  it("toggleReveal toggles reveal state", () => {
    const { result } = setup();

    act(() => result.current.toggleReveal("c1"));
    expect(result.current.revealMap["c1"]).toBe(true);

    act(() => result.current.toggleReveal("c1"));
    expect(result.current.revealMap["c1"]).toBe(false);
  });

  it("gradeCard sends grade and reloads", async () => {
    const cards = [makeCard("c1", true)];
    mockFetchCards.mockResolvedValueOnce({ summary: { total: 1, due: 1, learning: 1, mastered: 0 }, cards });
    mockGradeCard.mockResolvedValueOnce({ success: true });
    mockFetchCards.mockResolvedValueOnce({ summary: { total: 1, due: 1, learning: 1, mastered: 0 }, cards }); // reload
    const { result } = setup();

    await act(async () => {
      await result.current.loadCards();
    });

    // Reveal card first
    act(() => result.current.toggleReveal("c1"));
    expect(result.current.revealMap["c1"]).toBe(true);

    let success = false;
    await act(async () => {
      success = await result.current.gradeCard("c1", 4);
    });

    expect(success).toBe(true);
    expect(mockGradeCard).toHaveBeenCalledWith("c1", 4, expect.objectContaining({ token: "jwt-abc" }));
    // Reveal should be reset after grading
    expect(result.current.revealMap["c1"]).toBe(false);
    expect(result.current.gradingCardId).toBeNull();
  });

  it("gradeCard handles failure", async () => {
    const cards = [makeCard("c1", true)];
    mockFetchCards.mockResolvedValueOnce({ summary: { total: 1, due: 1, learning: 1, mastered: 0 }, cards });
    mockGradeCard.mockResolvedValueOnce({ success: false, error: "Invalid grade" });
    const { result } = setup();

    await act(async () => {
      await result.current.loadCards();
    });

    let success = true;
    await act(async () => {
      success = await result.current.gradeCard("c1", 4);
    });

    expect(success).toBe(false);
    expect(mockSetMessage).toHaveBeenCalledWith(expect.stringContaining("Invalid grade"));
  });

  it("gradeCard fails when not logged in", async () => {
    mockEnsureSession.mockResolvedValue(null);
    const { result } = setup();

    let success = true;
    await act(async () => {
      success = await result.current.gradeCard("c1", 4);
    });

    expect(success).toBe(false);
    expect(mockGradeCard).not.toHaveBeenCalled();
  });

  it("japanese locale shows jp messages on error", async () => {
    mockFetchCards.mockRejectedValueOnce(new Error("fail"));
    const { result } = setup("ja");

    await act(async () => {
      await result.current.loadCards();
    });

    expect(mockSetMessage).toHaveBeenCalledWith(expect.stringContaining("エラー"));
  });
});
