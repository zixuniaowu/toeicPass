export type { Role } from "@toeicpass/shared";
import type { Role } from "@toeicpass/shared";

export interface Tenant {
  id: string;
  name: string;
  code: string;
  createdAt: string;
}

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  isActive: boolean;
  oauthProvider?: string;
  oauthProviderId?: string;
  createdAt: string;
}

export interface Membership {
  id: string;
  tenantId: string;
  userId: string;
  role: Role;
}

export interface Goal {
  id: string;
  tenantId: string;
  userId: string;
  targetScore: number;
  targetExamDate: string;
  baselineScore?: number;
  createdAt: string;
}

export interface QuestionOption {
  key: "A" | "B" | "C" | "D";
  text: string;
  isCorrect: boolean;
}

export type QuestionSource =
  | "seed"
  | "bank"
  | "official_pack"
  | "admin"
  | "legacy";

export interface Question {
  id: string;
  tenantId: string;
  partNo: number;
  skillTag: string;
  difficulty: number;
  stem: string;
  passage?: string;
  explanation: string;
  mediaUrl?: string;
  imageUrl?: string;
  source?: QuestionSource;
  status: "draft" | "review" | "published" | "archived";
  createdBy?: string;
  createdAt: string;
  options: QuestionOption[];
}

export type AttemptMode = "diagnostic" | "practice" | "mock" | "ip_simulation";

export interface AttemptItem {
  id: string;
  attemptId: string;
  questionId: string;
  selectedKey?: "A" | "B" | "C" | "D";
  isCorrect?: boolean;
  durationMs?: number;
  createdAt: string;
}

export interface Attempt {
  id: string;
  tenantId: string;
  userId: string;
  mode: AttemptMode;
  startedAt: string;
  submittedAt?: string;
  scoreL?: number;
  scoreR?: number;
  scoreTotal?: number;
}

export interface MistakeNote {
  id: string;
  tenantId: string;
  userId: string;
  attemptItemId: string;
  rootCause?: string;
  note: string;
  createdAt: string;
}

export interface ReviewCard {
  id: string;
  tenantId: string;
  userId: string;
  questionId: string;
  easeFactor: number;
  intervalDays: number;
  dueAt: string;
  lastGrade?: number;
}

export interface VocabularyCard {
  id: string;
  tenantId: string;
  userId: string;
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
  cefrLevel?: string;
  difficulty?: number;
  scoreBand?: string;
  createdAt: string;
}

export interface GrammarCard {
  id: string;
  tenantId: string;
  userId: string;
  ruleId: string;
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
  cefrLevel?: string;
  easeFactor: number;
  intervalDays: number;
  dueAt: string;
  lastGrade?: number;
  createdAt: string;
}

export interface ScorePrediction {
  id: string;
  tenantId: string;
  userId: string;
  predictedTotal: number;
  confidence: number;
  factors: Record<string, number>;
  createdAt: string;
}

export interface OrgUnit {
  id: string;
  tenantId: string;
  name: string;
  parentId?: string;
}

export interface IpCampaign {
  id: string;
  tenantId: string;
  name: string;
  mode: "official" | "simulation";
  plannedDate: string;
  status: "draft" | "published" | "closed";
  createdBy: string;
  createdAt: string;
}

export interface IpCandidate {
  id: string;
  tenantId: string;
  campaignId: string;
  employeeNo?: string;
  fullName: string;
  email?: string;
  orgUnitId?: string;
}

export interface IpSession {
  id: string;
  tenantId: string;
  campaignId: string;
  sessionCode: string;
  startsAt: string;
  endsAt: string;
  seatCapacity: number;
  proctorUserId?: string;
}

export interface IpSessionCandidate {
  id: string;
  tenantId: string;
  sessionId: string;
  candidateId: string;
  status: "invited" | "checked_in" | "in_progress" | "submitted" | "absent";
  checkedInAt?: string;
  submittedAt?: string;
}

export interface IpResult {
  id: string;
  tenantId: string;
  campaignId: string;
  candidateId: string;
  source: "official_import" | "simulation_scored";
  scoreL: number;
  scoreR: number;
  scoreTotal: number;
  percentile?: number;
  importedAt: string;
}

export interface AuditLog {
  id: string;
  tenantId?: string;
  actorUserId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  payloadHash: string;
  createdAt: string;
}

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

// ===== Subscription & Monetization =====

export type PlanCode = "free" | "basic" | "premium" | "enterprise";
export type SubscriptionStatus = "active" | "cancelled" | "expired" | "past_due";
export type BillingCycle = "monthly" | "yearly" | "lifetime";

export interface PlanFeatures {
  daily_practice_sessions: number;  // -1 = unlimited
  daily_mock_tests: number;
  daily_questions: number;
  vocab_cards: number;
  ai_conversations: number;
  show_ads: boolean;
  explanation_detail: "basic" | "full";
  score_prediction: boolean;
  export_data: boolean;
}

export interface SubscriptionPlan {
  id: string;
  code: PlanCode;
  nameEn: string;
  nameZh: string;
  nameJa: string;
  priceMonthly: number;   // cents
  priceYearly: number;
  currency: string;
  features: PlanFeatures;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
}

export interface UserSubscription {
  id: string;
  userId: string;
  planId: string;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  startedAt: string;
  expiresAt?: string;
  cancelledAt?: string;
  paymentProvider?: string;
  paymentProviderId?: string;
  createdAt: string;
}

export interface DailyUsage {
  id: string;
  tenantId: string;
  userId: string;
  usageDate: string;
  practiceSessions: number;
  mockTests: number;
  questionsAnswered: number;
  vocabReviews: number;
  aiConversations: number;
}

export type AdSlot = "banner_top" | "interstitial" | "native_feed" | "reward_video";

export interface AdPlacement {
  id: string;
  slot: AdSlot;
  title: string;
  imageUrl?: string;
  linkUrl: string;
  ctaText: string;
  priority: number;
  targetPlans: PlanCode[];
  isActive: boolean;
  impressions: number;
  clicks: number;
  startsAt?: string;
  expiresAt?: string;
  createdAt: string;
}

export interface AdEvent {
  id: string;
  placementId: string;
  userId?: string;
  eventType: "impression" | "click" | "dismiss" | "reward_complete";
  createdAt: string;
}

// ===== Refresh Tokens =====

export interface RefreshTokenRecord {
  /** Opaque random token (stored as bcrypt hash in production; plain here for speed). */
  id: string;
  userId: string;
  /** SHA-256 hex hash of the raw token value. */
  tokenHash: string;
  expiresAt: string;
  /** If true the token has been rotated or explicitly revoked. */
  revoked: boolean;
  createdAt: string;
}
