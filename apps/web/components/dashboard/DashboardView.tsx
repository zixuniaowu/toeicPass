"use client";

import { useEffect, useMemo, useState } from "react";
import type { AnalyticsOverview, DailyPlan, NextTask, ViewTab, WeeklyPlanDay } from "../../types";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/Card";
import { Button } from "../ui/Button";
import styles from "./DashboardView.module.css";

interface DashboardViewProps {
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
      ? "当前目标节奏偏紧，建议立即提升每周做题量和模考频率。"
      : pace?.status === "at_risk"
        ? "目标有压力，建议每周增加弱项强化并保证至少一次模考。"
        : "目标节奏可达成，继续保持当前训练强度。";

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
      ? "已打卡"
      : "待打卡";

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
          <CardTitle as="h1">学习概览</CardTitle>
          <Button variant="secondary" onClick={onRefresh}>
            刷新数据
          </Button>
        </CardHeader>

        <CardContent>
          <div className={styles.focusIntro}>
            <h2>每日打卡模式</h2>
            <p>步骤：选日期 → 点“开始下一个任务” → 完成后勾选打卡。</p>
          </div>

          <div className={styles.kpiGrid}>
            <div className={styles.kpi}>
              <span>当前总分</span>
              <strong>{currentScore ?? "--"}</strong>
            </div>
            <div className={styles.kpi}>
              <span>预测分数</span>
              <strong>{predictedScore ?? "--"}</strong>
            </div>
            <div className={styles.kpi}>
              <span>目标差距</span>
              <strong>{currentGap}</strong>
            </div>
            <div className={styles.kpi}>
              <span>训练正确率</span>
              <strong>{accuracyLabel}</strong>
            </div>
          </div>

          {showPace && (
            <div className={`${styles.paceBanner} ${paceClass}`}>
              <strong>冲分节奏</strong>
              <span>
                距考试 {pace?.daysToExam ?? "--"} 天 · 每周需提升 {pace?.requiredWeeklyGain ?? "--"} 分。
              </span>
              <p>{paceText}</p>
            </div>
          )}

          <div className={styles.actions}>
            <Button onClick={onStartDiagnostic}>开始诊断</Button>
            <Button variant="secondary" onClick={() => onViewChange("listening")}>听力训练</Button>
            <Button variant="secondary" onClick={() => onViewChange("reading")}>阅读训练</Button>
            <Button variant="secondary" onClick={() => onViewChange("mistakes")}>错题库</Button>
          </div>

          <div className={styles.planBoard}>
            <div className={styles.planTitleRow}>
              <h2>每日打卡计划</h2>
              <span className={styles.progressBadge}>
                连续学习 {analytics?.currentStreak ?? 0} 天 · {isSyncing ? "同步中" : checkedInText}
              </span>
            </div>

            {weekSchedule.length > 0 && (
              <div className={styles.weekGrid}>
                {weekSchedule.map((day) => {
                  const isSelected = day.date === selectedDate;
                  const progress = getDayTaskProgress(day);
                  const checkinLabel =
                    progress.total > 0 && progress.done === progress.total
                      ? "已打卡"
                      : `${progress.done}/${progress.total}`;

                  return (
                    <button
                      type="button"
                      key={`quick-${day.date}`}
                      className={`${styles.quickDayButton} ${isSelected ? styles.quickDayButtonActive : ""}`}
                      onClick={() => setSelectedDate(day.date)}
                    >
                      <span>{day.dayLabel} · {day.date.slice(5)}</span>
                      <span className={styles.quickDayMeta}>{day.totalMinutes} 分钟 · {checkinLabel}</span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className={styles.dailyToolbar}>
              <Button onClick={() => void runNextPendingTask()} disabled={!nextPendingTask || Boolean(runningTaskKey)}>
                {runningTaskKey ? "执行中..." : nextPendingTask ? "开始下一个任务" : "今日已完成"}
              </Button>
              <span className={styles.dailyMeta}>
                {selectedDate || "--"} {selectedDay?.dayLabel ?? ""} · {selectedTotalMinutes} 分钟
              </span>
            </div>

            <div className={styles.progressTrack}>
              <div className={styles.progressFill} style={{ width: `${selectedTaskStats.pct}%` }} />
            </div>

            <div className={styles.planMetaRow}>
              <span>任务 {selectedTaskStats.done}/{selectedTaskStats.total}</span>
              <span>完成率 {selectedTaskStats.pct}%</span>
              <span>平均用时 {avgTimeLabel}</span>
            </div>

            {renderTasks.length === 0 ? (
              <p className={styles.empty}>今天还没有生成任务，先点一次“开始诊断”。</p>
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
                          <span>{task.minutes} 分钟</span>
                          <span className={done ? styles.statusDone : styles.statusTodo}>
                            {done ? "已打卡" : "未打卡"}
                          </span>
                        </div>
                      </div>

                      {task.reason && <p className={styles.taskReason}>{task.reason}</p>}

                      {task.previews.length > 0 && (
                        <details className={styles.taskDetails}>
                          <summary>查看任务要点</summary>
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
                          {runningTaskKey === task.progressKey ? "执行中..." : "开始"}
                        </Button>
                        <label className={styles.doneToggle}>
                          <input
                            type="checkbox"
                            checked={done}
                            onChange={() => toggleProgress(task.progressKey)}
                          />
                          手动打卡
                        </label>
                      </div>
                      {failedTaskKey === task.progressKey && (
                        <p className={styles.taskRunError}>任务执行失败，请看顶部提示后重试。</p>
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
