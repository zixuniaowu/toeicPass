"use client";

import type { AuthCredentials } from "../../hooks/useAuth";
import type { Locale } from "../../types";
import { Button } from "../ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import { Input } from "../ui/Input";
import styles from "./LoginView.module.css";

interface LoginViewProps {
  locale: Locale;
  credentials: AuthCredentials;
  isSubmitting: boolean;
  message: string;
  onCredentialsChange: (updates: Partial<AuthCredentials>) => void;
  onLogin: () => void;
  onRegister: () => void;
  onLocaleChange?: (locale: Locale) => void;
}

const COPY = {
  zh: {
    overviewAriaLabel: "product-overview",
    eyebrow: "LangBoost",
    brandTitle: "日语 · 英语 口语强化平台",
    brandDesc: "跟读训练、模拟考试、错题强化、词汇复习——日语与英语口语提升一站搞定。",
    features: [
      "日语跟读 + 每日新闻 + YouTube 导入，母语沉浸",
      "2 小时整卷模拟，自动沉淀错题到错题库",
      "间隔重复词卡，按到期自动排优先级",
      "句级跟读 + 实时发音对比，练出口语肌肉记忆",
    ],
    stats: [
      { value: "JP+EN", label: "双语训练" },
      { value: "2000+", label: "练习题" },
      { value: "SRS", label: "间隔重复" },
    ],
    formEyebrow: "Welcome Back",
    formTitle: "登录 LangBoost",
    formSubtitle: "输入账号后即可进入精简学习模式",
    passwordPlaceholder: "请输入密码",
    loginLoading: "处理中...",
    loginButton: "登录",
    demoNotice: "默认只需 Email + Password。Tenant Code 仅在多租户登录或注册时需要。",
    orgSummary: "组织信息（仅注册或多租户登录时填写）",
    tenantNameLabel: "Tenant Name（注册用）",
    displayNameLabel: "Display Name（注册用）",
    registerLoading: "处理中...",
    registerButton: "注册并登录",
    registerTip: "注册会使用上方填写的 Email 和 Password。",
    accountTip: "注意：`demo / owner@demo.com` 常用于调试，通常包含历史数据，不适合作为第一天学习账号。",
  },
  ja: {
    overviewAriaLabel: "product-overview-ja",
    eyebrow: "LangBoost",
    brandTitle: "日本語・英語 スピーキング強化",
    brandDesc: "模擬試験・シャドーイング・ミス復習・単語学習を 1 つの流れにまとめ、日本語・英語のスピーキング力を高めます。",
    features: [
      "日本語シャドーイング＋デイリーニュース＋YouTube 取込",
      "2 時間の模擬試験でミス問題を自動蓄積",
      "間隔反復カードで期限到来の単語を優先学習",
      "文単位シャドーイングと発音フィードバック",
    ],
    stats: [
      { value: "JP+EN", label: "二か国語" },
      { value: "2000+", label: "練習問題" },
      { value: "SRS", label: "間隔反復" },
    ],
    formEyebrow: "Welcome Back",
    formTitle: "LangBoost ログイン",
    formSubtitle: "アカウント情報を入力すると集中学習モードに入れます",
    passwordPlaceholder: "パスワードを入力",
    loginLoading: "処理中...",
    loginButton: "ログイン",
    demoNotice: "通常は Email + Password だけでログインできます。Tenant Code はマルチテナント環境のみ必要です。",
    orgSummary: "組織情報（登録またはマルチテナントログイン時のみ）",
    tenantNameLabel: "Tenant Name（登録用）",
    displayNameLabel: "Display Name（登録用）",
    registerLoading: "処理中...",
    registerButton: "登録してログイン",
    registerTip: "登録時は上の Email と Password を使用します。",
    accountTip: "注意：`demo / owner@demo.com` は検証用で履歴データが多く、初日学習アカウントには不向きです。",
  },
} as const;

