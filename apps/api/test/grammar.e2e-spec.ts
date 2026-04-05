import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { createTestApp, registerAndLogin } from "./helpers";

describe("Grammar Cards E2E", () => {
  let app: INestApplication;
  const tenantCode = "grammar-test";
  const email = "grammar@test.com";
  const password = "toeic123";
  let authHeader: string;

  beforeAll(async () => {
    app = await createTestApp();
    const creds = await registerAndLogin(app, {
      tenantCode,
      email,
      password,
      displayName: "Grammar User",
    });
    authHeader = creds.authHeader;
  });

  afterAll(async () => {
    await app.close();
  });

  // ===== Grammar Card Listing =====

  it("lists grammar cards with summary", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/learning/grammar/cards")
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader);
    expect(res.status).toBe(200);
    expect(res.body.summary).toBeDefined();
    expect(res.body.cards).toBeDefined();
    expect(Array.isArray(res.body.cards)).toBe(true);
    expect(res.body.cards.length).toBeGreaterThanOrEqual(1);

    // Check summary shape
    expect(typeof res.body.summary.total).toBe("number");
    expect(typeof res.body.summary.due).toBe("number");

    // Check card shape
    const card = res.body.cards[0];
    expect(card.ruleId).toBeDefined();
    expect(card.category).toBeDefined();
    expect(card.title).toBeDefined();
  });

  it("grammar cards have SM-2 fields", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/learning/grammar/cards")
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader);

    const card = res.body.cards[0];
    expect(typeof card.easeFactor).toBe("number");
    expect(typeof card.intervalDays).toBe("number");
    expect(card.dueAt).toBeDefined();
  });

  // ===== Grammar Card Grading =====

  it("grades a grammar card (grade 3 = remembered)", async () => {
    const cardsRes = await request(app.getHttpServer())
      .get("/api/v1/learning/grammar/cards")
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader);

    const firstCard = cardsRes.body.cards[0];

    const res = await request(app.getHttpServer())
      .post(`/api/v1/learning/grammar/cards/${firstCard.id}/grade`)
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader)
      .send({ grade: 3 });
    expect(res.status).toBe(201);

    // Verify the interval was updated
    const updated = await request(app.getHttpServer())
      .get("/api/v1/learning/grammar/cards")
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader);

    const updatedCard = updated.body.cards.find(
      (c: { ruleId: string }) => c.ruleId === firstCard.ruleId,
    );
    expect(updatedCard).toBeDefined();
    expect(updatedCard.intervalDays).toBeGreaterThanOrEqual(1);
  });

  it("grades a grammar card (grade 1 = forgotten)", async () => {
    const cardsRes = await request(app.getHttpServer())
      .get("/api/v1/learning/grammar/cards")
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader);

    const card = cardsRes.body.cards[1] || cardsRes.body.cards[0];

    const res = await request(app.getHttpServer())
      .post(`/api/v1/learning/grammar/cards/${card.id}/grade`)
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader)
      .send({ grade: 1 });
    expect(res.status).toBe(201);

    const updated = await request(app.getHttpServer())
      .get("/api/v1/learning/grammar/cards")
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader);

    const updatedCard = updated.body.cards.find(
      (c: { ruleId: string }) => c.ruleId === card.ruleId,
    );
    expect(updatedCard).toBeDefined();
    expect(updatedCard.intervalDays).toBe(0);
  });

  it("rejects invalid grade value", async () => {
    const cardsRes = await request(app.getHttpServer())
      .get("/api/v1/learning/grammar/cards")
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader);

    const firstCard = cardsRes.body.cards[0];

    const res = await request(app.getHttpServer())
      .post(`/api/v1/learning/grammar/cards/${firstCard.id}/grade`)
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader)
      .send({ grade: 10 });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
