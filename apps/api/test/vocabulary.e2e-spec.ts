import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { createTestApp, registerAndLogin } from "./helpers";

describe("Vocabulary E2E", () => {
  let app: INestApplication;
  const tenantCode = "vocab-test";
  const email = "vocab@test.com";
  const password = "toeic123";
  let authHeader: string;

  beforeAll(async () => {
    app = await createTestApp();
    const creds = await registerAndLogin(app, {
      tenantCode,
      email,
      password,
      displayName: "Vocab User",
    });
    authHeader = creds.authHeader;
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns the default English vocabulary deck", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/learning/vocabulary/cards")
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader);

    expect(res.status).toBe(200);
    expect(res.body.summary.total).toBeGreaterThan(0);
    expect(Array.isArray(res.body.cards)).toBe(true);
    expect(res.body.cards.every((card: { targetLanguage?: string }) => (card.targetLanguage ?? "en") === "en")).toBe(true);
    expect(res.body.cards.some((card: { translations?: { definition?: { en?: string } } }) => typeof card.translations?.definition?.en === "string")).toBe(true);
  });

  it("returns JLPT vocabulary cards when targetLang=ja", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/learning/vocabulary/cards?targetLang=ja")
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader);

    expect(res.status).toBe(200);
    expect(res.body.summary.total).toBeGreaterThan(0);
    expect(Array.isArray(res.body.cards)).toBe(true);
    expect(res.body.cards.every((card: { targetLanguage?: string }) => card.targetLanguage === "ja")).toBe(true);
    expect(res.body.cards.some((card: { scoreBand?: string }) => card.scoreBand === "N5")).toBe(true);
    expect(res.body.cards.some((card: { tags?: string[] }) => Array.isArray(card.tags) && card.tags.includes("jlpt"))).toBe(true);
    expect(res.body.cards.some((card: { term?: string }) => /[ぁ-んァ-ン一-龯]/.test(card.term ?? ""))).toBe(true);
    expect(
      res.body.cards.every((card: {
        translations?: {
          definition?: { zh?: string; ja?: string; en?: string };
          example?: { zh?: string; ja?: string; en?: string };
        };
      }) => (
        typeof card.translations?.definition?.zh === "string" &&
        typeof card.translations?.definition?.ja === "string" &&
        typeof card.translations?.definition?.en === "string" &&
        typeof card.translations?.example?.zh === "string" &&
        typeof card.translations?.example?.ja === "string" &&
        typeof card.translations?.example?.en === "string"
      )),
    ).toBe(true);
  });
});
