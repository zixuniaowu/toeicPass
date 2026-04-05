"use client";

import { ReactNode } from "react";
import type { Locale, ViewTab, PlanCode } from "../../types";
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
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
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
  locale,
  onLocaleChange,
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
          locale={locale}
          onLocaleChange={onLocaleChange}
          planCode={planCode}
          isAdmin={isAdmin}
        />
        <main key={activeView} className={styles.main}>{children}</main>
        <Footer message={message} />
      </div>
    </div>
  );
}
