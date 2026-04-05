"use client";

import type { PlanCode } from "../../types";
import styles from "./PlanBadge.module.css";

interface PlanBadgeProps {
  planCode: PlanCode;
  onClick?: () => void;
}

const PLAN_LABELS: Record<PlanCode, { zh: string; ja: string; color: string }> = {
  free: { zh: "免费版", ja: "無料", color: "#9ca3af" },
  basic: { zh: "基础版", ja: "ベーシック", color: "#0f62fe" },
  premium: { zh: "高级版", ja: "プレミアム", color: "#7c3aed" },
  enterprise: { zh: "企业版", ja: "エンタープライズ", color: "#059669" },
};

export function PlanBadge({ planCode, onClick }: PlanBadgeProps) {
  const plan = PLAN_LABELS[planCode] ?? PLAN_LABELS.free;
  return (
    <button
      className={styles.badge}
      style={{ "--badge-color": plan.color } as React.CSSProperties}
      onClick={onClick}
      title="Plan"
    >
      <span className={styles.dot} />
      <span className={styles.label}>{plan.zh}</span>
    </button>
  );
}
