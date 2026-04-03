"use client";

import React from "react";
import styles from "./ViewErrorBoundary.module.css";

const DEFAULT_COPY = {
  zh: { title: "页面加载失败", hint: "请点击刷新后重试。若重复出现，请联系管理员导出错误日志。", errorLabel: "错误信息:" },
  ja: { title: "ページの読み込みに失敗しました", hint: "ページを更新してもう一度お試しください。繰り返し発生する場合は管理者にお問い合わせください。", errorLabel: "エラー情報:" },
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

export class ViewErrorBoundary extends React.Component<ViewErrorBoundaryProps, ViewErrorBoundaryState> {
  constructor(props: ViewErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

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
  }

  render() {
    if (this.state.hasError) {
      const d = DEFAULT_COPY[this.props.locale ?? "zh"];
      return (
        <div className={styles.errorPanel}>
          <h2>{this.props.title ?? d.title}</h2>
          <p className={styles.errorHint}>{this.props.hint ?? d.hint}</p>
          <p className={styles.errorMessage}>{d.errorLabel} {this.state.errorMessage}</p>
        </div>
      );
    }

    return this.props.children;
  }
}

