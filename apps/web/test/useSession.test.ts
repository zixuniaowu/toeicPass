import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useSession } from "../hooks/useSession";
import type { OptionKey, SessionQuestion } from "../types";

vi.mock("../lib/api", () => ({
  startSession: vi.fn(),
  startMistakeDrillSession: vi.fn(),
  submitSession: vi.fn(),
}));

import * as api from "../lib/api";

const mockStartSession = vi.mocked(api.startSession);
const mockSubmitSession = vi.mocked(api.submitSession);
const mockStartMistakeDrill = vi.mocked(api.startMistakeDrillSession);

const mockEnsureSession = vi.fn<() => Promise<string | null>>();
const mockGetRequestOptions = vi.fn((token?: string) => ({
  token: token ?? "jwt-abc",
  tenantCode: "demo",
}));
const mockSetMessage = vi.fn();

function makeQuestion(id: string, partNo = 5): SessionQuestion {
  return {
    id,
    partNo,
    stem: `Question ${id}`,
    options: [{ key: "A" as OptionKey, text: "opt A" }, { key: "B" as OptionKey, text: "opt B" }, { key: "C" as OptionKey, text: "opt C" }, { key: "D" as OptionKey, text: "opt D" }],
  };
}

function setup(locale: "zh" | "ja" = "zh") {
  return renderHook(() =>
    useSession(mockEnsureSession, mockGetRequestOptions, mockSetMessage, locale),
  );
}

