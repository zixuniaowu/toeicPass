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

// ===== Shadowing Engine =====

/** A single word annotation in a transcript line. */
export interface FuriganaSegment {
  /** Original surface form (may include kanji). */
  surface: string;
  /** Phonetic reading in hiragana (Japanese) or IPA string (English). */
  reading: string;
  /** Whether this segment carries an IPA transcription instead of furigana. */
  isIpa?: boolean;
}

/** One timestamped cue in a transcript. */
export interface TranscriptLine {
  /** Start time in seconds relative to the audio/video. */
  startSec: number;
  /** End time in seconds. */
  endSec: number;
  /** Raw text for this cue. */
  text: string;
  /**
   * Optional word-level phonetic annotations.
   * For Japanese: furigana segments.
   * For English: IPA segments.
   */
  annotations?: FuriganaSegment[];
}

/** Supported audio/video source kinds for shadowing content. */
export type ShadowingSourceKind =
  | "youtube"      // YouTube video by videoId
  | "database"     // Stored in the app's question / media database
  | "local_file"   // Uploaded local audio/video file
  | "tts";         // Generated text-to-speech audio

/**
 * Canonical content descriptor for the Shadowing Engine.
 *
 * All shadowing exercises must map their data to this interface so the
 * `useShadowingEngine` hook can process them uniformly regardless of source.
 */
export interface IShadowingContent {
  /** Stable unique identifier for this content item. */
  id: string;

  /** Display title shown in the practice UI. */
  title: string;

  /** Short description or topic label. */
  description?: string;

  /** Primary language of the spoken content. */
  language: "en" | "ja";

  /** Where this content comes from. */
  sourceKind: ShadowingSourceKind;

  /**
   * Audio URL or YouTube video ID depending on `sourceKind`.
   * - `youtube`: YouTube video ID (e.g. `"dQw4w9WgXcQ"`)
   * - `database` / `local_file` / `tts`: Absolute or relative audio URL
   */
  audioRef: string;

  /** Full ordered transcript. */
  transcript: TranscriptLine[];

  /**
   * Total duration in seconds.
   * Required when `sourceKind !== 'youtube'`.
   */
  durationSec?: number;

  /** CEFR or TOEIC band difficulty label (e.g. "B1", "700"). */
  difficultyLabel?: string;

  /** Thumbnail image URL shown in the content picker. */
  thumbnailUrl?: string;

  /** Arbitrary tags for filtering (e.g. ["business", "part2"]). */
  tags?: string[];
}

// ===== Score Calculation =====

/** Raw metrics collected by the recording engine for a single shadowing attempt. */
export interface ShadowingAttemptMetrics {
  /**
   * Pronunciation score: 0–100.
   * Derived from phoneme-level comparison between the user's speech and reference.
   */
  pronunciationScore: number;

  /**
   * Fluency score: 0–100.
   * Based on speaking rate, pause distribution, and hesitation count.
   */
  fluencyScore: number;

  /**
   * Completeness score: 0–100.
   * Percentage of reference words that the user successfully produced.
   */
  completenessScore: number;

  /** Words per minute (user's speaking rate). */
  wpm?: number;

  /** Number of pause events detected (silence > 500 ms in mid-sentence). */
  pauseCount?: number;
}
