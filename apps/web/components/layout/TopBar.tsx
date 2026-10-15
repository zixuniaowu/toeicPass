"use client";

import { useState, useCallback } from "react";
import type { ViewTab, PlanCode, UiLang, TargetLang } from "../../types";
import { createT } from "../../lib/i18n";
import { NAV_ITEMS } from "../../lib/features";
import styles from "./TopBar.module.css";

interface TopBarProps {
  activeView: ViewTab;
  onViewChange: (view: ViewTab) => void;
  isLoggedIn: boolean;
  onLogout?: () => void;
  uiLang: UiLang;
  targetLang: TargetLang;
  /** @deprecated language is changed in Settings only */
  onUiLangChange?: (lang: UiLang) => void;
  /** @deprecated language is changed in Settings only */
  onTargetLangChange?: (lang: TargetLang) => void;
  planCode?: PlanCode;
  isAdmin?: boolean;
}

export function TopBar({ activeView, onViewChange, isLoggedIn, onLogout, uiLang, targetLang }: TopBarProps) {
  const t = createT(uiLang);
  const ja = uiLang === "ja";
  const l = (zh: string, jaText: string, en?: string) => (uiLang === "en" ? en ?? jaText : ja ? jaText : zh);
  const [menuOpen, setMenuOpen] = useState(false);

  const handleTabClick = useCallback((key: ViewTab) => {
    onViewChange(key);
    setMenuOpen(false);
  }, [onViewChange]);

  const targetLabel = targetLang === "ja" ? l("🇯🇵 学日语", "🇯🇵 日本語", "🇯🇵 Learning Japanese") : l("🇺🇸 学英语 · TOEIC", "🇺🇸 英語（TOEIC）", "🇺🇸 English (TOEIC)");

  return (
    <header className={styles.topbar}>
      <div className={styles.brand}>
        <span className={styles.brandMark}>LB</span>
        <div>
          <p className={styles.brandTitle}>{t("brand.title")}</p>
          <p className={styles.brandSub}>{l("跟读 · 发音训练", "シャドーイング・発音トレーニング", "Shadowing · pronunciation training")}</p>
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
          <nav className={`${styles.tabs} ${menuOpen ? styles.tabsOpen : ""}`} aria-label="main">
            {NAV_ITEMS.map((tab) => (
              <button
                key={tab.key}
                className={`${styles.tab} ${activeView === tab.key ? styles.active : ""}`}
                aria-current={activeView === tab.key ? "page" : undefined}
                onClick={() => handleTabClick(tab.key)}
              >
                {tab.icon} {l(tab.zh, tab.ja, tab.en)}
              </button>
            ))}
          </nav>
        </>
      )}

      <div className={styles.actions}>
        {isLoggedIn && (
          <button
            type="button"
            className={styles.logout}
            title={l("在设置中修改", "設定で変更", "Change in Settings")}
            onClick={() => onViewChange("settings")}
            data-testid="target-badge"
          >
            {targetLabel}
          </button>
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
