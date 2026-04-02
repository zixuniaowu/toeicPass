import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useAnalytics } from "../hooks/useAnalytics";
import type { AnalyticsOverview, NextTask, DailyPlan } from "../types";

vi.mock("../lib/api", () => ({
  fetchAnalyticsOverview: vi.fn(),
  fetchNextTasks: vi.fn(),
  fetchDailyPlan: vi.fn(),
  fetchPrediction: vi.fn(),
}));

import * as api from "../lib/api";

const mockFetchOverview = vi.mocked(api.fetchAnalyticsOverview);
const mockFetchTasks = vi.mocked(api.fetchNextTasks);
const mockFetchPlan = vi.mocked(api.fetchDailyPlan);
const mockFetchPrediction = vi.mocked(api.fetchPrediction);

const mockGetRequestOptions = vi.fn<(token?: string) => { token?: string; tenantCode?: string }>((token?: string) => ({
  token: token ?? "jwt-abc",
  tenantCode: "demo",
}));

function makeOverview(overrides: Partial<AnalyticsOverview> = {}): AnalyticsOverview {
  return {
    attempts: 10,
    questionsAnswered: 50,
    overallAccuracy: 0.76,
    avgDurationMs: 12500,
    latestScore: 650,
    scoreHistory: [580, 620, 650],
    activeDays7: 5,
    currentStreak: 3,
    studyMinutes7: 120,
    modeBreakdown: { diagnostic: 1, practice: 6, mock: 2, ip_simulation: 1 },
    goalPace: { daysToExam: 30, requiredWeeklyGain: 15, status: "on_track" },
    byPart: [],
    goal: { targetScore: 800, gap: 150, targetExamDate: "2026-06-01" },
    ...overrides,
  };
}

function makeTask(id: string, action = "practice:start"): NextTask {
  return { id, title: `Task ${id}`, reason: "weak area", action, priority: 1 };
}

function makePlan(): DailyPlan {
  return {
    generatedAt: "2026-01-01T00:00:00Z",
    totalMinutes: 60,
    focusPart: 5,
    blocks: [{ id: "b1", title: "Grammar drill", minutes: 30, reason: "weak", action: "practice:start?part=5" }],
  };
}

function setup() {
  return renderHook(() => useAnalytics(mockGetRequestOptions));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetRequestOptions.mockImplementation((token?: string) => ({
    token: token ?? "jwt-abc",
    tenantCode: "demo",
  }));
});

