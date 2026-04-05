"use client";

/**
 * Ad provider configuration and slot mapping.
 *
 * The app uses a hybrid approach:
 * 1. Self-serve ads (managed in admin panel) are shown first
 * 2. Google AdSense backfills when no self-serve ad is available
 *
 * Environment variables (set in .env.local):
 *   NEXT_PUBLIC_ADSENSE_CLIENT_ID   — Google AdSense publisher ID (ca-pub-XXX)
 *   NEXT_PUBLIC_ADSENSE_BANNER_SLOT — AdSense slot ID for banner_top
 *   NEXT_PUBLIC_ADSENSE_NATIVE_SLOT — AdSense slot ID for native_feed
 */

export type AdSlotType = "banner_top" | "interstitial" | "native_feed" | "reward_video";

/** AdSense slot IDs mapped to our internal slot types */
export const ADSENSE_SLOTS: Partial<Record<AdSlotType, string>> = {
  banner_top: process.env.NEXT_PUBLIC_ADSENSE_BANNER_SLOT,
  native_feed: process.env.NEXT_PUBLIC_ADSENSE_NATIVE_SLOT,
};

/** Whether AdSense is configured (client ID is set) */
export function isAdSenseEnabled(): boolean {
  return !!process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;
}

/** Get AdSense slot ID for a given slot type, or undefined if not configured */
export function getAdSenseSlot(slot: AdSlotType): string | undefined {
  return ADSENSE_SLOTS[slot];
}
