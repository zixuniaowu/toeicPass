// ===== Ad System Shared Types =====

/** Available ad slot positions. */
export type AdSlot = "banner_top" | "interstitial" | "native_feed" | "reward_video";

/** Tracked ad event types. */
export type AdEventType = "impression" | "click" | "dismiss" | "reward_complete";

/** A single ad placement record. */
export interface AdPlacement {
  /** Unique placement identifier. */
  id: string;
  /** Ad slot position. */
  slot: AdSlot;
  /** Ad title displayed to users. */
  title: string;
  /** Optional image URL for the ad creative. */
  imageUrl?: string;
  /** Destination URL when the ad is clicked. */
  linkUrl: string;
  /** Call-to-action button text. */
  ctaText: string;
  /** Display priority (higher = shown first). */
  priority: number;
  /** User plan codes this ad targets (e.g. `["free", "basic"]`). */
  targetPlans: string[];
  /** Whether this placement is currently active. */
  isActive: boolean;
  /** Cumulative impression count. */
  impressions: number;
  /** Cumulative click count. */
  clicks: number;
  /** ISO 8601 start time for time-windowed delivery. */
  startsAt?: string;
  /** ISO 8601 end time for time-windowed delivery. */
  expiresAt?: string;
  /** ISO 8601 creation timestamp. */
  createdAt: string;
}

/** A recorded ad event (impression, click, etc.). */
export interface AdEvent {
  /** Unique event identifier. */
  id: string;
  /** ID of the associated ad placement. */
  placementId: string;
  /** ID of the user who triggered the event (if known). */
  userId?: string;
  /** Type of event recorded. */
  eventType: AdEventType;
  /** ISO 8601 timestamp when the event occurred. */
  createdAt: string;
}

/** Aggregated ad analytics. */
export interface AdStats {
  /** Total number of ad placements. */
  totalPlacements: number;
  /** Number of currently active placements. */
  activePlacements: number;
  /** Total impressions across all placements. */
  totalImpressions: number;
  /** Total clicks across all placements. */
  totalClicks: number;
  /** Click-through rate as a percentage (e.g. 2.35). */
  ctr: number;
  /** Per-slot breakdown of counts, impressions, and clicks. */
  bySlot: Record<string, { count: number; impressions: number; clicks: number }>;
  /** Last 50 events in reverse chronological order. */
  recentEvents: Array<{ id: string; placementId: string; eventType: string; createdAt: string }>;
}

// ===== Store Interface (host app implements this) =====

/**
 * Storage abstraction that the host application must implement.
 * Provides mutable arrays for placements and events, plus a persist callback.
 */
export interface IAdStore {
  /** Mutable array of all ad placements. */
  adPlacements: AdPlacement[];
  /** Mutable array of all recorded ad events. */
  adEvents: AdEvent[];
  /** Called after mutations to persist the current state. */
  persistSnapshot(): void;
}

// ===== Service Configuration =====

/** Optional configuration for {@link AdService}. */
export interface AdServiceConfig {
  /** Function to generate unique IDs. Default: crypto.randomUUID() */
  generateId?: () => string;
  /** Function to get current ISO timestamp. Default: new Date().toISOString() */
  nowIso?: () => string;
}

// ===== DTO shapes (plain objects — host app adds validation decorators) =====

/** Input for creating a new ad placement. */
export interface CreateAdInput {
  /** Ad slot type (e.g. "banner_top"). */
  slot: string;
  /** Ad title. */
  title: string;
  /** Optional image URL. */
  imageUrl?: string;
  /** Click destination URL. */
  linkUrl: string;
  /** CTA button text. */
  ctaText: string;
  /** Display priority (higher = shown first). */
  priority: number;
  /** Target user plans (e.g. ["free"]). */
  targetPlans: string[];
  /** Optional ISO 8601 delivery start time. */
  startsAt?: string;
  /** Optional ISO 8601 delivery end time. */
  expiresAt?: string;
}

/** Input for updating an existing ad placement. All fields optional. */
export interface UpdateAdInput {
  slot?: string;
  title?: string;
  imageUrl?: string;
  linkUrl?: string;
  ctaText?: string;
  priority?: number;
  targetPlans?: string[];
  isActive?: boolean;
  startsAt?: string;
  expiresAt?: string;
}

/** Input for recording an ad event. */
export interface RecordAdEventInput {
  /** ID of the ad placement this event is for. */
  placementId: string;
  /** Type of event to record. */
  eventType: AdEventType;
}
