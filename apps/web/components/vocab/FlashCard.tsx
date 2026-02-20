"use client";

import type { VocabCard } from "../../types";
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
  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div>
          <p className={styles.label}>当前词卡</p>
          <h2 className={styles.term}>{card.term}</h2>
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

      {isRevealed && (
        <div className={styles.answer}>
          <p>{card.definition}</p>
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
