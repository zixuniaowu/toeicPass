"use client";

import type { MistakeLibraryItem, OptionKey } from "../../types";
import { ROOT_CAUSE_OPTIONS, isListeningPart } from "../../types";
import { Button } from "../ui/Button";
import { Select } from "../ui/Select";
import { AudioPlayer } from "../ui/AudioPlayer";
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
  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <strong>Part {item.partNo ?? "-"}</strong>
        <span>
          错 {item.wrongCount} 次 · 最近 {new Date(item.lastWrongAt).toLocaleDateString("zh-CN")}
        </span>
      </div>

      {item.imageUrl && item.partNo === 1 && (
        <div className={styles.imageWrap}>
          <img src={item.imageUrl} alt="mistake visual" className={styles.image} />
        </div>
      )}

      {item.mediaUrl && (item.partNo ?? 0) <= 4 && (
        <AudioPlayer src={item.mediaUrl} label="听力回放" compact />
      )}

      <p className={styles.stem}>{item.stem}</p>

      <div className={styles.options}>
        {item.options.map((opt) => (
          <div
            key={`${item.questionId}-${opt.key}`}
            className={`${styles.option} ${
              item.correctKey === opt.key ? styles.correct : ""
            } ${
              item.lastSelectedKey === opt.key && item.correctKey !== opt.key ? styles.wrong : ""
            }`}
          >
            <span className={styles.optionKey}>{opt.key}.</span>
            <span>{opt.text}</span>
          </div>
        ))}
      </div>

      <p className={styles.explanation}>解析: {item.explanation}</p>

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
      </div>

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
