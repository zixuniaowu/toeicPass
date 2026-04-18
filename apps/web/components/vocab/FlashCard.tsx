"use client";

import { useEffect, useRef, useState } from "react";
import type { Locale, VocabCard } from "../../types";
import { annotateTerm } from "../../data/word-dictionary";
import { getWordIpa } from "../../lib/pronunciation";
import { translateText } from "../../lib/translate";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import styles from "./FlashCard.module.css";

interface FlashCardProps {
  locale: Locale;
  card: VocabCard;
  isRevealed: boolean;
  isGrading: boolean;
  onToggleReveal: () => void;
  onGrade: (grade: number) => void;
}

const POS_LABELS: Record<string, Record<string, string>> = {
  zh: {
    noun: "名词", verb: "动词", adj: "形容词", adv: "副词",
    adjective: "形容词", adverb: "副词", preposition: "介词",
    conjunction: "连词", pronoun: "代词", interjection: "感叹词",
    phrase: "短语", idiom: "惯用语", "phrasal verb": "短语动词",
    n: "名词", v: "动词", "n.": "名词", "v.": "动词",
    "adj.": "形容词", "adv.": "副词", "prep.": "介词",
  },
  ja: {
    noun: "名詞", verb: "動詞", adj: "形容詞", adv: "副詞",
    adjective: "形容詞", adverb: "副詞", preposition: "前置詞",
    conjunction: "接続詞", pronoun: "代名詞", interjection: "感嘆詞",
    phrase: "フレーズ", idiom: "慣用句", "phrasal verb": "句動詞",
    n: "名詞", v: "動詞", "n.": "名詞", "v.": "動詞",
    "adj.": "形容詞", "adv.": "副詞", "prep.": "前置詞",
  },
};

function localizePos(pos: string, locale: "zh" | "ja"): string {
  const lower = pos.trim().toLowerCase();
  const label = POS_LABELS[locale]?.[lower];
  return label ? `${label} (${pos})` : pos;
}

const COPY = {
  zh: {
    currentCard: "当前词卡",
    loadingIpa: "正在查询音标...",
    noIpa: "暂无 IPA（可点下方朗读）",
    dueReview: "到期复习",
    nextDue: (dueAt: string) => `下次 ${dueAt}`,
    hideMeaning: "隐藏释义",
    showMeaning: "显示释义",
    speakWord: "朗读单词",
    speakExample: "朗读例句",
    stop: "停止",
    chineseDef: "中文释义",
    japaneseDef: "日文释义",
    noChineseDef: "词典暂未收录该词中文释义，可先看英文解释。",
    translating: "翻译中...",
    englishDef: "English Definition",
    exampleLabel: "例句",
    exampleTransLabel: "例句翻译",
    tags: (tags: string) => `Tags: ${tags}`,
    unknown: "不认识",
    unknownHint: "→ 几分钟后重现",
    familiar: "有点印象",
    familiarHint: "→ 1-3天后复习",
    mastered: "完全掌握",
    masteredHint: "→ 延长间隔",
  },
  ja: {
    currentCard: "現在のカード",
    loadingIpa: "IPA を取得中...",
    noIpa: "IPA なし（下の読み上げを利用できます）",
    dueReview: "復習期限",
    nextDue: (dueAt: string) => `次回 ${dueAt}`,
    hideMeaning: "意味を隠す",
    showMeaning: "意味を表示",
    speakWord: "単語を再生",
    speakExample: "例文を再生",
    stop: "停止",
    chineseDef: "中国語訳",
    japaneseDef: "日本語訳",
    noChineseDef: "辞書に中国語訳がありません。先に英語定義を確認してください。",
    translating: "翻訳中...",
    englishDef: "English Definition",
    exampleLabel: "例文",
    exampleTransLabel: "例文訳",
    tags: (tags: string) => `Tags: ${tags}`,
    unknown: "わからない",
    unknownHint: "→ 数分後に再出題",
    familiar: "少し分かる",
    familiarHint: "→ 1〜3日後に復習",
    mastered: "完全に覚えた",
    masteredHint: "→ 間隔を延長",
  },
} as const;

