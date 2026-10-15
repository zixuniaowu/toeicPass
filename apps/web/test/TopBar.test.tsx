import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TopBar } from "../components/layout/TopBar";
import type { TargetLang, UiLang } from "../types";

function renderTopBar(overrides: {
  uiLang?: UiLang;
  targetLang?: TargetLang;
} = {}) {
  const onViewChange = vi.fn();
  render(
    <TopBar
      activeView="shadowing"
      onViewChange={onViewChange}
      isLoggedIn
      onLogout={vi.fn()}
      uiLang={overrides.uiLang ?? "zh"}
      targetLang={overrides.targetLang ?? "en"}
    />,
  );
  return { onViewChange };
}

describe("TopBar", () => {
  it("shows shadowing-focused navigation without top language switches", () => {
    renderTopBar();

    const nav = screen.getByRole("navigation", { name: "main" });
    expect(within(nav).getByRole("button", { name: /跟读/ })).toBeInTheDocument();
    expect(within(nav).getByRole("button", { name: /词汇/ })).toBeInTheDocument();
    expect(within(nav).getByRole("button", { name: /复习/ })).toBeInTheDocument();
    expect(within(nav).getByRole("button", { name: /设置/ })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "界面语言" })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "学习目标" })).not.toBeInTheDocument();
  });

  it("opens settings from the learning-target badge", () => {
    const { onViewChange } = renderTopBar();

    fireEvent.click(screen.getByTestId("target-badge"));
    expect(onViewChange).toHaveBeenCalledWith("settings");
  });

  it("shows the current learning target on the badge", () => {
    renderTopBar({ targetLang: "ja" });
    expect(screen.getByTestId("target-badge")).toHaveTextContent("学日语");
  });
});
