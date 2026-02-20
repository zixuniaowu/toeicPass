"use client";

import { TABS, ViewTab } from "../../types";
import styles from "./TopBar.module.css";

interface TopBarProps {
  activeView: ViewTab;
  onViewChange: (view: ViewTab) => void;
  isLoggedIn: boolean;
}

export function TopBar({ activeView, onViewChange, isLoggedIn }: TopBarProps) {
  return (
    <header className={styles.topbar}>
      <div className={styles.brand}>
        <span className={styles.brandMark}>TP</span>
        <div>
          <p className={styles.brandTitle}>toeicPass</p>
          <p className={styles.brandSub}>focused study workflow</p>
        </div>
      </div>

      <nav className={styles.tabs}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={`${styles.tab} ${activeView === tab.key ? styles.active : ""}`}
            onClick={() => onViewChange(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className={`${styles.badge} ${isLoggedIn ? styles.on : styles.off}`}>
        {isLoggedIn ? "已登录" : "体验模式"}
      </div>
    </header>
  );
}
