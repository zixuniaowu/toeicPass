import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ViewErrorBoundary } from "../components/error/ViewErrorBoundary";

function ThrowingView({ error }: { error: Error }) {
  throw error;
}

describe("ViewErrorBoundary", () => {
  const originalLocation = window.location;
  const reload = vi.fn();
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

  beforeEach(() => {
    sessionStorage.clear();
    reload.mockReset();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        ...originalLocation,
        pathname: "/",
        reload,
      },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });

  it("reloads once for chunk load errors", () => {
    const error = new Error("Loading chunk 460 failed. (error: /_next/static/chunks/460.js)");
    error.name = "ChunkLoadError";

    const { unmount } = render(
      <ViewErrorBoundary>
        <ThrowingView error={error} />
      </ViewErrorBoundary>,
    );

    expect(reload).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "立即刷新" })).toBeInTheDocument();

    unmount();

    render(
      <ViewErrorBoundary>
        <ThrowingView error={error} />
      </ViewErrorBoundary>,
    );

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("does not auto-reload for non-chunk errors", () => {
    render(
      <ViewErrorBoundary>
        <ThrowingView error={new Error("plain render failure")} />
      </ViewErrorBoundary>,
    );

    expect(reload).not.toHaveBeenCalled();
    expect(screen.getByText(/plain render failure/i)).toBeInTheDocument();
  });

  it("lets the user retry manually", () => {
    render(
      <ViewErrorBoundary>
        <ThrowingView error={new Error("plain render failure")} />
      </ViewErrorBoundary>,
    );

    fireEvent.click(screen.getByRole("button", { name: "立即刷新" }));

    expect(reload).toHaveBeenCalledTimes(1);
  });
});