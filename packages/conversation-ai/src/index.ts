// @toeicpass/conversation-ai — Backend entry point

export { ConversationService } from "./conversation.service";
export { DEFAULT_SCENARIOS } from "./scenarios";

export type {
  ConversationScenario,
  ConversationMessage,
  ConversationSession,
  ConversationReplyInput,
  ConversationReplyResult,
  ConversationServiceConfig,
} from "./types";
