export type Role = "learner" | "coach" | "tenant_admin" | "super_admin";

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
