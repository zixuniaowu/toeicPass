import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../jwt-auth.guard";
import { Roles, TenantGuard } from "../auth";
import { RolesGuard } from "../roles.guard";
import { ReqShape, toCtx } from "../request-context";
import { SubscriptionService } from "../services/subscription.service";
import { CreateAdDto, RecordAdEventDto, SubscribeDto, UpdateAdDto } from "../dto";

@Controller()
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  /** Public: list all available plans (no auth needed) */
  @Get("plans")
  listPlans() {
    return { plans: this.subscriptionService.listPlans() };
  }

  /** Get current user's profile with plan & usage info */
  @Get("me/profile")
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  getProfile(@Req() req: ReqShape) {
    return this.subscriptionService.getUserProfile(toCtx(req));
  }

  /** Subscribe or change plan */
  @Post("me/subscribe")
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  subscribe(@Req() req: ReqShape, @Body() dto: SubscribeDto) {
    const ctx = toCtx(req);
    // In production, validate paymentToken with Stripe/Alipay/WechatPay here
    const sub = this.subscriptionService.subscribe(
      ctx.userId,
      dto.planCode,
      dto.billingCycle ?? "monthly",
    );
    return { success: true, subscription: sub };
  }

  /** Cancel current subscription */
  @Post("me/subscribe/cancel")
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  cancelSubscription(@Req() req: ReqShape) {
    const ctx = toCtx(req);
    this.subscriptionService.cancelSubscription(ctx.userId);
    return { success: true };
  }

  /** Check usage limit before an action */
  @Get("me/usage")
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  getUsage(@Req() req: ReqShape) {
    const ctx = toCtx(req);
    return {
      usage: this.subscriptionService.getTodayUsage(ctx),
      features: this.subscriptionService.getUserFeatures(ctx.userId),
    };
  }

  /** Get ads for the current user */
  @Get("ads")
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  getAds(@Req() req: ReqShape, @Query("slot") slot?: string) {
    const ctx = toCtx(req);
    const ads = this.subscriptionService.getAdsForUser(ctx.userId, slot);
    return { ads };
  }

  /** Record an ad event (impression, click, etc.) */
  @Post("ads/event")
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  recordAdEvent(@Req() req: ReqShape, @Body() dto: RecordAdEventDto) {
    const ctx = toCtx(req);
    this.subscriptionService.recordAdEvent(dto.placementId, ctx.userId, dto.eventType);
    return { success: true };
  }

  // ===== Admin Ad Management =====

  @Get("admin/ads")
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles("tenant_admin", "super_admin")
  listAllAds() {
    return { ads: this.subscriptionService.listAllAds() };
  }

  @Get("admin/ads/stats")
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles("tenant_admin", "super_admin")
  getAdStats() {
    return this.subscriptionService.getAdStats();
  }

  @Post("admin/ads")
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles("tenant_admin", "super_admin")
  createAd(@Body() dto: CreateAdDto) {
    const ad = this.subscriptionService.createAd(dto);
    return { success: true, ad };
  }

  @Put("admin/ads/:adId")
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles("tenant_admin", "super_admin")
  updateAd(@Param("adId") adId: string, @Body() dto: UpdateAdDto) {
    const ad = this.subscriptionService.updateAd(adId, dto);
    return { success: true, ad };
  }

  @Delete("admin/ads/:adId")
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles("tenant_admin", "super_admin")
  deleteAd(@Param("adId") adId: string) {
    this.subscriptionService.deleteAd(adId);
    return { success: true };
  }
}
