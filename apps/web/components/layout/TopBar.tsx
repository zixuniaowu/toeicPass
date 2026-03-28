"use client";

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
  shadowing: "シャドーイング",
  mock: "模擬試験",
  mistakes: "ミスノート",
  vocab: "単語帳",
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

  return (
    <header className={styles.topbar}>
      <div className={styles.brand}>
        <span className={styles.brandMark}>TP</span>
        <div>
          <p className={styles.brandTitle}>toeicPass</p>
          <p className={styles.brandSub}>{isJa ? "英語スピーキング強化" : "英语口语强化"}</p>
        </div>
      </div>

      {isLoggedIn && (
        <nav className={styles.tabs}>
          {TABS.map((tab) => (
            <button
              key={tab.key}
              className={`${styles.tab} ${activeView === tab.key ? styles.active : ""}`}
              onClick={() => onViewChange(tab.key)}
            >
              {isJa ? TAB_LABEL_JA[tab.key] ?? tab.label : tab.label}
            </button>
          ))}
        </nav>
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
        <div className={`${styles.badge} ${isLoggedIn ? styles.on : styles.off}`}>
          {isLoggedIn ? (isJa ? "ログイン済み" : "已登录") : isJa ? "未ログイン" : "未登录"}
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
