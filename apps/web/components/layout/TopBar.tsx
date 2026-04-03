"use client";

import { useState, useCallback } from "react";
import { TABS, type Locale, type ViewTab } from "../../types";
import styles from "./TopBar.module.css";

interface TopBarProps {
  activeView: ViewTab;
  onViewChange: (view: ViewTab) => void;
  isLoggedIn: boolean;
  onLogout?: () => void;
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
}

const TAB_LABEL_JA: Partial<Record<ViewTab, string>> = {
  dashboard: "ダッシュボード",
  shadowing: "シャドーイング",
  mock: "模擬試験",
  conversation: "AI 会話",
  mistakes: "ミスノート",
  vocab: "単語帳",
  settings: "設定",
};

export function TopBar({
  activeView,
  onViewChange,
  isLoggedIn,
  onLogout,
  locale,
  onLocaleChange,
}: TopBarProps) {
  const isJa = locale === "ja";
  const [menuOpen, setMenuOpen] = useState(false);

  const handleTabClick = useCallback((key: ViewTab) => {
    onViewChange(key);
    setMenuOpen(false);
  }, [onViewChange]);

  return (
    <header className={styles.topbar}>
      <div className={styles.brand}>
        <span className={styles.brandMark}>LB</span>
        <div>
          <p className={styles.brandTitle}>LangBoost</p>
          <p className={styles.brandSub}>{isJa ? "日本語・英語 スピーキング強化" : "日语 · 英语 口语强化平台"}</p>
        </div>
      </div>

      {isLoggedIn && (
        <>
          <button
            type="button"
            className={styles.hamburger}
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle navigation"
          >
            <span className={`${styles.hamburgerLine} ${menuOpen ? styles.hamburgerOpen : ""}`} />
          </button>
          <nav className={`${styles.tabs} ${menuOpen ? styles.tabsOpen : ""}`}>
            {TABS.map((tab) => (
              <button
                key={tab.key}
                className={`${styles.tab} ${activeView === tab.key ? styles.active : ""}`}
                onClick={() => handleTabClick(tab.key)}
              >
                {isJa ? TAB_LABEL_JA[tab.key] ?? tab.label : tab.label}
              </button>
            ))}
          </nav>
        </>
      )}

      <div className={styles.actions}>
        <div className={styles.localeSwitch}>
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
        {isLoggedIn && onLogout && (
          <button type="button" className={styles.logout} onClick={onLogout}>
            {isJa ? "ログアウト" : "退出登录"}
          </button>
        )}
      </div>
    </header>
  );
}
