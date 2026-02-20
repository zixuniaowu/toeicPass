// Session and Authentication Types
export type LoginResponse = { accessToken: string };
export type SessionMode = "diagnostic" | "practice" | "mock";
export type ViewTab = "dashboard" | "listening" | "grammar" | "textcompletion" | "reading" | "conversation" | "shadowing" | "mock" | "review" | "mistakes" | "vocab" | "settings";
export type OptionKey = "A" | "B" | "C" | "D";
export type SessionFilters = { partNo?: number; difficulty?: number };

// Question Types
export type SessionQuestion = {
  id: string;
  stem: string;
  partNo: number;
  mediaUrl?: string;
  imageUrl?: string;
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
};

// Task Types
export type NextTask = {
  id: string;
  title: string;
  reason: string;
  action: string;
  priority: number;
};

export type DueCard = {
  question?: {
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

export const TABS: Array<{ key: ViewTab; label: string }> = [
  { key: "dashboard", label: "概览" },
  { key: "listening", label: "听力" },
  { key: "grammar", label: "语法填空" },
  { key: "textcompletion", label: "段落填空" },
  { key: "reading", label: "阅读理解" },
  { key: "conversation", label: "AI对话" },
  { key: "shadowing", label: "跟读练习" },
  { key: "mock", label: "模拟考试" },
  { key: "review", label: "复盘" },
  { key: "mistakes", label: "错题库" },
  { key: "vocab", label: "背单词" },
  { key: "settings", label: "设置" },
];

export const ROOT_CAUSE_OPTIONS = [
  { value: "", label: "未标注" },
  { value: "vocab", label: "词汇" },
  { value: "grammar", label: "语法" },
  { value: "logic", label: "逻辑理解" },
  { value: "careless", label: "粗心" },
] as const;

// Conversation Types
export type ConversationScenario = {
  id: string;
  title: string;
  titleCn: string;
  description: string;
  context: string;
  difficulty: 1 | 2 | 3;
  category: "office" | "restaurant" | "airport" | "hotel" | "shopping" | "meeting" | "phone" | "interview";
};

export type ConversationMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  corrections?: string[];
  suggestions?: string[];
};

export type ConversationSession = {
  scenarioId: string;
  messages: ConversationMessage[];
  startedAt: string;
  score?: number;
  feedback?: string;
};

// Utility functions
export const isListeningPart = (partNo: number): boolean => partNo >= 1 && partNo <= 4;
export const toErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
