"use client";

import { useState } from "react";
import type { Locale, MistakeLibraryItem } from "../../types";
import { ROOT_CAUSE_OPTIONS } from "../../types";
import { Button } from "../ui/Button";
import { Select } from "../ui/Select";
import { AudioPlayer } from "../ui/AudioPlayer";
import { buildFixPlan, rootCauseLabelByLocale, summarizeLibraryMistake } from "../../lib/mistake-coach";
import styles from "./MistakeCard.module.css";

interface MistakeCardProps {
  locale: Locale;
  item: MistakeLibraryItem;
  noteDraft: string;
  rootCause: string;
  isSaving: boolean;
  onNoteChange: (note: string) => void;
  onRootCauseChange: (cause: string) => void;
  onSave: () => void;
  onPractice: () => void;
}

const COPY = {
  zh: {
    wrongCount: (count: number, date: string) => `错 ${count} 次 · 最近 ${date}`,
    mediaBoth: "音频/配图",
    mediaImage: "配图",
    mediaAudio: "音频",
    collapseMedia: (label: string) => `收起${label}`,
    expandMedia: (label: string) => `展开${label}`,
    replayAudio: "听力回放",
    audioOnlyHint: "该题型通常仅音频作答，不提供配图。",
    explanation: "解析",
    whereWrong: "你这题错在这里",
    rootCauseNow: "当前根因",
    howToFix: "怎么改（直接照做）",
    rootCauseLabel: "根因标签",
    noteLabel: "错题备注",
    notePlaceholder: "写下你为什么错、下次如何避免",
    generateTemplate: "一键生成强化模板",
    latestNote: "上次强化记录",
    saving: "保存中...",
    save: "保存备注",
    targetedPractice: "针对练习",
    noteTemplate: (summary: string, steps: string[]) => `错因：${summary}\n改法：${steps.slice(0, 2).join("；")}`,
  },
  ja: {
    wrongCount: (count: number, date: string) => `誤答 ${count} 回 · 最終 ${date}`,
    mediaBoth: "音声/画像",
    mediaImage: "画像",
    mediaAudio: "音声",
    collapseMedia: (label: string) => `${label}を閉じる`,
    expandMedia: (label: string) => `${label}を表示`,
    replayAudio: "音声を再生",
    audioOnlyHint: "この問題タイプは通常音声のみで、画像はありません。",
    explanation: "解説",
    whereWrong: "この問題のミスポイント",
    rootCauseNow: "現在の原因",
    howToFix: "改善アクション（そのまま実行）",
    rootCauseLabel: "原因タグ",
    noteLabel: "復習メモ",
    notePlaceholder: "なぜ間違えたか、次回どう防ぐかを 1 文で書く",
    generateTemplate: "強化テンプレートを生成",
    latestNote: "前回の強化メモ",
    saving: "保存中...",
    save: "メモを保存",
    targetedPractice: "この問題を再演習",
    noteTemplate: (summary: string, steps: string[]) => `原因：${summary}\n改善：${steps.slice(0, 2).join("；")}`,
  },
} as const;

const ROOT_CAUSE_LABELS = {
  zh: {
    "": "未标注",
    vocab: "词汇",
    grammar: "语法",
    logic: "逻辑理解",
    careless: "粗心",
  },
  ja: {
    "": "未選択",
    vocab: "語彙",
    grammar: "文法",
    logic: "論理理解",
    careless: "不注意ミス",
  },
} as const;

