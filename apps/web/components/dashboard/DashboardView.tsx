"use client";

import { useEffect, useMemo, useState } from "react";
import type { AnalyticsOverview, DailyPlan, Locale, NextTask, ViewTab, WeeklyPlanDay } from "../../types";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/Card";
import { Button } from "../ui/Button";
import styles from "./DashboardView.module.css";

const COPY = {
  zh: {
    title: "\u5b66\u4e60\u6982\u89c8",
    refresh: "\u5237\u65b0\u6570\u636e",
    focusTitle: "\u6bcf\u65e5\u6253\u5361\u6a21\u5f0f",
    focusHint: "\u6b65\u9aa4\uff1a\u9009\u65e5\u671f \u2192 \u70b9\u201c\u5f00\u59cb\u4e0b\u4e00\u4e2a\u4efb\u52a1\u201d \u2192 \u5b8c\u6210\u540e\u52fe\u9009\u6253\u5361\u3002",
    currentScore: "\u5f53\u524d\u603b\u5206",
    predicted: "\u9884\u6d4b\u5206\u6570",
    gap: "\u76ee\u6807\u5dee\u8ddd",
    accuracy: "\u8bad\u7ec3\u6b63\u786e\u7387",
    paceCritical: "\u5f53\u524d\u76ee\u6807\u8282\u594f\u504f\u7d27\uff0c\u5efa\u8bae\u7acb\u5373\u63d0\u5347\u6bcf\u5468\u505a\u9898\u91cf\u548c\u6a21\u8003\u9891\u7387\u3002",
    paceRisk: "\u76ee\u6807\u6709\u538b\u529b\uff0c\u5efa\u8bae\u6bcf\u5468\u589e\u52a0\u5f31\u9879\u5f3a\u5316\u5e76\u4fdd\u8bc1\u81f3\u5c11\u4e00\u6b21\u6a21\u8003\u3002",
    paceGood: "\u76ee\u6807\u8282\u594f\u53ef\u8fbe\u6210\uff0c\u7ee7\u7eed\u4fdd\u6301\u5f53\u524d\u8bad\u7ec3\u5f3a\u5ea6\u3002",
    paceLabel: "\u51b2\u5206\u8282\u594f",
    paceDaysTo: (days: number | string, gain: number | string) => `\u8ddd\u8003\u8bd5 ${days} \u5929 \xb7 \u6bcf\u5468\u9700\u63d0\u5347 ${gain} \u5206\u3002`,
    startDiagnostic: "\u5f00\u59cb\u8bca\u65ad",
    listening: "\u542c\u529b\u8bad\u7ec3",
    reading: "\u9605\u8bfb\u8bad\u7ec3",
    grammar: "\u8bed\u6cd5\u8bad\u7ec3",
    mistakeBank: "\u9519\u9898\u5e93",
    conversation: "AI \u5bf9\u8bdd",
    planTitle: "\u6bcf\u65e5\u6253\u5361\u8ba1\u5212",
    streakLabel: (streak: number) => `\u8fde\u7eed\u5b66\u4e60 ${streak} \u5929`,
    syncing: "\u540c\u6b65\u4e2d",
    checkedIn: "\u5df2\u6253\u5361",
    pending: "\u5f85\u6253\u5361",
    min: "\u5206\u949f",
    taskOf: (done: number, total: number) => `\u4efb\u52a1 ${done}/${total}`,
    completionRate: (pct: number) => `\u5b8c\u6210\u7387 ${pct}%`,
    avgTime: "\u5e73\u5747\u7528\u65f6",
    running: "\u6267\u884c\u4e2d...",
    startNext: "\u5f00\u59cb\u4e0b\u4e00\u4e2a\u4efb\u52a1",
    allDone: "\u4eca\u65e5\u5df2\u5b8c\u6210",
    emptyPlan: "\u4eca\u5929\u8fd8\u6ca1\u6709\u751f\u6210\u4efb\u52a1\uff0c\u5148\u70b9\u4e00\u6b21\u201c\u5f00\u59cb\u8bca\u65ad\u201d\u3002",
    done: "\u5df2\u6253\u5361",
    notDone: "\u672a\u6253\u5361",
    viewPoints: "\u67e5\u770b\u4efb\u52a1\u8981\u70b9",
    start: "\u5f00\u59cb",
    manualCheck: "\u624b\u52a8\u6253\u5361",
    taskFailed: "\u4efb\u52a1\u6267\u884c\u5931\u8d25\uff0c\u8bf7\u770b\u9876\u90e8\u63d0\u793a\u540e\u91cd\u8bd5\u3002",
  },
  ja: {
    title: "\u5b66\u7fd2\u6982\u8981",
    refresh: "\u30c7\u30fc\u30bf\u66f4\u65b0",
    focusTitle: "\u6bce\u65e5\u30c1\u30a7\u30c3\u30af\u30a4\u30f3",
    focusHint: "\u624b\u9806\uff1a\u65e5\u4ed8\u9078\u629e \u2192 \u300c\u6b21\u306e\u30bf\u30b9\u30af\u3092\u958b\u59cb\u300d \u2192 \u5b8c\u4e86\u5f8c\u30c1\u30a7\u30c3\u30af\u3002",
    currentScore: "\u73fe\u5728\u30b9\u30b3\u30a2",
    predicted: "\u4e88\u6e2c\u30b9\u30b3\u30a2",
    gap: "\u76ee\u6a19\u307e\u3067",
    accuracy: "\u6b63\u7b54\u7387",
    paceCritical: "\u76ee\u6a19\u30da\u30fc\u30b9\u304c\u53b3\u3057\u3044\u3067\u3059\u3002\u6bcf\u9031\u306e\u7df4\u7fd2\u91cf\u3068\u6a21\u8a66\u983b\u5ea6\u3092\u5897\u3084\u3057\u307e\u3057\u3087\u3046\u3002",
    paceRisk: "\u76ee\u6a19\u306b\u5727\u304c\u304b\u304b\u3063\u3066\u3044\u307e\u3059\u3002\u5f31\u70b9\u5f37\u5316\u3068\u9031\u4e00\u56de\u306e\u6a21\u8a66\u3092\u304a\u3059\u3059\u3081\u3057\u307e\u3059\u3002",
    paceGood: "\u76ee\u6a19\u30da\u30fc\u30b9\u306f\u9054\u6210\u53ef\u80fd\u3067\u3059\u3002\u3053\u306e\u307e\u307e\u7d9a\u3051\u307e\u3057\u3087\u3046\u3002",
    paceLabel: "\u30b9\u30b3\u30a2\u30da\u30fc\u30b9",
    paceDaysTo: (days: number | string, gain: number | string) => `\u8a66\u9a13\u307e\u3067 ${days} \u65e5 \xb7 \u6bce\u9031 ${gain} \u70b9\u30a2\u30c3\u30d7\u304c\u5fc5\u8981\u3067\u3059\u3002`,
    startDiagnostic: "\u8a3a\u65ad\u958b\u59cb",
    listening: "\u30ea\u30b9\u30cb\u30f3\u30b0",
    reading: "\u30ea\u30fc\u30c7\u30a3\u30f3\u30b0",
    grammar: "\u6587\u6cd5",
    mistakeBank: "\u30df\u30b9\u30ce\u30fc\u30c8",
    conversation: "AI \u4f1a\u8a71",
    planTitle: "\u6bce\u65e5\u30c1\u30a7\u30c3\u30af\u30a4\u30f3\u8a08\u753b",
    streakLabel: (streak: number) => `${streak} \u65e5\u9023\u7d9a\u5b66\u7fd2`,
    syncing: "\u540c\u671f\u4e2d",
    checkedIn: "\u30c1\u30a7\u30c3\u30af\u6e08",
    pending: "\u672a\u30c1\u30a7\u30c3\u30af",
    min: "\u5206",
    taskOf: (done: number, total: number) => `\u30bf\u30b9\u30af ${done}/${total}`,
    completionRate: (pct: number) => `\u5b8c\u4e86\u7387 ${pct}%`,
    avgTime: "\u5e73\u5747\u6240\u8981\u6642\u9593",
    running: "\u5b9f\u884c\u4e2d...",
    startNext: "\u6b21\u306e\u30bf\u30b9\u30af\u3092\u958b\u59cb",
    allDone: "\u672c\u65e5\u5b8c\u4e86",
    emptyPlan: "\u4eca\u65e5\u306e\u30bf\u30b9\u30af\u304c\u307e\u3060\u751f\u6210\u3055\u308c\u3066\u3044\u307e\u305b\u3093\u3002\u307e\u305a\u300c\u8a3a\u65ad\u958b\u59cb\u300d\u3092\u62bc\u3057\u3066\u304f\u3060\u3055\u3044\u3002",
    done: "\u30c1\u30a7\u30c3\u30af\u6e08",
    notDone: "\u672a\u30c1\u30a7\u30c3\u30af",
    viewPoints: "\u30bf\u30b9\u30af\u306e\u30dd\u30a4\u30f3\u30c8",
    start: "\u958b\u59cb",
    manualCheck: "\u624b\u52d5\u30c1\u30a7\u30c3\u30af",
    taskFailed: "\u30bf\u30b9\u30af\u306e\u5b9f\u884c\u306b\u5931\u6557\u3057\u307e\u3057\u305f\u3002\u4e0a\u90e8\u306e\u30e1\u30c3\u30bb\u30fc\u30b8\u3092\u78ba\u8a8d\u3057\u3066\u518d\u8a66\u884c\u3057\u3066\u304f\u3060\u3055\u3044\u3002",
  },
} as const;

