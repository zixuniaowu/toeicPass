import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";

describe("toeicPass e2e", () => {
  let app: INestApplication;
  const tenantCode = "demo";
  const email = "owner@demo.com";
  const password = "toeic123";
  let accessToken = "";
  let authHeader = "";
  let diagnosticAttemptId = "";
  let mockAttemptId = "";
  let campaignId = "";
  let candidateId = "";
  let sessionId = "";

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("registers and logs in", async () => {
    const register = await request(app.getHttpServer()).post("/api/v1/auth/register").send({
      tenantCode,
      tenantName: "Demo Org",
      email,
      password,
      displayName: "Owner",
    });
    expect(register.status).toBe(201);
    expect(register.body.userId).toBeDefined();

    const login = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .set("x-tenant-code", tenantCode)
      .send({
        tenantCode,
        email,
        password,
      });
    expect(login.status).toBe(201);
    expect(login.body.accessToken).toBeDefined();
    accessToken = login.body.accessToken;
    authHeader = `Bearer ${accessToken}`;
  });

  it("runs learner cycle for goal, diagnostic, practice, and prediction", async () => {
    const me = await request(app.getHttpServer())
      .get("/api/v1/me")
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader);
    expect(me.status).toBe(200);
    expect(me.body.roles).toContain("tenant_admin");

    const goal = await request(app.getHttpServer())
      .post("/api/v1/goals")
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader)
      .send({
        targetScore: 820,
        targetExamDate: "2026-09-30",
      });
    expect(goal.status).toBe(201);
    expect(goal.body.goalId).toBeDefined();

    const diagnosticStart = await request(app.getHttpServer())
      .post("/api/v1/diagnostics/start")
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader);
    expect(diagnosticStart.status).toBe(201);
    diagnosticAttemptId = diagnosticStart.body.attemptId;
    expect(diagnosticStart.body.questions.length).toBeGreaterThan(0);

    const diagnosticAnswers = diagnosticStart.body.questions.map(
      (q: { id: string; options: Array<{ key: string }> }) => ({
        questionId: q.id,
        selectedKey: q.options[0].key,
        durationMs: 12000,
      }),
    );
    const diagnosticSubmit = await request(app.getHttpServer())
      .post(`/api/v1/diagnostics/${diagnosticAttemptId}/submit`)
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader)
      .send({ answers: diagnosticAnswers });
    expect(diagnosticSubmit.status).toBe(201);
    expect(diagnosticSubmit.body.scoreTotal).toBeGreaterThanOrEqual(10);
    expect(Array.isArray(diagnosticSubmit.body.review)).toBe(true);
    expect(diagnosticSubmit.body.review[0]).toMatchObject({
      questionId: expect.any(String),
      stem: expect.any(String),
      selectedKey: expect.any(String),
      correctKey: expect.any(String),
      isCorrect: expect.any(Boolean),
      explanation: expect.any(String),
    });

    const practiceStart = await request(app.getHttpServer())
      .post("/api/v1/practice/sessions")
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader);
    expect(practiceStart.status).toBe(201);
    const practiceAnswers = practiceStart.body.questions.map(
      (q: { id: string; options: Array<{ key: string }> }) => ({
        questionId: q.id,
        selectedKey: q.options[0].key,
        durationMs: 9000,
      }),
    );
    const practiceComplete = await request(app.getHttpServer())
      .post(`/api/v1/practice/sessions/${practiceStart.body.attemptId}/complete`)
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader)
      .send({ answers: practiceAnswers });
    expect(practiceComplete.status).toBe(201);

    const targetedPractice = await request(app.getHttpServer())
      .post("/api/v1/practice/sessions?part=5&difficulty=2")
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader);
    expect(targetedPractice.status).toBe(201);
    expect(targetedPractice.body.questions.length).toBeGreaterThan(0);
    expect(
      targetedPractice.body.questions.every(
        (q: { partNo: number; options: Array<{ key: string }> }) => q.partNo === 5 && q.options.length > 0,
      ),
    ).toBe(true);
    const targetedAnswers = targetedPractice.body.questions.map(
      (q: { id: string; options: Array<{ key: string }> }) => ({
        questionId: q.id,
        selectedKey: q.options[0].key,
        durationMs: 8000,
      }),
    );
    const targetedComplete = await request(app.getHttpServer())
      .post(`/api/v1/practice/sessions/${targetedPractice.body.attemptId}/complete`)
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader)
      .send({ answers: targetedAnswers });
    expect(targetedComplete.status).toBe(201);

    const listeningPractice = await request(app.getHttpServer())
      .post("/api/v1/practice/sessions?part=2")
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader);
    expect(listeningPractice.status).toBe(201);
    expect(
      listeningPractice.body.questions.every(
        (q: { partNo: number; mediaUrl?: string; imageUrl?: string }) =>
          q.partNo === 2 && typeof q.mediaUrl === "string",
      ),
    ).toBe(true);

    const mistakes = await request(app.getHttpServer())
      .get("/api/v1/mistakes")
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader);
    expect(mistakes.status).toBe(200);
    if (mistakes.body.length > 0) {
      const noteRes = await request(app.getHttpServer())
        .post(`/api/v1/mistakes/${mistakes.body[0].attemptItemId}/notes`)
        .set("x-tenant-code", tenantCode)
        .set("Authorization", authHeader)
        .send({
          note: "Need to read options more carefully.",
          rootCause: "vocab",
        });
      expect(noteRes.status).toBe(201);
    }

    const mistakeLibrary = await request(app.getHttpServer())
      .get("/api/v1/mistakes/library")
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader);
    expect(mistakeLibrary.status).toBe(200);
    expect(Array.isArray(mistakeLibrary.body)).toBe(true);
    if (mistakeLibrary.body.length > 0) {
      expect(mistakeLibrary.body[0]).toMatchObject({
        questionId: expect.any(String),
        stem: expect.any(String),
        wrongCount: expect.any(Number),
        latestAttemptItemId: expect.any(String),
      });
    }

    const vocabulary = await request(app.getHttpServer())
      .get("/api/v1/learning/vocabulary/cards")
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader);
    expect(vocabulary.status).toBe(200);
    expect(vocabulary.body.summary.total).toBeGreaterThan(0);
    expect(Array.isArray(vocabulary.body.cards)).toBe(true);
    expect(vocabulary.body.cards[0]).toMatchObject({
      id: expect.any(String),
      term: expect.any(String),
      definition: expect.any(String),
    });

    const vocabGrade = await request(app.getHttpServer())
      .post(`/api/v1/learning/vocabulary/cards/${vocabulary.body.cards[0].id}/grade`)
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader)
      .send({ grade: 4 });
    expect(vocabGrade.status).toBe(201);
    expect(vocabGrade.body.dueAt).toBeDefined();

    const mockStart = await request(app.getHttpServer())
      .post("/api/v1/mock-tests/start")
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader);
    expect(mockStart.status).toBe(201);
    mockAttemptId = mockStart.body.attemptId;
    const mockAnswers = mockStart.body.questions.map(
      (q: { id: string; options: Array<{ key: string }> }) => ({
        questionId: q.id,
        selectedKey: q.options[0].key,
        durationMs: 10000,
      }),
    );

    const mockSubmit = await request(app.getHttpServer())
      .post(`/api/v1/mock-tests/${mockAttemptId}/submit`)
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader)
      .send({ answers: mockAnswers });
    expect(mockSubmit.status).toBe(201);

    const prediction = await request(app.getHttpServer())
      .get("/api/v1/predictions/latest")
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader);
    expect(prediction.status).toBe(200);
    expect(prediction.body.predictedTotal).toBeGreaterThanOrEqual(10);

    const analytics = await request(app.getHttpServer())
      .get("/api/v1/analytics/overview")
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader);
    expect(analytics.status).toBe(200);
    expect(analytics.body.attempts).toBeGreaterThanOrEqual(4);
    expect(analytics.body.questionsAnswered).toBeGreaterThan(0);
    expect(Array.isArray(analytics.body.byPart)).toBe(true);
    expect(analytics.body.byPart.length).toBeGreaterThan(0);
    expect(analytics.body.goal.targetScore).toBe(820);
    expect(typeof analytics.body.goal.gap).toBe("number");

    const nextTasks = await request(app.getHttpServer())
      .get("/api/v1/learning/next-tasks")
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader);
    expect(nextTasks.status).toBe(200);
    expect(Array.isArray(nextTasks.body.tasks)).toBe(true);
    expect(nextTasks.body.tasks.length).toBeGreaterThan(0);
    expect(nextTasks.body.tasks[0]).toMatchObject({
      title: expect.any(String),
      reason: expect.any(String),
      action: expect.any(String),
      priority: expect.any(Number),
    });

    const auditLogs = await request(app.getHttpServer())
      .get("/api/v1/admin/audit-logs")
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader);
    expect(auditLogs.status).toBe(200);
    expect(auditLogs.body.length).toBeGreaterThan(0);
  });

  it("runs enterprise TOEIC IP campaign lifecycle", async () => {
    const campaign = await request(app.getHttpServer())
      .post("/api/v1/ip/campaigns")
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader)
      .send({
        name: "Q3 TOEIC IP",
        mode: "official",
        plannedDate: "2026-08-15",
      });
    expect(campaign.status).toBe(201);
    campaignId = campaign.body.id;

    const importCandidates = await request(app.getHttpServer())
      .post(`/api/v1/ip/campaigns/${campaignId}/candidates/import`)
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader)
      .send({
        candidates: [
          { employeeNo: "E1001", fullName: "Alice Chen", email: "alice@example.com" },
          { employeeNo: "E1002", fullName: "Bob Lin", email: "bob@example.com" },
        ],
      });
    expect(importCandidates.status).toBe(201);
    expect(importCandidates.body.imported).toBe(2);

    const candidates = await request(app.getHttpServer())
      .get(`/api/v1/ip/campaigns/${campaignId}/candidates`)
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader);
    expect(candidates.status).toBe(200);
    expect(candidates.body.length).toBe(2);
    candidateId = candidates.body[0].id;

    const campaigns = await request(app.getHttpServer())
      .get("/api/v1/ip/campaigns")
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader);
    expect(campaigns.status).toBe(200);
    expect(campaigns.body.length).toBeGreaterThan(0);

    const session = await request(app.getHttpServer())
      .post(`/api/v1/ip/campaigns/${campaignId}/sessions`)
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader)
      .send({
        sessionCode: "S1",
        startsAt: "2026-08-15T01:00:00.000Z",
        endsAt: "2026-08-15T03:00:00.000Z",
        seatCapacity: 40,
      });
    expect(session.status).toBe(201);
    sessionId = session.body.id;

    const checkin = await request(app.getHttpServer())
      .post(`/api/v1/ip/sessions/${sessionId}/check-in`)
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader)
      .send({ candidateId });
    expect(checkin.status).toBe(201);
    expect(checkin.body.status).toBe("checked_in");

    const submit = await request(app.getHttpServer())
      .post(`/api/v1/ip/sessions/${sessionId}/submit`)
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader)
      .send({ candidateId });
    expect(submit.status).toBe(201);
    expect(submit.body.status).toBe("submitted");

    const importResults = await request(app.getHttpServer())
      .post(`/api/v1/ip/campaigns/${campaignId}/results/import`)
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader)
      .send({
        rows: [{ candidateId, scoreL: 300, scoreR: 320 }],
      });
    expect(importResults.status).toBe(201);
    expect(importResults.body.imported).toBe(1);

    const report = await request(app.getHttpServer())
      .get(`/api/v1/ip/campaigns/${campaignId}/reports`)
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader);
    expect(report.status).toBe(200);
    expect(report.body.campaignId).toBe(campaignId);
  });
});