export function MistakeCard({
  locale,
  item,
  noteDraft,
  rootCause,
  isSaving,
  onNoteChange,
  onRootCauseChange,
  onSave,
  onPractice,
}: MistakeCardProps) {
  const copy = COPY[locale];
  const effectiveRootCause = rootCause || item.latestNote?.rootCause || "";
  const fixPlan = buildFixPlan(item.partNo, effectiveRootCause, locale);
  const mistakeSummary = summarizeLibraryMistake(item, locale);
  const noteTemplate = copy.noteTemplate(mistakeSummary, fixPlan);
  const safeStem = String(item.stem ?? "");
  const safeExplanation = String(item.explanation ?? "");
  const safeOptions = Array.isArray(item.options) ? item.options : [];
  const wrongDate = new Date(item.lastWrongAt);
  const wrongDateText = Number.isNaN(wrongDate.getTime())
    ? "-"
    : wrongDate.toLocaleDateString(locale === "ja" ? "ja-JP" : "zh-CN");
  const [mediaOpen, setMediaOpen] = useState(false);
  const hasImage = Boolean(item.imageUrl && item.partNo === 1);
  const hasAudio = Boolean(item.mediaUrl && (item.partNo ?? 0) <= 4);
  const hasMedia = hasImage || hasAudio;
  const mediaLabel = hasImage && hasAudio
    ? copy.mediaBoth
    : hasImage
      ? copy.mediaImage
      : copy.mediaAudio;
  const imageUrl = hasImage && typeof item.imageUrl === "string" ? item.imageUrl : undefined;
  const mediaUrl = hasAudio && typeof item.mediaUrl === "string" ? item.mediaUrl : undefined;
  const rootCauseOptions = ROOT_CAUSE_OPTIONS.map((option) => ({
    value: option.value,
    label: ROOT_CAUSE_LABELS[locale][option.value as keyof (typeof ROOT_CAUSE_LABELS)[typeof locale]],
  }));

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <strong>Part {item.partNo ?? "-"}</strong>
        <span>{copy.wrongCount(item.wrongCount, wrongDateText)}</span>
      </div>

      {hasMedia && (
        <div className={styles.mediaPanel}>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setMediaOpen((prev) => !prev)}
          >
            {mediaOpen ? copy.collapseMedia(mediaLabel) : copy.expandMedia(mediaLabel)}
          </Button>
          {mediaOpen && imageUrl && (
            <div className={styles.imageWrap}>
              <img src={imageUrl} alt="mistake visual" className={styles.image} />
            </div>
          )}
          {mediaOpen && mediaUrl && (
            <AudioPlayer src={mediaUrl} label={copy.replayAudio} compact />
          )}
          {mediaOpen && hasAudio && !hasImage && (
            <p className={styles.mediaHint}>{copy.audioOnlyHint}</p>
          )}
        </div>
      )}

      <p className={styles.stem}>{safeStem}</p>

      <div className={styles.options}>
        {safeOptions.map((opt) => (
          <div
            key={`${item.questionId}-${opt.key}`}
            className={`${styles.option} ${
              item.correctKey === opt.key ? styles.correct : ""
            } ${
              item.lastSelectedKey === opt.key && item.correctKey !== opt.key ? styles.wrong : ""
            }`}
          >
            <span className={styles.optionKey}>{opt.key}.</span>
            <span>{String(opt.text ?? "")}</span>
          </div>
        ))}
      </div>

      <p className={styles.explanation}>{copy.explanation}: {safeExplanation}</p>

      <div className={styles.coachPanel}>
        <h4>{copy.whereWrong}</h4>
        <p>{mistakeSummary}</p>
        <p className={styles.rootCauseText}>
          {copy.rootCauseNow}：{rootCauseLabelByLocale(effectiveRootCause, locale)}
        </p>
      </div>

      <div className={styles.planPanel}>
        <h4>{copy.howToFix}</h4>
        <ol className={styles.planList}>
          {fixPlan.map((step, index) => (
            <li key={`${item.questionId}-step-${index}`}>{step}</li>
          ))}
        </ol>
      </div>

      <Select
        label={copy.rootCauseLabel}
        options={rootCauseOptions}
        value={rootCause}
        onChange={(e) => onRootCauseChange(e.target.value)}
      />

      <div className={styles.noteWrapper}>
        <label className={styles.noteLabel}>{copy.noteLabel}</label>
        <textarea
          className={styles.textarea}
          value={noteDraft}
          onChange={(e) => onNoteChange(e.target.value)}
          placeholder={copy.notePlaceholder}
        />
        <div className={styles.noteActions}>
          <Button
            type="button"
            variant="link"
            onClick={() => onNoteChange(noteTemplate)}
          >
            {copy.generateTemplate}
          </Button>
        </div>
      </div>

      {item.latestNote?.note && (
        <div className={styles.latestNote}>
          <strong>{copy.latestNote}</strong>
          <p>{item.latestNote.note}</p>
        </div>
      )}

      <div className={styles.actions}>
        <Button onClick={onSave} disabled={isSaving}>
          {isSaving ? copy.saving : copy.save}
        </Button>
        <Button
          variant="secondary"
          onClick={onPractice}
          disabled={typeof item.partNo !== "number"}
        >
          {copy.targetedPractice}
        </Button>
      </div>
    </div>
  );
}
