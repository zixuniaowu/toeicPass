import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { createTestApp, registerAndLogin } from "./helpers";

describe("Conversation & Writing E2E", () => {
  let app: INestApplication;
  const tenantCode = "conv-test";
  const email = "conv@test.com";
  const password = "toeic123";
  let authHeader: string;

  beforeAll(async () => {
    app = await createTestApp();
    const creds = await registerAndLogin(app, {
      tenantCode,
      email,
      password,
      displayName: "Conv User",
    });
    authHeader = creds.authHeader;
  });

  afterAll(async () => {
    await app.close();
  });

  // ===== Conversation Scenarios =====

  it("lists conversation scenarios", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/conversation/scenarios")
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);

    // Check scenario shape
    const scenario = res.body[0];
    expect(scenario.id).toBeDefined();
    expect(scenario.category).toBeDefined();
    expect(scenario.targetLanguage).toMatch(/en|ja/);
    expect(res.body.some((item: { targetLanguage: string }) => item.targetLanguage === "ja")).toBe(true);
  });

  it("generates a conversation reply", async () => {
    // First get scenarios
    const scenarios = await request(app.getHttpServer())
      .get("/api/v1/conversation/scenarios")
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader);

    const scenarioId = scenarios.body[0].id;

    const res = await request(app.getHttpServer())
      .post("/api/v1/conversation/reply")
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader)
      .send({ scenarioId, text: "Hello, nice to meet you!" });
    expect(res.status).toBe(201);
    expect(res.body.content).toBeDefined();
    expect(typeof res.body.content).toBe("string");
  });

  it("generates reply with conversation history", async () => {
    const scenarios = await request(app.getHttpServer())
      .get("/api/v1/conversation/scenarios")
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader);

    const scenarioId = scenarios.body[0].id;

    const res = await request(app.getHttpServer())
      .post("/api/v1/conversation/reply")
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader)
      .send({
        scenarioId,
        text: "I would like a coffee, please.",
        history: ["Hello!", "Hi, what can I get for you?"],
      });
    expect(res.status).toBe(201);
    expect(res.body.content).toBeDefined();
  });

  it("generates a Japanese conversation reply", async () => {
    const scenarios = await request(app.getHttpServer())
      .get("/api/v1/conversation/scenarios")
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader);

    const japaneseScenario = scenarios.body.find(
      (scenario: { targetLanguage?: string }) => scenario.targetLanguage === "ja",
    );

    expect(japaneseScenario).toBeDefined();

    const res = await request(app.getHttpServer())
      .post("/api/v1/conversation/reply")
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader)
      .send({
        scenarioId: japaneseScenario.id,
        text: "こんにちは。予約をお願いします。",
      });

    expect(res.status).toBe(201);
    expect(res.body.content).toBeDefined();
    expect(res.body.content).toMatch(/[ぁ-んァ-ン一-龯]/);
  });

  it("rejects reply with missing scenarioId", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/conversation/reply")
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader)
      .send({ text: "Hello" });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it("rejects reply with empty text", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/conversation/reply")
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader)
      .send({ scenarioId: "office-small-talk", text: "" });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  // ===== Writing Evaluation =====

  it("evaluates a writing submission", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/writing/evaluate")
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader)
      .send({
        text: "Dear Mr. Johnson, I am writing to inform you about the schedule change.",
      });
    expect(res.status).toBe(201);
    expect(res.body).toBeDefined();
    // Should return evaluation content (structure depends on AI vs rule-based fallback)
  });

  it("returns stable English writing scores for the same submission", async () => {
    const payload = {
      text: "First, our team reviewed the customer feedback in detail. However, we also compared it with the sales data from the last quarter. Therefore, we decided to simplify the onboarding email and add one clearer example for new users.",
      targetLang: "en",
    };

    const first = await request(app.getHttpServer())
      .post("/api/v1/writing/evaluate")
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader)
      .send(payload);

    const second = await request(app.getHttpServer())
      .post("/api/v1/writing/evaluate")
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader)
      .send(payload);

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body.score).toBe(first.body.score);
    expect(second.body.feedback).toEqual(first.body.feedback);
    expect(second.body.summary).toBe(first.body.summary);
    expect(second.body.nextStep).toBe(first.body.nextStep);
    expect(second.body.focusArea).toBe(first.body.focusArea);
    expect(second.body.focusSignals).toEqual(first.body.focusSignals);
    expect(second.body.drillChecklist).toEqual(first.body.drillChecklist);
    expect(second.body.revisionPrompt).toBe(first.body.revisionPrompt);
    expect(second.body.sentenceFrames).toEqual(first.body.sentenceFrames);
    expect(second.body.rubric).toEqual(first.body.rubric);
  });

  it("evaluates a Japanese writing submission when targetLang is ja", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/writing/evaluate")
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader)
      .send({
        text: "昨日は図書館で日本語を勉強しました。宿題もしました。とても忙しかったです。",
        targetLang: "ja",
      });

    expect(res.status).toBe(201);
    expect(Array.isArray(res.body.feedback)).toBe(true);
    expect(res.body.feedback).toContain("文章が短めです。理由や具体例を少し足して、内容を広げてみましょう。");
    expect(res.body.summary).toMatch(/[ぁ-んァ-ン一-龯]/);
    expect(res.body.focusArea).toMatch(/content|organization|languageControl/);
    expect(Array.isArray(res.body.focusSignals)).toBe(true);
    expect(res.body.focusSignals).toContain("理由や具体例を1つ足して内容を厚くする。");
    expect(Array.isArray(res.body.drillChecklist)).toBe(true);
    expect(typeof res.body.revisionPrompt).toBe("string");
    expect(Array.isArray(res.body.sentenceFrames)).toBe(true);
    expect(res.body.sentenceFrames[0]).toMatch(/[ぁ-んァ-ン一-龯〜]/);
    expect(Array.isArray(res.body.rubric)).toBe(true);
    expect(res.body.rubric[0]).toEqual(
      expect.objectContaining({
        label: expect.any(String),
        score: expect.any(Number),
        comment: expect.any(String),
      }),
    );
  });

  it("rejects writing evaluation with empty text", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/writing/evaluate")
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader)
      .send({ text: "" });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
