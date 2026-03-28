"use client";

import { ReactNode } from "react";
import { ViewTab } from "../../types";
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
}

export function AppShell({
  children,
  activeView,
  onViewChange,
  isLoggedIn,
  message,
  onLogout,
}: AppShellProps) {
  return (
    <div className={styles.shell}>
      <div className={styles.content}>
        <TopBar
          activeView={activeView}
          onViewChange={onViewChange}
          isLoggedIn={isLoggedIn}
          onLogout={onLogout}
        />
        <main className={styles.main}>{children}</main>
        <Footer message={message} />
      </div>
    </div>
  );
}
