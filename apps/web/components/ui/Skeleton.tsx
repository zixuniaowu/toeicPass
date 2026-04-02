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
      <div className={`${styles.skeleton} ${styles.text}`} style={{ width: "40%", height: "24px" }} />
      <div className={`${styles.skeleton} ${styles.text}`} style={{ width: "100%", height: "16px" }} />
      <div className={`${styles.skeleton} ${styles.text}`} style={{ width: "80%", height: "16px" }} />
      <div className={`${styles.skeleton} ${styles.text}`} style={{ width: "60%", height: "16px" }} />
    </div>
  );
}

export function QuestionSkeleton() {
  return (
    <div className={styles.questionSkeleton}>
      <div className={`${styles.skeleton} ${styles.text}`} style={{ width: "70%", height: "22px" }} />
      <div className={`${styles.skeleton} ${styles.text}`} style={{ width: "100%", height: "18px" }} />
      <div className={styles.optionsSkeleton}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className={`${styles.skeleton} ${styles.rectangular}`} style={{ height: "52px" }} />
        ))}
      </div>
    </div>
  );
}
