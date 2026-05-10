"use client";

import type { AuthCredentials } from "../../hooks/useAuth";
import type { Locale } from "../../types";
import type { UiLang } from "../../types";
import { createT } from "../../lib/i18n";
import { Button } from "../ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import { Input } from "../ui/Input";
import styles from "./LoginView.module.css";

interface LoginViewProps {
  locale: Locale;
  uiLang?: UiLang;
  credentials: AuthCredentials;
  isSubmitting: boolean;
  message: string;
  onCredentialsChange: (updates: Partial<AuthCredentials>) => void;
  onLogin: () => void;
  onRegister: () => void;
  onGoogleLogin?: () => void;
  onWeChatLogin?: () => void;
  onLineLogin?: () => void;
  onLocaleChange?: (lang: UiLang) => void;
}

export function LoginView({
  locale,
  uiLang,
  credentials,
  isSubmitting,
  message,
  onCredentialsChange,
  onLogin,
  onRegister,
  onGoogleLogin,
  onWeChatLogin,
  onLineLogin,
  onLocaleChange,
}: LoginViewProps) {
  const t = createT(uiLang ?? locale);
  const featureKeys = ["login.feature1", "login.feature2", "login.feature3", "login.feature4"] as const;
  const statKeys = [
    { value: "login.stat1Value", label: "login.stat1Label" },
    { value: "login.stat2Value", label: "login.stat2Label" },
    { value: "login.stat3Value", label: "login.stat3Label" },
  ] as const;

  return (
    <div className={styles.page}>
      {onLocaleChange && (
        <div className={styles.localeSwitcher}>
          <button
            type="button"
            className={`${styles.localeBtn} ${(uiLang ?? locale) === "zh" ? styles.localeBtnActive : ""}`}
            onClick={() => onLocaleChange("zh")}
          >
            {t("lang.zh")}
          </button>
          <button
            type="button"
            className={`${styles.localeBtn} ${(uiLang ?? locale) === "ja" ? styles.localeBtnActive : ""}`}
            onClick={() => onLocaleChange("ja")}
          >
            {t("lang.ja")}
          </button>
          <button
            type="button"
            className={`${styles.localeBtn} ${(uiLang ?? locale) === "en" ? styles.localeBtnActive : ""}`}
            onClick={() => onLocaleChange("en")}
          >
            {t("lang.en")}
          </button>
        </div>
      )}
      <section className={styles.brandPanel} aria-label={t("login.overviewAriaLabel")}>
        <p className={styles.eyebrow}>{t("login.eyebrow")}</p>
        <h1 className={styles.brandTitle}>{t("login.brandTitle")}</h1>
        <p className={styles.brandDesc}>{t("login.brandDesc")}</p>
        <ul className={styles.featureList}>
          {featureKeys.map((featureKey) => (
            <li key={featureKey}>{t(featureKey)}</li>
          ))}
        </ul>
        <div className={styles.statRow}>
          {statKeys.map((stat) => (
            <div key={stat.label} className={styles.statItem}>
              <span className={styles.statValue}>{t(stat.value)}</span>
              <span className={styles.statLabel}>{t(stat.label)}</span>
            </div>
          ))}
        </div>
      </section>

      <Card className={styles.formCard} variant="elevated" padding="lg">
        <CardHeader className={styles.formHeader}>
          <div>
            <p className={styles.formEyebrow}>{t("login.formEyebrow")}</p>
            <CardTitle as="h2">{t("login.formTitle")}</CardTitle>
            <p className={styles.formSubtitle}>{t("login.formSubtitle")}</p>
          </div>
        </CardHeader>
        <CardContent className={styles.formBody}>
          <div className={styles.loginGrid}>
            <Input
              label={t("auth.emailLabel")}
              type="email"
              value={credentials.email}
              onChange={(e) => onCredentialsChange({ email: e.target.value })}
              autoComplete="email"
              placeholder="name@example.com"
            />
            <Input
              label={t("auth.passwordLabel")}
              type="password"
              value={credentials.password}
              onChange={(e) => onCredentialsChange({ password: e.target.value })}
              autoComplete="current-password"
              placeholder={t("auth.passwordPlaceholder")}
            />
          </div>

          <div className={styles.loginAction}>
            <Button onClick={onLogin} loading={isSubmitting} fullWidth size="lg">
              {isSubmitting ? t("auth.processing") : t("auth.loginButton")}
            </Button>
          </div>

          {onGoogleLogin && (
            <>
              <div className={styles.divider}>
                <span>{t("login.orDivider")}</span>
              </div>
              <div className={styles.oauthGroup}>
                <button type="button" className={styles.oauthBtn} onClick={onGoogleLogin} disabled={isSubmitting} title="Google">
                  <svg width="22" height="22" viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                  </svg>
                </button>

                {onWeChatLogin && (
                  <button type="button" className={styles.oauthBtn} onClick={onWeChatLogin} disabled={isSubmitting} title="WeChat">
                    <svg width="22" height="22" viewBox="0 0 48 48">
                      <path fill="#09B83E" d="M24 2C11.85 2 2 10.95 2 22c0 6.15 3.15 11.6 8.05 15.15L8.4 43.5c-.15.55.4 1 .9.75l7.2-3.8c2.35.7 4.85 1.05 7.5 1.05 12.15 0 22-8.95 22-20S36.15 2 24 2z"/>
                      <path fill="#fff" d="M16.5 18c-1.38 0-2.5 1.12-2.5 2.5s1.12 2.5 2.5 2.5 2.5-1.12 2.5-2.5-1.12-2.5-2.5-2.5zm15 0c-1.38 0-2.5 1.12-2.5 2.5s1.12 2.5 2.5 2.5 2.5-1.12 2.5-2.5-1.12-2.5-2.5-2.5z"/>
                    </svg>
                  </button>
                )}

                {onLineLogin && (
                  <button type="button" className={styles.oauthBtn} onClick={onLineLogin} disabled={isSubmitting} title="LINE">
                    <svg width="22" height="22" viewBox="0 0 48 48">
                      <rect width="48" height="48" rx="12" fill="#06C755"/>
                      <path fill="#fff" d="M40 22.38c0-7.18-7.18-13.02-16-13.02S8 15.2 8 22.38c0 6.44 5.72 11.83 13.44 12.85.52.11 1.23.35 1.41.8.16.41.1 1.05.05 1.47l-.23 1.36c-.07.41-.32 1.6 1.4.87s9.31-5.49 12.72-9.4C39.01 27.87 40 25.27 40 22.38z"/>
                    </svg>
                  </button>
                )}
              </div>
            </>
          )}

          <div className={styles.demoNotice}>{t("login.demoNotice")}</div>

          <details className={styles.advanced}>
            <summary>{t("login.orgSummary")}</summary>
            <div className={styles.grid}>
              <Input
                label={t("login.tenantCodeLabel")}
                value={credentials.tenantCode}
                onChange={(e) => onCredentialsChange({ tenantCode: e.target.value })}
                autoComplete="organization"
              />
              <Input
                label={t("login.tenantNameLabel")}
                value={credentials.tenantName}
                onChange={(e) => onCredentialsChange({ tenantName: e.target.value })}
                autoComplete="organization-title"
              />
              <Input
                label={t("login.displayNameLabel")}
                value={credentials.displayName}
                onChange={(e) => onCredentialsChange({ displayName: e.target.value })}
                autoComplete="name"
              />
            </div>
            <div className={styles.actions}>
              <Button variant="secondary" onClick={onRegister} loading={isSubmitting} fullWidth>
                {isSubmitting ? t("auth.processing") : t("auth.registerButton")}
              </Button>
            </div>
            <p className={styles.tip}>{t("login.registerTip")}</p>
          </details>

          <p className={styles.tip}>{t("login.accountTip")}</p>
          <p className={styles.message}>{message}</p>
        </CardContent>
      </Card>
    </div>
  );
}
