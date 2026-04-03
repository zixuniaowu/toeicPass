"use client";

import Link from "next/link";
import type { Locale } from "../../types";
import type { AuthCredentials } from "../../hooks/useAuth";
import type { ThemeMode } from "../ClientHome";
import { API_BASE } from "../../lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/Card";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import styles from "./SettingsView.module.css";

const COPY = {
  zh: {
    title: "\u8d26\u6237\u4e0e\u76ee\u6807\u8bbe\u7f6e",
    account: "\u8d26\u6237",
    register: "\u6ce8\u518c",
    login: "\u767b\u5f55",
    goal: "\u76ee\u6807",
    currentScoreLabel: "\u5f53\u524d\u5206\u6570\uff08\u6700\u8fd1\u771f\u5b9e\u8003\u8bd5\uff09",
    goalScoreLabel: "\u76ee\u6807\u5206\u6570",
    examDate: "\u8003\u8bd5\u65e5\u671f",
    goalHint: "\u63a8\u8350\uff1a\u5148\u70b9\u201c\u4e00\u952e\u586b\u5165\u201d\uff0c\u518d\u70b9\u201c\u4fdd\u5b58\u76ee\u6807\u201d\u3002",
    quickFill: "\u4e00\u952e\u586b\u5165 800 / 90 \u5929",
    saveGoal: "\u4fdd\u5b58\u76ee\u6807",
    system: "\u7cfb\u7edf\u72b6\u6001",
    viewEndpoints: "\u67e5\u770b\u7aef\u70b9",
    theme: "\u4e3b\u9898",
    themeLight: "\u6d45\u8272",
    themeDark: "\u6df1\u8272",
    themeAuto: "\u8ddf\u968f\u7cfb\u7edf",
  },
  ja: {
    title: "\u30a2\u30ab\u30a6\u30f3\u30c8\u3068\u76ee\u6a19\u8a2d\u5b9a",
    account: "\u30a2\u30ab\u30a6\u30f3\u30c8",
    register: "\u767b\u9332",
    login: "\u30ed\u30b0\u30a4\u30f3",
    goal: "\u76ee\u6a19",
    currentScoreLabel: "\u73fe\u5728\u30b9\u30b3\u30a2\uff08\u6700\u65b0\u306e\u5b9f\u969b\u306e\u8a66\u9a13\uff09",
    goalScoreLabel: "\u76ee\u6a19\u30b9\u30b3\u30a2",
    examDate: "\u8a66\u9a13\u65e5",
    goalHint: "\u304a\u3059\u3059\u3081\uff1a\u307e\u305a\u300c\u30ef\u30f3\u30af\u30ea\u30c3\u30af\u5165\u529b\u300d\u3092\u62bc\u3057\u3066\u304b\u3089\u300c\u76ee\u6a19\u4fdd\u5b58\u300d\u3002",
    quickFill: "\u30ef\u30f3\u30af\u30ea\u30c3\u30af\u5165\u529b 800 / 90\u65e5",
    saveGoal: "\u76ee\u6a19\u4fdd\u5b58",
    system: "\u30b7\u30b9\u30c6\u30e0\u30b9\u30c6\u30fc\u30bf\u30b9",
    viewEndpoints: "\u30a8\u30f3\u30c9\u30dd\u30a4\u30f3\u30c8\u4e00\u89a7",
    theme: "\u30c6\u30fc\u30de",
    themeLight: "\u30e9\u30a4\u30c8",
    themeDark: "\u30c0\u30fc\u30af",
    themeAuto: "\u30b7\u30b9\u30c6\u30e0\u306b\u5408\u308f\u305b\u308b",
  },
} as const;

interface SettingsViewProps {
  locale: Locale;
  credentials: AuthCredentials;
  currentScore: number;
  goalScore: number;
  goalDate: string;
  theme: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
  onCredentialsChange: (updates: Partial<AuthCredentials>) => void;
  onCurrentScoreChange: (score: number) => void;
  onGoalScoreChange: (score: number) => void;
  onGoalDateChange: (date: string) => void;
  onRegister: () => void;
  onLogin: () => void;
  onApplyNinetyDayGoal: () => void;
  onSaveGoal: () => void;
}

