import type {
  AdPlacement,
  AdEvent,
  AdStats,
  AdServiceConfig,
  IAdStore,
  CreateAdInput,
  UpdateAdInput,
  AdEventType,
} from "./types";

const defaultGenerateId = () => {
  // Fallback for environments without crypto.randomUUID
  return "ad_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 10);
};

const defaultNowIso = () => new Date().toISOString();

/**
 * Core ad service — stateless logic operating on an IAdStore.
 *
 * Usage:
 * ```ts
 * const adService = new AdService(myStore, { generateId: myIdFn });
 * const ads = adService.getAdsForUser("free", "banner_top");
 * ```
 */
export class AdService {
  private readonly store: IAdStore;
  private readonly generateId: () => string;
  private readonly nowIso: () => string;

  constructor(store: IAdStore, config?: AdServiceConfig) {
    this.store = store;
    this.generateId = config?.generateId ?? defaultGenerateId;
    this.nowIso = config?.nowIso ?? defaultNowIso;
  }

  // ===== User-facing =====

  /**
   * Get active ads for a user's plan, optionally filtered by slot.
   * @param userPlanCode - The user's current plan code (e.g. "free", "premium")
   * @param slot - Optional slot type to filter by
   */
  getAdsForUser(userPlanCode: string, slot?: string): AdPlacement[] {
    const now = new Date();
    return this.store.adPlacements
      .filter((ad) => {
        if (!ad.isActive) return false;
        if (!ad.targetPlans.includes(userPlanCode)) return false;
        if (slot && ad.slot !== slot) return false;
        if (ad.startsAt && new Date(ad.startsAt) > now) return false;
        if (ad.expiresAt && new Date(ad.expiresAt) < now) return false;
        return true;
      })
      .sort((a, b) => b.priority - a.priority);
  }

  /**
   * Record an ad event (impression, click, dismiss, reward_complete).
   */
  recordAdEvent(placementId: string, userId: string | undefined, eventType: AdEventType): void {
    const placement = this.store.adPlacements.find((a) => a.id === placementId);
    if (!placement) return;

    this.store.adEvents.push({
      id: this.generateId(),
      placementId,
      userId,
      eventType,
      createdAt: this.nowIso(),
    });

    if (eventType === "impression") placement.impressions += 1;
    if (eventType === "click") placement.clicks += 1;
  }

  // ===== Admin =====

  listAllAds(): AdPlacement[] {
    return [...this.store.adPlacements].sort((a, b) => b.priority - a.priority);
  }

  getAdStats(): AdStats {
    const ads = this.store.adPlacements;
    const totalImpressions = ads.reduce((s, a) => s + a.impressions, 0);
    const totalClicks = ads.reduce((s, a) => s + a.clicks, 0);

    const bySlot: Record<string, { count: number; impressions: number; clicks: number }> = {};
    for (const ad of ads) {
      if (!bySlot[ad.slot]) bySlot[ad.slot] = { count: 0, impressions: 0, clicks: 0 };
      bySlot[ad.slot].count += 1;
      bySlot[ad.slot].impressions += ad.impressions;
      bySlot[ad.slot].clicks += ad.clicks;
    }

    const recentEvents = this.store.adEvents
      .slice(-50)
      .reverse()
      .map((e) => ({
        id: e.id,
        placementId: e.placementId,
        eventType: e.eventType,
        createdAt: e.createdAt,
      }));

    return {
      totalPlacements: ads.length,
      activePlacements: ads.filter((a) => a.isActive).length,
      totalImpressions,
      totalClicks,
      ctr: totalImpressions > 0 ? Math.round((totalClicks / totalImpressions) * 10000) / 100 : 0,
      bySlot,
      recentEvents,
    };
  }

  createAd(data: CreateAdInput): AdPlacement {
    const ad: AdPlacement = {
      id: this.generateId(),
      slot: data.slot as AdPlacement["slot"],
      title: data.title,
      imageUrl: data.imageUrl,
      linkUrl: data.linkUrl,
      ctaText: data.ctaText,
      priority: data.priority,
      targetPlans: data.targetPlans,
      isActive: true,
      impressions: 0,
      clicks: 0,
      startsAt: data.startsAt,
      expiresAt: data.expiresAt,
      createdAt: this.nowIso(),
    };
    this.store.adPlacements.push(ad);
    this.store.persistSnapshot();
    return ad;
  }

  updateAd(adId: string, data: UpdateAdInput): AdPlacement | null {
    const ad = this.store.adPlacements.find((a) => a.id === adId);
    if (!ad) return null;
    if (data.slot !== undefined) ad.slot = data.slot as AdPlacement["slot"];
    if (data.title !== undefined) ad.title = data.title;
    if (data.imageUrl !== undefined) ad.imageUrl = data.imageUrl;
    if (data.linkUrl !== undefined) ad.linkUrl = data.linkUrl;
    if (data.ctaText !== undefined) ad.ctaText = data.ctaText;
    if (data.priority !== undefined) ad.priority = data.priority;
    if (data.targetPlans !== undefined) ad.targetPlans = data.targetPlans;
    if (data.isActive !== undefined) ad.isActive = data.isActive;
    if (data.startsAt !== undefined) ad.startsAt = data.startsAt;
    if (data.expiresAt !== undefined) ad.expiresAt = data.expiresAt;
    this.store.persistSnapshot();
    return ad;
  }

  deleteAd(adId: string): boolean {
    const idx = this.store.adPlacements.findIndex((a) => a.id === adId);
    if (idx === -1) return false;
    this.store.adPlacements.splice(idx, 1);
    this.store.persistSnapshot();
    return true;
  }

  // ===== Seed Helper =====

  /**
   * Seed sample ads if none exist. Call during app bootstrap.
   */
  seedIfEmpty(seeds: Array<Omit<CreateAdInput, "targetPlans"> & { targetPlans?: string[] }>): AdPlacement[] {
    if (this.store.adPlacements.length > 0) return [];
    const created: AdPlacement[] = [];
    for (const seed of seeds) {
      created.push(this.createAd({ ...seed, targetPlans: seed.targetPlans ?? ["free"] }));
    }
    return created;
  }
}
