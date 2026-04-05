// Re-export shared types as canonical source
import type { Locale as _Locale, SessionMode as _SessionMode, SessionFilters as _SessionFilters } from "@toeicpass/shared";
export type Locale = _Locale;
export type SessionMode = _SessionMode;
export type SessionFilters = _SessionFilters;
export type LoginResponse = { accessToken: string; tenantCode: string };
export type ViewTab = "dashboard" | "listening" | "grammar" | "textcompletion" | "reading" | "shadowing" | "mock" | "mistakes" | "vocab" | "writing" | "conversation" | "settings" | "subscription" | "admin";
export type OptionKey = "A" | "B" | "C" | "D";

// Question Types
export type SessionQuestion = {
  id: string;
  stem: string;
  passage?: string;
  partNo: number;
  mediaUrl?: string;
  imageUrl?: string;
  explanation?: string;
  correctKey?: OptionKey | null;
  options: Array<{ key: OptionKey; text: string }>;
};

export type ActiveSession = {
  mode: SessionMode;
  attemptId: string;
  questions: SessionQuestion[];
};

// Report Types
export type SubmitReport = {
  scoreTotal: number;
  scoreL: number;
  scoreR: number;
  correct: number;
  answered: number;
  review: ReviewItem[];
};

export type ReviewItem = {
  questionId: string;
  partNo: number | null;
  stem: string;
  mediaUrl?: string | null;
  imageUrl?: string | null;
  selectedKey: OptionKey | null;
  correctKey: OptionKey | null;
  isCorrect: boolean;
  explanation: string;
};

// Analytics Types
export type AnalyticsOverview = {
  attempts: number;
  questionsAnswered: number;
  overallAccuracy: number;
  avgDurationMs: number;
  latestScore: number | null;
  scoreHistory: number[];
  activeDays7: number;
  currentStreak: number;
  studyMinutes7: number;
  modeBreakdown: {
    diagnostic: number;
    practice: number;
    mock: number;
    ip_simulation: number;
  };
  goalPace: {
    daysToExam: number | null;
    requiredWeeklyGain: number | null;
    status: "no_goal" | "on_track" | "at_risk" | "critical";
  };
  byPart: PartAnalytics[];
  goal: GoalInfo;
};

export type PartAnalytics = {
  partNo: number;
  answered: number;
  correct: number;
  accuracy: number;
  avgDurationMs: number;
};

export type GoalInfo = {
  targetScore: number | null;
  gap: number | null;
  targetExamDate: string | null;
  baselineScore?: number | null;
};

// Task Types
export type NextTask = {
  id: string;
  title: string;
  reason: string;
  action: string;
  priority: number;
};

export type DailyPlanBlock = {
  id: string;
  title: string;
  minutes: number;
  reason: string;
  action: string;
  checklist?: DailyPlanChecklistItem[];
};

export type DailyPlanChecklistItem = {
  id: string;
  label: string;
  detail?: string;
  questionId?: string;
  partNo?: number | null;
};

export type WeeklyPlanTask = {
  id: string;
  title: string;
  minutes: number;
  action: string;
  previews: string[];
};

export type WeeklyPlanDay = {
  date: string;
  dayLabel: string;
  totalMinutes: number;
  tasks: WeeklyPlanTask[];
};

export type DailyPlan = {
  generatedAt: string;
  totalMinutes: number;
  focusPart: number | null;
  blocks: DailyPlanBlock[];
  weekSchedule?: WeeklyPlanDay[];
};

export type DueCard = {
  questionId?: string;
  question?: {
    id?: string;
    partNo?: number;
  };
};

// Mistake Types
export type MistakeLibraryItem = {
  questionId: string;
  partNo: number | null;
  stem: string;
  explanation: string;
  mediaUrl?: string | null;
  imageUrl?: string | null;
  options: Array<{ key: OptionKey; text: string }>;
  correctKey: OptionKey | null;
  wrongCount: number;
  latestAttemptItemId: string;
  lastSelectedKey: OptionKey | null;
  lastWrongAt: string;
  latestNote: MistakeNote | null;
};

export type MistakeNote = {
  note: string;
  rootCause: string | null;
  createdAt: string;
};

// Vocabulary Types
export type VocabCard = {
  id: string;
  term: string;
  pos: string;
  definition: string;
  example: string;
  sourcePart: number;
  tags: string[];
  scoreBand?: string;
  easeFactor: number;
  intervalDays: number;
  dueAt: string;
  lastGrade?: number;
  due: boolean;
};

export type VocabSummary = {
  total: number;
  due: number;
  learning: number;
  mastered: number;
};

export type VocabularyPayload = {
  summary: VocabSummary;
  cards: VocabCard[];
};

// Constants
export const LISTENING_PARTS = [1, 2, 3, 4] as const;
export const READING_PARTS = [5, 6, 7] as const;
export const ALL_PARTS = [1, 2, 3, 4, 5, 6, 7] as const;
export const DIFFICULTY_OPTIONS = [1, 2, 3, 4, 5] as const;

export const TABS: Array<{ key: ViewTab; label: string; group?: string }> = [
  { key: "shadowing", label: "跟读练习", group: "practice" },
  { key: "mock", label: "模拟考试", group: "practice" },
  { key: "grammar", label: "语法练习", group: "practice" },
  { key: "conversation", label: "AI对话", group: "practice" },
  { key: "mistakes", label: "错题集", group: "review" },
  { key: "vocab", label: "背单词", group: "review" },
  { key: "subscription", label: "会员", group: "system" },
  { key: "admin", label: "广告管理", group: "system" },
  { key: "settings", label: "设置", group: "system" },
];

export const ROOT_CAUSE_OPTIONS = [
  { value: "", label: "未标注" },
  { value: "vocab", label: "词汇" },
  { value: "grammar", label: "语法" },
  { value: "logic", label: "逻辑理解" },
  { value: "careless", label: "粗心" },
] as const;

// Conversation Types
export type { ConversationScenario, ConversationMessage, ConversationSession } from "@toeicpass/conversation-ai";

// Utility functions
export const isListeningPart = (partNo: number): boolean => partNo >= 1 && partNo <= 4;
export const toErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

// ===== Subscription & Monetization =====

export type PlanCode = "free" | "basic" | "premium" | "enterprise";

export type PlanFeatures = {
  daily_practice_sessions: number;
  daily_mock_tests: number;
  daily_questions: number;
  vocab_cards: number;
  ai_conversations: number;
  show_ads: boolean;
  explanation_detail: "basic" | "full";
  score_prediction: boolean;
  export_data: boolean;
};

export type SubscriptionPlan = {
  id: string;
  code: PlanCode;
  nameEn: string;
  nameZh: string;
  nameJa: string;
  priceMonthly: number;
  priceYearly: number;
  currency: string;
  features: PlanFeatures;
  sortOrder: number;
};

export type UserProfile = {
  id: string;
  email: string;
  displayName: string;
  roles: string[];
  tenantId: string;
  plan: {
    code: PlanCode;
    name: string;
    features: PlanFeatures;
    expiresAt?: string;
    billingCycle?: string;
  };
  usage: {
    practiceSessions: { used: number; limit: number };
    mockTests: { used: number; limit: number };
    questionsAnswered: { used: number; limit: number };
    vocabReviews: { used: number; limit: number };
    aiConversations: { used: number; limit: number };
  };
};

export type { AdPlacement } from "@toeicpass/ad-system";
