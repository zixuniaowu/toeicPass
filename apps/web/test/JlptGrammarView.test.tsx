import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { JlptGrammarView } from "../components/grammar/JlptGrammarView";

describe("JlptGrammarView", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads JLPT grammar cards and grades the active card", async () => {
    const payload = {
      summary: { total: 3, due: 1, learning: 2, mastered: 1 },
      cards: [
        {
          id: "card-1",
          ruleId: "jlpt-n5-wa-vs-ga",
          targetLanguage: "ja",
          jlptLevel: "N5",
          title: "は と が",
          titleCn: "は 和 が 的区别",
          titleJa: "は と が",
          category: "jlpt-particles",
          explanation: "「は」と「が」の違いです。",
          explanationCn: "用于区分主题和主语。",
          explanationJa: "「は」と「が」の違いです。",
          examples: ["わたしは がくせいです。"],
          sourcePart: 0,
          difficulty: 1,
          easeFactor: 2.3,
          intervalDays: 0,
          dueAt: "2026-05-05",
          due: true,
        },
      ],
    };

    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/learning/grammar/cards/card-1/grade")) {
        return { ok: true, json: async () => ({ success: true }) };
      }
      return { ok: true, json: async () => payload };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<JlptGrammarView locale="zh" token="token" tenantCode="demo" />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "http://127.0.0.1:8001/api/v1/learning/grammar/cards?targetLang=ja",
        expect.objectContaining({ method: "GET" }),
      );
    });
    expect(screen.getByText("JLPT 文法卡片")).toBeInTheDocument();
    expect(screen.getByText("は 和 が 的区别")).toBeInTheDocument();
    expect(screen.getByText("用于区分主题和主语。"))
      .toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "已掌握" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "http://127.0.0.1:8001/api/v1/learning/grammar/cards/card-1/grade",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ grade: 5 }),
        }),
      );
    });
  });
});