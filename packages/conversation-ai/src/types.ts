// ===== Conversation AI Shared Types =====

export interface ConversationScenario {
  id: string;
  title: string;
  titleCn: string;
  description: string;
  context: string;
  difficulty: 1 | 2 | 3;
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

export interface ConversationMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  corrections?: string[];
  suggestions?: string[];
}

export interface ConversationSession {
  scenarioId: string;
  messages: ConversationMessage[];
  startedAt: string;
  score?: number;
  feedback?: string;
}

export interface ConversationReplyInput {
  scenarioId: string;
  text: string;
  history?: string[];
}

export interface ConversationReplyResult {
  content: string;
  corrections: string[];
  suggestions: string[];
}

// ===== Service Configuration =====

export interface ConversationServiceConfig {
  /** Gemini API key. If not provided, falls back to rule-based responses. */
  geminiApiKey?: string;
  /** Override built-in scenarios with custom ones. */
  scenarios?: ConversationScenario[];
  /** Gemini model to use. Default: "gemini-2.0-flash" */
  model?: string;
}