export function LoginView({
  locale,
  credentials,
  isSubmitting,
  message,
  onCredentialsChange,
  onLogin,
  onRegister,
  onLocaleChange,
}: LoginViewProps) {
  const copy = COPY[locale];

  return (
    <div className={styles.page}>
      {onLocaleChange && (
        <div className={styles.localeSwitcher}>
          <button
            type="button"
            className={`${styles.localeBtn} ${locale === "zh" ? styles.localeBtnActive : ""}`}
            onClick={() => onLocaleChange("zh")}
          >
            中文
          </button>
          <button
            type="button"
            className={`${styles.localeBtn} ${locale === "ja" ? styles.localeBtnActive : ""}`}
            onClick={() => onLocaleChange("ja")}
          >
            日本語
          </button>
        </div>
      )}
      <section className={styles.brandPanel} aria-label={copy.overviewAriaLabel}>
        <p className={styles.eyebrow}>{copy.eyebrow}</p>
        <h1 className={styles.brandTitle}>{copy.brandTitle}</h1>
        <p className={styles.brandDesc}>{copy.brandDesc}</p>
        <ul className={styles.featureList}>
          {copy.features.map((feature) => (
            <li key={feature}>{feature}</li>
          ))}
        </ul>
        <div className={styles.statRow}>
          {copy.stats.map((stat) => (
            <div key={stat.label} className={styles.statItem}>
              <span className={styles.statValue}>{stat.value}</span>
              <span className={styles.statLabel}>{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      <Card className={styles.formCard} variant="elevated" padding="lg">
        <CardHeader className={styles.formHeader}>
          <div>
            <p className={styles.formEyebrow}>{copy.formEyebrow}</p>
            <CardTitle as="h2">{copy.formTitle}</CardTitle>
            <p className={styles.formSubtitle}>{copy.formSubtitle}</p>
          </div>
        </CardHeader>
        <CardContent className={styles.formBody}>
          <div className={styles.loginGrid}>
            <Input
              label="Email"
              type="email"
              value={credentials.email}
              onChange={(e) => onCredentialsChange({ email: e.target.value })}
              autoComplete="email"
              placeholder="name@example.com"
            />
            <Input
              label="Password"
              type="password"
              value={credentials.password}
              onChange={(e) => onCredentialsChange({ password: e.target.value })}
              autoComplete="current-password"
              placeholder={copy.passwordPlaceholder}
            />
          </div>

          <div className={styles.loginAction}>
            <Button onClick={onLogin} disabled={isSubmitting} fullWidth size="lg">
              {isSubmitting ? copy.loginLoading : copy.loginButton}
            </Button>
          </div>

          <div className={styles.demoNotice}>{copy.demoNotice}</div>

          <details className={styles.advanced}>
            <summary>{copy.orgSummary}</summary>
            <div className={styles.grid}>
              <Input
                label="Tenant Code"
                value={credentials.tenantCode}
                onChange={(e) => onCredentialsChange({ tenantCode: e.target.value })}
                autoComplete="organization"
              />
              <Input
                label={copy.tenantNameLabel}
                value={credentials.tenantName}
                onChange={(e) => onCredentialsChange({ tenantName: e.target.value })}
                autoComplete="organization-title"
              />
              <Input
                label={copy.displayNameLabel}
                value={credentials.displayName}
                onChange={(e) => onCredentialsChange({ displayName: e.target.value })}
                autoComplete="name"
              />
            </div>
            <div className={styles.actions}>
              <Button variant="secondary" onClick={onRegister} disabled={isSubmitting} fullWidth>
                {isSubmitting ? copy.registerLoading : copy.registerButton}
              </Button>
            </div>
            <p className={styles.tip}>{copy.registerTip}</p>
          </details>

          <p className={styles.tip}>{copy.accountTip}</p>
          <p className={styles.message}>{message}</p>
        </CardContent>
      </Card>
    </div>
  );
}
