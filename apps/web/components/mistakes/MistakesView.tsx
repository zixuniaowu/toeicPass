"use client";

import { useEffect, useMemo, useState } from "react";
import type { Locale, MistakeLibraryItem } from "../../types";
import { ALL_PARTS } from "../../types";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/Card";
import { Button } from "../ui/Button";
import { Select } from "../ui/Select";
import { Input } from "../ui/Input";
import { MistakeCard } from "./MistakeCard";
import { CardSkeleton } from "../ui/Skeleton";
import { NativeFeedAd } from "../ads/NativeFeedAd";
import styles from "./MistakesView.module.css";

const PAGE_SIZE = 20;

interface MistakesViewProps {
  locale: Locale;
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
  showAds?: boolean;
  token?: string;
  tenantCode?: string;
}

const COPY = {
  zh: {
    all: "全部",
    title: "错题集",
    refreshing: "刷新中...",
    refresh: "刷新错题",
    keyword: "关键词",
    searchPlaceholder: "搜索题干、选项、解析",
    poolSize: "错题池总量",
    filtered: "筛选命中",
    shown: "本页显示",
    practiceFiltered: "练习筛选错题",
    highFrequency: "高频错题冲刺",
    guideTitle: "错题强化流程（每题 60~90 秒）",
    guideBody: "1) 先看“你这题错在这里”确认错误点；2) 选根因标签并写 1 句避免策略；3) 点“针对练习”立即复练。",
    guideHint: "口径说明：错题池总量/筛选命中是库存；概览页“错题强化（今日 X 题）”才是今天要完成的任务量。",
    loading: "正在加载错题库...",
    empty: "暂无错题，先去做一轮训练，系统会自动沉淀错题。",
    loadMore: (size: number) => `加载更多（+${size}）`,
    shownCount: (visible: number, total: number) => `已显示 ${visible} / ${total}`,
  },
  ja: {
    all: "すべて",
    title: "ミスノート",
    refreshing: "更新中...",
    refresh: "ミスを更新",
    keyword: "キーワード",
    searchPlaceholder: "設問・選択肢・解説を検索",
    poolSize: "ミス総数",
    filtered: "絞り込み件数",
    shown: "表示件数",
    practiceFiltered: "絞り込みを再演習",
    highFrequency: "頻出ミスを集中演習",
    guideTitle: "ミス強化フロー（1問 60〜90 秒）",
    guideBody: "1) 「この問題のミスポイント」を確認 2) 原因タグと回避策を 1 文で記録 3) 「この問題を再演習」で即復習。",
    guideHint: "補足：ミス総数/絞り込み件数は在庫。トップの「今日のミス強化」が本日の実施対象です。",
    loading: "ミスノートを読み込み中...",
    empty: "まだミス問題がありません。まず 1 セット解いて蓄積しましょう。",
    loadMore: (size: number) => `さらに表示（+${size}）`,
    shownCount: (visible: number, total: number) => `${visible} / ${total} 件を表示`,
  },
} as const;

export function MistakesView({
  locale,
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
  showAds = false,
  token = "",
  tenantCode = "",
}: MistakesViewProps) {
  const copy = COPY[locale];
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [partFilter, searchQuery, filteredMistakes.length]);

  const partOptions = [
    { value: "all", label: copy.all },
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
        <CardTitle as="h1">{copy.title}</CardTitle>
        <Button variant="secondary" onClick={onRefresh} loading={isLoading}>
          {isLoading ? copy.refreshing : copy.refresh}
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
            label={copy.keyword}
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder={copy.searchPlaceholder}
          />
          <div className={styles.summary}>
            <div>
              <span>{copy.poolSize}</span>
              <strong>{mistakeLibrary.length}</strong>
            </div>
            <div>
              <span>{copy.filtered}</span>
              <strong>{filteredMistakes.length}</strong>
            </div>
            <div>
              <span>{copy.shown}</span>
              <strong>{visibleMistakes.length}</strong>
            </div>
          </div>
          <div className={styles.quickActions}>
            <Button
              variant="secondary"
              disabled={filteredQuestionIds.length === 0}
              onClick={() => onPracticeFiltered({ questionIds: filteredQuestionIds, partNo: selectedPart })}
            >
              {copy.practiceFiltered}
            </Button>
            <Button
              variant="secondary"
              disabled={filteredQuestionIds.length === 0}
              onClick={() => onPracticeFiltered({ questionIds: filteredQuestionIds })}
            >
              {copy.highFrequency}
            </Button>
          </div>
        </div>

        <div className={styles.guide}>
          <strong>{copy.guideTitle}</strong>
          <p>{copy.guideBody}</p>
          <p className={styles.mappingHint}>{copy.guideHint}</p>
        </div>

        {isLoading && (
          <div className={styles.list}>
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        )}

        {!isLoading && filteredMistakes.length === 0 && (
          <p className={styles.empty}>{copy.empty}</p>
        )}

        <div className={styles.list}>
          {visibleMistakes.map((item) => (
            <MistakeCard
              key={item.questionId}
              locale={locale}
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

        {showAds && (
          <NativeFeedAd locale={locale} token={token} tenantCode={tenantCode} showAds={showAds} />
        )}

        {!isLoading && hasMore && (
          <div className={styles.listFooter}>
            <Button variant="secondary" onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}>
              {copy.loadMore(PAGE_SIZE)}
            </Button>
            <span className={styles.listHint}>
              {copy.shownCount(visibleMistakes.length, filteredMistakes.length)}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
