import { INestApplication } from "@nestjs/common";
import request from "supertest";
import {
  createTestApp,
  registerAndLogin,
  countSentences,
  isAlignedPart1Visual,
  isSupportedAction,
  parseAction,
} from "./helpers";

describe("Learning e2e", () => {
  let app: INestApplication;
  const tenantCode = "learn-test";
  const email = "learner@test.com";
  const password = "toeic123";
  let authHeader = "";

  beforeAll(async () => {
    app = await createTestApp();
    const auth = await registerAndLogin(app, { tenantCode, email, password, displayName: "Learner" });
    authHeader = auth.authHeader;
  });

  afterAll(async () => {
    await app.close();
  });

  it("creates a goal", async () => {
    const goal = await request(app.getHttpServer())
      .post("/api/v1/goals")
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader)
      .send({ targetScore: 820, targetExamDate: "2026-09-30", currentScore: 590 });
    expect(goal.status).toBe(201);
    expect(goal.body.goalId).toBeDefined();
  });

  it("runs diagnostic start and submit", async () => {
    const start = await request(app.getHttpServer())
      .post("/api/v1/diagnostics/start")
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader);
    expect(start.status).toBe(201);
    expect(start.body.questions.length).toBeGreaterThan(0);
    expect(start.body.questions.some((q: { partNo: number }) => q.partNo >= 1 && q.partNo <= 4)).toBe(true);
    expect(start.body.questions.some((q: { partNo: number }) => q.partNo >= 5 && q.partNo <= 7)).toBe(true);

    const answers = start.body.questions.map(
      (q: { id: string; options: Array<{ key: string }> }) => ({
        questionId: q.id,
        selectedKey: q.options[0].key,
        durationMs: 12000,
      }),
    );
    const submit = await request(app.getHttpServer())
      .post(`/api/v1/diagnostics/${start.body.attemptId}/submit`)
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader)
      .send({ answers });
    expect(submit.status).toBe(201);
    expect(submit.body.scoreTotal).toBeGreaterThanOrEqual(10);
    expect(submit.body.review[0]).toMatchObject({
      questionId: expect.any(String),
      stem: expect.any(String),
      selectedKey: expect.any(String),
      correctKey: expect.any(String),
      isCorrect: expect.any(Boolean),
      explanation: expect.any(String),
    });

    const resubmit = await request(app.getHttpServer())
      .post(`/api/v1/diagnostics/${start.body.attemptId}/submit`)
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader)
      .send({ answers });
    expect(resubmit.status).toBe(400);
  });

  it("runs practice session with targeted filters", async () => {
    const start = await request(app.getHttpServer())
      .post("/api/v1/practice/sessions?part=5&difficulty=2")
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader);
    expect(start.status).toBe(201);
    expect(start.body.questions.every(
      (q: { partNo: number }) => q.partNo === 5,
    )).toBe(true);

    const answers = start.body.questions.map(
      (q: { id: string; options: Array<{ key: string }> }) => ({
        questionId: q.id,
        selectedKey: q.options[0].key,
        durationMs: 8000,
      }),
    );
    const complete = await request(app.getHttpServer())
      .post(`/api/v1/practice/sessions/${start.body.attemptId}/complete`)
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader)
      .send({ answers });
    expect(complete.status).toBe(201);
  });

  it("serves listening practice with time-fragmented media", async () => {
    const start = await request(app.getHttpServer())
      .post("/api/v1/practice/sessions?partGroup=listening")
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader);
    expect(start.status).toBe(201);
    expect(
      start.body.questions.every(
        (q: { partNo: number; mediaUrl?: string }) =>
          q.partNo >= 1 &&
          q.partNo <= 4 &&
          typeof q.mediaUrl === "string" &&
          /#t=\d+(?:\.\d+)?,\d+(?:\.\d+)?$/.test(q.mediaUrl),
      ),
    ).toBe(true);
  });

  it("serves Part 1 with aligned visuals", async () => {
    const start = await request(app.getHttpServer())
      .post("/api/v1/practice/sessions?part=1")
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader);
    expect(start.status).toBe(201);
    expect(
      start.body.questions.every(
        (q: { partNo: number; mediaUrl?: string; imageUrl?: string; stem: string; options: Array<{ text: string }> }) =>
          q.partNo === 1 &&
          typeof q.mediaUrl === "string" &&
          typeof q.imageUrl === "string" &&
          isAlignedPart1Visual(q),
      ),
    ).toBe(true);
  });

  it("serves Part 6 with fill-in-the-blank and context", async () => {
    const start = await request(app.getHttpServer())
      .post("/api/v1/practice/sessions?part=6")
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader);
    expect(start.status).toBe(201);
    expect(
      start.body.questions.every(
        (q: { partNo: number; stem: string; passage?: string }) => {
          const context = `${q.passage ?? ""} ${q.stem}`.trim();
          return q.partNo === 6 && q.stem.includes("___") && context.length >= 60 && countSentences(context) >= 2;
        },
      ),
    ).toBe(true);
  });

  it("serves Part 7 with reading passage", async () => {
    const start = await request(app.getHttpServer())
      .post("/api/v1/practice/sessions?part=7")
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader);
    expect(start.status).toBe(201);
    expect(
      start.body.questions.every(
        (q: { partNo: number; stem: string; passage?: string }) =>
          q.partNo === 7 &&
          typeof q.passage === "string" &&
          q.passage.trim().length >= 90 &&
          countSentences(q.passage) >= 2 &&
          q.stem.trim().endsWith("?"),
      ),
    ).toBe(true);
  });

  it("runs mock exam with scoring", async () => {
    const start = await request(app.getHttpServer())
      .post("/api/v1/mock-tests/start")
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader);
    expect(start.status).toBe(201);
    const answers = start.body.questions.map(
      (q: { id: string; options: Array<{ key: string }> }) => ({
        questionId: q.id,
        selectedKey: q.options[0].key,
        durationMs: 10000,
      }),
    );
    const submit = await request(app.getHttpServer())
      .post(`/api/v1/mock-tests/${start.body.attemptId}/submit`)
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader)
      .send({ answers });
    expect(submit.status).toBe(201);
    expect(submit.body.scoreTotal).toBeGreaterThanOrEqual(10);
  });

  it("rejects empty practice submission", async () => {
    const start = await request(app.getHttpServer())
      .post("/api/v1/practice/sessions?part=5")
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader);
    expect(start.status).toBe(201);
    const submit = await request(app.getHttpServer())
      .post(`/api/v1/practice/sessions/${start.body.attemptId}/complete`)
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader)
      .send({ answers: [] });
    expect(submit.status).toBe(400);
  });

  it("provides analytics and prediction", async () => {
    const analytics = await request(app.getHttpServer())
      .get("/api/v1/analytics/overview")
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader);
    expect(analytics.status).toBe(200);
    expect(analytics.body.attempts).toBeGreaterThanOrEqual(2);
    expect(analytics.body.questionsAnswered).toBeGreaterThan(0);
    expect(Array.isArray(analytics.body.byPart)).toBe(true);

    const prediction = await request(app.getHttpServer())
      .get("/api/v1/predictions/latest")
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader);
    expect(prediction.status).toBe(200);
    expect(prediction.body.predictedTotal).toBeGreaterThanOrEqual(10);
  });

  it("provides next-tasks and daily-plan with valid actions", async () => {
    const nextTasks = await request(app.getHttpServer())
      .get("/api/v1/learning/next-tasks")
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader);
    expect(nextTasks.status).toBe(200);
    expect(nextTasks.body.tasks.length).toBeGreaterThan(0);
    expect(
      nextTasks.body.tasks.every((task: { action: string }) => isSupportedAction(task.action)),
    ).toBe(true);

    const dailyPlan = await request(app.getHttpServer())
      .get("/api/v1/learning/daily-plan")
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader);
    expect(dailyPlan.status).toBe(200);
    expect(dailyPlan.body.totalMinutes).toBe(60);
    expect(dailyPlan.body.weekSchedule.length).toBe(7);
    expect(
      dailyPlan.body.blocks.every((block: { action: string }) => isSupportedAction(block.action)),
    ).toBe(true);
  });

  it("manages vocabulary cards", async () => {
    const vocabulary = await request(app.getHttpServer())
      .get("/api/v1/learning/vocabulary/cards")
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader);
    expect(vocabulary.status).toBe(200);
    expect(vocabulary.body.summary.total).toBeGreaterThan(0);

    const grade = await request(app.getHttpServer())
      .post(`/api/v1/learning/vocabulary/cards/${vocabulary.body.cards[0].id}/grade`)
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader)
      .send({ grade: 4 });
    expect(grade.status).toBe(201);
    expect(grade.body.dueAt).toBeDefined();
  });

  it("manages mistake library", async () => {
    const library = await request(app.getHttpServer())
      .get("/api/v1/mistakes/library")
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader);
    expect(library.status).toBe(200);
    expect(Array.isArray(library.body)).toBe(true);
  });

  it("executes generated next-task actions", async () => {
    const nextTasks = await request(app.getHttpServer())
      .get("/api/v1/learning/next-tasks")
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader);
    const dailyPlan = await request(app.getHttpServer())
      .get("/api/v1/learning/daily-plan")
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader);

    const actionSet = new Set<string>([
      ...nextTasks.body.tasks.map((task: { action: string }) => task.action),
      ...dailyPlan.body.blocks.map((block: { action: string }) => block.action),
    ]);

    for (const action of actionSet) {
      const { command, query } = parseAction(action);
      const queryText = query.toString();
      const suffix = queryText ? `?${queryText}` : "";

      if (command === "practice:start") {
        const r = await request(app.getHttpServer())
          .post(`/api/v1/practice/sessions${suffix}`)
          .set("x-tenant-code", tenantCode)
          .set("Authorization", authHeader);
        expect(r.status).toBe(201);
      } else if (command === "diagnostic:start") {
        const r = await request(app.getHttpServer())
          .post(`/api/v1/diagnostics/start${suffix}`)
          .set("x-tenant-code", tenantCode)
          .set("Authorization", authHeader);
        expect(r.status).toBe(201);
      } else if (command === "mock:start") {
        const r = await request(app.getHttpServer())
          .post(`/api/v1/mock-tests/start${suffix}`)
          .set("x-tenant-code", tenantCode)
          .set("Authorization", authHeader);
        expect(r.status).toBe(201);
      } else if (command === "vocab:start") {
        const r = await request(app.getHttpServer())
          .get("/api/v1/learning/vocabulary/cards")
          .set("x-tenant-code", tenantCode)
          .set("Authorization", authHeader);
        expect(r.status).toBe(200);
      } else if (command === "mistakes:start") {
        const r = await request(app.getHttpServer())
          .get("/api/v1/mistakes/library")
          .set("x-tenant-code", tenantCode)
          .set("Authorization", authHeader);
        expect(r.status).toBe(200);
      }
    }
  });
});
