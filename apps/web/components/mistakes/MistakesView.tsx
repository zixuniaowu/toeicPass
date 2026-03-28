"use client";

import { useEffect, useMemo, useState } from "react";
import type { MistakeLibraryItem } from "../../types";
import { ALL_PARTS } from "../../types";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/Card";
import { Button } from "../ui/Button";
import { Select } from "../ui/Select";
import { Input } from "../ui/Input";
import { MistakeCard } from "./MistakeCard";
import styles from "./MistakesView.module.css";

const PAGE_SIZE = 20;

interface MistakesViewProps {
  mistakeLibrary: MistakeLibraryItem[];
  filteredMistakes: MistakeLibraryItem[];
  isLoading: boolean;
  partFilter: string;
  searchQuery: string;
  noteDraftMap: Record<string, string>;
  rootCauseMap: Record<string, string>;
  savingId: string | null;
  onPartFilterChange: (value: string) => void;
  onSearchQueryChange: (value: string) => void;
  onNoteDraftChange: (itemId: string, note: string) => void;
  onRootCauseChange: (itemId: string, cause: string) => void;
  onSaveNote: (item: MistakeLibraryItem) => void;
  onRefresh: () => void;
  onPractice: (partNo: number) => void;
  onPracticeFiltered: (payload: { questionIds: string[]; partNo?: number }) => void;
  onPracticeQuestion: (questionId: string, partNo?: number) => void;
}

export function MistakesView({
  mistakeLibrary,
  filteredMistakes,
  isLoading,
  partFilter,
  searchQuery,
  noteDraftMap,
  rootCauseMap,
  savingId,
  onPartFilterChange,
  onSearchQueryChange,
  onNoteDraftChange,
  onRootCauseChange,
  onSaveNote,
  onRefresh,
  onPractice,
  onPracticeFiltered,
  onPracticeQuestion,
}: MistakesViewProps) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [partFilter, searchQuery, filteredMistakes.length]);

  const partOptions = [
    { value: "all", label: "全部" },
    ...ALL_PARTS.map((p) => ({ value: String(p), label: `Part ${p}` })),
  ];
  const parsedPart = Number(partFilter);
  const selectedPart = Number.isNaN(parsedPart) ? undefined : parsedPart;
  const visibleMistakes = useMemo(
    () => filteredMistakes.slice(0, visibleCount),
    [filteredMistakes, visibleCount],
  );
  const hasMore = visibleMistakes.length < filteredMistakes.length;
  const filteredQuestionIds = filteredMistakes
    .map((item) => String(item.questionId ?? "").trim())
    .filter((id) => id.length > 0)
    .slice(0, PAGE_SIZE);

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h1">错题库</CardTitle>
        <Button variant="secondary" onClick={onRefresh}>
          {isLoading ? "刷新中..." : "刷新错题"}
        </Button>
      </CardHeader>

      <CardContent>
        <div className={styles.toolbar}>
          <Select
            label="Part"
            options={partOptions}
            value={partFilter}
            onChange={(e) => onPartFilterChange(e.target.value)}
          />
          <Input
            label="关键词"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder="搜索题干、选项、解析"
          />
          <div className={styles.summary}>
            <div>
              <span>错题池总量</span>
              <strong>{mistakeLibrary.length}</strong>
            </div>
            <div>
              <span>筛选命中</span>
              <strong>{filteredMistakes.length}</strong>
            </div>
            <div>
              <span>本页显示</span>
              <strong>{visibleMistakes.length}</strong>
            </div>
          </div>
          <div className={styles.quickActions}>
            <Button
              variant="secondary"
              disabled={filteredQuestionIds.length === 0}
              onClick={() => onPracticeFiltered({ questionIds: filteredQuestionIds, partNo: selectedPart })}
            >
              练习筛选错题
            </Button>
            <Button
              variant="secondary"
              disabled={filteredQuestionIds.length === 0}
              onClick={() => onPracticeFiltered({ questionIds: filteredQuestionIds })}
            >
              高频错题冲刺
            </Button>
          </div>
        </div>

        <div className={styles.guide}>
          <strong>错题强化流程（每题 60~90 秒）</strong>
          <p>1) 先看“你这题错在这里”确认错误点；2) 选根因标签并写 1 句避免策略；3) 点“针对练习”立即复练。</p>
          <p className={styles.mappingHint}>
            口径说明：错题池总量/筛选命中是库存；概览页“错题强化（今日 X 题）”才是今天要完成的任务量。
          </p>
        </div>

        {isLoading && <p className={styles.empty}>正在加载错题库...</p>}

        {!isLoading && filteredMistakes.length === 0 && (
          <p className={styles.empty}>暂无错题，先去做一轮训练，系统会自动沉淀错题。</p>
        )}

        <div className={styles.list}>
          {visibleMistakes.map((item) => (
            <MistakeCard
              key={item.questionId}
              item={item}
              noteDraft={noteDraftMap[item.latestAttemptItemId] ?? ""}
              rootCause={rootCauseMap[item.latestAttemptItemId] ?? ""}
              isSaving={savingId === item.latestAttemptItemId}
              onNoteChange={(note) => onNoteDraftChange(item.latestAttemptItemId, note)}
              onRootCauseChange={(cause) => onRootCauseChange(item.latestAttemptItemId, cause)}
              onSave={() => onSaveNote(item)}
              onPractice={() => {
                if (typeof item.partNo === "number") {
                  onPracticeQuestion(item.questionId, item.partNo);
                  return;
                }
                onPractice(item.partNo ?? 7);
              }}
            />
          ))}
        </div>
        {!isLoading && hasMore && (
          <div className={styles.listFooter}>
            <Button variant="secondary" onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}>
              加载更多（+{PAGE_SIZE}）
            </Button>
            <span className={styles.listHint}>
              已显示 {visibleMistakes.length} / {filteredMistakes.length}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
