/** Canonical command names for learning actions. */
export type LearningActionCommand =
  | "practice:start"
  | "diagnostic:start"
  | "mock:start"
  | "mistakes:start"
  | "vocab:start"
  | "shadowing:start";

/** Listening / Reading part group discriminator. */
export type LearningPartGroup = "listening" | "reading";

/** Filter parameters passed alongside learning actions. */
export type SessionFilters = {
  partNo?: number;
  difficulty?: number;
  partGroup?: LearningPartGroup;
};

/** Supported UI locales. */
export type Locale = "zh" | "ja";

/** Session modes for practice/diagnostic/mock. */
export type SessionMode = "diagnostic" | "practice" | "mock";

/** RBAC roles. */
export type Role = "learner" | "coach" | "tenant_admin" | "super_admin";
