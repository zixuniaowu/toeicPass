"use client";

import type { SessionQuestion, OptionKey } from "../../types";
import { isListeningPart } from "../../types";
import { AudioPlayer } from "../ui/AudioPlayer";
import styles from "./QuestionCard.module.css";

interface QuestionCardProps {
  question: SessionQuestion;
  selectedAnswer: OptionKey | undefined;
  onSelectAnswer: (key: OptionKey) => void;
}

export function QuestionCard({ question, selectedAnswer, onSelectAnswer }: QuestionCardProps) {
  const isListening = isListeningPart(question.partNo);

  return (
    <div className={styles.card}>
      {question.imageUrl && question.partNo === 1 && (
        <div className={styles.imageWrap}>
          <img
            src={question.imageUrl}
            alt={`Part ${question.partNo} visual`}
            className={styles.image}
          />
        </div>
      )}

      {question.mediaUrl && isListening && (
        <AudioPlayer src={question.mediaUrl} label="官方公开听力音频" />
      )}

      <p className={styles.stem}>{question.stem}</p>

      <div className={styles.options}>
        {question.options.map((opt) => (
          <button
            key={opt.key}
            className={`${styles.option} ${selectedAnswer === opt.key ? styles.selected : ""}`}
            onClick={() => onSelectAnswer(opt.key)}
          >
            <span className={styles.optionKey}>{opt.key}.</span>
            <span>{opt.text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