interface DashboardViewProps {
  locale: Locale;
  analytics: AnalyticsOverview | null;
  nextTasks: NextTask[];
  dailyPlan: DailyPlan | null;
  currentScore: number | null;
  predictedScore: number | null;
  currentGap: string;
  accuracyLabel: string;
  avgTimeLabel: string;
  isSyncing: boolean;
  onRefresh: () => void;
  onStartDiagnostic: () => void;
  onViewChange: (view: ViewTab) => void;
  onRunTask: (task: NextTask) => Promise<boolean>;
  onRunAction: (action: string) => Promise<boolean>;
  progressStorageKey?: string;
}

const PLAN_PROGRESS_STORAGE_KEY_PREFIX = "toeicpass.planProgress.v1";

type RenderTask = {
  id: string;
  title: string;
  action: string;
  minutes: number;
  reason?: string;
  previews: string[];
  progressKey: string;
  source: "daily" | "week" | "priority";
  originalTask?: NextTask;
};

export function DashboardView({
  locale,
  analytics,
  nextTasks,
  dailyPlan,
  currentScore,
  predictedScore,
  currentGap,
  accuracyLabel,
  avgTimeLabel,
  isSyncing,
  onRefresh,
  onStartDiagnostic,
  onViewChange,
  onRunTask,
  onRunAction,
  progressStorageKey,
}: DashboardViewProps) {
  const t = COPY[locale];
  const pace = analytics?.goalPace;
  const showPace = Boolean(pace) && pace?.status !== "no_goal";
  const paceClass =
    pace?.status === "critical"
      ? styles.paceCritical
      : pace?.status === "at_risk"
        ? styles.paceRisk
        : styles.paceGood;
  const paceText =
    pace?.status === "critical"
      ? t.paceCritical
      : pace?.status === "at_risk"
        ? t.paceRisk
        : t.paceGood;

  const weekSchedule = dailyPlan?.weekSchedule ?? [];
  const priorityTasks = nextTasks.slice(0, 3);
  const todayDateKey = new Date().toISOString().slice(0, 10);
  const storageKey = progressStorageKey
    ? `${PLAN_PROGRESS_STORAGE_KEY_PREFIX}:${progressStorageKey}`
    : PLAN_PROGRESS_STORAGE_KEY_PREFIX;

  const [progressMap, setProgressMap] = useState<Record<string, boolean>>({});
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [runningTaskKey, setRunningTaskKey] = useState<string | null>(null);
  const [failedTaskKey, setFailedTaskKey] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return;
    }
    try {
      const parsed = JSON.parse(raw) as Record<string, boolean>;
      setProgressMap(parsed);
    } catch {
      setProgressMap({});
    }
  }, [storageKey]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(storageKey, JSON.stringify(progressMap));
  }, [progressMap, storageKey]);

  const scheduleByDate = useMemo(
    () => new Map(weekSchedule.map((day) => [day.date, day])),
    [weekSchedule],
  );

  useEffect(() => {
    if (weekSchedule.length === 0) {
      setSelectedDate("");
      return;
    }
    if (!selectedDate || !scheduleByDate.has(selectedDate)) {
      setSelectedDate(scheduleByDate.has(todayDateKey) ? todayDateKey : weekSchedule[0].date);
    }
  }, [weekSchedule, selectedDate, scheduleByDate, todayDateKey]);

  const selectedDay = selectedDate ? scheduleByDate.get(selectedDate) ?? null : null;
  const isTodaySelected = selectedDate === todayDateKey;
  const planDateKey = dailyPlan?.generatedAt?.slice(0, 10) ?? todayDateKey;

  const todayBlockStats = useMemo(() => {
    if (!dailyPlan || dailyPlan.blocks.length === 0) {
      return { done: 0, total: 0, pct: 0 };
    }
    const total = dailyPlan.blocks.length;
    const done = dailyPlan.blocks.reduce((sum, block) => {
      const key = `block:${planDateKey}:${block.id}`;
      return sum + (progressMap[key] ? 1 : 0);
    }, 0);
    return {
      done,
      total,
      pct: Math.round((done / Math.max(1, total)) * 100),
    };
  }, [dailyPlan, planDateKey, progressMap]);

  const renderTasks = useMemo<RenderTask[]>(() => {
    if (isTodaySelected && dailyPlan && dailyPlan.blocks.length > 0) {
      return dailyPlan.blocks.map((block) => ({
        id: block.id,
        title: block.title,
        action: block.action,
        minutes: block.minutes,
        reason: block.reason,
        previews: (block.checklist ?? []).slice(0, 3).map((item) => item.label),
        progressKey: `block:${planDateKey}:${block.id}`,
        source: "daily",
      }));
    }

    if (selectedDay && selectedDay.tasks.length > 0) {
      return selectedDay.tasks.map((task) => ({
        id: task.id,
        title: task.title,
        action: task.action,
        minutes: task.minutes,
        previews: task.previews.slice(0, 3),
        progressKey: `week:${selectedDay.date}:${task.id}`,
        source: "week",
      }));
    }

    return priorityTasks.map((task) => ({
      id: task.id,
      title: task.title,
      action: task.action,
      minutes: 15,
      reason: task.reason,
      previews: [],
      progressKey: `priority:${todayDateKey}:${task.id}`,
      source: "priority",
      originalTask: task,
    }));
  }, [isTodaySelected, dailyPlan, planDateKey, selectedDay, priorityTasks, todayDateKey]);

  const selectedTaskStats = useMemo(() => {
    if (renderTasks.length === 0) {
      return { done: 0, total: 0, pct: 0 };
    }
    const total = renderTasks.length;
    const done = renderTasks.reduce((sum, task) => sum + (progressMap[task.progressKey] ? 1 : 0), 0);
    return {
      done,
      total,
      pct: Math.round((done / Math.max(1, total)) * 100),
    };
  }, [renderTasks, progressMap]);

  const checkedInText =
    selectedTaskStats.total > 0 && selectedTaskStats.done === selectedTaskStats.total
      ? t.checkedIn
      : t.pending;

  const selectedTotalMinutes =
    isTodaySelected && dailyPlan && dailyPlan.blocks.length > 0
      ? dailyPlan.totalMinutes
      : selectedDay?.totalMinutes ?? renderTasks.reduce((sum, task) => sum + task.minutes, 0);

  const nextPendingTask = renderTasks.find((task) => !progressMap[task.progressKey]) ?? null;

  const toggleProgress = (key: string) => {
    setProgressMap((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const markProgress = (key: string) => {
    setProgressMap((prev) => ({ ...prev, [key]: true }));
  };

  const runTask = async (task: RenderTask) => {
    if (runningTaskKey) {
      return;
    }
    setRunningTaskKey(task.progressKey);
    setFailedTaskKey(null);
    try {
      const success =
        task.source === "priority" && task.originalTask
          ? await onRunTask(task.originalTask)
          : await onRunAction(task.action);
      if (success) {
        markProgress(task.progressKey);
        return;
      }
      setFailedTaskKey(task.progressKey);
    } finally {
      setRunningTaskKey(null);
    }
  };

  const runNextPendingTask = async () => {
    if (!nextPendingTask) {
      return;
    }
    await runTask(nextPendingTask);
  };

  const getDayTaskProgress = (day: WeeklyPlanDay) => {
    if (day.date === todayDateKey && dailyPlan && dailyPlan.blocks.length > 0) {
      const total = dailyPlan.blocks.length;
      const done = dailyPlan.blocks.reduce((sum, block) => {
        const key = `block:${planDateKey}:${block.id}`;
        return sum + (progressMap[key] ? 1 : 0);
      }, 0);
      return { done, total };
    }

    const total = day.tasks.length;
    const done = day.tasks.reduce((sum, task) => {
      const key = `week:${day.date}:${task.id}`;
      return sum + (progressMap[key] ? 1 : 0);
    }, 0);
    return { done, total };
  };

  return (
    <div className={styles.dashboard}>
      <Card>
        <CardHeader>
          <CardTitle as="h1">{t.title}</CardTitle>
          <Button variant="secondary" onClick={onRefresh}>
            {t.refresh}
          </Button>
        </CardHeader>

        <CardContent>
          <div className={styles.focusIntro}>
            <h2>{t.focusTitle}</h2>
            <p>{t.focusHint}</p>
          </div>

          <div className={styles.kpiGrid}>
            <div className={styles.kpi}>
              <span>{t.currentScore}</span>
              <strong>{currentScore ?? "--"}</strong>
            </div>
            <div className={styles.kpi}>
              <span>{t.predicted}</span>
              <strong>{predictedScore ?? "--"}</strong>
            </div>
            <div className={styles.kpi}>
              <span>{t.gap}</span>
              <strong>{currentGap}</strong>
            </div>
            <div className={styles.kpi}>
              <span>{t.accuracy}</span>
              <strong>{accuracyLabel}</strong>
            </div>
          </div>

          {showPace && (
            <div className={`${styles.paceBanner} ${paceClass}`}>
              <strong>{t.paceLabel}</strong>
              <span>
                {t.paceDaysTo(pace?.daysToExam ?? "--", pace?.requiredWeeklyGain ?? "--")}
              </span>
              <p>{paceText}</p>
            </div>
          )}

          <div className={styles.actions}>
            <Button onClick={onStartDiagnostic}>{t.startDiagnostic}</Button>
            <Button variant="secondary" onClick={() => onViewChange("listening")}>{t.listening}</Button>
            <Button variant="secondary" onClick={() => onViewChange("grammar")}>{t.grammar}</Button>
            <Button variant="secondary" onClick={() => onViewChange("reading")}>{t.reading}</Button>
            <Button variant="secondary" onClick={() => onViewChange("mistakes")}>{t.mistakeBank}</Button>
            <Button variant="secondary" onClick={() => onViewChange("conversation")}>{t.conversation}</Button>
          </div>

          <div className={styles.planBoard}>
            <div className={styles.planTitleRow}>
              <h2>{t.planTitle}</h2>
              <span className={styles.progressBadge}>
                {t.streakLabel(analytics?.currentStreak ?? 0)} · {isSyncing ? t.syncing : checkedInText}
              </span>
            </div>

            {weekSchedule.length > 0 && (
              <div className={styles.weekGrid}>
                {weekSchedule.map((day) => {
                  const isSelected = day.date === selectedDate;
                  const progress = getDayTaskProgress(day);
                  const checkinLabel =
                    progress.total > 0 && progress.done === progress.total
                      ? t.checkedIn
                      : `${progress.done}/${progress.total}`;

                  return (
                    <button
                      type="button"
                      key={`quick-${day.date}`}
                      className={`${styles.quickDayButton} ${isSelected ? styles.quickDayButtonActive : ""}`}
                      onClick={() => setSelectedDate(day.date)}
                    >
                      <span>{day.dayLabel} · {day.date.slice(5)}</span>
                      <span className={styles.quickDayMeta}>{day.totalMinutes} {t.min} · {checkinLabel}</span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className={styles.dailyToolbar}>
              <Button onClick={() => void runNextPendingTask()} disabled={!nextPendingTask || Boolean(runningTaskKey)}>
                {runningTaskKey ? t.running : nextPendingTask ? t.startNext : t.allDone}
              </Button>
              <span className={styles.dailyMeta}>
                {selectedDate || "--"} {selectedDay?.dayLabel ?? ""} · {selectedTotalMinutes} {t.min}
              </span>
            </div>

            <div className={styles.progressTrack}>
              <div className={styles.progressFill} style={{ width: `${selectedTaskStats.pct}%` }} />
            </div>

            <div className={styles.planMetaRow}>
              <span>{t.taskOf(selectedTaskStats.done, selectedTaskStats.total)}</span>
              <span>{t.completionRate(selectedTaskStats.pct)}</span>
              <span>{t.avgTime} {avgTimeLabel}</span>
            </div>

            {renderTasks.length === 0 ? (
              <p className={styles.empty}>{t.emptyPlan}</p>
            ) : (
              <div className={styles.planList}>
                {renderTasks.map((task, index) => {
                  const done = Boolean(progressMap[task.progressKey]);
                  return (
                    <div key={task.progressKey} className={styles.planItem}>
                      <div className={styles.planHeader}>
                        <strong>
                          {index + 1}. {task.title}
                        </strong>
                        <div className={styles.planHeaderRight}>
                          <span>{task.minutes} {t.min}</span>
                          <span className={done ? styles.statusDone : styles.statusTodo}>
                            {done ? t.done : t.notDone}
                          </span>
                        </div>
                      </div>

                      {task.reason && <p className={styles.taskReason}>{task.reason}</p>}

                      {task.previews.length > 0 && (
                        <details className={styles.taskDetails}>
                          <summary>{t.viewPoints}</summary>
                          <ul className={styles.taskPreviewList}>
                            {task.previews.map((preview, previewIndex) => (
                              <li key={`${task.id}-preview-${previewIndex}`}>{preview}</li>
                            ))}
                          </ul>
                        </details>
                      )}

                      <div className={styles.taskActions}>
                        <Button
                          variant="secondary"
                          onClick={() => void runTask(task)}
                          disabled={Boolean(runningTaskKey)}
                        >
                          {runningTaskKey === task.progressKey ? t.running : t.start}
                        </Button>
                        <label className={styles.doneToggle}>
                          <input
                            type="checkbox"
                            checked={done}
                            onChange={() => toggleProgress(task.progressKey)}
                          />
                          {t.manualCheck}
                        </label>
                      </div>
                      {failedTaskKey === task.progressKey && (
                        <p className={styles.taskRunError}>{t.taskFailed}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
