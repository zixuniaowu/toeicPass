"use client";

import { useMemo } from "react";
import type { Locale } from "../../types";
import * as api from "../../lib/api";
import { ConversationView as ConversationViewBase } from "@toeicpass/conversation-ai/web";
import type { ConversationApiFunctions } from "@toeicpass/conversation-ai/web";

interface ConversationViewProps {
  locale: Locale;
  token: string;
  tenantCode: string;
}

export function ConversationView({ locale, token, tenantCode }: ConversationViewProps) {
  const conversationApi = useMemo<ConversationApiFunctions>(() => {
    const opts = { token, tenantCode };
    return {
      fetchScenarios: () => api.fetchConversationScenarios(opts),
      sendReply: (payload) => api.fetchConversationReply(payload, opts),
    };
  }, [token, tenantCode]);

  return <ConversationViewBase locale={locale} api={conversationApi} />;
}
