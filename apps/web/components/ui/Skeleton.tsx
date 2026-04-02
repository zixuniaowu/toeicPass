"use client";

import styles from "./Skeleton.module.css";

interface SkeletonProps {
  width?: string;
  height?: string;
  variant?: "text" | "circular" | "rectangular";
  count?: number;
  className?: string;
}

export function Skeleton({
  width,
  height,
  variant = "text",
  count = 1,
  className = "",
}: SkeletonProps) {
  const classes = [styles.skeleton, styles[variant], className].filter(Boolean).join(" ");

  if (count > 1) {
    return (
      <div className={styles.stack}>
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className={classes} style={{ width, height }} />
        ))}
      </div>
    );
  }

  return <div className={classes} style={{ width, height }} />;
}

export function CardSkeleton() {
  return (
    <div className={styles.cardSkeleton}>
      <div className={`${styles.skeleton} ${styles.text} ${styles.lineTitle}`} />
      <div className={`${styles.skeleton} ${styles.text} ${styles.lineFull}`} />
      <div className={`${styles.skeleton} ${styles.text} ${styles.lineMedium}`} />
      <div className={`${styles.skeleton} ${styles.text} ${styles.lineShort}`} />
    </div>
  );
}

export function QuestionSkeleton() {
  return (
    <div className={styles.questionSkeleton}>
      <div className={`${styles.skeleton} ${styles.text} ${styles.questionTitle}`} />
      <div className={`${styles.skeleton} ${styles.text} ${styles.questionLine}`} />
      <div className={styles.optionsSkeleton}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className={`${styles.skeleton} ${styles.rectangular} ${styles.optionLine}`} />
        ))}
      </div>
    </div>
  );
}
