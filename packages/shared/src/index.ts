/**
 * Canonical command names for learning actions.
 *
 * | Command | Description |
 * |---|---|
 * | `practice:start` | Start a practice session by Part / difficulty |
 * | `diagnostic:start` | Run a diagnostic test to establish baseline |
 * | `mock:start` | Start a full mock exam (200 questions) |
 * | `mistakes:start` | Review and re-practice past errors |
 * | `vocab:start` | Start vocabulary flashcard practice |
 * | `shadowing:start` | Start listening shadowing exercise |
 */
export type LearningActionCommand =
  | "practice:start"
  | "diagnostic:start"
  | "mock:start"
  | "mistakes:start"
  | "vocab:start"
  | "shadowing:start";

/** TOEIC part group discriminator: listening (Parts 1–4) or reading (Parts 5–7). */
export type LearningPartGroup = "listening" | "reading";

/**
 * Filter parameters passed alongside learning actions.
 * All fields are optional — omitting a field means "no filter".
 */
export type SessionFilters = {
  /** TOEIC Part number (1–7). */
  partNo?: number;
  /** Difficulty level. */
  difficulty?: number;
  /** Filter by listening or reading group. */
  partGroup?: LearningPartGroup;
};

// ===== Language Configuration =====

/** Supported UI display languages. */
export type UiLang = "zh" | "ja" | "en";

/** User's native/primary language (determines translation targets). */
export type NativeLang = "zh" | "ja" | "en";

/** Languages available as learning targets. */
export type TargetLang = "en" | "ja";

/**
 * Complete language configuration for a user session.
 * Three independent dimensions:
 * - `uiLang`: what language the interface is rendered in
 * - `nativeLang`: the user's mother tongue (for translation direction)
 * - `targetLang`: what language the user is studying
 */
export type LangConfig = {
  uiLang: UiLang;
  nativeLang: NativeLang;
  targetLang: TargetLang;
};

/** @deprecated Use `UiLang` instead. Kept for backward compatibility during migration. */
export type Locale = "zh" | "ja";

/** Session mode discriminator for different test/practice types. */
export type SessionMode = "diagnostic" | "practice" | "mock";

/**
 * RBAC roles for the multi-tenant system.
 *
 * | Role | Scope |
 * |---|---|
 * | `learner` | Learning features, personal data |
 * | `coach` | Student management, score viewing |
 * | `tenant_admin` | Tenant management, question management |
 * | `super_admin` | Full platform administration |
 */
export type Role = "learner" | "coach" | "tenant_admin" | "super_admin";
