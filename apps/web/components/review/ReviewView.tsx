"use client";
/** 复习 — sentences that still need work, re-practiced with the same feedback panel. */
import { useCallback, useEffect, useMemo, useState } from "react";
import type { TargetLang, UiLang } from "../../types";
import { readPracticeLog, removePracticeAttempt, type PracticeAttempt } from "../../lib/practice-log";
import { useSpeechRecognition } from "../../hooks/useSpeechRecognition";
import { getJapaneseReading } from "../../lib/japanese-reading";
import { RecordingPanel } from "../shadowing/RecordingPanel";
import type { PhoneticSegment } from "@toeicpass/app-core/shadowing-compare";
import styles from "../settings/SettingsView.module.css";

export function ReviewView({ uiLang, targetLang }: { uiLang: UiLang; targetLang: TargetLang }) {
  const ja = uiLang === "ja";
  const l = useCallback((zh: string, jaText: string) => (ja ? jaText : zh), [ja]);
  const [log, setLog] = useState<PracticeAttempt[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [segments, setSegments] = useState<PhoneticSegment[] | undefined>(undefined);
  const recognition = useSpeechRecognition(targetLang, () => window.speechSynthesis?.cancel(), l);

  const refresh = useCallback(() => setLog(readPracticeLog().filter((a) => a.lang === targetLang)), [targetLang]);
  useEffect(() => { refresh(); }, [refresh, recognition.compareResult]);

  useEffect(() => {
    setSegments(undefined);
    if (!active || targetLang !== "ja") return;
    void getJapaneseReading(active).then((r) => {
      if (r.tokens.length) setSegments(r.tokens.map((t) => ({ surface: t.surface, reading: t.reading ?? t.surface })));
    });
  }, [active, targetLang]);

  const weak = useMemo(() => log.filter((a) => a.bestAccuracy < 85), [log]);
  const mastered = useMemo(() => log.filter((a) => a.bestAccuracy >= 85), [log]);

  const renderItem = (a: PracticeAttempt) => (
    <div key={a.text} className={styles.row} style={{ flexDirection: "column", alignItems: "stretch" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <span className={styles.rowTitle} style={{ flex: 1 }}>{a.text}</span>
        <span className={styles.value} style={{ color: a.bestAccuracy >= 85 ? "#059669" : a.bestAccuracy >= 60 ? "#b45309" : "#dc2626" }}>
          {a.bestAccuracy}%
        </span>
      </div>
      <span className={styles.rowHint}>
        {l("练习", "練習")} {a.attempts} {l("次", "回")}
        {a.issues.length > 0 && ` · ${l("问题词", "要練習")}: ${a.issues.map((i) => i.word).slice(0, 5).join(", ")}`}
      </span>
      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
        <button type="button" className={styles.linkBtn} onClick={() => { recognition.clearRecognition(); setActive(active === a.text ? null : a.text); }}>
          {active === a.text ? l("收起", "閉じる") : `🎙 ${l("再练一次", "もう一度練習")}`}
        </button>
        <button type="button" className={styles.linkBtn} onClick={() => { removePracticeAttempt(a.text, a.lang); refresh(); }}>
          {l("移除", "削除")}
        </button>
      </div>
      {active === a.text && (
        <RecordingPanel
          micPermission={recognition.micPermission}
          isRecording={recognition.isRecording}
          isSpeaking={false}
          recognizedText={recognition.recognizedText}
          compareResult={recognition.compareResult}
          sentenceText={a.text}
          sentenceSegments={segments}
          trainingLanguage={targetLang}
          recordingUrl={recognition.recordingUrl}
          notice={recognition.notice}
          uiLang={uiLang}
          onStartRecording={recognition.startRecording}
          onStopRecording={recognition.stopRecording}
          onDismissMicBanner={recognition.dismissMicBanner}
          l={l}
        />
      )}
    </div>
  );

  return (
    <div className={styles.page} data-testid="review-page">
      <h1 className={styles.pageTitle}>{l("复习", "復習")}</h1>
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>{l("待加强", "要復習")}（{weak.length}）</h2>
          <p className={styles.sectionDesc}>{l("最高分低于 85% 的句子。反复跟读直到变绿。", "最高スコアが 85% 未満の文です。緑になるまで練習しましょう。")}</p>
        </div>
        {weak.length === 0 ? (
          <div className={styles.row}><span className={styles.rowHint}>{l("暂无需要复习的句子。去「跟读」练习吧！", "復習が必要な文はありません。「シャドーイング」で練習しましょう！")}</span></div>
        ) : weak.map(renderItem)}
      </section>
      {mastered.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>{l("已掌握", "習得済み")}（{mastered.length}）</h2>
          </div>
          {mastered.slice(0, 30).map(renderItem)}
        </section>
      )}
    </div>
  );
}
