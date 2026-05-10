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
  it("renders UI language and target language controls", () => {
    renderTopBar();

    expect(screen.getByRole("group", { name: "界面语言" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "学习目标" })).toBeInTheDocument();
  });

  it("switches UI language and learning target", () => {
    const { onUiLangChange, onTargetLangChange } = renderTopBar();

    fireEvent.click(screen.getByRole("button", { name: "界面语言: English" }));
    fireEvent.click(screen.getByRole("button", { name: "学习目标: 🇯🇵 日语" }));

    expect(onUiLangChange).toHaveBeenCalledWith("en");
    expect(onTargetLangChange).toHaveBeenCalledWith("ja");
  });

  it("marks active language selections with aria-pressed", () => {
    renderTopBar();

    expect(screen.getByRole("button", { name: "界面语言: 中文" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "学习目标: 🇺🇸 英语" })).toHaveAttribute("aria-pressed", "true");
  });
});