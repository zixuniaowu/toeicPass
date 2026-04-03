import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PracticeView } from "../components/practice/PracticeView";
import type { ActiveSession, SessionQuestion, OptionKey } from "../types";

const mockOnPartFilterChange = vi.fn();
const mockOnStartPractice = vi.fn();
const mockOnSelectAnswer = vi.fn();
const mockOnPrevious = vi.fn();
const mockOnNext = vi.fn();
const mockOnSubmit = vi.fn();

function makeQuestion(id: string, partNo = 5): SessionQuestion {
  return {
    id,
    partNo,
    stem: `Question stem ${id}`,
    options: [
      { key: "A" as OptionKey, text: "Option A" },
      { key: "B" as OptionKey, text: "Option B" },
      { key: "C" as OptionKey, text: "Option C" },
      { key: "D" as OptionKey, text: "Option D" },
    ],
    correctKey: "B" as OptionKey,
    explanation: "B is correct because...",
    mediaUrl: undefined,
    imageUrl: undefined,
  };
}

const baseProps = {
  type: "grammar" as const,
  locale: "zh" as const,
  activeSession: null as ActiveSession | null,
  currentQuestion: null as SessionQuestion | null,
  currentQuestionIndex: 0,
  totalQuestions: 0,
  answeredCount: 0,
  answerMap: {} as Record<string, OptionKey>,
  practiceHint: "",
  isSubmitting: false,
  partFilter: "all",
  onPartFilterChange: mockOnPartFilterChange,
  onStartPractice: mockOnStartPractice,
  onSelectAnswer: mockOnSelectAnswer,
  onPrevious: mockOnPrevious,
  onNext: mockOnNext,
  onSubmit: mockOnSubmit,
};

function renderPractice(overrides: Record<string, unknown> = {}) {
  return render(<PracticeView {...{ ...baseProps, ...overrides }} />);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PracticeView", () => {
  it("renders title for grammar type", () => {
    renderPractice({ type: "grammar" });
    expect(screen.getByText("语法填空训练 (Part 5)")).toBeDefined();
  });

  it("renders title for listening type", () => {
    renderPractice({ type: "listening" });
    expect(screen.getByText("听力训练中心 (Part 1-4)")).toBeDefined();
  });

  it("renders title for reading type", () => {
    renderPractice({ type: "reading" });
    expect(screen.getByText("阅读理解训练 (Part 7)")).toBeDefined();
  });

  it("renders title for textcompletion type", () => {
    renderPractice({ type: "textcompletion" });
    expect(screen.getByText("段落填空训练 (Part 6)")).toBeDefined();
  });

  it("shows empty state when no current question", () => {
    renderPractice({ type: "grammar" });
    // Match the empty state text (contains part of the grammar type empty label)
    expect(screen.getByText(/逐题模式/)).toBeDefined();
  });

  it("renders start button and calls onStartPractice", () => {
    renderPractice({ type: "grammar" });

    const startButton = screen.getByRole("button", { name: "开始语法训练" });
    fireEvent.click(startButton);

    expect(mockOnStartPractice).toHaveBeenCalledTimes(1);
  });

  it("renders question when currentQuestion is set", () => {
    const question = makeQuestion("q1");
    renderPractice({
      activeSession: { attemptId: "a1", mode: "practice", questions: [question] },
      currentQuestion: question,
      totalQuestions: 1,
    });

    expect(screen.getByText(/第 1 \/ 1 题/)).toBeDefined();
    expect(screen.getByText(/第 1 \/ 1 题 · Part 5/)).toBeDefined();
  });

  it("renders progress indicator", () => {
    const question = makeQuestion("q1");
    renderPractice({
      activeSession: { attemptId: "a1", mode: "practice", questions: [question] },
      currentQuestion: question,
      totalQuestions: 10,
      answeredCount: 3,
    });

    expect(screen.getByText("已作答 3/10")).toBeDefined();
  });

  it("disables previous button on first question", () => {
    const question = makeQuestion("q1");
    renderPractice({
      activeSession: { attemptId: "a1", mode: "practice", questions: [question] },
      currentQuestion: question,
      currentQuestionIndex: 0,
      totalQuestions: 5,
    });

    const prevButton = screen.getByRole("button", { name: "上一题" });
    expect(prevButton).toHaveAttribute("disabled");
  });

  it("disables next button on last question", () => {
    const question = makeQuestion("q1");
    renderPractice({
      activeSession: { attemptId: "a1", mode: "practice", questions: [question] },
      currentQuestion: question,
      currentQuestionIndex: 4,
      totalQuestions: 5,
    });

    const nextButton = screen.getByRole("button", { name: "下一题" });
    expect(nextButton).toHaveAttribute("disabled");
  });

  it("calls onPrevious and onNext", () => {
    const question = makeQuestion("q1");
    renderPractice({
      activeSession: { attemptId: "a1", mode: "practice", questions: [question] },
      currentQuestion: question,
      currentQuestionIndex: 2,
      totalQuestions: 5,
    });

    fireEvent.click(screen.getByRole("button", { name: "上一题" }));
    expect(mockOnPrevious).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "下一题" }));
    expect(mockOnNext).toHaveBeenCalledTimes(1);
  });

  it("renders submit button and handles click", () => {
    const question = makeQuestion("q1");
    renderPractice({
      activeSession: { attemptId: "a1", mode: "practice", questions: [question] },
      currentQuestion: question,
      totalQuestions: 1,
    });

    const submitButton = screen.getByRole("button", { name: "提交本次训练" });
    fireEvent.click(submitButton);

    expect(mockOnSubmit).toHaveBeenCalledTimes(1);
  });

  it("shows submitting state", () => {
    const question = makeQuestion("q1");
    renderPractice({
      activeSession: { attemptId: "a1", mode: "practice", questions: [question] },
      currentQuestion: question,
      totalQuestions: 1,
      isSubmitting: true,
    });

    expect(screen.getByRole("button", { name: /提交中/ })).toBeDefined();
  });

  it("shows diagnostic banner in diagnostic mode", () => {
    const question = makeQuestion("q1");
    renderPractice({
      type: "grammar",
      activeSession: { attemptId: "a1", mode: "diagnostic", questions: [question] },
      currentQuestion: question,
      totalQuestions: 1,
    });

    expect(screen.getByText(/按顺序作答/)).toBeDefined();
  });

  it("hides start button and part filter in diagnostic mode", () => {
    const question = makeQuestion("q1");
    renderPractice({
      type: "grammar",
      activeSession: { attemptId: "a1", mode: "diagnostic", questions: [question] },
      currentQuestion: question,
      totalQuestions: 1,
    });

    expect(screen.queryByRole("button", { name: "开始语法训练" })).toBeNull();
  });

  it("shows diagnostic title", () => {
    renderPractice({
      type: "grammar",
      activeSession: { attemptId: "a1", mode: "diagnostic", questions: [] },
    });

    expect(screen.getByText("诊断模式（Part 5）")).toBeDefined();
  });

  it("displays practice hint text", () => {
    const question = makeQuestion("q1");
    renderPractice({
      activeSession: { attemptId: "a1", mode: "practice", questions: [question] },
      currentQuestion: question,
      totalQuestions: 1,
      practiceHint: "Focus on verb forms",
    });

    expect(screen.getByText("Focus on verb forms")).toBeDefined();
  });
});
