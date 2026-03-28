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
}

const COPY = {
  zh: {
    overviewAriaLabel: "product-overview",
    eyebrow: "toeicPass",
    brandTitle: "英语口语强化",
    brandDesc: "模拟考试、跟读、错题强化、背单词集中在一个工作流里，不在功能间反复跳转。",
    features: [
      "2 小时整卷模拟，自动沉淀错题",
      "错题复盘可直接回到训练路径",
      "间隔重复词卡，按到期优先学习",
      "句级跟读 + 发音反馈，提升听说联动",
    ],
    formEyebrow: "Welcome Back",
    formTitle: "登录 toeicPass",
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
    eyebrow: "toeicPass",
    brandTitle: "英語スピーキング強化",
    brandDesc: "模擬試験・シャドーイング・ミス復習・単語学習を 1 つの流れにまとめ、画面を行き来せずに進めます。",
    features: [
      "2 時間の模擬試験でミス問題を自動蓄積",
      "ミス復習からそのまま再演習に戻れる",
      "間隔反復カードで期限到来の単語を優先学習",
      "文単位シャドーイングと発音フィードバック",
    ],
    formEyebrow: "Welcome Back",
    formTitle: "toeicPass ログイン",
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
}: LoginViewProps) {
  const copy = COPY[locale];

  return (
    <div className={styles.page}>
      <section className={styles.brandPanel} aria-label={copy.overviewAriaLabel}>
        <p className={styles.eyebrow}>{copy.eyebrow}</p>
        <h1 className={styles.brandTitle}>{copy.brandTitle}</h1>
        <p className={styles.brandDesc}>{copy.brandDesc}</p>
        <ul className={styles.featureList}>
          {copy.features.map((feature) => (
            <li key={feature}>{feature}</li>
          ))}
        </ul>
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
