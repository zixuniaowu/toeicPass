import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WritingView } from "../components/writing/WritingView";

vi.mock("../lib/api", () => ({
  API_BASE: "http://localhost:8001/api/v1",
}));

describe("WritingView", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("switches to Japanese-target copy and sends targetLang=ja", async () => {
    const onOpenView = vi.fn();
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        score: 82,
        wordCount: 28,
        summary: "内容は伝わっており、構成もおおむね安定しています。",
        focusArea: "organization",
        focusSignals: [
          "接続表現を1〜2個入れて流れを見せる。",
          "1文だけで終わらせず、2〜3文に分けて展開する。",
        ],
        drillChecklist: ["接続表現を2つ以上入れる。"],
        revisionPrompt: "次の改稿では、接続表現を2つ以上使って書き直してください。",
        sentenceFrames: ["まず、〜。", "次に、〜。", "そのため、〜。", "最後に、〜。"],
        rubric: [
          { label: "内容展開", score: 80, comment: "理由や具体例が入っています。" },
        ],
        feedback: [],
        nextStep: "次は接続表現をもう一つ増やしてみましょう。",
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    render(
      <WritingView
        locale="zh"
        targetLang="ja"
        token="token"
        tenantCode="demo"
        onOpenView={onOpenView}
      />,
    );

    expect(screen.getByRole("heading", { name: "日语写作练习" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("在这里开始写你的日语文章...")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "昨日は図書館で日本語を勉強しました。" },
    });

    expect(screen.getByText("字符数: 18")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "提交评估" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText("整体评价")).toBeInTheDocument();
    expect(screen.getByText("内容は伝わっており、構成もおおむね安定しています。"))
      .toBeInTheDocument();
    expect(screen.getByText("分项表现")).toBeInTheDocument();
    expect(screen.getByText("内容展開")).toBeInTheDocument();
    expect(screen.getByText("下一步训练建议")).toBeInTheDocument();
    expect(screen.getByText("重点诊断")).toBeInTheDocument();
    expect(screen.getByText("接続表現を1〜2個入れて流れを見せる。")).toBeInTheDocument();
    expect(screen.getByText("改写前检查清单")).toBeInTheDocument();
    expect(screen.getByText("接続表現を2つ以上入れる。"))
      .toBeInTheDocument();
    expect(screen.getByText("改写提示")).toBeInTheDocument();
    expect(screen.getByText("次の改稿では、接続表現を2つ以上使って書き直してください。"))
      .toBeInTheDocument();
    expect(screen.getByText("改写句型骨架")).toBeInTheDocument();
    expect(screen.getByText("まず、〜。")).toBeInTheDocument();
    expect(screen.getByText("推荐下一步训练")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "去做 JLPT 文法卡片" })).toBeInTheDocument();
    expect(screen.getByText("次は接続表現をもう一つ増やしてみましょう。"))
      .toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "去做 JLPT 文法卡片" }));

    expect(onOpenView).toHaveBeenCalledWith("grammar");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8001/api/v1/writing/evaluate",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ text: "昨日は図書館で日本語を勉強しました。", targetLang: "ja" }),
      }),
    );
  });
});