"use client";

import { useState, useCallback } from "react";
import { TABS, type ViewTab, type PlanCode } from "../../types";
import type { UiLang, TargetLang } from "../../types";
import { createT, UI_LANGS } from "../../lib/i18n";
import { PlanBadge } from "../subscription/PlanBadge";
import styles from "./TopBar.module.css";

interface TopBarProps {
  activeView: ViewTab;
  onViewChange: (view: ViewTab) => void;
  isLoggedIn: boolean;
  onLogout?: () => void;
  /** @deprecated Use uiLang instead */
  locale?: "zh" | "ja";
  /** @deprecated Use onUiLangChange instead */
  onLocaleChange?: (locale: "zh" | "ja") => void;
  uiLang: UiLang;
  targetLang: TargetLang;
  onUiLangChange: (lang: UiLang) => void;
  onTargetLangChange: (lang: TargetLang) => void;
  planCode?: PlanCode;
  isAdmin?: boolean;
}

const NAV_KEYS: readonly ViewTab[] = [
  "shadowing", "mock", "grammar", "conversation",
  "mistakes", "vocab", "subscription", "admin", "settings",
] as const;

const TARGET_LANGS: readonly TargetLang[] = ["en", "ja"] as const;

export function TopBar({
  activeView,
  onViewChange,
  isLoggedIn,
  onLogout,
  uiLang,
  targetLang,
  onUiLangChange,
  onTargetLangChange,
  planCode,
  isAdmin,
}: TopBarProps) {
  const t = createT(uiLang);
  const [menuOpen, setMenuOpen] = useState(false);

  const visibleTabs = TABS.filter((tab) => tab.key !== "admin" || isAdmin);

  const handleTabClick = useCallback((key: ViewTab) => {
    onViewChange(key);
    setMenuOpen(false);
  }, [onViewChange]);

  return (
    <header className={styles.topbar}>
      <div className={styles.brand}>
        <span className={styles.brandMark}>LB</span>
        <div>
          <p className={styles.brandTitle}>{t("brand.title")}</p>
          <p className={styles.brandSub}>{t("brand.subtitle")}</p>
        </div>
      </div>

      {isLoggedIn && (
        <>
          <button
            type="button"
            className={styles.hamburger}
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle navigation"
            aria-expanded={menuOpen}
          >
            <span className={`${styles.hamburgerLine} ${menuOpen ? styles.hamburgerOpen : ""}`} />
          </button>
          <nav className={`${styles.tabs} ${menuOpen ? styles.tabsOpen : ""}`}>
            {visibleTabs.map((tab) => (
              <button
                key={tab.key}
                className={`${styles.tab} ${activeView === tab.key ? styles.active : ""}`}
                onClick={() => handleTabClick(tab.key)}
              >
                {t(`nav.${tab.key}`) !== `nav.${tab.key}` ? t(`nav.${tab.key}`) : tab.label}
              </button>
            ))}
          </nav>

          <div className={styles.controls}>
            <div className={styles.switchGroup}>
              <span className={styles.switchLabel}>{t("lang.uiLabel")}</span>
              <div className={styles.localeSwitch} role="group" aria-label={t("lang.uiLabel")}>
                {UI_LANGS.map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    className={`${styles.localeBtn} ${uiLang === lang ? styles.localeBtnActive : ""}`}
                    aria-label={`${t("lang.uiLabel")}: ${t(`lang.${lang}`)}`}
                    aria-pressed={uiLang === lang}
                    onClick={() => onUiLangChange(lang)}
                  >
                    {t(`lang.${lang}`)}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.switchGroup}>
              <span className={styles.switchLabel}>{t("lang.targetLabel")}</span>
              <div className={styles.localeSwitch} role="group" aria-label={t("lang.targetLabel")}>
                {TARGET_LANGS.map((lang) => {
                  const key = `lang.target${lang.charAt(0).toUpperCase()}${lang.slice(1)}`;
                  return (
                    <button
                      key={lang}
                      type="button"
                      className={`${styles.localeBtn} ${targetLang === lang ? styles.localeBtnActive : ""}`}
                      aria-label={`${t("lang.targetLabel")}: ${t(key)}`}
                      aria-pressed={targetLang === lang}
                      onClick={() => onTargetLangChange(lang)}
                    >
                      {t(key)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}

      <div className={styles.actions}>
        {isLoggedIn && planCode && (
          <PlanBadge planCode={planCode} onClick={() => onViewChange("subscription")} />
        )}
        {isLoggedIn && onLogout && (
          <button type="button" className={styles.logout} onClick={onLogout}>
            {t("auth.logout")}
          </button>
        )}
      </div>
    </header>
  );
}
