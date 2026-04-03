"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { ConversationScenario, ConversationSession, Locale } from "../../types";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import styles from "./ConversationView.module.css";

const COPY = {
  zh: {
    heading: "AI 英语对话练习",
    subtitle: "选择一个场景，开始和 AI 进行英语对话练习",
    start: "开始对话练习",
    end: "结束对话",
    corrections: "纠错：",
    suggestions: "建议：",
    placeholderRecording: "正在录音，请讲话...",
    placeholderInput: "用英语输入你的回复或点击录音...",
    stopRec: "⏹️ 停止",
    startRec: "🎤 录音",
    send: "发送",
    tipsTitle: "练习技巧",
    tips: [
      "像真实对话一样自然地回复",
      "尽量使用完整的句子来练习",
      "注意 AI 给出的纠错和建议",
      "多练习 TOEIC 常见场景用语",
    ],
    speechUnsupported: "浏览器不支持语音识别，请使用 Chrome 浏览器",
  },
  ja: {
    heading: "AI 英会話練習",
    subtitle: "シナリオを選んで、AI と英会話を練習しましょう",
    start: "会話を始める",
    end: "会話を終了",
    corrections: "修正：",
    suggestions: "提案：",
    placeholderRecording: "録音中です。話してください...",
    placeholderInput: "英語で返答を入力するか、録音ボタンを押してください...",
    stopRec: "⏹️ 停止",
    startRec: "🎤 録音",
    send: "送信",
    tipsTitle: "練習のコツ",
    tips: [
      "実際の会話のように自然に返答しましょう",
      "できるだけ完全な文で練習しましょう",
      "AI のフィードバックや提案に注目しましょう",
      "TOEIC でよく出るシーン表現を積極的に使いましょう",
    ],
    speechUnsupported: "お使いのブラウザは音声認識に対応していません。Chrome をご利用ください。",
  },
} as const;

type ConversationViewProps = {
  locale: Locale;
  scenarios: ConversationScenario[];
  activeSession: ConversationSession | null;
  isLoading: boolean;
  inputText: string;
  onInputChange: (text: string) => void;
  onStartSession: (scenarioId: string) => void;
  onSendMessage: (text: string) => void;
  onEndSession: () => void;
};

export function ConversationView({
  locale,
  scenarios,
  activeSession,
  isLoading,
  inputText,
  onInputChange,
  onStartSession,
  onSendMessage,
  onEndSession,
}: ConversationViewProps) {
  const t = COPY[locale];
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      return;
    }

    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      alert(t.speechUnsupported);
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsRecording(true);
      onInputChange("");
    };

    recognition.onresult = (event: any) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      onInputChange(transcript);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [isRecording, onInputChange]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim() && !isLoading) {
      onSendMessage(inputText);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (inputText.trim() && !isLoading) {
        onSendMessage(inputText);
      }
    }
  };

  if (!activeSession) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h2>{t.heading}</h2>
          <p className={styles.subtitle}>{t.subtitle}</p>
        </div>

        <div className={styles.scenarioGrid}>
          {scenarios.map((scenario) => (
            <Card key={scenario.id} className={styles.scenarioCard}>
              <div className={styles.scenarioHeader}>
                <h3>{scenario.title}</h3>
                <span className={styles.titleCn}>{scenario.titleCn}</span>
              </div>
              <p className={styles.description}>{scenario.description}</p>
              <div className={styles.scenarioMeta}>
                <Badge variant={getDifficultyVariant(scenario.difficulty)}>
                  {getDifficultyLabel(scenario.difficulty)}
                </Badge>
                <Badge variant="info">{getCategoryLabel(scenario.category)}</Badge>
              </div>
              <Button onClick={() => onStartSession(scenario.id)} className={styles.startBtn}>
                {t.start}
              </Button>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const scenario = scenarios.find((s) => s.id === activeSession.scenarioId);
  const visibleMessages = activeSession.messages.filter((m) => m.role !== "system");

  return (
    <div className={styles.container}>
      <div className={styles.sessionHeader}>
        <div className={styles.sessionInfo}>
          <h2>{scenario?.title || "Conversation"}</h2>
          <span className={styles.titleCn}>{scenario?.titleCn}</span>
        </div>
        <Button variant="secondary" onClick={onEndSession}>
          {t.end}
        </Button>
      </div>

      <Card className={styles.chatContainer}>
        <div className={styles.messageList}>
          {visibleMessages.map((message) => (
            <div
              key={message.id}
              className={`${styles.message} ${message.role === "user" ? styles.userMessage : styles.assistantMessage}`}
            >
              <div className={styles.messageContent}>{message.content}</div>
              {message.corrections && message.corrections.length > 0 && (
                <div className={styles.corrections}>
                  <strong>{t.corrections}</strong>
                  <ul>
                    {message.corrections.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}
              {message.suggestions && message.suggestions.length > 0 && (
                <div className={styles.suggestions}>
                  <strong>{t.suggestions}</strong>
                  <ul>
                    {message.suggestions.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
          {isLoading && (
            <div className={`${styles.message} ${styles.assistantMessage}`}>
              <div className={styles.typing}>
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className={styles.inputForm}>
          <textarea
            value={inputText}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isRecording ? t.placeholderRecording : t.placeholderInput}
            className={styles.textInput}
            disabled={isLoading}
            rows={2}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <Button 
              type="button" 
              variant={isRecording ? "destructive" : "secondary"} 
              onClick={toggleRecording}
              disabled={isLoading}
            >
              {isRecording ? t.stopRec : t.startRec}
            </Button>
            <Button type="submit" disabled={!inputText.trim() || isLoading}>
              {t.send}
            </Button>
          </div>
        </form>
      </Card>

      <div className={styles.tips}>
        <h4>{t.tipsTitle}</h4>
        <ul>
          {t.tips.map((tip, i) => (
            <li key={i}>{tip}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function getDifficultyVariant(difficulty: number): "success" | "warning" | "error" {
  switch (difficulty) {
    case 1:
      return "success";
    case 2:
      return "warning";
    case 3:
      return "error";
    default:
      return "success";
  }
}

function getDifficultyLabel(difficulty: number): string {
  switch (difficulty) {
    case 1:
      return "Easy";
    case 2:
      return "Medium";
    case 3:
      return "Hard";
    default:
      return "Easy";
  }
}

function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    office: "Office",
    restaurant: "Dining",
    airport: "Travel",
    hotel: "Hotel",
    shopping: "Shopping",
    meeting: "Business",
    phone: "Phone",
    interview: "Interview",
  };
  return labels[category] || category;
}
