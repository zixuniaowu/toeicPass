"use client";

import React from "react";
import styles from "./ViewErrorBoundary.module.css";

type ViewErrorBoundaryProps = {
  title?: string;
  hint?: string;
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
      return (
        <div className={styles.errorPanel}>
          <h2>{this.props.title ?? "页面加载失败"}</h2>
          <p className={styles.errorHint}>{this.props.hint ?? "请点击刷新后重试。若重复出现，请联系管理员导出错误日志。"}</p>
          <p className={styles.errorMessage}>错误信息: {this.state.errorMessage}</p>
        </div>
      );
    }

    return this.props.children;
  }
}

