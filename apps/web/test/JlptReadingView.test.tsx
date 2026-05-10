import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { JlptReadingView } from "../components/reading/JlptReadingView";

vi.mock("../lib/japanese-reading", () => ({
  getJapaneseReading: vi.fn(async () => ({
    readingText: "あたらしい としょかん は らいしゅう の げつようび に あきます。",
    tokens: [],
  })),
}));

describe("JlptReadingView", () => {
  it("renders a JLPT reading passage with furigana and can switch passages", async () => {
    render(<JlptReadingView locale="zh" />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByRole("heading", { name: "JLPT 阅读练习" })).toBeInTheDocument();
    expect(screen.getByText("图书馆通知")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("あたらしい としょかん は らいしゅう の げつようび に あきます。"))
        .toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "下一篇" }));
      await Promise.resolve();
    });

    expect(screen.getByText("新干线变更通知")).toBeInTheDocument();
    expect(screen.getByText("东京早上 8 点出发的列车会怎样？")).toBeInTheDocument();
  });
});