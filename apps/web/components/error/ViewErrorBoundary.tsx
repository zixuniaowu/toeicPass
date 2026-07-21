"use client";

import React from "react";
import styles from "./ViewErrorBoundary.module.css";

const CHUNK_RELOAD_STORAGE_KEY = "view-error-boundary:chunk-reload";

const DEFAULT_COPY = {
  zh: {
    title: "页面加载失败",
    hint: "请点击刷新后重试。若重复出现，请联系管理员导出错误日志。",
    errorLabel: "错误信息:",
    retryLabel: "立即刷新",
  },
  ja: {
    title: "ページの読み込みに失敗しました",
    hint: "ページを更新してもう一度お試しください。繰り返し発生する場合は管理者にお問い合わせください。",
    errorLabel: "エラー情報:",
    retryLabel: "今すぐ再読み込み",
  },
};

type ViewErrorBoundaryProps = {
  title?: string;
  hint?: string;
  locale?: "zh" | "ja";
  children: React.ReactNode;
};

type ViewErrorBoundaryState = {
  hasError: boolean;
  errorMessage: string;
};

function isChunkLoadError(error: Error): boolean {
  const message = error?.message ?? "";
  return error?.name === "ChunkLoadError"
    || /Loading chunk [^ ]+ failed/i.test(message)
    || /Loading CSS chunk [^ ]+ failed/i.test(message)
    || /Failed to fetch dynamically imported module/i.test(message)
    || /Importing a module script failed/i.test(message);
}

function getChunkReloadKey(error: Error): string {
  const path = typeof window === "undefined" ? "unknown" : window.location.pathname;
  return `${CHUNK_RELOAD_STORAGE_KEY}:${path}:${error?.message ?? "unknown error"}`;
}

function tryRecoverChunkLoad(error: Error): boolean {
  if (typeof window === "undefined" || !isChunkLoadError(error)) {
    return false;
  }

  try {
    const reloadKey = getChunkReloadKey(error);
    if (window.sessionStorage.getItem(reloadKey) === "1") {
      return false;
    }
    window.sessionStorage.setItem(reloadKey, "1");
  } catch {
    // If session storage is unavailable, still attempt a single hard reload.
  }

  window.location.reload();
  return true;
}

export class ViewErrorBoundary extends React.Component<ViewErrorBoundaryProps, ViewErrorBoundaryState> {
  constructor(props: ViewErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

  private handleReload = (): void => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  static getDerivedStateFromError(error: Error): ViewErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message ?? "unknown error",
    };
  }

  componentDidCatch(error: Error): void {
    // Keep minimal logging to avoid noisy loops in production.
    // eslint-disable-next-line no-console
    console.error("ViewErrorBoundary captured error:", error);

    tryRecoverChunkLoad(error);
  }

  render() {
    if (this.state.hasError) {
      const d = DEFAULT_COPY[this.props.locale ?? "zh"];
      return (
        <div className={styles.errorPanel}>
          <h2>{this.props.title ?? d.title}</h2>
          <p className={styles.errorHint}>{this.props.hint ?? d.hint}</p>
          <p className={styles.errorMessage}>{d.errorLabel} {this.state.errorMessage}</p>
          <div className={styles.actions}>
            <button type="button" className={styles.retryButton} onClick={this.handleReload}>
              {d.retryLabel}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

