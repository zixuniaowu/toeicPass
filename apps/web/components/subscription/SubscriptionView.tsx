"use client";

import { useEffect, useState } from "react";
import type { Locale, SubscriptionPlan, UserProfile, PlanCode } from "../../types";
import * as api from "../../lib/api";
import styles from "./SubscriptionView.module.css";

interface SubscriptionViewProps {
  locale: Locale;
  token: string;
  tenantCode: string;
  onSubscribed?: () => void;
}

const COPY = {
  zh: {
    title: "会员计划",
    subtitle: "选择适合你的学习计划，解锁更多功能",
    currentPlan: "当前计划",
    freeBadge: "免费",
    monthly: "月付",
    yearly: "年付",
    yearlyDiscount: "省 17%",
    perMonth: "/月",
    perYear: "/年",
    subscribe: "立即订阅",
    currentBadge: "当前",
    cancel: "取消订阅",
    cancelConfirm: "确定要取消订阅吗？取消后将在到期日降级为免费版。",
    cancelled: "订阅已取消",
    subscribed: "订阅成功！",
    error: "操作失败，请重试",
    features: {
      daily_practice_sessions: "每日练习次数",
      daily_mock_tests: "每日模拟考试",
      daily_questions: "每日答题数",
      vocab_cards: "词汇卡片数",
      ai_conversations: "AI 对话次数",
      show_ads: "无广告",
      explanation_detail: "题目详解",
      score_prediction: "分数预测",
      export_data: "数据导出",
    },
    unlimited: "无限制",
    basic_detail: "基础",
    full_detail: "完整",
    usageTitle: "今日用量",
    usageOf: (used: number, limit: number) => limit === -1 ? `${used} / ∞` : `${used} / ${limit}`,
    expiresAt: (date: string) => `到期日: ${date.slice(0, 10)}`,
    popular: "最受欢迎",
    contactSales: "联系销售",
  },
  ja: {
    title: "会員プラン",
    subtitle: "あなたに合った学習プランを選んで、すべての機能を解放しましょう",
    currentPlan: "現在のプラン",
    freeBadge: "無料",
    monthly: "月払い",
    yearly: "年払い",
    yearlyDiscount: "17% お得",
    perMonth: "/月",
    perYear: "/年",
    subscribe: "今すぐ購読",
    currentBadge: "現在",
    cancel: "購読を解除",
    cancelConfirm: "購読を解除しますか？期限後に無料プランに戻ります。",
    cancelled: "購読を解除しました",
    subscribed: "購読完了！",
    error: "操作に失敗しました。再試行してください",
    features: {
      daily_practice_sessions: "1日の練習回数",
      daily_mock_tests: "1日の模擬試験",
      daily_questions: "1日の問題数",
      vocab_cards: "単語カード数",
      ai_conversations: "AI会話回数",
      show_ads: "広告なし",
      explanation_detail: "解説の詳細度",
      score_prediction: "スコア予測",
      export_data: "データエクスポート",
    },
    unlimited: "無制限",
    basic_detail: "基本",
    full_detail: "詳細",
    usageTitle: "本日の利用状況",
    usageOf: (used: number, limit: number) => limit === -1 ? `${used} / ∞` : `${used} / ${limit}`,
    expiresAt: (date: string) => `期限: ${date.slice(0, 10)}`,
    popular: "一番人気",
    contactSales: "営業に問い合わせ",
  },
} as const;

