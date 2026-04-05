"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ConversationScenario } from "../src/types";
import type { ConversationViewProps } from "./types";
import styles from "./ConversationView.module.css";

type ChatMessage = {
  id: number;
  role: "user" | "ai";
  text: string;
  corrections?: string[];
  suggestions?: string[];
};

const I18N = {
  zh: {
    title: "AI 语音对话",
    subtitle: "选择主题，按住麦克风用英语和 AI 聊天",
    hold: "按住说话",
    release: "松开发送",
    listening: "正在听...",
    thinking: "AI 回复中...",
    tapHint: "轻触麦克风开始对话",
    corrections: "纠正",
    suggestions: "建议",
    back: "返回",
    noMic: "浏览器不支持语音识别",
    micDenied: "请允许麦克风权限",
  },
  ja: {
    title: "AI 音声会話",
    subtitle: "トピックを選んで、マイクを押して英語で話そう",
    hold: "押して話す",
    release: "離して送信",
    listening: "聞いています...",
    thinking: "AI 返信中...",
    tapHint: "マイクをタップして会話開始",
    corrections: "修正",
    suggestions: "アドバイス",
    back: "戻る",
    noMic: "音声認識がサポートされていません",
    micDenied: "マイク権限を許可してください",
  },
};

const TOPIC_ICONS: Record<string, string> = {
  office: "🏢", restaurant: "🍽️", airport: "✈️", hotel: "🏨",
  phone: "📞", interview: "💼", meeting: "📊", shopping: "🛍️",
};

let msgId = 0;

export function ConversationView({ locale, api }: ConversationViewProps) {
  const t = I18N[locale] ?? I18N.zh;

  const [scenarios, setScenarios] = useState<ConversationScenario[]>([]);
  const [active, setActive] = useState<ConversationScenario | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [recording, setRecording] = useState(false);
  const [interim, setInterim] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    void api.fetchScenarios().then(setScenarios);
  }, [api]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, interim, aiLoading]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const speak = useCallback((text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = "en-US";
    utt.rate = 0.9;
    utterRef.current = utt;
    window.speechSynthesis.speak(utt);
  }, []);

  const sendText = useCallback(async (text: string) => {
    if (!text.trim() || !active) return;
    const userMsg: ChatMessage = { id: ++msgId, role: "user", text: text.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setAiLoading(true);

    const history = messages.map((m) => m.text);
    const result = await api.sendReply(
      { scenarioId: active.id, text: text.trim(), history },
    );
    setAiLoading(false);

    if (result.success && result.content) {
      const aiMsg: ChatMessage = {
        id: ++msgId,
        role: "ai",
        text: result.content,
        corrections: result.corrections,
        suggestions: result.suggestions,
      };
      setMessages((prev) => [...prev, aiMsg]);
      speak(result.content);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, messages, api, speak]);

  const startListening = useCallback(() => {
    if (typeof window === "undefined") return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setMicError(t.noMic); return; }

    const rec = new SR();
    rec.lang = "en-US";
    rec.continuous = false;
    rec.interimResults = true;
    recognitionRef.current = rec;

    rec.onstart = () => { setRecording(true); setInterim(""); setMicError(null); };

    rec.onresult = (e: SpeechRecognitionEvent) => {
      let final = "";
      let partial = "";
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          final += e.results[i][0].transcript;
        } else {
          partial += e.results[i][0].transcript;
        }
      }
      if (final) {
        setInterim("");
        void sendText(final);
      } else {
        setInterim(partial);
      }
    };

    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      setRecording(false);
      if (e.error === "not-allowed") setMicError(t.micDenied);
    };

    rec.onend = () => { setRecording(false); };

    try { rec.start(); } catch { setMicError(t.noMic); }
  }, [t, sendText]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const selectTopic = useCallback((sc: ConversationScenario) => {
    setActive(sc);
    setMessages([]);
    setInterim("");
    setMicError(null);
  }, []);

  const goBack = useCallback(() => {
    recognitionRef.current?.abort();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setActive(null);
    setMessages([]);
  }, []);

  // ── Topic selection ──
  if (!active) {
    return (
      <div className={styles.page}>
        <div className={styles.topicHeader}>
          <h1 className={styles.pageTitle}>{t.title}</h1>
          <p className={styles.pageSubtitle}>{t.subtitle}</p>
        </div>
        <div className={styles.topicGrid}>
          {scenarios.map((sc) => (
            <button key={sc.id} className={styles.topicCard} onClick={() => selectTopic(sc)}>
              <span className={styles.topicIcon}>{TOPIC_ICONS[sc.category] ?? "💬"}</span>
              <span className={styles.topicName}>{locale === "ja" ? sc.title : sc.titleCn}</span>
              <span className={styles.topicDesc}>{sc.description}</span>
              <span className={styles.topicDiff} data-diff={sc.difficulty} />
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Voice chat ──
  return (
    <div className={styles.chatPage}>
      <div className={styles.chatTopBar}>
        <button className={styles.backBtn} onClick={goBack}>← {t.back}</button>
        <div className={styles.chatTopInfo}>
          <span className={styles.topicEmoji}>{TOPIC_ICONS[active.category] ?? "💬"}</span>
          <span className={styles.chatTopTitle}>{locale === "ja" ? active.title : active.titleCn}</span>
        </div>
        <div style={{ width: 60 }} />
      </div>

      <div className={styles.contextHint}>{active.context}</div>

      <div className={styles.chatArea}>
        {messages.length === 0 && !recording && !aiLoading && (
          <div className={styles.emptyState}>{t.tapHint}</div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`${styles.bubble} ${msg.role === "user" ? styles.userBubble : styles.aiBubble}`}>
            <p className={styles.bubbleText}>{msg.text}</p>
            {msg.role === "ai" && msg.corrections && msg.corrections.length > 0 && (
              <div className={styles.feedbackBlock}>
                <span className={styles.feedbackLabel}>🔴 {t.corrections}</span>
                {msg.corrections.map((c, i) => <p key={i} className={styles.feedbackItem}>{c}</p>)}
              </div>
            )}
            {msg.role === "ai" && msg.suggestions && msg.suggestions.length > 0 && (
              <div className={styles.feedbackBlock}>
                <span className={styles.feedbackLabel}>💡 {t.suggestions}</span>
                {msg.suggestions.map((s, i) => <p key={i} className={styles.feedbackItem}>{s}</p>)}
              </div>
            )}
          </div>
        ))}

        {interim && (
          <div className={`${styles.bubble} ${styles.userBubble} ${styles.interimBubble}`}>
            <p className={styles.bubbleText}>{interim}</p>
          </div>
        )}

        {aiLoading && (
          <div className={`${styles.bubble} ${styles.aiBubble}`}>
            <div className={styles.typingDots}><span /><span /><span /></div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      <div className={styles.micArea}>
        {micError && <p className={styles.micError}>{micError}</p>}
        <button
          className={`${styles.micBtn} ${recording ? styles.micActive : ""}`}
          onPointerDown={startListening}
          onPointerUp={stopListening}
          onPointerLeave={stopListening}
          disabled={aiLoading}
        >
          <svg className={styles.micIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="1" width="6" height="12" rx="3" />
            <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        </button>
        <p className={styles.micLabel}>
          {recording ? t.release : aiLoading ? t.thinking : t.hold}
        </p>
      </div>
    </div>
  );
}
