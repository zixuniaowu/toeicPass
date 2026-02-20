"use client";

import type { ConversationScenario, ConversationSession } from "../../types";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import styles from "./ConversationView.module.css";

type ConversationViewProps = {
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
  scenarios,
  activeSession,
  isLoading,
  inputText,
  onInputChange,
  onStartSession,
  onSendMessage,
  onEndSession,
}: ConversationViewProps) {
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
          <h2>AI 英语对话练习</h2>
          <p className={styles.subtitle}>选择一个场景，开始和 AI 进行英语对话练习</p>
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
                开始对话练习
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
          结束对话
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
                  <strong>纠错：</strong>
                  <ul>
                    {message.corrections.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}
              {message.suggestions && message.suggestions.length > 0 && (
                <div className={styles.suggestions}>
                  <strong>建议：</strong>
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
            placeholder="用英语输入你的回复..."
            className={styles.textInput}
            disabled={isLoading}
            rows={2}
          />
          <Button type="submit" disabled={!inputText.trim() || isLoading}>
            发送
          </Button>
        </form>
      </Card>

      <div className={styles.tips}>
        <h4>练习技巧</h4>
        <ul>
          <li>像真实对话一样自然地回复</li>
          <li>尽量使用完整的句子来练习</li>
          <li>注意 AI 给出的纠错和建议</li>
          <li>多练习 TOEIC 常见场景用语</li>
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
