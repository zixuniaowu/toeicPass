"use client";

import { useState } from "react";
import type { MistakeLibraryItem } from "../../types";
import { ROOT_CAUSE_OPTIONS } from "../../types";
import { Button } from "../ui/Button";
import { Select } from "../ui/Select";
import { AudioPlayer } from "../ui/AudioPlayer";
import { buildFixPlan, rootCauseLabel, summarizeLibraryMistake } from "../../lib/mistake-coach";
import styles from "./MistakeCard.module.css";

interface MistakeCardProps {
  item: MistakeLibraryItem;
  noteDraft: string;
  rootCause: string;
  isSaving: boolean;
  onNoteChange: (note: string) => void;
  onRootCauseChange: (cause: string) => void;
  onSave: () => void;
  onPractice: () => void;
}

export function MistakeCard({
  item,
  noteDraft,
  rootCause,
  isSaving,
  onNoteChange,
  onRootCauseChange,
  onSave,
  onPractice,
}: MistakeCardProps) {
  const effectiveRootCause = rootCause || item.latestNote?.rootCause || "";
  const fixPlan = buildFixPlan(item.partNo, effectiveRootCause);
  const mistakeSummary = summarizeLibraryMistake(item);
  const noteTemplate = `错因：${mistakeSummary}\n改法：${fixPlan.slice(0, 2).join("；")}`;
  const safeStem = String(item.stem ?? "");
  const safeExplanation = String(item.explanation ?? "");
  const safeOptions = Array.isArray(item.options) ? item.options : [];
  const wrongDate = new Date(item.lastWrongAt);
  const wrongDateText = Number.isNaN(wrongDate.getTime())
    ? "-"
    : wrongDate.toLocaleDateString("zh-CN");
  const [mediaOpen, setMediaOpen] = useState(false);
  const hasImage = Boolean(item.imageUrl && item.partNo === 1);
  const hasAudio = Boolean(item.mediaUrl && (item.partNo ?? 0) <= 4);
  const hasMedia = hasImage || hasAudio;
  const mediaLabel = hasImage && hasAudio ? "音频/配图" : hasImage ? "配图" : "音频";
  const imageUrl = hasImage && typeof item.imageUrl === "string" ? item.imageUrl : undefined;
  const mediaUrl = hasAudio && typeof item.mediaUrl === "string" ? item.mediaUrl : undefined;

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <strong>Part {item.partNo ?? "-"}</strong>
        <span>
          错 {item.wrongCount} 次 · 最近 {wrongDateText}
        </span>
      </div>

      {hasMedia && (
        <div className={styles.mediaPanel}>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setMediaOpen((prev) => !prev)}
          >
            {mediaOpen ? `收起${mediaLabel}` : `展开${mediaLabel}`}
          </Button>
          {mediaOpen && imageUrl && (
            <div className={styles.imageWrap}>
              <img src={imageUrl} alt="mistake visual" className={styles.image} />
            </div>
          )}
          {mediaOpen && mediaUrl && (
            <AudioPlayer src={mediaUrl} label="听力回放" compact />
          )}
          {mediaOpen && hasAudio && !hasImage && (
            <p className={styles.mediaHint}>该题型通常仅音频作答，不提供配图。</p>
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

      <p className={styles.explanation}>解析: {safeExplanation}</p>

      <div className={styles.coachPanel}>
        <h4>你这题错在这里</h4>
        <p>{mistakeSummary}</p>
        <p className={styles.rootCauseText}>
          当前根因：{rootCauseLabel(effectiveRootCause)}
        </p>
      </div>

      <div className={styles.planPanel}>
        <h4>怎么改（直接照做）</h4>
        <ol className={styles.planList}>
          {fixPlan.map((step, index) => (
            <li key={`${item.questionId}-step-${index}`}>{step}</li>
          ))}
        </ol>
      </div>

      <Select
        label="根因标签"
        options={ROOT_CAUSE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
        value={rootCause}
        onChange={(e) => onRootCauseChange(e.target.value)}
      />

      <div className={styles.noteWrapper}>
        <label className={styles.noteLabel}>错题备注</label>
        <textarea
          className={styles.textarea}
          value={noteDraft}
          onChange={(e) => onNoteChange(e.target.value)}
          placeholder="写下你为什么错、下次如何避免"
        />
        <div className={styles.noteActions}>
          <Button
            type="button"
            variant="link"
            onClick={() => onNoteChange(noteTemplate)}
          >
            一键生成强化模板
          </Button>
        </div>
      </div>

      {item.latestNote?.note && (
        <div className={styles.latestNote}>
          <strong>上次强化记录</strong>
          <p>{item.latestNote.note}</p>
        </div>
      )}

      <div className={styles.actions}>
        <Button onClick={onSave} disabled={isSaving}>
          {isSaving ? "保存中..." : "保存备注"}
        </Button>
        <Button
          variant="secondary"
          onClick={onPractice}
          disabled={typeof item.partNo !== "number"}
        >
          针对练习
        </Button>
      </div>
    </div>
  );
}
