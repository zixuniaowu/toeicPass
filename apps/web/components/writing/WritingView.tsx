"use client";

import { useState } from "react";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import styles from "./WritingView.module.css";
import * as api from "../../lib/api";
import { useAuth } from "../../hooks/useAuth";

type WritingResult = {
  score: number;
  wordCount: number;
  feedback: string[];
};

export function WritingView() {
  const [text, setText] = useState("");
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [result, setResult] = useState<WritingResult | null>(null);
  const auth = useAuth();

  const wordCount = text.split(/\s+/).filter(Boolean).length;

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setIsEvaluating(true);
    setResult(null);
    try {
      const token = await auth.ensureSession();
      if (!token) return;
      const res = await fetch("http://localhost:8001/api/v1/writing/evaluate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
          "x-tenant-code": auth.credentials.tenantCode
        },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      setResult(data);
    } catch (error) {
      console.error("Evaluation failed", error);
      alert("评价提交失败，请重试");
    } finally {
      setIsEvaluating(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>英语写作练习</h2>
        <p className={styles.subtitle}>在这里输入你的英文文章或段落，AI会自动为你评估词汇、语法和结构。</p>
      </div>

      <div className={styles.workspace}>
        <Card className={styles.editorCard}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Start writing your essay here..."
            className={styles.textArea}
            disabled={isEvaluating}
            rows={12}
          />
          <div className={styles.metrics}>
            <span>字数: {wordCount}</span>
            <Button onClick={handleSubmit} disabled={isEvaluating || wordCount === 0}>
              {isEvaluating ? "评估中..." : "提交评估"}
            </Button>
          </div>
        </Card>

        {result && (
          <Card className={styles.resultCard}>
            <div className={styles.resultHeader}>
              <h3>评估报告</h3>
              <div className={styles.scoreBox}>
                得分: <span className={styles.score}>{result.score}</span> / 100
              </div>
            </div>
            <div className={styles.feedbackSection}>
              <h4>改进建议</h4>
              {result.feedback && result.feedback.length > 0 ? (
                <ul className={styles.feedbackList}>
                  {result.feedback.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              ) : (
                <p>非常好！没有更多建议。</p>
              )}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
