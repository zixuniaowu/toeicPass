"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { UiLang } from "../../types";
import {
  loadVocabDay, loadVocabIndex, masteredKey, pickTr, readMastered, writeMastered,
  type VocabDay, type VocabDaySummary, type VocabRootWord,
} from "../../lib/vocab-roots";
import { playSpeech, registerPrerecorded, stopSpeech } from "../../lib/tts";
import { useSpeechSynthesis } from "../../hooks/useSpeechSynthesis";
import { useSpeechRecognition } from "../../hooks/useSpeechRecognition";
import { RecordingPanel } from "../shadowing/RecordingPanel";
import { SelectionPronunciation } from "../ui/SelectionPronunciation";
import styles from "./VocabRootsView.module.css";

const DAY_KEY = "lb.vocabRoots.day";

/** Vocabulary tab for English learners: daily word sets grouped by root, each example sentence is a shadowing item. */
export function VocabRootsView({ uiLang }: { uiLang: UiLang }) {
  const ui = uiLang;
  const l = useCallback((zh: string, ja: string, en?: string) => (ui === "ja" ? ja : ui === "en" ? en ?? zh : zh), [ui]);
  const [days, setDays] = useState<VocabDaySummary[]>([]);
  const [dayNo, setDayNo] = useState<number | null>(null);
  const [day, setDay] = useState<VocabDay | null>(null);
  const [mastered, setMastered] = useState<Set<string>>(new Set());
  const [hideMeaning, setHideMeaning] = useState(false);
  const [onlyUnmastered, setOnlyUnmastered] = useState(false);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [activeShadow, setActiveShadow] = useState<string | null>(null);
  const scopeRef = useRef<HTMLDivElement | null>(null);

  const tts = useSpeechSynthesis("en");
  const recognition = useSpeechRecognition("en", tts.stopSpeaking, l);

  useEffect(() => {
    setMastered(readMastered());
    void loadVocabIndex().then((list) => {
      setDays(list);
      const saved = Number(localStorage.getItem(DAY_KEY));
      setDayNo(list.some((d) => d.day === saved) ? saved : list[0]?.day ?? null);
    });
  }, []);

  useEffect(() => {
    if (dayNo == null) return;
    localStorage.setItem(DAY_KEY, String(dayNo));
    setActiveShadow(null);
    void loadVocabDay(dayNo).then((d) => {
      if (!d) return;
      const map: Record<string, string> = {};
      for (const g of d.groups) for (const w of g.words) { map[w.w] = w.audio; map[w.ex] = w.exAudio; }
      registerPrerecorded(map);
      setDay(d);
    });
  }, [dayNo]);

  useEffect(() => () => stopSpeech(), []);

  const toggleMastered = (w: VocabRootWord) => {
    if (!day) return;
    const k = masteredKey(day.day, w.id);
    const next = new Set(mastered);
    if (next.has(k)) next.delete(k); else next.add(k);
    setMastered(next);
    writeMastered(next);
  };

  const openShadow = (w: VocabRootWord) => {
    recognition.clearRecognition();
    setActiveShadow((cur) => (cur === w.id ? null : w.id));
  };

  const dayMastered = useMemo(
    () => (day ? day.groups.reduce((s, g) => s + g.words.filter((w) => mastered.has(masteredKey(day.day, w.id))).length, 0) : 0),
    [day, mastered],
  );
  const dayTotal = day ? day.groups.reduce((s, g) => s + g.words.length, 0) : 0;

  return (
    <div className={styles.container} ref={scopeRef}>
      <header className={styles.header}>
        <h2>{l("词根背单词", "語根で覚える単語", "Vocabulary by roots")}</h2>
        <p className={styles.subtitle}>
          {l("TOEIC 600–850 高频词 · 按天、按词根分组 · 例句可直接跟读打分",
            "TOEIC 600–850 頻出語 · 日別・語根別 · 例文はそのままシャドーイング採点",
            "TOEIC 600–850 words · grouped by day and root · shadow each example sentence")}
        </p>
      </header>

      <nav className={styles.dayChips} aria-label={l("选择天数", "日を選択", "Choose a day")}>
        {days.map((d) => (
          <button key={d.day} type="button" data-testid={`vocab-day-${d.day}`}
            className={`${styles.dayChip} ${d.day === dayNo ? styles.dayChipActive : ""}`} onClick={() => setDayNo(d.day)}>
            Day {d.day}
          </button>
        ))}
      </nav>

      {day && (
        <>
          <section className={styles.dayHead}>
            <h3>Day {day.day} · {pickTr(day.title, ui)}</h3>
            <p>{pickTr(day.intro, ui)}</p>
            <div className={styles.toolbar}>
              <span className={styles.progress}>{l(`已掌握 ${dayMastered}/${dayTotal}`, `定着 ${dayMastered}/${dayTotal}`, `Mastered ${dayMastered}/${dayTotal}`)}</span>
              <label><input type="checkbox" checked={hideMeaning} onChange={(e) => { setHideMeaning(e.target.checked); setRevealed(new Set()); }} /> {l("遮住释义自测", "意味を隠して自己テスト", "Hide meanings (self-test)")}</label>
              <label><input type="checkbox" checked={onlyUnmastered} onChange={(e) => setOnlyUnmastered(e.target.checked)} /> {l("只看未掌握", "未定着のみ", "Unmastered only")}</label>
            </div>
          </section>

          <section className={styles.rootGrid} aria-label={l("今日词根", "今日の語根", "Today's roots")}>
            {day.roots.map((r) => (
              <article key={r.root} className={styles.rootCard}>
                <div className={styles.rootTitle}><strong>{r.root}</strong><span>{pickTr(r.meaning, ui)}</span></div>
                {r.origin && <p className={styles.origin}>{r.origin}</p>}
                <p className={styles.rootExp}>{pickTr(r.explanation, ui)}</p>
              </article>
            ))}
          </section>

          {day.groups.map((g) => {
            const words = g.words.filter((w) => !onlyUnmastered || !mastered.has(masteredKey(day.day, w.id)));
            if (words.length === 0) return null;
            const root = g.kind === "root" ? day.roots[g.rootIndex] : null;
            return (
              <section key={g.id} className={styles.group} data-testid={`vocab-group-${g.id}`}>
                <h3 className={styles.groupTitle}>
                  {pickTr(g.title, ui)}
                  {root && <span className={styles.groupRoot}>{root.root} = {pickTr(root.meaning, ui)}</span>}
                </h3>
                <div className={styles.words}>
                  {words.map((w) => {
                    const isMastered = mastered.has(masteredKey(day.day, w.id));
                    const hidden = hideMeaning && !revealed.has(w.id);
                    return (
                      <article key={w.id} className={`${styles.word} ${isMastered ? styles.wordMastered : ""}`} data-testid={`vocab-word-${w.id}`}>
                        <div className={styles.wordHead}>
                          <strong className={styles.term}>{w.w}</strong>
                          <span className={styles.pos}>{w.pos}</span>
                          <span className={styles.ipa}>{w.ipa}</span>
                          <button type="button" className={styles.iconBtn} onClick={() => void playSpeech(w.w, "en", tts.speechRate)} aria-label={l(`朗读 ${w.w}`, `${w.w} を再生`, `Play ${w.w}`)}>🔊</button>
                          <button type="button" className={`${styles.masterBtn} ${isMastered ? styles.masterBtnOn : ""}`} onClick={() => toggleMastered(w)}>
                            {isMastered ? l("✓ 已掌握", "✓ 定着", "✓ Mastered") : l("标记掌握", "定着にする", "Mark mastered")}
                          </button>
                        </div>
                        {hidden ? (
                          <button type="button" className={styles.reveal} onClick={() => setRevealed(new Set(revealed).add(w.id))}>{l("点击显示释义", "タップで意味を表示", "Tap to show meaning")}</button>
                        ) : (
                          <>
                            <p className={styles.meaning}>{pickTr(w.meaning, ui)}</p>
                            {w.parts.length > 0 && (
                              <div className={styles.parts}>
                                {w.parts.map((p, i) => (
                                  <span key={i} className={styles.part}><b>{p.text}</b> {pickTr(p, ui)}</span>
                                ))}
                              </div>
                            )}
                            {w.note && <p className={styles.note}>{pickTr(w.note, ui)}</p>}
                            {(w.forms.length > 0 || w.tip) && (
                              <details className={styles.more}>
                                <summary>{l("相关形式与提示", "関連語とヒント", "Related forms & tips")}</summary>
                                <ul>{w.forms.map((f, i) => <li key={i}><b>{f.text}</b> — {pickTr(f, ui)}</li>)}</ul>
                                {w.tip && <p className={styles.tip}>💡 {pickTr(w.tip, ui)}</p>}
                              </details>
                            )}
                          </>
                        )}
                        <div className={styles.example}>
                          <p className={styles.exText}>{w.ex}</p>
                          {!hidden && <p className={styles.exTr}>{pickTr(w.exTr, ui)}</p>}
                          <div className={styles.exActions}>
                            <button type="button" className={styles.smallBtn} onClick={() => void playSpeech(w.ex, "en", tts.speechRate)}>{l("🔊 例句", "🔊 例文", "🔊 Example")}</button>
                            <button type="button" className={`${styles.smallBtn} ${activeShadow === w.id ? styles.smallBtnOn : ""}`} onClick={() => openShadow(w)} data-testid={`vocab-shadow-${w.id}`}>
                              {activeShadow === w.id ? l("收起跟读", "閉じる", "Close") : l("🎙 跟读例句", "🎙 例文をシャドーイング", "🎙 Shadow example")}
                            </button>
                          </div>
                          {activeShadow === w.id && (
                            <RecordingPanel
                              micPermission={recognition.micPermission}
                              isRecording={recognition.isRecording}
                              isSpeaking={tts.isSpeaking}
                              recognizedText={recognition.recognizedText}
                              compareResult={recognition.compareResult}
                              sentenceText={w.ex}
                              trainingLanguage="en"
                              recordingUrl={recognition.recordingUrl}
                              notice={recognition.notice}
                              uiLang={ui}
                              speechRate={tts.speechRate}
                              onStartRecording={recognition.startRecording}
                              onStopRecording={recognition.stopRecording}
                              onDismissMicBanner={recognition.dismissMicBanner}
                              l={l}
                            />
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </>
      )}
      <SelectionPronunciation scopeRef={scopeRef} locale={ui} learningLanguage="en" />
    </div>
  );
}
