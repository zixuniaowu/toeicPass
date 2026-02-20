"use client";

import type { MistakeLibraryItem, ViewTab } from "../../types";
import { ALL_PARTS, isListeningPart } from "../../types";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/Card";
import { Button } from "../ui/Button";
import { Select } from "../ui/Select";
import { Input } from "../ui/Input";
import { MistakeCard } from "./MistakeCard";
import styles from "./MistakesView.module.css";

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
}: MistakesViewProps) {
  const partOptions = [
    { value: "all", label: "全部" },
    ...ALL_PARTS.map((p) => ({ value: String(p), label: `Part ${p}` })),
  ];

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
              <span>错题总量</span>
              <strong>{mistakeLibrary.length}</strong>
            </div>
            <div>
              <span>筛选结果</span>
              <strong>{filteredMistakes.length}</strong>
            </div>
          </div>
        </div>

        {isLoading && <p className={styles.empty}>正在加载错题库...</p>}

        {!isLoading && filteredMistakes.length === 0 && (
          <p className={styles.empty}>暂无错题，先去做一轮训练，系统会自动沉淀错题。</p>
        )}

        <div className={styles.list}>
          {filteredMistakes.map((item) => (
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
                  onPractice(item.partNo);
                }
              }}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