export function SettingsView({
  locale,
  credentials,
  currentScore,
  goalScore,
  goalDate,
  theme,
  onThemeChange,
  onCredentialsChange,
  onCurrentScoreChange,
  onGoalScoreChange,
  onGoalDateChange,
  onRegister,
  onLogin,
  onApplyNinetyDayGoal,
  onSaveGoal,
}: SettingsViewProps) {
  const t = COPY[locale];
  return (
    <Card>
      <CardHeader>
        <CardTitle as="h1">{t.title}</CardTitle>
      </CardHeader>

      <CardContent>
        <div className={styles.grid}>
          <div className={styles.box}>
            <h3>{t.account}</h3>
            <Input
              label="Tenant Code"
              value={credentials.tenantCode}
              onChange={(e) => onCredentialsChange({ tenantCode: e.target.value })}
            />
            <Input
              label="Tenant Name"
              value={credentials.tenantName}
              onChange={(e) => onCredentialsChange({ tenantName: e.target.value })}
            />
            <Input
              label="Display Name"
              value={credentials.displayName}
              onChange={(e) => onCredentialsChange({ displayName: e.target.value })}
            />
            <Input
              label="Email"
              type="email"
              value={credentials.email}
              onChange={(e) => onCredentialsChange({ email: e.target.value })}
            />
            <Input
              label="Password"
              type="password"
              value={credentials.password}
              onChange={(e) => onCredentialsChange({ password: e.target.value })}
            />
            <div className={styles.actions}>
              <Button onClick={onRegister}>{t.register}</Button>
              <Button variant="secondary" onClick={onLogin}>
                {t.login}
              </Button>
            </div>
          </div>

          <div className={styles.box}>
            <h3>{t.goal}</h3>
            <Input
              label={t.currentScoreLabel}
              type="number"
              min={10}
              max={990}
              value={currentScore}
              onChange={(e) => onCurrentScoreChange(Number(e.target.value) || 10)}
            />
            <Input
              label={t.goalScoreLabel}
              type="number"
              min={10}
              max={990}
              value={goalScore}
              onChange={(e) => onGoalScoreChange(Number(e.target.value) || 10)}
            />
            <Input
              label={t.examDate}
              type="date"
              value={goalDate}
              onChange={(e) => onGoalDateChange(e.target.value)}
            />
            <p className={styles.goalHint}>{t.goalHint}</p>
            <div className={styles.goalActions}>
              <Button variant="secondary" onClick={onApplyNinetyDayGoal}>{t.quickFill}</Button>
              <Button onClick={onSaveGoal}>{t.saveGoal}</Button>
            </div>
          </div>
        </div>

        <div className={styles.box}>
          <h3>{t.theme}</h3>
          <div className={styles.themeToggle}>
            {(["light", "dark", "auto"] as const).map((m) => (
              <button
                key={m}
                className={`${styles.themeBtn} ${theme === m ? styles.themeBtnActive : ""}`}
                onClick={() => onThemeChange(m)}
              >
                {m === "light" ? `☀️ ${t.themeLight}` : m === "dark" ? `🌙 ${t.themeDark}` : `💻 ${t.themeAuto}`}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.box}>
          <h3>{t.system}</h3>
          <ul className={styles.statusList}>
            <li>
              <span>Web</span>
              <strong>:8000</strong>
            </li>
            <li>
              <span>API</span>
              <strong>:8001</strong>
            </li>
            <li>
              <span>API Base</span>
              <strong className={styles.mono}>{API_BASE}</strong>
            </li>
            <li>
              <span>Official Audio</span>
              <a href="https://www.toeic.com.hk/Track/" target="_blank" rel="noreferrer">
                toeic.com.hk
              </a>
            </li>
            <li>
              <span>IP API</span>
              <Link href="/api-guide">{t.viewEndpoints}</Link>
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
