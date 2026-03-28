"use client";

import { useState, useCallback } from "react";
import type { AnalyticsOverview, DailyPlan, NextTask } from "../types";
import * as api from "../lib/api";

export function useAnalytics(
  getRequestOptions: (token?: string) => { token?: string; tenantCode?: string }
) {
  const [analytics, setAnalytics] = useState<AnalyticsOverview | null>(null);
  const [nextTasks, setNextTasks] = useState<NextTask[]>([]);
  const [dailyPlan, setDailyPlan] = useState<DailyPlan | null>(null);
  const [predictedScore, setPredictedScore] = useState<number | null>(null);
  const [latestScore, setLatestScore] = useState<number | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const refreshInsights = useCallback(
    async (token?: string) => {
      const options = getRequestOptions(token);
      if (!options.token) return;

      setIsSyncing(true);
      try {
        const [overview, tasks, plan] = await Promise.all([
          api.fetchAnalyticsOverview(options),
          api.fetchNextTasks(options),
          api.fetchDailyPlan(options),
        ]);

        if (overview) {
          setAnalytics(overview);
          if (typeof overview.latestScore === "number") {
            setLatestScore(overview.latestScore);
          }
        }
        setNextTasks(tasks);
        setDailyPlan(plan);
      } finally {
        setIsSyncing(false);
      }
    },
    [getRequestOptions]
  );

  const fetchPrediction = useCallback(
    async (token?: string) => {
      const options = getRequestOptions(token);
      if (!options.token) return;

      const prediction = await api.fetchPrediction(options);
      if (prediction !== null) {
        setPredictedScore(prediction);
      }
    },
    [getRequestOptions]
  );

  const refreshAll = useCallback(
    async (token?: string) => {
      await Promise.all([refreshInsights(token), fetchPrediction(token)]);
    },
    [refreshInsights, fetchPrediction]
  );

  const updateLatestScore = useCallback((score: number) => {
    setLatestScore((prev) => {
      if (typeof prev !== "number") {
        return score;
      }
      return Math.max(prev, score);
    });
  }, []);

  // Computed values
  const accuracyLabel =
    analytics && analytics.questionsAnswered > 0
      ? `${Math.round(analytics.overallAccuracy * 100)}%`
      : "--";

  const avgTimeLabel =
    analytics && analytics.avgDurationMs > 0
      ? `${(analytics.avgDurationMs / 1000).toFixed(1)} 秒/题`
      : "--";

  const currentGap =
    typeof analytics?.goal.gap === "number" ? `${analytics.goal.gap} 分` : "--";

  const currentScore = latestScore ?? analytics?.latestScore ?? null;

  return {
    analytics,
    nextTasks,
    dailyPlan,
    predictedScore,
    latestScore,
    isSyncing,
    accuracyLabel,
    avgTimeLabel,
    currentGap,
    currentScore,
    refreshInsights,
    fetchPrediction,
    refreshAll,
    updateLatestScore,
  };
}
