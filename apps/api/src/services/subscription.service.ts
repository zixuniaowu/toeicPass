import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { StoreService } from "../store.service";
import { RequestContext } from "../context";
import {
  AdPlacement,
  DailyUsage,
  PlanCode,
  PlanFeatures,
  SubscriptionPlan,
  UserSubscription,
} from "../types";
import { newId, nowIso } from "../utils";
import { AdService } from "@toeicpass/ad-system";

@Injectable()
export class SubscriptionService {
  private readonly adService: AdService;

  constructor(private readonly store: StoreService) {
    this.adService = new AdService(store, { generateId: newId, nowIso });
  }

  // ===== Plans =====

  listPlans(): SubscriptionPlan[] {
    return this.store.subscriptionPlans
      .filter((p) => p.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  getPlan(planCode: PlanCode): SubscriptionPlan {
    const plan = this.store.subscriptionPlans.find((p) => p.code === planCode && p.isActive);
    if (!plan) throw new NotFoundException(`Plan not found: ${planCode}`);
    return plan;
  }

  // ===== User Subscription =====

  getUserSubscription(userId: string): UserSubscription | null {
    return (
      this.store.userSubscriptions.find(
        (s) => s.userId === userId && s.status === "active",
      ) ?? null
    );
  }

  getUserPlan(userId: string): SubscriptionPlan {
    const sub = this.getUserSubscription(userId);
    if (!sub) return this.getPlan("free");
    const plan = this.store.subscriptionPlans.find((p) => p.id === sub.planId);
    return plan ?? this.getPlan("free");
  }

  getUserFeatures(userId: string): PlanFeatures {
    return this.getUserPlan(userId).features;
  }

  /**
   * Subscribe/upgrade a user to a plan.
   * In production this would involve Stripe checkout; here we just create the record.
   */
  subscribe(
    userId: string,
    planCode: PlanCode,
    billingCycle: "monthly" | "yearly" = "monthly",
    paymentProvider?: string,
    paymentProviderId?: string,
  ): UserSubscription {
    const plan = this.getPlan(planCode);

    // Cancel any existing active subscription
    this.store.userSubscriptions
      .filter((s) => s.userId === userId && s.status === "active")
      .forEach((s) => {
        s.status = "cancelled";
        s.cancelledAt = nowIso();
      });

    const now = nowIso();
    const expiresAt = new Date(now);
    if (billingCycle === "monthly") {
      expiresAt.setMonth(expiresAt.getMonth() + 1);
    } else {
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    }

    const sub: UserSubscription = {
      id: newId(),
      userId,
      planId: plan.id,
      status: "active",
      billingCycle,
      startedAt: now,
      expiresAt: expiresAt.toISOString(),
      paymentProvider,
      paymentProviderId,
      createdAt: now,
    };
    this.store.userSubscriptions.push(sub);
    this.store.persistSnapshot();
    return sub;
  }

  cancelSubscription(userId: string): void {
    const sub = this.getUserSubscription(userId);
    if (!sub) throw new BadRequestException("No active subscription found");
    sub.status = "cancelled";
    sub.cancelledAt = nowIso();
    this.store.persistSnapshot();
  }

  // ===== Usage Tracking & Limits =====

  getTodayUsage(ctx: RequestContext): DailyUsage {
    const today = new Date().toISOString().slice(0, 10);
    let usage = this.store.dailyUsage.find(
      (u) => u.userId === ctx.userId && u.tenantId === ctx.tenantId && u.usageDate === today,
    );
    if (!usage) {
      usage = {
        id: newId(),
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        usageDate: today,
        practiceSessions: 0,
        mockTests: 0,
        questionsAnswered: 0,
        vocabReviews: 0,
        aiConversations: 0,
      };
      this.store.dailyUsage.push(usage);
    }
    return usage;
  }

  incrementUsage(ctx: RequestContext, field: keyof Pick<DailyUsage, "practiceSessions" | "mockTests" | "questionsAnswered" | "vocabReviews" | "aiConversations">, amount = 1): void {
    const usage = this.getTodayUsage(ctx);
    usage[field] += amount;
    // No snapshot on every increment; batched on session complete
  }

  /**
   * Check if the user is within their plan limits.
   * Returns { allowed: boolean, reason?: string }
   */
  checkLimit(
    ctx: RequestContext,
    action: "practice_session" | "mock_test" | "question" | "vocab_review" | "ai_conversation",
  ): { allowed: boolean; reason?: string; limit?: number; used?: number } {
    // If subscription plans are not seeded, skip limit enforcement
    if (this.store.subscriptionPlans.length === 0) return { allowed: true };

    const features = this.getUserFeatures(ctx.userId);
    const usage = this.getTodayUsage(ctx);

    const checks: Record<string, { limit: number; used: number }> = {
      practice_session: { limit: features.daily_practice_sessions, used: usage.practiceSessions },
      mock_test: { limit: features.daily_mock_tests, used: usage.mockTests },
      question: { limit: features.daily_questions, used: usage.questionsAnswered },
      vocab_review: { limit: features.vocab_cards, used: usage.vocabReviews },
      ai_conversation: { limit: features.ai_conversations, used: usage.aiConversations },
    };

    const check = checks[action];
    if (!check) return { allowed: true };
    if (check.limit === -1) return { allowed: true }; // unlimited
    if (check.used >= check.limit) {
      return {
        allowed: false,
        reason: `Daily ${action.replace("_", " ")} limit reached (${check.limit}). Upgrade your plan for more.`,
        limit: check.limit,
        used: check.used,
      };
    }
    return { allowed: true, limit: check.limit, used: check.used };
  }

  // ===== Ads =====

  getAdsForUser(userId: string, slot?: string): AdPlacement[] {
    const plan = this.getUserPlan(userId);
    return this.adService.getAdsForUser(plan.code, slot) as AdPlacement[];
  }

  recordAdEvent(placementId: string, userId: string | undefined, eventType: "impression" | "click" | "dismiss" | "reward_complete"): void {
    this.adService.recordAdEvent(placementId, userId, eventType);
  }

  // ===== User Profile for Frontend =====

  getUserProfile(ctx: RequestContext): {
    id: string;
    email: string;
    displayName: string;
    roles: string[];
    tenantId: string;
    plan: {
      code: PlanCode;
      name: string;
      features: PlanFeatures;
      expiresAt?: string;
      billingCycle?: string;
    };
    usage: {
      practiceSessions: { used: number; limit: number };
      mockTests: { used: number; limit: number };
      questionsAnswered: { used: number; limit: number };
      vocabReviews: { used: number; limit: number };
      aiConversations: { used: number; limit: number };
    };
  } {
    const user = this.store.users.find((u) => u.id === ctx.userId);
    if (!user) throw new NotFoundException("User not found");

    const plan = this.getUserPlan(ctx.userId);
    const sub = this.getUserSubscription(ctx.userId);
    const usage = this.getTodayUsage(ctx);
    const f = plan.features;

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      roles: ctx.roles,
      tenantId: ctx.tenantId,
      plan: {
        code: plan.code,
        name: plan.nameZh, // default Chinese; frontend switches by locale
        features: f,
        expiresAt: sub?.expiresAt,
        billingCycle: sub?.billingCycle,
      },
      usage: {
        practiceSessions: { used: usage.practiceSessions, limit: f.daily_practice_sessions },
        mockTests: { used: usage.mockTests, limit: f.daily_mock_tests },
        questionsAnswered: { used: usage.questionsAnswered, limit: f.daily_questions },
        vocabReviews: { used: usage.vocabReviews, limit: f.vocab_cards },
        aiConversations: { used: usage.aiConversations, limit: f.daily_questions },
      },
    };
  }

  // ===== Admin: Ad Management =====

  listAllAds(): AdPlacement[] {
    return this.adService.listAllAds() as AdPlacement[];
  }

  getAdStats(): {
    totalPlacements: number;
    activePlacements: number;
    totalImpressions: number;
    totalClicks: number;
    ctr: number;
    bySlot: Record<string, { count: number; impressions: number; clicks: number }>;
    recentEvents: Array<{ id: string; placementId: string; eventType: string; createdAt: string }>;
  } {
    return this.adService.getAdStats();
  }

  createAd(data: {
    slot: string;
    title: string;
    imageUrl?: string;
    linkUrl: string;
    ctaText: string;
    priority: number;
    targetPlans: string[];
    startsAt?: string;
    expiresAt?: string;
  }): AdPlacement {
    return this.adService.createAd(data) as AdPlacement;
  }

  updateAd(adId: string, data: Partial<{
    slot: string;
    title: string;
    imageUrl: string;
    linkUrl: string;
    ctaText: string;
    priority: number;
    targetPlans: string[];
    isActive: boolean;
    startsAt: string;
    expiresAt: string;
  }>): AdPlacement {
    const result = this.adService.updateAd(adId, data);
    if (!result) throw new NotFoundException(`Ad not found: ${adId}`);
    return result as AdPlacement;
  }

  deleteAd(adId: string): void {
    const success = this.adService.deleteAd(adId);
    if (!success) throw new NotFoundException(`Ad not found: ${adId}`);
  }
}