describe("useSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnsureSession.mockResolvedValue("jwt-abc");
  });

  it("starts with no active session", () => {
    const { result } = setup();
    expect(result.current.activeSession).toBeNull();
    expect(result.current.currentQuestion).toBeNull();
    expect(result.current.totalQuestions).toBe(0);
    expect(result.current.answeredCount).toBe(0);
  });

  it("startSession creates active session with questions", async () => {
    const questions = [makeQuestion("q1"), makeQuestion("q2", 6)];
    mockStartSession.mockResolvedValueOnce({
      success: true,
      attemptId: "att-1",
      questions,
    });

    const { result } = setup();

    let ok = false;
    await act(async () => {
      ok = await result.current.startSession("practice");
    });

    expect(ok).toBe(true);
    expect(result.current.activeSession).not.toBeNull();
    expect(result.current.activeSession!.attemptId).toBe("att-1");
    expect(result.current.totalQuestions).toBe(2);
    expect(result.current.currentQuestion!.id).toBe("q1");
    expect(result.current.currentQuestionIndex).toBe(0);
  });

  it("startSession fails when ensureSession returns null", async () => {
    mockEnsureSession.mockResolvedValueOnce(null);
    const { result } = setup();

    let ok = true;
    await act(async () => {
      ok = await result.current.startSession("practice");
    });

    expect(ok).toBe(false);
    expect(result.current.activeSession).toBeNull();
  });

  it("startSession handles API error", async () => {
    mockStartSession.mockResolvedValueOnce({
      success: false,
      error: "No questions available",
    });
    const { result } = setup();

    let ok = true;
    await act(async () => {
      ok = await result.current.startSession("practice");
    });

    expect(ok).toBe(false);
    expect(mockSetMessage).toHaveBeenCalledWith(expect.stringContaining("No questions available"));
  });

  it("startSession handles empty questions", async () => {
    mockStartSession.mockResolvedValueOnce({
      success: true,
      attemptId: "att-2",
      questions: [],
    });
    const { result } = setup();

    let ok = true;
    await act(async () => {
      ok = await result.current.startSession("practice");
    });

    expect(ok).toBe(false);
    expect(result.current.activeSession).toBeNull();
  });

  it("selectAnswer updates answerMap", async () => {
    const questions = [makeQuestion("q1"), makeQuestion("q2")];
    mockStartSession.mockResolvedValueOnce({ success: true, attemptId: "att-1", questions });
    const { result } = setup();

    await act(async () => {
      await result.current.startSession("practice");
    });

    act(() => {
      result.current.selectAnswer("q1", "B" as OptionKey);
    });

    expect(result.current.answerMap["q1"]).toBe("B");
    expect(result.current.answeredCount).toBe(1);
  });

  it("goToNext and goToPrevious navigate questions", async () => {
    const questions = [makeQuestion("q1"), makeQuestion("q2"), makeQuestion("q3")];
    mockStartSession.mockResolvedValueOnce({ success: true, attemptId: "att-1", questions });
    const { result } = setup();

    await act(async () => {
      await result.current.startSession("practice");
    });
    expect(result.current.currentQuestionIndex).toBe(0);

    act(() => result.current.goToNext());
    expect(result.current.currentQuestionIndex).toBe(1);

    act(() => result.current.goToNext());
    expect(result.current.currentQuestionIndex).toBe(2);

    // Should not go beyond last
    act(() => result.current.goToNext());
    expect(result.current.currentQuestionIndex).toBe(2);

    act(() => result.current.goToPrevious());
    expect(result.current.currentQuestionIndex).toBe(1);

    act(() => result.current.goToPrevious());
    expect(result.current.currentQuestionIndex).toBe(0);

    // Should not go below 0
    act(() => result.current.goToPrevious());
    expect(result.current.currentQuestionIndex).toBe(0);
  });

  it("goToQuestion jumps to specific index", async () => {
    const questions = [makeQuestion("q1"), makeQuestion("q2"), makeQuestion("q3")];
    mockStartSession.mockResolvedValueOnce({ success: true, attemptId: "att-1", questions });
    const { result } = setup();

    await act(async () => {
      await result.current.startSession("practice");
    });

    act(() => result.current.goToQuestion(2));
    expect(result.current.currentQuestionIndex).toBe(2);
    expect(result.current.currentQuestion!.id).toBe("q3");

    // Clamp to valid range
    act(() => result.current.goToQuestion(100));
    expect(result.current.currentQuestionIndex).toBe(2);

    act(() => result.current.goToQuestion(-1));
    expect(result.current.currentQuestionIndex).toBe(0);
  });

  it("submitSession sends answers and returns report", async () => {
    const questions = [makeQuestion("q1"), makeQuestion("q2")];
    mockStartSession.mockResolvedValueOnce({ success: true, attemptId: "att-1", questions });
    mockSubmitSession.mockResolvedValueOnce({
      success: true,
      report: {
        correct: 1,
        answered: 2,
        scoreTotal: 450,
        scoreL: 200,
        scoreR: 250,
        review: [],
      },
    });

    const { result } = setup();

    await act(async () => {
      await result.current.startSession("practice");
    });

    act(() => {
      result.current.selectAnswer("q1", "A" as OptionKey);
      result.current.selectAnswer("q2", "C" as OptionKey);
    });

    let report: unknown = null;
    await act(async () => {
      report = await result.current.submitSession();
    });

    expect(report).not.toBeNull();
    expect((report as { scoreTotal: number }).scoreTotal).toBe(450);
    // Session cleared after submit
    expect(result.current.activeSession).toBeNull();
    expect(result.current.sessionResult).not.toBeNull();
  });

  it("submitSession blocks when unanswered and not allowPartial", async () => {
    const questions = [makeQuestion("q1"), makeQuestion("q2")];
    mockStartSession.mockResolvedValueOnce({ success: true, attemptId: "att-1", questions });
    const { result } = setup();

    await act(async () => {
      await result.current.startSession("practice");
    });

    // Only answer 1 of 2
    act(() => {
      result.current.selectAnswer("q1", "A" as OptionKey);
    });

    let report: unknown = "not-null";
    await act(async () => {
      report = await result.current.submitSession();
    });

    expect(report).toBeNull();
    expect(mockSubmitSession).not.toHaveBeenCalled();
    expect(mockSetMessage).toHaveBeenCalledWith(expect.stringContaining("1"));
  });

  it("submitSession allows partial when allowPartial is true", async () => {
    const questions = [makeQuestion("q1"), makeQuestion("q2")];
    mockStartSession.mockResolvedValueOnce({ success: true, attemptId: "att-1", questions });
    mockSubmitSession.mockResolvedValueOnce({
      success: true,
      report: {
        correct: 1,
        answered: 1,
        scoreTotal: 200,
        scoreL: 0,
        scoreR: 200,
        review: [],
      },
    });
    const { result } = setup();

    await act(async () => {
      await result.current.startSession("practice");
    });

    act(() => {
      result.current.selectAnswer("q1", "A" as OptionKey);
    });

    let report: unknown = null;
    await act(async () => {
      report = await result.current.submitSession({ allowPartial: true });
    });

    expect(report).not.toBeNull();
    expect(mockSubmitSession).toHaveBeenCalled();
  });

  it("resetSession clears everything", async () => {
    const questions = [makeQuestion("q1")];
    mockStartSession.mockResolvedValueOnce({ success: true, attemptId: "att-1", questions });
    const { result } = setup();

    await act(async () => {
      await result.current.startSession("practice");
    });
    expect(result.current.activeSession).not.toBeNull();

    act(() => result.current.resetSession());

    expect(result.current.activeSession).toBeNull();
    expect(result.current.currentQuestionIndex).toBe(0);
    expect(result.current.answeredCount).toBe(0);
    expect(result.current.sessionResult).toBeNull();
  });

  it("japanese locale uses jp messages", async () => {
    mockStartSession.mockResolvedValueOnce({
      success: false,
      error: "error",
    });
    const { result } = setup("ja");

    await act(async () => {
      await result.current.startSession("practice");
    });

    expect(mockSetMessage).toHaveBeenCalledWith(expect.stringContaining("失敗"));
  });

  it("startMistakeDrill creates session from mistake questions", async () => {
    const questions = [makeQuestion("q1", 5), makeQuestion("q2", 5)];
    mockStartMistakeDrill.mockResolvedValueOnce({
      success: true,
      attemptId: "att-md",
      questions,
    });
    const { result } = setup();

    let partNo: number | null = null;
    await act(async () => {
      partNo = await result.current.startMistakeDrill({ partNo: 5 });
    });

    expect(partNo).toBe(5);
    expect(result.current.activeSession).not.toBeNull();
    expect(result.current.totalQuestions).toBe(2);
  });
});
