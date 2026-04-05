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

  it("rejects writing evaluation with empty text", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/writing/evaluate")
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader)
      .send({ text: "" });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
