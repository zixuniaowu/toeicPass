// Frontend types for @toeicpass/conversation-ai/web

import type { ConversationScenario, ConversationReplyResult } from "../src/types";

/** API functions that conversation components need — injected by the host app */
export interface ConversationApiFunctions {
  fetchScenarios: () => Promise<ConversationScenario[]>;
  sendReply: (payload: {
    scenarioId: string;
    text: string;
    history: string[];
  }) => Promise<{
    success: boolean;
    content?: string;
    corrections?: string[];
    suggestions?: string[];
    error?: string;
  }>;
}

export interface ConversationViewProps {
  locale: "zh" | "ja";
  api: ConversationApiFunctions;
}

export type { ConversationScenario, ConversationReplyResult };
