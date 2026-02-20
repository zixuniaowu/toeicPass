"use client";

import { useState, useCallback } from "react";
import type { AnalyticsOverview, NextTask } from "../types";
import * as api from "../lib/api";

export function useAnalytics(
  getRequestOptions: (token?: string) => { token?: string; tenantCode?: string }
) {
  const [analytics, setAnalytics] = useState<AnalyticsOverview | null>(null);
  const [nextTasks, setNextTasks] = useState<NextTask[]>([]);
  const [predictedScore, setPredictedScore] = useState<number | null>(null);
  const [latestScore, setLatestScore] = useState<number | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const refreshInsights = useCallback(
    async (token?: string) => {
      const options = getRequestOptions(token);
      if (!options.token) return;

      setIsSyncing(true);
      try {
        const [overview, tasks] = await Promise.all([
          api.fetchAnalyticsOverview(options),
          api.fetchNextTasks(options),
        ]);

        if (overview) {
          setAnalytics(overview);
          if (typeof overview.latestScore === "number") {
            setLatestScore(overview.latestScore);
          }
        }
        setNextTasks(tasks);
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
    setLatestScore(score);
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
