"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { VocabCard, VocabSummary } from "../../types";
import { annotateTerm } from "../../data/word-dictionary";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/Card";
import { Button } from "../ui/Button";
import { FlashCard } from "./FlashCard";
import { SelectionPronunciation } from "../ui/SelectionPronunciation";
import styles from "./VocabView.module.css";

interface VocabViewProps {
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

export function VocabView({
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
  const selectionScopeRef = useRef<HTMLDivElement | null>(null);
  const [tab, setTab] = useState<VocabTab>("study");
  const [browseFilter, setBrowseFilter] = useState<"all" | "due" | "learning" | "mastered">("all");
  const [browsePartFilter, setBrowsePartFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [studyIndex, setStudyIndex] = useState(0);
  const [studyScope, setStudyScope] = useState<"today" | "allDue" | "all">("today");

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
  const filteredCards = cards.filter((card) => {
    if (browseFilter === "due" && !card.due) return false;
    if (browseFilter === "learning" && (card.due || (card.intervalDays >= 14 && (card.lastGrade ?? 0) >= 4))) return false;
    if (browseFilter === "mastered" && !(card.intervalDays >= 14 && (card.lastGrade ?? 0) >= 4)) return false;
    if (browsePartFilter !== "all" && String(card.sourcePart) !== browsePartFilter) return false;
    if (searchQuery && !card.term.toLowerCase().includes(searchQuery.toLowerCase()) && !card.definition.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

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

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>背单词</h2>
        <p className={styles.subtitle}>TOEIC 核心词汇 - 间隔重复记忆</p>
        <p className={styles.pronunciationHint}>可选中英文单词，查看音标并点击朗读。</p>
      </div>

      {dueCount > 0 ? (
        <div className={styles.dailyTargetBanner}>
          <strong>今日打卡目标：先完成 {todayTargetCount} 词</strong>
          <span>当前到期共 {dueCount} 词。今天先做这一批，剩余词卡后续继续清理。</span>
        </div>
      ) : (
        <div className={styles.dailyTargetBannerEmpty}>今天没有到期词卡，可切到「词汇列表」补新词。</div>
      )}

      {/* KPI Summary */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpi}>
          <span>总词卡</span>
          <strong>{summary?.total ?? cards.length}</strong>
        </div>
        <div className={`${styles.kpi} ${dueCount > 0 ? styles.kpiHighlight : ""}`}>
          <span>到期总量</span>
          <strong>{dueCount}</strong>
        </div>
        <div className={`${styles.kpi} ${todayTargetCount > 0 ? styles.kpiHighlight : ""}`}>
          <span>今日计划量</span>
          <strong>{todayTargetCount}</strong>
        </div>
        <div className={styles.kpi}>
          <span>学习中</span>
          <strong>{summary?.learning ?? learningCards.length}</strong>
        </div>
        <div className={styles.kpi}>
          <span>已掌握</span>
          <strong>{summary?.mastered ?? masteredCards.length}</strong>
        </div>
      </div>

      {/* Tab bar */}
      <div className={styles.tabBar}>
        <button className={`${styles.tab} ${tab === "study" ? styles.tabActive : ""}`} onClick={() => setTab("study")}>
          学习模式
        </button>
        <button className={`${styles.tab} ${tab === "browse" ? styles.tabActive : ""}`} onClick={() => setTab("browse")}>
          词汇列表
        </button>
        <button className={`${styles.tab} ${tab === "stats" ? styles.tabActive : ""}`} onClick={() => setTab("stats")}>
          学习统计
        </button>
        <div className={styles.tabActions}>
          <Button variant="secondary" onClick={onRefresh} disabled={isLoading}>
            {isLoading ? "刷新中..." : "刷新"}
          </Button>
        </div>
      </div>

      <div className={styles.selectionScope} ref={selectionScopeRef}>
        {/* Study Tab */}
        {tab === "study" && (
          <div className={styles.studyArea}>
            {studyCards.length === 0 ? (
              <div className={styles.emptyStudy}>
                <h3>暂无词卡</h3>
                <p>点击「刷新」加载你的 TOEIC 词汇卡片</p>
              </div>
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
                      今日任务（{todayTargetCount}）
                    </button>
                    <button
                      type="button"
                      className={`${styles.scopeButton} ${studyScope === "allDue" ? styles.scopeButtonActive : ""}`}
                      onClick={() => {
                        setStudyScope("allDue");
                        setStudyIndex(0);
                      }}
                    >
                      全部到期（{dueCount}）
                    </button>
                  </div>
                )}

                {/* Progress bar */}
                <div className={styles.studyProgress}>
                  <div className={styles.progressInfo}>
                    <span>第 {studyIndex + 1} / {studyCards.length} 张</span>
                    {dueCount > 0 && (
                      <span className={styles.dueLabel}>
                        {studyScope === "today" && dueCount > todayTargetCount
                          ? `今日批次 ${todayTargetCount}/${dueCount}`
                          : `到期总量 ${dueCount}`}
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
                    上一张
                  </Button>
                  <span className={styles.navLabel}>{studyIndex + 1} / {studyCards.length}</span>
                  <Button variant="secondary" onClick={handleNextStudyCard} disabled={studyIndex >= studyCards.length - 1}>
                    下一张
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
                placeholder="搜索单词或释义..."
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
                    {f === "all" ? "全部" : f === "due" ? "待复习" : f === "learning" ? "学习中" : "已掌握"}
                  </button>
                ))}
              </div>
              <div className={styles.filterChips}>
                <button
                  className={`${styles.chip} ${browsePartFilter === "all" ? styles.chipActive : ""}`}
                  onClick={() => setBrowsePartFilter("all")}
                >
                  全 Part
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

            <p className={styles.filterCount}>共 {filteredCards.length} 个词卡</p>

            <div className={styles.wordList}>
              {filteredCards.slice(0, 50).map((card) => {
                const annotation = annotateTerm(card.term);
                const hasChineseInDefinition = /[\u4e00-\u9fff]/.test(card.definition);
                const chineseDefinition = annotation?.cn ?? (hasChineseInDefinition ? card.definition : null);
                return (
                  <div key={card.id} className={styles.wordItem}>
                    <div className={styles.wordMain}>
                      <strong className={styles.wordTerm}>{card.term}</strong>
                      {annotation?.ipa && <span className={styles.wordIpa}>{annotation.ipa}</span>}
                      <span className={styles.wordPos}>{card.pos}</span>
                      {card.due && <span className={styles.wordDue}>待复习</span>}
                      {card.intervalDays >= 14 && (card.lastGrade ?? 0) >= 4 && <span className={styles.wordMastered}>已掌握</span>}
                      <button
                        type="button"
                        className={styles.wordSpeak}
                        onClick={() => speak(card.term)}
                        aria-label={`朗读 ${card.term}`}
                      >
                        朗读
                      </button>
                    </div>
                    <p className={styles.wordDefCn}>
                      中文：{chineseDefinition ?? "暂未收录"}
                    </p>
                    <p className={styles.wordDef}>{card.definition}</p>
                    {card.example && <p className={styles.wordExample}>{card.example}</p>}
                    <div className={styles.wordMeta}>
                      <span>Part {card.sourcePart}</span>
                      <span>EF {card.easeFactor.toFixed(1)}</span>
                      <span>间隔 {card.intervalDays}天</span>
                      {card.tags.length > 0 && <span>{card.tags.join(", ")}</span>}
                    </div>
                  </div>
                );
              })}
              {filteredCards.length > 50 && (
                <p className={styles.moreHint}>还有 {filteredCards.length - 50} 个词卡未显示</p>
              )}
            </div>
          </div>
        )}
        {(tab === "study" || tab === "browse") && <SelectionPronunciation scopeRef={selectionScopeRef} />}
      </div>

      {/* Stats Tab */}
      {tab === "stats" && (
        <div className={styles.statsArea}>
          {/* Overall progress */}
          <div className={styles.statsSection}>
            <h3>整体进度</h3>
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
                  <span className={styles.legendMastered}>已掌握 {masteredCards.length}</span>
                  <span className={styles.legendLearning}>学习中 {learningCards.length}</span>
                  <span className={styles.legendDue}>待复习 {dueCards.length}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Per-part breakdown */}
          <div className={styles.statsSection}>
            <h3>各 Part 词汇分布</h3>
            <div className={styles.partGrid}>
              {partStats.map((s) => (
                <div key={s.part} className={styles.partCard}>
                  <div className={styles.partHeader}>
                    <strong>Part {s.part}</strong>
                    <span>{s.total} 词</span>
                  </div>
                  <div className={styles.miniBar}>
                    <div className={styles.miniBarFill} style={{ width: s.total > 0 ? `${(s.mastered / s.total) * 100}%` : "0%" }} />
                  </div>
                  <div className={styles.partDetail}>
                    <span>已掌握 {s.mastered}</span>
                    <span>待复习 {s.due}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Difficulty distribution */}
          <div className={styles.statsSection}>
            <h3>记忆难度分布</h3>
            <div className={styles.diffGrid}>
              {[
                { label: "困难 (EF < 2.0)", count: cards.filter((c) => c.easeFactor < 2.0).length, color: "#dc2626" },
                { label: "一般 (EF 2.0-2.5)", count: cards.filter((c) => c.easeFactor >= 2.0 && c.easeFactor < 2.5).length, color: "#f59e0b" },
                { label: "容易 (EF 2.5-3.0)", count: cards.filter((c) => c.easeFactor >= 2.5 && c.easeFactor < 3.0).length, color: "#10b981" },
                { label: "非常容易 (EF >= 3.0)", count: cards.filter((c) => c.easeFactor >= 3.0).length, color: "#0f62fe" },
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
            <h4>间隔重复记忆法</h4>
            <ol>
              <li><strong>不认识</strong> - 短时间后再次出现，加强记忆</li>
              <li><strong>有点印象</strong> - 中等间隔复习，巩固记忆</li>
              <li><strong>完全掌握</strong> - 延长间隔，减少复习频率</li>
              <li>每天坚持复习到期词卡，效果最佳</li>
              <li>重点关注 Part 5/6 高频词汇，提分最快</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
