"use client";

import { useEffect, useRef, useState } from "react";
import type { VocabCard } from "../../types";
import { annotateTerm } from "../../data/word-dictionary";
import { getWordIpa } from "../../lib/pronunciation";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import styles from "./FlashCard.module.css";

interface FlashCardProps {
  card: VocabCard;
  isRevealed: boolean;
  isGrading: boolean;
  onToggleReveal: () => void;
  onGrade: (grade: number) => void;
}

export function FlashCard({
  card,
  isRevealed,
  isGrading,
  onToggleReveal,
  onGrade,
}: FlashCardProps) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [fallbackIpa, setFallbackIpa] = useState<string | null>(null);
  const [isLoadingIpa, setIsLoadingIpa] = useState(false);
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);
  const termInfo = annotateTerm(card.term);

  const stopSpeak = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }
    window.speechSynthesis.cancel();
    utterRef.current = null;
    setIsSpeaking(false);
  };

  const speak = (text: string) => {
    if (!text || typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.onend = () => {
      setIsSpeaking(false);
      utterRef.current = null;
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
      utterRef.current = null;
    };
    utterRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  };

  useEffect(() => {
    if (termInfo?.ipa) {
      setFallbackIpa(null);
      setIsLoadingIpa(false);
      return;
    }
    let cancelled = false;
    setIsLoadingIpa(true);
    setFallbackIpa(null);
    void getWordIpa(card.term)
      .then((ipa) => {
        if (!cancelled) {
          setFallbackIpa(ipa);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingIpa(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [card.term, termInfo?.ipa]);

  const displayIpa = termInfo?.ipa ?? fallbackIpa;
  const hasChineseInDefinition = /[\u4e00-\u9fff]/.test(card.definition);
  const chineseDefinition = termInfo?.cn ?? (hasChineseInDefinition ? card.definition : null);
  const englishDefinition = hasChineseInDefinition ? null : card.definition;

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div>
          <p className={styles.label}>当前词卡</p>
          <h2 className={styles.term}>{card.term}</h2>
          <p className={styles.ipa}>
            {displayIpa ?? (isLoadingIpa ? "正在查询音标..." : "暂无 IPA（可点下方朗读）")}
          </p>
          <span className={styles.meta}>
            {card.pos} · Part {card.sourcePart}
          </span>
        </div>
        <Badge variant={card.due ? "warning" : "info"}>
          {card.due ? "到期复习" : `下次 ${card.dueAt}`}
        </Badge>
      </div>

      <Button variant="secondary" onClick={onToggleReveal}>
        {isRevealed ? "隐藏释义" : "显示释义"}
      </Button>

      <div className={styles.pronounceRow}>
        <Button variant="secondary" onClick={() => speak(card.term)}>
          朗读单词
        </Button>
        <Button variant="secondary" onClick={() => speak(card.example || card.term)}>
          朗读例句
        </Button>
        <Button variant="secondary" onClick={stopSpeak} disabled={!isSpeaking}>
          停止
        </Button>
      </div>

      {isRevealed && (
        <div className={styles.answer}>
          <p className={styles.defLabel}>中文释义</p>
          <p>{chineseDefinition ?? "词典暂未收录该词中文释义，可先看英文解释。"}</p>
          {englishDefinition && (
            <>
              <p className={styles.defLabel}>English Definition</p>
              <p>{englishDefinition}</p>
            </>
          )}
          <p className={styles.example}>{card.example}</p>
          <p className={styles.tags}>Tags: {card.tags.join(", ")}</p>
        </div>
      )}

      <div className={styles.gradeRow}>
        <Button variant="secondary" onClick={() => onGrade(1)} disabled={isGrading}>
          不认识
        </Button>
        <Button variant="secondary" onClick={() => onGrade(3)} disabled={isGrading}>
          有点印象
        </Button>
        <Button onClick={() => onGrade(5)} disabled={isGrading}>
          完全掌握
        </Button>
      </div>
    </div>
  );
}
