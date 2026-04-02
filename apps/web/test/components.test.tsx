import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Button } from "../components/ui/Button";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";
import { Skeleton, CardSkeleton, QuestionSkeleton } from "../components/ui/Skeleton";

describe("Button", () => {
  it("renders children text", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole("button")).toHaveTextContent("Click me");
  });

  it("calls onClick when clicked", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click</Button>);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("is disabled when disabled prop is true", () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("is disabled when loading is true", () => {
    render(<Button loading>Loading</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("renders spinner when loading", () => {
    const { container } = render(<Button loading>Loading</Button>);
    expect(container.querySelector("[class*=spinner]")).toBeTruthy();
  });

  it("does not render spinner when not loading", () => {
    const { container } = render(<Button>Normal</Button>);
    expect(container.querySelector("[class*=spinner]")).toBeNull();
  });

  it("applies fullWidth class", () => {
    const { container } = render(<Button fullWidth>Wide</Button>);
    expect(container.firstElementChild!.className).toContain("fullWidth");
  });

  it("applies variant class", () => {
    const { container } = render(<Button variant="secondary">Sec</Button>);
    expect(container.firstElementChild!.className).toContain("secondary");
  });

  it("applies size class", () => {
    const { container } = render(<Button size="lg">Large</Button>);
    expect(container.firstElementChild!.className).toContain("lg");
  });
});

describe("Card", () => {
  it("renders children", () => {
    render(<Card>Card content</Card>);
    expect(screen.getByText("Card content")).toBeTruthy();
  });

  it("applies variant class", () => {
    const { container } = render(<Card variant="elevated">Elevated</Card>);
    expect(container.firstElementChild!.className).toContain("elevated");
  });

  it("applies padding class", () => {
    const { container } = render(<Card padding="lg">Padded</Card>);
    expect(container.firstElementChild!.className).toContain("padding-lg");
  });
});

describe("CardHeader and CardTitle", () => {
  it("renders header and title", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>My Title</CardTitle>
        </CardHeader>
        <CardContent>Body</CardContent>
      </Card>,
    );
    expect(screen.getByText("My Title")).toBeTruthy();
    expect(screen.getByText("Body")).toBeTruthy();
  });
});

describe("Skeleton", () => {
  it("renders single skeleton by default", () => {
    const { container } = render(<Skeleton />);
    const skeletons = container.querySelectorAll("[class*=skeleton]");
    expect(skeletons.length).toBeGreaterThanOrEqual(1);
  });

  it("renders multiple skeletons with count", () => {
    const { container } = render(<Skeleton count={3} />);
    const items = container.querySelectorAll("[class*=skeleton]");
    // 3 skeleton divs inside a stack div
    expect(items.length).toBe(3);
  });

  it("applies width and height styles", () => {
    const { container } = render(<Skeleton width="200px" height="40px" />);
    const el = container.firstElementChild! as HTMLElement;
    expect(el.style.width).toBe("200px");
    expect(el.style.height).toBe("40px");
  });
});

describe("CardSkeleton", () => {
  it("renders card skeleton with 4 shimmer lines", () => {
    const { container } = render(<CardSkeleton />);
    const lines = container.querySelectorAll("[class*=skeleton]");
    expect(lines.length).toBe(4);
  });
});

describe("QuestionSkeleton", () => {
  it("renders question skeleton with stem + 4 options", () => {
    const { container } = render(<QuestionSkeleton />);
    // 2 text lines (title + line) + 4 option rectangles = 6 skeleton elements
    const skeletons = container.querySelectorAll("[class*=skeleton]");
    expect(skeletons.length).toBe(6);
  });
});
