export type LearningActionCommand = "practice:start" | "diagnostic:start" | "mock:start" | "mistakes:start" | "vocab:start" | "shadowing:start";
export type LearningPartGroup = "listening" | "reading";
export type SessionFilters = {
    partNo?: number;
    difficulty?: number;
    partGroup?: LearningPartGroup;
};
export type Locale = "zh" | "ja";
export type SessionMode = "diagnostic" | "practice" | "mock";
export type Role = "learner" | "coach" | "tenant_admin" | "super_admin";
