// ===== Conversation AI Shared Types =====

/**
 * A conversation practice scenario definition.
 * Each scenario provides context for the AI to role-play a specific TOEIC-relevant situation.
 */
export interface ConversationScenario {
  /** Unique scenario identifier (e.g. "office-meeting"). */
  id: string;
  /** English title. */
  title: string;
  /** Chinese title. */
  titleCn: string;
  /** Brief description of the scenario for display. */
  description: string;
  /** Detailed context used in the AI system prompt. */
  context: string;
  /** Difficulty level: 1 (easy), 2 (medium), 3 (hard). */
  difficulty: 1 | 2 | 3;
  /** Scenario category, used for rule-based response selection. */
  category:
    | "office"
    | "restaurant"
    | "airport"
    | "hotel"
    | "shopping"
    | "meeting"
    | "phone"
    | "interview";
}

/** A single message in a conversation, with optional corrections and suggestions. */
export interface ConversationMessage {
  /** Unique message identifier. */
  id: string;
  /** Who sent this message. */
  role: "user" | "assistant" | "system";
  /** Message text content. */
  content: string;
  /** ISO 8601 timestamp. */
  timestamp: string;
  /** Grammar corrections for the user's input (if any). */
  corrections?: string[];
  /** Improvement suggestions (if any). */
  suggestions?: string[];
}

/** A full conversation session record. */
export interface ConversationSession {
  /** Scenario this session belongs to. */
  scenarioId: string;
  /** Ordered list of messages in the session. */
  messages: ConversationMessage[];
  /** ISO 8601 session start time. */
  startedAt: string;
  /** Optional overall session score. */
  score?: number;
  /** Optional summary feedback for the session. */
  feedback?: string;
}

/** Input DTO for {@link ConversationService.generateReply}. */
export interface ConversationReplyInput {
  /** ID of the active scenario. */
  scenarioId: string;
  /** The user's text input. */
  text: string;
  /** Previous messages as alternating user/assistant strings. */
  history?: string[];
}

/** Result from {@link ConversationService.generateReply}. */
export interface ConversationReplyResult {
  /** The AI or rule-engine's response text. */
  content: string;
  /** Grammar corrections (empty array if none). */
  corrections: string[];
  /** Improvement suggestions (empty array if none). */
  suggestions: string[];
}

// ===== Service Configuration =====

/** Configuration for {@link ConversationService}. */
export interface ConversationServiceConfig {
  /** Gemini API key. If not provided, falls back to rule-based responses. */
  geminiApiKey?: string;
  /** Override built-in scenarios with custom ones. */
  scenarios?: ConversationScenario[];
  /** Gemini model to use. Default: "gemini-2.0-flash" */
  model?: string;
}
