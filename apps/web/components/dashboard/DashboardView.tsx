"use client";

import type { AnalyticsOverview, NextTask, ViewTab } from "../../types";
import { isListeningPart } from "../../types";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/Card";
import { Button } from "../ui/Button";
import styles from "./DashboardView.module.css";

interface DashboardViewProps {
  analytics: AnalyticsOverview | null;
  nextTasks: NextTask[];
  currentScore: number | null;
  predictedScore: number | null;
  currentGap: string;
  accuracyLabel: string;
  avgTimeLabel: string;
  isSyncing: boolean;
  onRefresh: () => void;
  onStartDiagnostic: () => void;
  onViewChange: (view: ViewTab) => void;
  onRunTask: (task: NextTask) => void;
}

export function DashboardView({
  analytics,
  nextTasks,
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
}: DashboardViewProps) {
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
              <span>总体正确率</span>
              <strong>{accuracyLabel}</strong>
            </div>
          </div>

          <div className={styles.actions}>
            <Button onClick={onStartDiagnostic}>开始诊断</Button>
            <Button variant="secondary" onClick={() => onViewChange("listening")}>
              去听力训练
            </Button>
            <Button variant="secondary" onClick={() => onViewChange("reading")}>
              去阅读训练
            </Button>
            <Button variant="secondary" onClick={() => onViewChange("mistakes")}>
              打开错题库
            </Button>
            <Button variant="secondary" onClick={() => onViewChange("vocab")}>
              背单词
            </Button>
          </div>

          <div className={styles.statsGrid}>
            <div className={styles.stat}>
              <span>完成测验</span>
              <strong>{analytics?.attempts ?? 0}</strong>
            </div>
            <div className={styles.stat}>
              <span>累计作答</span>
              <strong>{analytics?.questionsAnswered ?? 0}</strong>
            </div>
            <div className={styles.stat}>
              <span>平均用时</span>
              <strong>{avgTimeLabel}</strong>
            </div>
            <div className={styles.stat}>
              <span>同步状态</span>
              <strong>{isSyncing ? "同步中" : "正常"}</strong>
            </div>
          </div>

          <div className={styles.taskBoard}>
            <h2>下一步任务</h2>
            {nextTasks.length === 0 && (
              <p className={styles.empty}>先完成一次练习，系统会自动生成任务。</p>
            )}
            {nextTasks.map((task) => (
              <div key={task.id} className={styles.taskItem}>
                <div className={styles.taskHeader}>
                  <strong>{task.title}</strong>
                  <span className={styles.priority}>P{task.priority}</span>
                </div>
                <p>{task.reason}</p>
                <Button variant="link" onClick={() => onRunTask(task)}>
                  执行任务
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
