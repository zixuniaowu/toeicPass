import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TopBar } from "../components/layout/TopBar";

function renderTopBar() {
  const onUiLangChange = vi.fn();
  const onTargetLangChange = vi.fn();

  render(
    <TopBar
      activeView="shadowing"
      onViewChange={vi.fn()}
      isLoggedIn
      onLogout={vi.fn()}
      uiLang="zh"
      targetLang="en"
      onUiLangChange={onUiLangChange}
      onTargetLangChange={onTargetLangChange}
    />,
  );

  return {
    onUiLangChange,
    onTargetLangChange,
  };
}

describe("TopBar", () => {
  it("has no language toggles in the header", () => {
    renderTopBar();
    expect(screen.queryByRole("group", { name: "界面语言" })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "学习目标" })).not.toBeInTheDocument();
  });

  it("shows the focused navigation", () => {
    renderTopBar();
    for (const name of ["🎙 跟读", "📚 词汇", "🔁 复习", "⚙️ 设置"]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
    expect(screen.queryByText(/模拟考试|语法|写作|AI对话|会员/)).not.toBeInTheDocument();
  });

  it("target badge opens settings", () => {
    const onViewChange = vi.fn();
    render(<TopBar activeView="shadowing" onViewChange={onViewChange} isLoggedIn uiLang="zh" targetLang="en" />);
    fireEvent.click(screen.getByTestId("target-badge"));
    expect(onViewChange).toHaveBeenCalledWith("settings");
  });
});
