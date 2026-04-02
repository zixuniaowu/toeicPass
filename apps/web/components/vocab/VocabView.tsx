"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Locale, VocabCard, VocabSummary } from "../../types";
import { annotateTerm } from "../../data/word-dictionary";
import { translateText } from "../../lib/translate";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/Card";
import { Button } from "../ui/Button";
import { FlashCard } from "./FlashCard";
import { SelectionPronunciation } from "../ui/SelectionPronunciation";
import { CardSkeleton } from "../ui/Skeleton";
import styles from "./VocabView.module.css";

interface VocabViewProps {
  locale: Locale;
  cards: VocabCard[];
  summary: VocabSummary | null;
  isLoading: boolean;
  dueCards: VocabCard[];
  activeCard: VocabCard | null;
  revealMap: Record<string, boolean>;
  gradingCardId: string | null;
  onRefresh: () => void;
  onToggleReveal: (cardId: string) => void;
  onGrade: (cardId: string, grade: number) => void;
}

type VocabTab = "study" | "browse" | "stats";

const COPY = {
  zh: {
    headerTitle: "背单词",
    subtitle: "TOEIC 核心词汇 - 间隔重复记忆",
    pronunciationHint: "可选中英文单词，查看音标并点击朗读。",
    dailyGoal: (count: number) => `今日打卡目标：先完成 ${count} 词`,
    dueHint: (due: number) => `当前到期共 ${due} 词。今天先做这一批，剩余词卡后续继续清理。`,
    noDueHint: "今天没有到期词卡，可切到「词汇列表」补新词。",
    totalCards: "总词卡",
    dueTotal: "到期总量",
    todayPlan: "今日计划量",
    learning: "学习中",
    mastered: "已掌握",
    tabStudy: "学习模式",
    tabBrowse: "词汇列表",
    tabStats: "学习统计",
    refreshing: "刷新中...",
    refresh: "刷新",
    emptyTitle: "暂无词卡",
    emptyHint: "点击「刷新」加载你的 TOEIC 词汇卡片",
    todayBatch: (count: number) => `今日任务（${count}）`,
    allDueBatch: (count: number) => `全部到期（${count}）`,
    cardProgress: (current: number, total: number) => `第 ${current} / ${total} 张`,
    dueBatchLabel: (today: number, due: number) => `今日批次 ${today}/${due}`,
    dueTotalLabel: (due: number) => `到期总量 ${due}`,
    prevCard: "上一张",
    nextCard: "下一张",
    searchPlaceholder: "搜索单词或释义...",
    filterAll: "全部",
    filterDue: "待复习",
    filterLearning: "学习中",
    filterMastered: "已掌握",
    allPart: "全 Part",
    filterCount: (count: number) => `共 ${count} 个词卡`,
    dueBadge: "待复习",
    masteredBadge: "已掌握",
    speakAria: (term: string) => `朗读 ${term}`,
    speak: "朗读",
    chineseDef: "中文",
    japaneseDef: "日文",
    noChineseDef: "暂未收录",
    translating: "翻译中...",
    intervalDays: (days: number) => `间隔 ${days}天`,
    moreHint: (count: number) => `还有 ${count} 个词卡未显示`,
    overallProgress: "整体进度",
    legendMastered: (count: number) => `已掌握 ${count}`,
    legendLearning: (count: number) => `学习中 ${count}`,
    legendDue: (count: number) => `待复习 ${count}`,
    partDist: "各 Part 词汇分布",
    wordsCount: (count: number) => `${count} 词`,
    memoryDifficulty: "记忆难度分布",
    diffHard: "困难 (EF < 2.0)",
    diffNormal: "一般 (EF 2.0-2.5)",
    diffEasy: "容易 (EF 2.5-3.0)",
    diffVeryEasy: "非常容易 (EF >= 3.0)",
    tipsTitle: "间隔重复记忆法",
    tip1: "不认识 - 短时间后再次出现，加强记忆",
    tip2: "有点印象 - 中等间隔复习，巩固记忆",
    tip3: "完全掌握 - 延长间隔，减少复习频率",
    tip4: "每天坚持复习到期词卡，效果最佳",
    tip5: "重点关注 Part 5/6 高频词汇，提分最快",
  },
  ja: {
    headerTitle: "単語学習",
    subtitle: "TOEIC コア語彙 - 間隔反復で記憶定着",
    pronunciationHint: "英語/中国語の語句を選択すると IPA と読み上げが使えます。",
    dailyGoal: (count: number) => `本日の目標：まず ${count} 語を完了`,
    dueHint: (due: number) => `復習期限は合計 ${due} 語。まずこのバッチを終えてから残りを進めます。`,
    noDueHint: "本日の期限カードはありません。「単語一覧」で新規語彙を追加学習してください。",
    totalCards: "総カード数",
    dueTotal: "期限到来",
    todayPlan: "本日計画",
    learning: "学習中",
    mastered: "定着済み",
    tabStudy: "学習モード",
    tabBrowse: "単語一覧",
    tabStats: "学習統計",
    refreshing: "更新中...",
    refresh: "更新",
    emptyTitle: "カードがありません",
    emptyHint: "「更新」を押して TOEIC 語彙カードを読み込んでください",
    todayBatch: (count: number) => `今日タスク（${count}）`,
    allDueBatch: (count: number) => `期限カード（${count}）`,
    cardProgress: (current: number, total: number) => `${current} / ${total} 枚`,
    dueBatchLabel: (today: number, due: number) => `今日バッチ ${today}/${due}`,
    dueTotalLabel: (due: number) => `期限合計 ${due}`,
    prevCard: "前のカード",
    nextCard: "次のカード",
    searchPlaceholder: "単語または意味で検索...",
    filterAll: "すべて",
    filterDue: "要復習",
    filterLearning: "学習中",
    filterMastered: "定着済み",
    allPart: "全 Part",
    filterCount: (count: number) => `${count} 件のカード`,
    dueBadge: "要復習",
    masteredBadge: "定着済み",
    speakAria: (term: string) => `${term} を読み上げ`,
    speak: "再生",
    chineseDef: "中国語",
    japaneseDef: "日本語",
    noChineseDef: "未登録",
    translating: "翻訳中...",
    intervalDays: (days: number) => `間隔 ${days}日`,
    moreHint: (count: number) => `残り ${count} 件は未表示`,
    overallProgress: "全体進捗",
    legendMastered: (count: number) => `定着済み ${count}`,
    legendLearning: (count: number) => `学習中 ${count}`,
    legendDue: (count: number) => `要復習 ${count}`,
    partDist: "Part 別語彙分布",
    wordsCount: (count: number) => `${count} 語`,
    memoryDifficulty: "記憶難易度分布",
    diffHard: "難しい (EF < 2.0)",
    diffNormal: "標準 (EF 2.0-2.5)",
    diffEasy: "易しい (EF 2.5-3.0)",
    diffVeryEasy: "とても易しい (EF >= 3.0)",
    tipsTitle: "間隔反復のコツ",
    tip1: "わからない - 短い間隔で再出題して記憶を強化",
    tip2: "少し分かる - 中間間隔で復習して定着",
    tip3: "完全に覚えた - 間隔を伸ばして復習頻度を下げる",
    tip4: "毎日、期限カードを優先すると効果が高い",
    tip5: "Part 5/6 の高頻度語彙を優先すると得点効率が高い",
  },
} as const;

