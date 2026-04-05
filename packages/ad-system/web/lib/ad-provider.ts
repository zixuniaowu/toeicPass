"use client";

/**
 * Ad provider configuration and slot mapping.
 * Hybrid approach: self-serve ads first, Google AdSense backfill.
 *
 * Environment variables (set in .env.local):
 *   NEXT_PUBLIC_ADSENSE_CLIENT_ID   — Google AdSense publisher ID (ca-pub-XXX)
 *   NEXT_PUBLIC_ADSENSE_BANNER_SLOT — AdSense slot ID for banner_top
 *   NEXT_PUBLIC_ADSENSE_NATIVE_SLOT — AdSense slot ID for native_feed
 */

export type AdSlotType = "banner_top" | "interstitial" | "native_feed" | "reward_video";

export const ADSENSE_SLOTS: Partial<Record<AdSlotType, string>> = {
  banner_top: typeof process !== "undefined" ? process.env.NEXT_PUBLIC_ADSENSE_BANNER_SLOT : undefined,
  native_feed: typeof process !== "undefined" ? process.env.NEXT_PUBLIC_ADSENSE_NATIVE_SLOT : undefined,
};

export function isAdSenseEnabled(): boolean {
  return typeof process !== "undefined" && !!process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;
}

export function getAdSenseSlot(slot: AdSlotType): string | undefined {
  return ADSENSE_SLOTS[slot];
}
