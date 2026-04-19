"use client";

import { ReactNode } from "react";
import type { ViewTab, PlanCode } from "../../types";
import type { UiLang, TargetLang } from "../../types";
import { TopBar } from "./TopBar";
import { Footer } from "./Footer";
import styles from "./AppShell.module.css";

interface AppShellProps {
  children: ReactNode;
  activeView: ViewTab;
  onViewChange: (view: ViewTab) => void;
  isLoggedIn: boolean;
  message: string;
  onLogout?: () => void;
  uiLang: UiLang;
  targetLang: TargetLang;
  onUiLangChange: (lang: UiLang) => void;
  onTargetLangChange: (lang: TargetLang) => void;
  planCode?: PlanCode;
  isAdmin?: boolean;
}

export function AppShell({
  children,
  activeView,
  onViewChange,
  isLoggedIn,
  message,
  onLogout,
  uiLang,
  targetLang,
  onUiLangChange,
  onTargetLangChange,
  planCode,
  isAdmin,
}: AppShellProps) {
  return (
    <div className={styles.shell}>
      <div className={styles.content}>
        <TopBar
          activeView={activeView}
          onViewChange={onViewChange}
          isLoggedIn={isLoggedIn}
          onLogout={onLogout}
          uiLang={uiLang}
          targetLang={targetLang}
          onUiLangChange={onUiLangChange}
          onTargetLangChange={onTargetLangChange}
          planCode={planCode}
          isAdmin={isAdmin}
        />
        <main key={activeView} className={styles.main}>{children}</main>
        <Footer message={message} />
      </div>
    </div>
  );
}