describe("useAnalytics", () => {
  it("initial state has null analytics and empty tasks", () => {
    const { result } = setup();
    expect(result.current.analytics).toBeNull();
    expect(result.current.nextTasks).toEqual([]);
    expect(result.current.dailyPlan).toBeNull();
    expect(result.current.predictedScore).toBeNull();
    expect(result.current.latestScore).toBeNull();
    expect(result.current.isSyncing).toBe(false);
  });

  it("refreshInsights fetches overview, tasks, and plan in parallel", async () => {
    const overview = makeOverview();
    const tasks = [makeTask("t1"), makeTask("t2")];
    const plan = makePlan();
    mockFetchOverview.mockResolvedValueOnce(overview);
    mockFetchTasks.mockResolvedValueOnce(tasks);
    mockFetchPlan.mockResolvedValueOnce(plan);
    const { result } = setup();

    await act(async () => {
      await result.current.refreshInsights();
    });

    expect(result.current.analytics).toEqual(overview);
    expect(result.current.nextTasks).toEqual(tasks);
    expect(result.current.dailyPlan).toEqual(plan);
    expect(result.current.latestScore).toBe(650);
    expect(result.current.isSyncing).toBe(false);
  });

  it("refreshInsights sets isSyncing during fetch", async () => {
    let resolveFn: (v: AnalyticsOverview | null) => void;
    mockFetchOverview.mockReturnValueOnce(
      new Promise((r) => { resolveFn = r; })
    );
    mockFetchTasks.mockResolvedValueOnce([]);
    mockFetchPlan.mockResolvedValueOnce(null);
    const { result } = setup();

    let promise: Promise<void>;
    act(() => {
      promise = result.current.refreshInsights();
    });

    expect(result.current.isSyncing).toBe(true);

    await act(async () => {
      resolveFn!(null);
      await promise!;
    });

    expect(result.current.isSyncing).toBe(false);
  });

  it("refreshInsights skips when no token", async () => {
    mockGetRequestOptions.mockReturnValueOnce({ token: undefined, tenantCode: "demo" });
    const { result } = setup();

    await act(async () => {
      await result.current.refreshInsights();
    });

    expect(mockFetchOverview).not.toHaveBeenCalled();
  });

  it("refreshInsights handles null overview gracefully", async () => {
    mockFetchOverview.mockResolvedValueOnce(null);
    mockFetchTasks.mockResolvedValueOnce([makeTask("t1")]);
    mockFetchPlan.mockResolvedValueOnce(null);
    const { result } = setup();

    await act(async () => {
      await result.current.refreshInsights();
    });

    expect(result.current.analytics).toBeNull();
    expect(result.current.nextTasks).toHaveLength(1);
  });

  it("fetchPrediction stores predicted score", async () => {
    mockFetchPrediction.mockResolvedValueOnce(720);
    const { result } = setup();

    await act(async () => {
      await result.current.fetchPrediction();
    });

    expect(result.current.predictedScore).toBe(720);
  });

  it("fetchPrediction ignores null response", async () => {
    mockFetchPrediction.mockResolvedValueOnce(null);
    const { result } = setup();

    await act(async () => {
      await result.current.fetchPrediction();
    });

    expect(result.current.predictedScore).toBeNull();
  });

  it("fetchPrediction skips when no token", async () => {
    mockGetRequestOptions.mockReturnValueOnce({ token: undefined, tenantCode: "demo" });
    const { result } = setup();

    await act(async () => {
      await result.current.fetchPrediction();
    });

    expect(mockFetchPrediction).not.toHaveBeenCalled();
  });

  it("refreshAll calls both refreshInsights and fetchPrediction", async () => {
    mockFetchOverview.mockResolvedValueOnce(makeOverview());
    mockFetchTasks.mockResolvedValueOnce([]);
    mockFetchPlan.mockResolvedValueOnce(null);
    mockFetchPrediction.mockResolvedValueOnce(700);
    const { result } = setup();

    await act(async () => {
      await result.current.refreshAll();
    });

    expect(mockFetchOverview).toHaveBeenCalled();
    expect(mockFetchPrediction).toHaveBeenCalled();
    expect(result.current.predictedScore).toBe(700);
  });

  it("updateLatestScore sets score when no previous", () => {
    const { result } = setup();

    act(() => result.current.updateLatestScore(600));

    expect(result.current.latestScore).toBe(600);
  });

  it("updateLatestScore keeps max of previous and new", async () => {
    mockFetchOverview.mockResolvedValueOnce(makeOverview({ latestScore: 650 }));
    mockFetchTasks.mockResolvedValueOnce([]);
    mockFetchPlan.mockResolvedValueOnce(null);
    const { result } = setup();

    await act(async () => {
      await result.current.refreshInsights();
    });
    expect(result.current.latestScore).toBe(650);

    act(() => result.current.updateLatestScore(600));
    expect(result.current.latestScore).toBe(650);

    act(() => result.current.updateLatestScore(800));
    expect(result.current.latestScore).toBe(800);
  });

  // Computed label tests
  it("accuracyLabel shows percentage when data available", async () => {
    mockFetchOverview.mockResolvedValueOnce(makeOverview({ overallAccuracy: 0.823 }));
    mockFetchTasks.mockResolvedValueOnce([]);
    mockFetchPlan.mockResolvedValueOnce(null);
    const { result } = setup();

    await act(async () => {
      await result.current.refreshInsights();
    });

    expect(result.current.accuracyLabel).toBe("82%");
  });

  it("accuracyLabel shows -- when no data", () => {
    const { result } = setup();
    expect(result.current.accuracyLabel).toBe("--");
  });

  it("accuracyLabel shows -- when zero questions answered", async () => {
    mockFetchOverview.mockResolvedValueOnce(makeOverview({ questionsAnswered: 0 }));
    mockFetchTasks.mockResolvedValueOnce([]);
    mockFetchPlan.mockResolvedValueOnce(null);
    const { result } = setup();

    await act(async () => {
      await result.current.refreshInsights();
    });

    expect(result.current.accuracyLabel).toBe("--");
  });

  it("avgTimeLabel shows seconds per question", async () => {
    mockFetchOverview.mockResolvedValueOnce(makeOverview({ avgDurationMs: 15300 }));
    mockFetchTasks.mockResolvedValueOnce([]);
    mockFetchPlan.mockResolvedValueOnce(null);
    const { result } = setup();

    await act(async () => {
      await result.current.refreshInsights();
    });

    expect(result.current.avgTimeLabel).toBe("15.3 秒/题");
  });

  it("avgTimeLabel shows -- when no data", () => {
    const { result } = setup();
    expect(result.current.avgTimeLabel).toBe("--");
  });

  it("currentGap shows gap when goal exists", async () => {
    mockFetchOverview.mockResolvedValueOnce(makeOverview({ goal: { targetScore: 800, gap: 150, targetExamDate: "2026-06-01" } }));
    mockFetchTasks.mockResolvedValueOnce([]);
    mockFetchPlan.mockResolvedValueOnce(null);
    const { result } = setup();

    await act(async () => {
      await result.current.refreshInsights();
    });

    expect(result.current.currentGap).toBe("150 分");
  });

  it("currentGap shows -- when no goal", () => {
    const { result } = setup();
    expect(result.current.currentGap).toBe("--");
  });

  it("currentScore uses latestScore over analytics.latestScore", async () => {
    mockFetchOverview.mockResolvedValueOnce(makeOverview({ latestScore: 650 }));
    mockFetchTasks.mockResolvedValueOnce([]);
    mockFetchPlan.mockResolvedValueOnce(null);
    const { result } = setup();

    await act(async () => {
      await result.current.refreshInsights();
    });

    expect(result.current.currentScore).toBe(650);

    act(() => result.current.updateLatestScore(700));
    expect(result.current.currentScore).toBe(700);
  });

  it("currentScore is null when no data at all", () => {
    const { result } = setup();
    expect(result.current.currentScore).toBeNull();
  });
});