export function VocabView({
  locale,
  cards,
  summary,
  isLoading,
  dueCards,
  activeCard,
  revealMap,
  gradingCardId,
  onRefresh,
  onToggleReveal,
  onGrade,
}: VocabViewProps) {
  const copy = COPY[locale];
  const selectionScopeRef = useRef<HTMLDivElement | null>(null);
  const [tab, setTab] = useState<VocabTab>("study");
  const [browseFilter, setBrowseFilter] = useState<"all" | "due" | "learning" | "mastered">("all");
  const [browsePartFilter, setBrowsePartFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [studyIndex, setStudyIndex] = useState(0);
  const [studyScope, setStudyScope] = useState<"today" | "allDue" | "all">("today");
  const [jaDefinitionMap, setJaDefinitionMap] = useState<Record<string, string>>({});

  const speak = (text: string) => {
    if (!text || typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 0.9;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  };

  // Derived data
  const masteredCards = cards.filter((c) => c.intervalDays >= 14 && (c.lastGrade ?? 0) >= 4);
  const learningCards = cards.filter((c) => !(c.intervalDays >= 14 && (c.lastGrade ?? 0) >= 4) && !c.due);
  const dueCount = summary?.due ?? dueCards.length;
  const todayTargetCount = Math.min(dueCount, 30);
  const todayStudyCards = dueCards.slice(0, todayTargetCount);

  // Browse filtering
  const filteredCards = useMemo(
    () =>
      cards.filter((card) => {
        if (browseFilter === "due" && !card.due) return false;
        if (browseFilter === "learning" && (card.due || (card.intervalDays >= 14 && (card.lastGrade ?? 0) >= 4))) return false;
        if (browseFilter === "mastered" && !(card.intervalDays >= 14 && (card.lastGrade ?? 0) >= 4)) return false;
        if (browsePartFilter !== "all" && String(card.sourcePart) !== browsePartFilter) return false;
        if (searchQuery && !card.term.toLowerCase().includes(searchQuery.toLowerCase()) && !card.definition.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        return true;
      }),
    [browseFilter, browsePartFilter, cards, searchQuery],
  );

  // Study mode: default to today's target batch first
  const studyCards = useMemo(() => {
    if (studyScope === "today" && todayStudyCards.length > 0) {
      return todayStudyCards;
    }
    if (studyScope === "allDue" && dueCards.length > 0) {
      return dueCards;
    }
    return cards;
  }, [studyScope, todayStudyCards, dueCards, cards]);
  const currentStudyCard = studyCards[studyIndex] ?? null;

  useEffect(() => {
    if (studyScope !== "all" && dueCards.length === 0) {
      setStudyScope("all");
      setStudyIndex(0);
    }
  }, [dueCards.length, studyScope]);

  useEffect(() => {
    setStudyIndex((prev) => {
      if (studyCards.length === 0) {
        return 0;
      }
      return Math.min(prev, studyCards.length - 1);
    });
  }, [studyCards.length]);

  const handleNextStudyCard = () => {
    setStudyIndex((prev) => Math.min(prev + 1, studyCards.length - 1));
  };

  const handlePrevStudyCard = () => {
    setStudyIndex((prev) => Math.max(prev - 1, 0));
  };

  const handleGradeAndNext = (cardId: string, grade: number) => {
    onGrade(cardId, grade);
    // Auto-advance after grading
    setTimeout(() => {
      if (studyIndex < studyCards.length - 1) {
        setStudyIndex((prev) => prev + 1);
      }
    }, 300);
  };

  // Stats by part
  const partStats = [1, 2, 3, 4, 5, 6, 7].map((p) => {
    const partCards = cards.filter((c) => c.sourcePart === p);
    const partDue = partCards.filter((c) => c.due);
    const partMastered = partCards.filter((c) => c.intervalDays >= 14 && (c.lastGrade ?? 0) >= 4);
    return { part: p, total: partCards.length, due: partDue.length, mastered: partMastered.length };
  }).filter((s) => s.total > 0);
  const visibleBrowseCards = useMemo(() => filteredCards.slice(0, 50), [filteredCards]);

  useEffect(() => {
    if (locale !== "ja") {
      return;
    }
    const pendingCards = visibleBrowseCards.filter((card) => !jaDefinitionMap[card.id]);
    if (pendingCards.length === 0) {
      return;
    }
    let cancelled = false;
    void Promise.all(
      pendingCards.map(async (card) => {
        const annotation = annotateTerm(card.term);
        const hasChineseInDefinition = /[\u4e00-\u9fff]/.test(card.definition);
        const sourceText = String(annotation?.cn ?? (hasChineseInDefinition ? card.definition : card.definition)).trim();
        if (!sourceText) {
          return [card.id, card.term] as const;
        }
        const translated = await translateText(sourceText, "ja", /[\u4e00-\u9fff]/.test(sourceText) ? "zh-CN" : "en");
        return [card.id, translated] as const;
      }),
    ).then((entries) => {
      if (cancelled) {
        return;
      }
      setJaDefinitionMap((prev) => {
        const next = { ...prev };
        entries.forEach(([id, translated]) => {
          next[id] = translated;
        });
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [jaDefinitionMap, locale, visibleBrowseCards]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>{copy.headerTitle}</h2>
        <p className={styles.subtitle}>{copy.subtitle}</p>
        <p className={styles.pronunciationHint}>{copy.pronunciationHint}</p>
      </div>

      {dueCount > 0 ? (
        <div className={styles.dailyTargetBanner}>
          <strong>{copy.dailyGoal(todayTargetCount)}</strong>
          <span>{copy.dueHint(dueCount)}</span>
        </div>
      ) : (
        <div className={styles.dailyTargetBannerEmpty}>{copy.noDueHint}</div>
      )}

      {/* KPI Summary */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpi}>
          <span>{copy.totalCards}</span>
          <strong>{summary?.total ?? cards.length}</strong>
        </div>
        <div className={`${styles.kpi} ${dueCount > 0 ? styles.kpiHighlight : ""}`}>
          <span>{copy.dueTotal}</span>
          <strong>{dueCount}</strong>
        </div>
        <div className={`${styles.kpi} ${todayTargetCount > 0 ? styles.kpiHighlight : ""}`}>
          <span>{copy.todayPlan}</span>
          <strong>{todayTargetCount}</strong>
        </div>
        <div className={styles.kpi}>
          <span>{copy.learning}</span>
          <strong>{summary?.learning ?? learningCards.length}</strong>
        </div>
        <div className={styles.kpi}>
          <span>{copy.mastered}</span>
          <strong>{summary?.mastered ?? masteredCards.length}</strong>
        </div>
      </div>

      {/* Tab bar */}
      <div className={styles.tabBar}>
        <button className={`${styles.tab} ${tab === "study" ? styles.tabActive : ""}`} onClick={() => setTab("study")}>
          {copy.tabStudy}
        </button>
        <button className={`${styles.tab} ${tab === "browse" ? styles.tabActive : ""}`} onClick={() => setTab("browse")}>
          {copy.tabBrowse}
        </button>
        <button className={`${styles.tab} ${tab === "stats" ? styles.tabActive : ""}`} onClick={() => setTab("stats")}>
          {copy.tabStats}
        </button>
        <div className={styles.tabActions}>
          <Button variant="secondary" onClick={onRefresh} loading={isLoading}>
            {isLoading ? copy.refreshing : copy.refresh}
          </Button>
        </div>
      </div>

      <div className={styles.selectionScope} ref={selectionScopeRef}>
        {/* Study Tab */}
        {tab === "study" && (
          <div className={styles.studyArea}>
            {studyCards.length === 0 ? (
              isLoading ? (
                <div className={styles.emptyStudy}>
                  <CardSkeleton />
                  <CardSkeleton />
                </div>
              ) : (
                <div className={styles.emptyStudy}>
                  <h3>{copy.emptyTitle}</h3>
                  <p>{copy.emptyHint}</p>
                </div>
              )
            ) : (
              <>
                {dueCount > 0 && (
                  <div className={styles.scopeSwitch}>
                    <button
                      type="button"
                      className={`${styles.scopeButton} ${studyScope === "today" ? styles.scopeButtonActive : ""}`}
                      onClick={() => {
                        setStudyScope("today");
                        setStudyIndex(0);
                      }}
                    >
                      {copy.todayBatch(todayTargetCount)}
                    </button>
                    <button
                      type="button"
                      className={`${styles.scopeButton} ${studyScope === "allDue" ? styles.scopeButtonActive : ""}`}
                      onClick={() => {
                        setStudyScope("allDue");
                        setStudyIndex(0);
                      }}
                    >
                      {copy.allDueBatch(dueCount)}
                    </button>
                  </div>
                )}

                {/* Progress bar */}
                <div className={styles.studyProgress}>
                  <div className={styles.progressInfo}>
                    <span>{copy.cardProgress(studyIndex + 1, studyCards.length)}</span>
                    {dueCount > 0 && (
                      <span className={styles.dueLabel}>
                        {studyScope === "today" && dueCount > todayTargetCount
                          ? copy.dueBatchLabel(todayTargetCount, dueCount)
                          : copy.dueTotalLabel(dueCount)}
                      </span>
                    )}
                  </div>
                  <div className={styles.progressBar}>
                    <div className={styles.progressFill} style={{ width: `${((studyIndex + 1) / studyCards.length) * 100}%` }} />
                  </div>
                </div>

                {/* Current card */}
                {currentStudyCard && (
                  <FlashCard
                    locale={locale}
                    card={currentStudyCard}
                    isRevealed={revealMap[currentStudyCard.id] ?? false}
                    isGrading={gradingCardId === currentStudyCard.id}
                    onToggleReveal={() => onToggleReveal(currentStudyCard.id)}
                    onGrade={(grade) => handleGradeAndNext(currentStudyCard.id, grade)}
                  />
                )}

                {/* Navigation */}
                <div className={styles.studyNav}>
                  <Button variant="secondary" onClick={handlePrevStudyCard} disabled={studyIndex === 0}>
                    {copy.prevCard}
                  </Button>
                  <span className={styles.navLabel}>{studyIndex + 1} / {studyCards.length}</span>
                  <Button variant="secondary" onClick={handleNextStudyCard} disabled={studyIndex >= studyCards.length - 1}>
                    {copy.nextCard}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Browse Tab */}
        {tab === "browse" && (
          <div className={styles.browseArea}>
            <div className={styles.browseFilters}>
              <input
                className={styles.searchInput}
                type="text"
                placeholder={copy.searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <div className={styles.filterChips}>
                {(["all", "due", "learning", "mastered"] as const).map((f) => (
                  <button
                    key={f}
                    className={`${styles.chip} ${browseFilter === f ? styles.chipActive : ""}`}
                    onClick={() => setBrowseFilter(f)}
                  >
                    {f === "all"
                      ? copy.filterAll
                      : f === "due"
                        ? copy.filterDue
                        : f === "learning"
                          ? copy.filterLearning
                          : copy.filterMastered}
                  </button>
                ))}
              </div>
              <div className={styles.filterChips}>
                <button
                  className={`${styles.chip} ${browsePartFilter === "all" ? styles.chipActive : ""}`}
                  onClick={() => setBrowsePartFilter("all")}
                >
                  {copy.allPart}
                </button>
                {[1, 2, 3, 4, 5, 6, 7].map((p) => (
                  <button
                    key={p}
                    className={`${styles.chip} ${browsePartFilter === String(p) ? styles.chipActive : ""}`}
                    onClick={() => setBrowsePartFilter(String(p))}
                  >
                    P{p}
                  </button>
                ))}
              </div>
            </div>

            <p className={styles.filterCount}>{copy.filterCount(filteredCards.length)}</p>

            <div className={styles.wordList}>
              {visibleBrowseCards.map((card) => {
                const annotation = annotateTerm(card.term);
                const hasChineseInDefinition = /[\u4e00-\u9fff]/.test(card.definition);
                const chineseDefinition = annotation?.cn ?? (hasChineseInDefinition ? card.definition : null);
                const localizedDefinition = locale === "ja" ? jaDefinitionMap[card.id] : chineseDefinition;
                return (
                  <div key={card.id} className={styles.wordItem}>
                    <div className={styles.wordMain}>
                      <strong className={styles.wordTerm}>{card.term}</strong>
                      {annotation?.ipa && <span className={styles.wordIpa}>{annotation.ipa}</span>}
                      <span className={styles.wordPos}>{card.pos}</span>
                      {card.due && <span className={styles.wordDue}>{copy.dueBadge}</span>}
                      {card.intervalDays >= 14 && (card.lastGrade ?? 0) >= 4 && <span className={styles.wordMastered}>{copy.masteredBadge}</span>}
                      <button
                        type="button"
                        className={styles.wordSpeak}
                        onClick={() => speak(card.term)}
                        aria-label={copy.speakAria(card.term)}
                      >
                        {copy.speak}
                      </button>
                    </div>
                    <p className={styles.wordDefCn}>
                      {locale === "ja"
                        ? `${copy.japaneseDef}：${localizedDefinition ?? copy.translating}`
                        : `${copy.chineseDef}：${localizedDefinition ?? copy.noChineseDef}`}
                    </p>
                    <p className={styles.wordDef}>{card.definition}</p>
                    {card.example && <p className={styles.wordExample}>{card.example}</p>}
                    <div className={styles.wordMeta}>
                      <span>Part {card.sourcePart}</span>
                      <span>EF {card.easeFactor.toFixed(1)}</span>
                      <span>{copy.intervalDays(card.intervalDays)}</span>
                      {card.tags.length > 0 && <span>{card.tags.join(", ")}</span>}
                    </div>
                  </div>
                );
              })}
              {filteredCards.length > 50 && (
                <p className={styles.moreHint}>{copy.moreHint(filteredCards.length - 50)}</p>
              )}
            </div>
          </div>
        )}
        {(tab === "study" || tab === "browse") && <SelectionPronunciation scopeRef={selectionScopeRef} locale={locale} />}
      </div>

      {/* Stats Tab */}
      {tab === "stats" && (
        <div className={styles.statsArea}>
          {/* Overall progress */}
          <div className={styles.statsSection}>
            <h3>{copy.overallProgress}</h3>
            <div className={styles.overallBar}>
              <div className={styles.barSegment}>
                <div className={styles.barTrack}>
                  {cards.length > 0 && (
                    <>
                      <div className={styles.barMastered} style={{ width: `${(masteredCards.length / cards.length) * 100}%` }} />
                      <div className={styles.barLearning} style={{ width: `${(learningCards.length / cards.length) * 100}%` }} />
                    </>
                  )}
                </div>
                <div className={styles.barLabels}>
                  <span className={styles.legendMastered}>{copy.legendMastered(masteredCards.length)}</span>
                  <span className={styles.legendLearning}>{copy.legendLearning(learningCards.length)}</span>
                  <span className={styles.legendDue}>{copy.legendDue(dueCards.length)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Per-part breakdown */}
          <div className={styles.statsSection}>
            <h3>{copy.partDist}</h3>
            <div className={styles.partGrid}>
              {partStats.map((s) => (
                <div key={s.part} className={styles.partCard}>
                  <div className={styles.partHeader}>
                    <strong>Part {s.part}</strong>
                    <span>{copy.wordsCount(s.total)}</span>
                  </div>
                  <div className={styles.miniBar}>
                    <div className={styles.miniBarFill} style={{ width: s.total > 0 ? `${(s.mastered / s.total) * 100}%` : "0%" }} />
                  </div>
                  <div className={styles.partDetail}>
                    <span>{copy.legendMastered(s.mastered)}</span>
                    <span>{copy.legendDue(s.due)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Difficulty distribution */}
          <div className={styles.statsSection}>
            <h3>{copy.memoryDifficulty}</h3>
            <div className={styles.diffGrid}>
              {[
                { label: copy.diffHard, count: cards.filter((c) => c.easeFactor < 2.0).length, color: "#dc2626" },
                { label: copy.diffNormal, count: cards.filter((c) => c.easeFactor >= 2.0 && c.easeFactor < 2.5).length, color: "#f59e0b" },
                { label: copy.diffEasy, count: cards.filter((c) => c.easeFactor >= 2.5 && c.easeFactor < 3.0).length, color: "#10b981" },
                { label: copy.diffVeryEasy, count: cards.filter((c) => c.easeFactor >= 3.0).length, color: "#0f62fe" },
              ].map((d) => (
                <div key={d.label} className={styles.diffItem}>
                  <div className={styles.diffBar}>
                    <div className={styles.diffBarFill} style={{ width: cards.length > 0 ? `${(d.count / cards.length) * 100}%` : "0%", background: d.color }} />
                  </div>
                  <div className={styles.diffLabel}>
                    <span>{d.label}</span>
                    <strong>{d.count}</strong>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tips */}
          <div className={styles.tips}>
            <h4>{copy.tipsTitle}</h4>
            <ol>
              <li>{copy.tip1}</li>
              <li>{copy.tip2}</li>
              <li>{copy.tip3}</li>
              <li>{copy.tip4}</li>
              <li>{copy.tip5}</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
