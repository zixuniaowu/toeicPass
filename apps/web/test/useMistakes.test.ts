import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useMistakes } from "../hooks/useMistakes";
import type { MistakeLibraryItem } from "../types";

vi.mock("../lib/api", () => ({
  fetchMistakeLibrary: vi.fn(),
  saveMistakeNote: vi.fn(),
}));

import * as api from "../lib/api";

const mockFetchMistakes = vi.mocked(api.fetchMistakeLibrary);
const mockSaveNote = vi.mocked(api.saveMistakeNote);

const mockEnsureSession = vi.fn<() => Promise<string | null>>();
const mockGetRequestOptions = vi.fn((token?: string) => ({
  token: token ?? "jwt-abc",
  tenantCode: "demo",
}));
const mockSetMessage = vi.fn();

function makeMistake(id: string, partNo: number, stem = "Test stem"): MistakeLibraryItem {
  return {
    questionId: id,
    partNo,
    stem,
    explanation: `Explanation for ${id}`,
    mediaUrl: null,
    imageUrl: null,
    options: [
      { key: "A", text: "Option A" },
      { key: "B", text: "Option B" },
      { key: "C", text: "Option C" },
      { key: "D", text: "Option D" },
    ],
    correctKey: "A",
    wrongCount: 1,
    latestAttemptItemId: `${id}-item`,
    lastSelectedKey: "B",
    lastWrongAt: "2026-01-01T00:00:00Z",
    latestNote: null,
  } as MistakeLibraryItem;
}

function setup(locale: "zh" | "ja" = "zh") {
  return renderHook(() =>
    useMistakes(mockEnsureSession, mockGetRequestOptions, mockSetMessage, locale),
  );
}

describe("useMistakes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnsureSession.mockResolvedValue("jwt-abc");
  });

  it("starts with empty mistake library", () => {
    const { result } = setup();
    expect(result.current.mistakeLibrary).toEqual([]);
    expect(result.current.filteredMistakes).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.partFilter).toBe("all");
  });

  it("loadMistakes fetches and normalizes items", async () => {
    const items = [makeMistake("q1", 5), makeMistake("q2", 7)];
    mockFetchMistakes.mockResolvedValueOnce(items);
    const { result } = setup();

    await act(async () => {
      await result.current.loadMistakes();
    });

    expect(result.current.mistakeLibrary).toHaveLength(2);
    expect(result.current.mistakeLibrary[0].questionId).toBe("q1");
    expect(result.current.isLoading).toBe(false);
  });

  it("loadMistakes handles API error gracefully", async () => {
    mockFetchMistakes.mockRejectedValueOnce(new Error("Network fail"));
    const { result } = setup();

    await act(async () => {
      await result.current.loadMistakes();
    });

    expect(result.current.mistakeLibrary).toEqual([]);
    expect(mockSetMessage).toHaveBeenCalledWith(expect.stringContaining("Network fail"));
  });

  it("loadMistakes fails gracefully when not logged in", async () => {
    mockEnsureSession.mockResolvedValueOnce(null);
    const { result } = setup();

    await act(async () => {
      await result.current.loadMistakes();
    });

    expect(mockFetchMistakes).not.toHaveBeenCalled();
  });

  it("filteredMistakes filters by part", async () => {
    const items = [makeMistake("q1", 5), makeMistake("q2", 7), makeMistake("q3", 5)];
    mockFetchMistakes.mockResolvedValueOnce(items);
    const { result } = setup();

    await act(async () => {
      await result.current.loadMistakes();
    });

    act(() => result.current.setPartFilter("5"));
    expect(result.current.filteredMistakes).toHaveLength(2);
    expect(result.current.filteredMistakes.every((m) => m.partNo === 5)).toBe(true);

    act(() => result.current.setPartFilter("all"));
    expect(result.current.filteredMistakes).toHaveLength(3);
  });

  it("filteredMistakes filters by search query", async () => {
    const items = [
      makeMistake("q1", 5, "The company revenue increased"),
      makeMistake("q2", 5, "She went to the meeting"),
    ];
    mockFetchMistakes.mockResolvedValueOnce(items);
    const { result } = setup();

    await act(async () => {
      await result.current.loadMistakes();
    });

    act(() => result.current.setSearchQuery("revenue"));
    expect(result.current.filteredMistakes).toHaveLength(1);
    expect(result.current.filteredMistakes[0].questionId).toBe("q1");
  });

  it("updateNoteDraft and updateRootCause work", async () => {
    const items = [makeMistake("q1", 5)];
    mockFetchMistakes.mockResolvedValueOnce(items);
    const { result } = setup();

    await act(async () => {
      await result.current.loadMistakes();
    });

    act(() => {
      result.current.updateNoteDraft("q1-item", "My note about grammar");
      result.current.updateRootCause("q1-item", "vocabulary");
    });

    expect(result.current.noteDraftMap["q1-item"]).toBe("My note about grammar");
    expect(result.current.rootCauseMap["q1-item"]).toBe("vocabulary");
  });

  it("saveNote sends note and root cause", async () => {
    const items = [makeMistake("q1", 5)];
    mockFetchMistakes.mockResolvedValueOnce(items);
    mockSaveNote.mockResolvedValueOnce({ success: true });
    mockFetchMistakes.mockResolvedValueOnce(items); // reload after save
    const { result } = setup();

    await act(async () => {
      await result.current.loadMistakes();
    });

    act(() => {
      result.current.updateNoteDraft("q1-item", "Need to review grammar");
      result.current.updateRootCause("q1-item", "grammar");
    });

    let success = false;
    await act(async () => {
      success = await result.current.saveNote(result.current.mistakeLibrary[0]);
    });

    expect(success).toBe(true);
    expect(mockSaveNote).toHaveBeenCalledWith(
      "q1-item",
      "Need to review grammar",
      "grammar",
      expect.objectContaining({ token: "jwt-abc" }),
    );
  });

  it("saveNote rejects empty note", async () => {
    const items = [makeMistake("q1", 5)];
    mockFetchMistakes.mockResolvedValueOnce(items);
    const { result } = setup();

    await act(async () => {
      await result.current.loadMistakes();
    });

    // Note is empty by default
    let success = true;
    await act(async () => {
      success = await result.current.saveNote(result.current.mistakeLibrary[0]);
    });

    expect(success).toBe(false);
    expect(mockSaveNote).not.toHaveBeenCalled();
  });

  it("normalizes items with missing/bad data", async () => {
    const badItem = {
      questionId: "",
      partNo: "not-a-number",
      stem: null,
      options: null,
      correctKey: "Z",
      wrongCount: -5,
      latestAttemptItemId: "",
      lastSelectedKey: null,
      lastWrongAt: "",
      latestNote: null,
    } as unknown as MistakeLibraryItem;
    mockFetchMistakes.mockResolvedValueOnce([badItem]);
    const { result } = setup();

    await act(async () => {
      await result.current.loadMistakes();
    });

    expect(result.current.mistakeLibrary).toHaveLength(1);
    const item = result.current.mistakeLibrary[0];
    expect(item.questionId).toContain("mistake-q-");
    expect(item.partNo).toBeNull();
    expect(item.options).toEqual([]);
    expect(item.wrongCount).toBe(1);
    expect(item.correctKey).toBeNull();
  });
});
