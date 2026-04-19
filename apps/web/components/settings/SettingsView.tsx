"use client";

import Link from "next/link";
import type { UiLang, NativeLang, TargetLang } from "../../types";
import type { AuthCredentials } from "../../hooks/useAuth";
import type { ThemeMode } from "../ClientHome";
import { API_BASE } from "../../lib/api";
import { createT, UI_LANGS } from "../../lib/i18n";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/Card";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import styles from "./SettingsView.module.css";

const NATIVE_LANGS: readonly NativeLang[] = ["zh", "ja", "en"] as const;
const TARGET_LANGS: readonly TargetLang[] = ["en", "ja"] as const;

interface SettingsViewProps {
  credentials: AuthCredentials;
  currentScore: number;
  goalScore: number;
  goalDate: string;
  theme: ThemeMode;
  uiLang: UiLang;
  nativeLang: NativeLang;
  targetLang: TargetLang;
  onThemeChange: (theme: ThemeMode) => void;
  onUiLangChange: (lang: UiLang) => void;
  onNativeLangChange: (lang: NativeLang) => void;
  onTargetLangChange: (lang: TargetLang) => void;
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
  credentials,
  currentScore,
  goalScore,
  goalDate,
  theme,
  uiLang,
  nativeLang,
  targetLang,
  onThemeChange,
  onUiLangChange,
  onNativeLangChange,
  onTargetLangChange,
  onCredentialsChange,
  onCurrentScoreChange,
  onGoalScoreChange,
  onGoalDateChange,
  onRegister,
  onLogin,
  onApplyNinetyDayGoal,
  onSaveGoal,
}: SettingsViewProps) {
  const t = createT(uiLang);
  return (
    <Card>
      <CardHeader>
        <CardTitle as="h1">{t("settings.title")}</CardTitle>
      </CardHeader>

      <CardContent>
        <div className={styles.grid}>
          <div className={styles.box}>
            <h3>{t("settings.account")}</h3>
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
              <Button onClick={onRegister}>{t("auth.register")}</Button>
              <Button variant="secondary" onClick={onLogin}>
                {t("auth.login")}
              </Button>
            </div>
          </div>

          <div className={styles.box}>
            <h3>{t("settings.goal")}</h3>
            <Input
              label={t("settings.currentScoreLabel")}
              type="number"
              min={10}
              max={990}
              value={currentScore}
              onChange={(e) => onCurrentScoreChange(Number(e.target.value) || 10)}
            />
            <Input
              label={t("settings.goalScoreLabel")}
              type="number"
              min={10}
              max={990}
              value={goalScore}
              onChange={(e) => onGoalScoreChange(Number(e.target.value) || 10)}
            />
            <Input
              label={t("settings.examDate")}
              type="date"
              value={goalDate}
              onChange={(e) => onGoalDateChange(e.target.value)}
            />
            <p className={styles.goalHint}>{t("settings.goalHint")}</p>
            <div className={styles.goalActions}>
              <Button variant="secondary" onClick={onApplyNinetyDayGoal}>{t("settings.quickFill")}</Button>
              <Button onClick={onSaveGoal}>{t("settings.saveGoal")}</Button>
            </div>
          </div>
        </div>

        <div className={styles.box}>
          <h3>{t("settings.langConfig")}</h3>
          <div className={styles.langGroup}>
            <label className={styles.langLabel}>{t("settings.uiLangLabel")}</label>
            <div className={styles.themeToggle}>
              {UI_LANGS.map((lang) => (
                <button
                  key={lang}
                  className={`${styles.themeBtn} ${uiLang === lang ? styles.themeBtnActive : ""}`}
                  onClick={() => onUiLangChange(lang)}
                >
                  {t(`lang.${lang}`)}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.langGroup}>
            <label className={styles.langLabel}>{t("settings.targetLangLabel")}</label>
            <div className={styles.themeToggle}>
              {TARGET_LANGS.map((lang) => (
                <button
                  key={lang}
                  className={`${styles.themeBtn} ${targetLang === lang ? styles.themeBtnActive : ""}`}
                  onClick={() => onTargetLangChange(lang)}
                >
                  {t(`lang.target${lang.charAt(0).toUpperCase() + lang.slice(1)}`)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className={styles.box}>
          <h3>{t("settings.theme")}</h3>
          <div className={styles.themeToggle}>
            {(["light", "dark", "auto"] as const).map((m) => (
              <button
                key={m}
                className={`${styles.themeBtn} ${theme === m ? styles.themeBtnActive : ""}`}
                onClick={() => onThemeChange(m)}
              >
                {m === "light" ? `☀️ ${t("settings.themeLight")}` : m === "dark" ? `🌙 ${t("settings.themeDark")}` : `💻 ${t("settings.themeAuto")}`}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.box}>
          <h3>{t("settings.system")}</h3>
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
              <Link href="/api-guide">{t("settings.viewEndpoints")}</Link>
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