export function SubscriptionView({ locale, token, tenantCode, onSubscribed }: SubscriptionViewProps) {
  const copy = COPY[locale];
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const opts = { token, tenantCode };

  useEffect(() => {
    void api.fetchPlans().then(setPlans);
    void api.fetchUserProfile(opts).then(setProfile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleSubscribe = async (planCode: PlanCode) => {
    if (planCode === "enterprise") return; // contact sales
    setLoading(planCode);
    setMessage("");
    const result = await api.subscribe(planCode, billingCycle, opts);
    if (result.success) {
      setMessage(copy.subscribed);
      const refreshed = await api.fetchUserProfile(opts);
      setProfile(refreshed);
      onSubscribed?.();
    } else {
      setMessage(copy.error);
    }
    setLoading(null);
  };

  const handleCancel = async () => {
    if (!window.confirm(copy.cancelConfirm)) return;
    setLoading("cancel");
    const result = await api.cancelSubscription(opts);
    if (result.success) {
      setMessage(copy.cancelled);
      const refreshed = await api.fetchUserProfile(opts);
      setProfile(refreshed);
    } else {
      setMessage(copy.error);
    }
    setLoading(null);
  };

  const currentPlanCode = profile?.plan?.code ?? "free";

  const formatPrice = (cents: number) => {
    if (cents === 0) return copy.freeBadge;
    return `$${(cents / 100).toFixed(2)}`;
  };

  const formatFeatureValue = (key: string, value: unknown): string => {
    if (key === "show_ads") return value ? "✗" : "✓";
    if (key === "explanation_detail") return value === "full" ? copy.full_detail : copy.basic_detail;
    if (key === "score_prediction" || key === "export_data") return value ? "✓" : "✗";
    if (typeof value === "number") return value === -1 ? copy.unlimited : String(value);
    return String(value);
  };

  const featureKeys: Array<keyof typeof copy.features> = [
    "daily_practice_sessions",
    "daily_mock_tests",
    "daily_questions",
    "vocab_cards",
    "ai_conversations",
    "show_ads",
    "explanation_detail",
    "score_prediction",
    "export_data",
  ];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>{copy.title}</h2>
        <p className={styles.subtitle}>{copy.subtitle}</p>
      </div>

      {message && <div className={styles.message}>{message}</div>}

      {/* Billing toggle */}
      <div className={styles.billingToggle}>
        <button
          className={`${styles.toggleBtn} ${billingCycle === "monthly" ? styles.toggleActive : ""}`}
          onClick={() => setBillingCycle("monthly")}
        >
          {copy.monthly}
        </button>
        <button
          className={`${styles.toggleBtn} ${billingCycle === "yearly" ? styles.toggleActive : ""}`}
          onClick={() => setBillingCycle("yearly")}
        >
          {copy.yearly}
          <span className={styles.discount}>{copy.yearlyDiscount}</span>
        </button>
      </div>

      {/* Usage summary for current plan */}
      {profile?.usage && (
        <div className={styles.usageSection}>
          <h3>{copy.usageTitle}</h3>
          <div className={styles.usageGrid}>
            {(Object.entries(profile.usage) as [string, { used: number; limit: number }][]).map(([key, val]) => {
              const featureLabel = copy.features[key as keyof typeof copy.features] ?? key;
              const pct = val.limit <= 0 ? 0 : Math.min((val.used / val.limit) * 100, 100);
              const isOver = val.limit > 0 && val.used >= val.limit;
              return (
                <div key={key} className={styles.usageItem}>
                  <div className={styles.usageLabel}>
                    <span>{featureLabel}</span>
                    <span className={isOver ? styles.usageOver : ""}>{copy.usageOf(val.used, val.limit)}</span>
                  </div>
                  <div className={styles.usageBar}>
                    <div
                      className={`${styles.usageBarFill} ${isOver ? styles.usageBarOver : ""}`}
                      style={{ width: `${val.limit === -1 ? 5 : pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          {profile.plan?.expiresAt && (
            <p className={styles.expiresAt}>{copy.expiresAt(profile.plan.expiresAt)}</p>
          )}
        </div>
      )}

      {/* Plan cards */}
      <div className={styles.planGrid}>
        {plans.filter((p) => p.code !== "enterprise").map((plan) => {
          const isCurrent = plan.code === currentPlanCode;
          const isPopular = plan.code === "premium";
          const price = billingCycle === "monthly" ? plan.priceMonthly : plan.priceYearly;
          const priceSuffix = billingCycle === "monthly" ? copy.perMonth : copy.perYear;
          const planName = locale === "ja" ? plan.nameJa : plan.nameZh;

          return (
            <div
              key={plan.id}
              className={`${styles.planCard} ${isCurrent ? styles.planCardCurrent : ""} ${isPopular ? styles.planCardPopular : ""}`}
            >
              {isPopular && <div className={styles.popularBadge}>{copy.popular}</div>}
              {isCurrent && <div className={styles.currentBadge}>{copy.currentBadge}</div>}
              <h3 className={styles.planName}>{planName}</h3>
              <div className={styles.planPrice}>
                <span className={styles.priceAmount}>{formatPrice(price)}</span>
                {price > 0 && <span className={styles.priceSuffix}>{priceSuffix}</span>}
              </div>

              <ul className={styles.featureList}>
                {featureKeys.map((key) => {
                  const val = plan.features[key];
                  const display = formatFeatureValue(key, val);
                  const isPositive = display !== "✗" && display !== "0";
                  return (
                    <li key={key} className={`${styles.featureItem} ${isPositive ? "" : styles.featureDisabled}`}>
                      <span className={styles.featureCheck}>{isPositive ? "✓" : "—"}</span>
                      <span>{copy.features[key]}: {display}</span>
                    </li>
                  );
                })}
              </ul>

              {isCurrent ? (
                plan.code !== "free" ? (
                  <button
                    className={styles.cancelBtn}
                    onClick={handleCancel}
                    disabled={loading === "cancel"}
                  >
                    {loading === "cancel" ? "..." : copy.cancel}
                  </button>
                ) : null
              ) : (
                <button
                  className={`${styles.subscribeBtn} ${isPopular ? styles.subscribeBtnPopular : ""}`}
                  onClick={() => handleSubscribe(plan.code)}
                  disabled={loading === plan.code}
                >
                  {loading === plan.code ? "..." : copy.subscribe}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
