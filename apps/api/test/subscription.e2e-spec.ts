import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { createTestApp, registerAndLogin } from "./helpers";

describe("Subscription & Ads E2E", () => {
  let app: INestApplication;
  const tenantCode = "sub-test";
  const email = "sub@test.com";
  const password = "toeic123";
  let authHeader: string;

  beforeAll(async () => {
    app = await createTestApp();
    const creds = await registerAndLogin(app, {
      tenantCode,
      email,
      password,
      displayName: "Sub User",
    });
    authHeader = creds.authHeader;
  });

  afterAll(async () => {
    await app.close();
  });

  // ===== Plan Listing =====

  it("lists available plans (no auth required)", async () => {
    const res = await request(app.getHttpServer()).get("/api/v1/plans");
    expect(res.status).toBe(200);
    expect(res.body.plans).toBeDefined();
    expect(Array.isArray(res.body.plans)).toBe(true);
    expect(res.body.plans.length).toBeGreaterThanOrEqual(1);

    const free = res.body.plans.find((p: { code: string }) => p.code === "free");
    expect(free).toBeDefined();
    expect(free.priceMonthly).toBe(0);
  });

  // ===== User Profile =====

  it("gets user profile with plan info", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/me/profile")
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(email);
  });

  // ===== Subscribe =====

  it("subscribes to a plan", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/me/subscribe")
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader)
      .send({ planCode: "basic", billingCycle: "monthly" });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.subscription).toBeDefined();
  });

  it("rejects invalid plan code", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/me/subscribe")
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader)
      .send({ planCode: "nonexistent" });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  // ===== Usage =====

  it("gets usage and features", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/me/usage")
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader);
    expect(res.status).toBe(200);
    expect(res.body.usage).toBeDefined();
    expect(res.body.features).toBeDefined();
  });

  // ===== Cancel =====

  it("cancels subscription", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/me/subscribe/cancel")
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  // ===== Ads =====

  it("gets ads for user", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/ads")
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader);
    expect(res.status).toBe(200);
    expect(res.body.ads).toBeDefined();
    expect(Array.isArray(res.body.ads)).toBe(true);
  });

  it("gets ads filtered by slot", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/ads?slot=banner_top")
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.ads)).toBe(true);
  });

  it("records an ad event", async () => {
    // First get ads to find a placement id
    const adsRes = await request(app.getHttpServer())
      .get("/api/v1/ads")
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader);

    if (adsRes.body.ads.length > 0) {
      const adId = adsRes.body.ads[0].id;
      const res = await request(app.getHttpServer())
        .post("/api/v1/ads/event")
        .set("x-tenant-code", tenantCode)
        .set("Authorization", authHeader)
        .send({ placementId: adId, eventType: "impression" });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    }
  });

  // ===== Admin Ads =====

  it("admin lists all ads", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/admin/ads")
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.ads)).toBe(true);
  });

  it("admin gets ad stats", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/admin/ads/stats")
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader);
    expect(res.status).toBe(200);
  });

  it("admin creates an ad", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/admin/ads")
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader)
      .send({
        slot: "banner_top",
        title: "Test Ad",
        linkUrl: "https://example.com",
        ctaText: "Click here",
        priority: 10,
        targetPlans: ["free", "basic"],
      });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.ad).toBeDefined();
    expect(res.body.ad.title).toBe("Test Ad");
  });

  it("admin updates an ad", async () => {
    // Create an ad first
    const create = await request(app.getHttpServer())
      .post("/api/v1/admin/ads")
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader)
      .send({
        slot: "banner_bottom",
        title: "Ad to Update",
        linkUrl: "https://example.com",
        ctaText: "Go",
        priority: 5,
        targetPlans: ["free"],
      });

    const adId = create.body.ad.id;

    const res = await request(app.getHttpServer())
      .put(`/api/v1/admin/ads/${adId}`)
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader)
      .send({ title: "Updated Ad Title" });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.ad.title).toBe("Updated Ad Title");
  });

  it("admin deletes an ad", async () => {
    // Create an ad first
    const create = await request(app.getHttpServer())
      .post("/api/v1/admin/ads")
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader)
      .send({
        slot: "interstitial",
        title: "Ad to Delete",
        linkUrl: "https://example.com",
        ctaText: "Go",
        priority: 1,
        targetPlans: ["free"],
      });

    const adId = create.body.ad.id;

    const res = await request(app.getHttpServer())
      .delete(`/api/v1/admin/ads/${adId}`)
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  // ===== Auth checks =====

  it("rejects unauthenticated access to profile", async () => {
    const res = await request(app.getHttpServer()).get("/api/v1/me/profile");
    expect(res.status).toBe(401);
  });

  it("rejects unauthenticated access to ads", async () => {
    const res = await request(app.getHttpServer()).get("/api/v1/ads");
    expect(res.status).toBe(401);
  });
});
