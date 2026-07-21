import type {
  LangConfig as _LangConfig,
  Locale as _Locale,
  NativeLang as _NativeLang,
  SessionFilters as _SessionFilters,
  SessionMode as _SessionMode,
  ShadowingAttemptMetrics as _ShadowingAttemptMetrics,
  TargetLang as _TargetLang,
  UiLang as _UiLang,
} from "@toeicpass/shared";

export type Locale = _Locale;
export type SessionMode = _SessionMode;
export type SessionFilters = _SessionFilters;
export type UiLang = _UiLang;
export type NativeLang = _NativeLang;
export type TargetLang = _TargetLang;
export type LangConfig = _LangConfig;
export type ShadowingAttemptMetrics = _ShadowingAttemptMetrics;

export type LoginResponse = {
  accessToken: string;
  refreshToken?: string;
  tenantCode: string;
};

export type OptionKey = "A" | "B" | "C" | "D";

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

export type SubmitReport = {
  scoreTotal: number;
  scoreL: number;
  scoreR: number;
  correct: number;
  answered: number;
  review: ReviewItem[];
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

export type NextTask = {
  id: string;
  title: string;
  reason: string;
  action: string;
  priority: number;
};

export type DailyPlanChecklistItem = {
  id: string;
  label: string;
  detail?: string;
  questionId?: string;
  partNo?: number | null;
};

export type DailyPlanBlock = {
  id: string;
  title: string;
  minutes: number;
  reason: string;
  action: string;
  checklist?: DailyPlanChecklistItem[];
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

export type MistakeNote = {
  note: string;
  rootCause: string | null;
  createdAt: string;
};

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

export type VocabCardTranslations = {
  definition?: Partial<Record<"zh" | "ja" | "en", string>>;
  example?: Partial<Record<"zh" | "ja" | "en", string>>;
};

export type VocabCard = {
  id: string;
  term: string;
  pos: string;
  definition: string;
  example: string;
  sourcePart: number;
  tags: string[];
  scoreBand?: string;
  targetLanguage?: "en" | "ja";
  easeFactor: number;
  intervalDays: number;
  dueAt: string;
  lastGrade?: number;
  due: boolean;
  translations?: VocabCardTranslations;
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

export type GrammarCard = {
  id: string;
  ruleId: string;
  targetLanguage?: "en" | "ja";
  jlptLevel?: string;
  title: string;
  titleCn: string;
  titleJa: string;
  category: string;
  explanation: string;
  explanationCn: string;
  explanationJa: string;
  examples: string[];
  sourcePart: number;
  difficulty: number;
  easeFactor: number;
  intervalDays: number;
  dueAt: string;
  lastGrade?: number;
  due: boolean;
};

export type GrammarSummary = {
  total: number;
  due: number;
  learning: number;
  mastered: number;
};

export type GrammarPayload = {
  summary: GrammarSummary;
  cards: GrammarCard[];
};

export const ROOT_CAUSE_OPTIONS = [
  { value: "", label: "unlabeled" },
  { value: "vocab", label: "vocabulary" },
  { value: "grammar", label: "grammar" },
  { value: "logic", label: "logic" },
  { value: "careless", label: "careless" },
] as const;

export type RootCauseValue = (typeof ROOT_CAUSE_OPTIONS)[number]["value"];

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
export type { ConversationScenario, ConversationMessage, ConversationSession } from "@toeicpass/conversation-ai";