export function FlashCard({
  locale,
  card,
  isRevealed,
  isGrading,
  onToggleReveal,
  onGrade,
}: FlashCardProps) {
  const copy = COPY[locale];
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [fallbackIpa, setFallbackIpa] = useState<string | null>(null);
  const [isLoadingIpa, setIsLoadingIpa] = useState(false);
  const [localizedDefinition, setLocalizedDefinition] = useState<string | null>(null);
  const [isTranslatingDefinition, setIsTranslatingDefinition] = useState(false);
  const [translatedExample, setTranslatedExample] = useState<string | null>(null);
  const [isTranslatingExample, setIsTranslatingExample] = useState(false);
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
  const baseDefinition = chineseDefinition ?? englishDefinition ?? card.definition;

  useEffect(() => {
    if (locale !== "ja") {
      setLocalizedDefinition(null);
      setIsTranslatingDefinition(false);
      return;
    }
    const sourceText = String(baseDefinition ?? "").trim();
    if (!sourceText) {
      setLocalizedDefinition(null);
      setIsTranslatingDefinition(false);
      return;
    }
    let cancelled = false;
    setIsTranslatingDefinition(true);
    void translateText(sourceText, "ja", /[\u4e00-\u9fff]/.test(sourceText) ? "zh-CN" : "en")
      .then((result) => {
        if (!cancelled) {
          setLocalizedDefinition(result);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsTranslatingDefinition(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [baseDefinition, locale]);

  // Translate example sentence for user's locale
  useEffect(() => {
    const example = String(card.example ?? "").trim();
    if (!example) {
      setTranslatedExample(null);
      setIsTranslatingExample(false);
      return;
    }
    let cancelled = false;
    setIsTranslatingExample(true);
    const targetLang = locale === "ja" ? "ja" : "zh-CN";
    void translateText(example, targetLang as "ja" | "zh-CN", "en")
      .then((result) => {
        if (!cancelled) {
          setTranslatedExample(result);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsTranslatingExample(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [card.example, locale]);

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div>
          <p className={styles.label}>{copy.currentCard}</p>
          <h2 className={styles.term}>{card.term}</h2>
          <p className={styles.ipa}>
            {displayIpa ?? (isLoadingIpa ? copy.loadingIpa : copy.noIpa)}
          </p>
          <span className={styles.meta}>
            {localizePos(card.pos, locale)} · Part {card.sourcePart}
          </span>
        </div>
        <Badge variant={card.due ? "warning" : "info"}>
          {card.due ? copy.dueReview : copy.nextDue(card.dueAt)}
        </Badge>
      </div>

      <Button variant="secondary" onClick={onToggleReveal}>
        {isRevealed ? copy.hideMeaning : copy.showMeaning}
      </Button>

      <div className={styles.pronounceRow}>
        <Button variant="secondary" onClick={() => speak(card.term)}>
          {copy.speakWord}
        </Button>
        <Button variant="secondary" onClick={() => speak(card.example || card.term)}>
          {copy.speakExample}
        </Button>
        <Button variant="secondary" onClick={stopSpeak} disabled={!isSpeaking}>
          {copy.stop}
        </Button>
      </div>

      {isRevealed && (
        <div className={styles.answer}>
          <p className={styles.defLabel}>{locale === "ja" ? copy.japaneseDef : copy.chineseDef}</p>
          <p>
            {locale === "ja"
              ? (isTranslatingDefinition ? copy.translating : (localizedDefinition ?? baseDefinition))
              : (chineseDefinition ?? copy.noChineseDef)}
          </p>
          <p className={styles.defLabel}>{copy.englishDef}</p>
          <p>{englishDefinition ?? card.definition}</p>
          {card.example && (
            <>
              <p className={styles.defLabel}>{copy.exampleLabel}</p>
              <p className={styles.example}>{card.example}</p>
              <p className={styles.defLabel}>{copy.exampleTransLabel}</p>
              <p>{isTranslatingExample ? copy.translating : (translatedExample ?? card.example)}</p>
            </>
          )}
          <p className={styles.tags}>{copy.tags(card.tags.join(", "))}</p>
        </div>
      )}

      <div className={styles.gradeRow}>
        <button className={styles.gradeBtn} onClick={() => onGrade(1)} disabled={isGrading}>
          <span className={styles.gradeBtnLabel}>{copy.unknown}</span>
          <span className={styles.gradeBtnHint}>{copy.unknownHint}</span>
        </button>
        <button className={styles.gradeBtn} onClick={() => onGrade(3)} disabled={isGrading}>
          <span className={styles.gradeBtnLabel}>{copy.familiar}</span>
          <span className={styles.gradeBtnHint}>{copy.familiarHint}</span>
        </button>
        <button className={`${styles.gradeBtn} ${styles.gradeBtnPrimary}`} onClick={() => onGrade(5)} disabled={isGrading}>
          <span className={styles.gradeBtnLabel}>{copy.mastered}</span>
          <span className={styles.gradeBtnHint}>{copy.masteredHint}</span>
        </button>
      </div>
    </div>
  );
}
