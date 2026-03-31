import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";

function countSentences(text: string): number {
  return (text.match(/[.!?](\s|$)/g) ?? []).length;
}

function isAlignedPart1Visual(question: {
  stem: string;
  imageUrl?: string;
  options: Array<{ text: string }>;
}): boolean {
  const image = (question.imageUrl ?? "").toLowerCase();
  const corpus = `${question.stem} ${question.options.map((opt) => opt.text).join(" ")}`.toLowerCase();
  if (image.includes("bicycles")) {
    return /(bicycle|bike|fence|parked)/.test(corpus);
  }
  if (image.includes("truck") || image.includes("unloading")) {
    return /(truck|box|loading|unloading|delivery)/.test(corpus);
  }
  if (image.includes("filing") || image.includes("cabinet")) {
    return /(filing|cabinet|drawer|office)/.test(corpus);
  }
  return false;
}

function isSupportedAction(action: string): boolean {
  const normalized = action.trim();
  const [command] = normalized.split("?");
  const allowed = new Set([
    "practice:start",
    "diagnostic:start",
    "mock:start",
    "mistakes:start",
    "vocab:start",
    "shadowing:start",
  ]);
  return allowed.has(command);
}

function parseAction(action: string): { command: string; query: URLSearchParams } {
  const normalized = action.trim();
  const [command, rawQuery] = normalized.split("?");
  return {
    command,
    query: new URLSearchParams(rawQuery ?? ""),
  };
}

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
  let secondCandidateId = "";
  let sessionId = "";
  let mistakesBeforeEmptyMock = 0;

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
      .send({
        email,
        password,
      });
    expect(login.status).toBe(201);
    expect(login.body.accessToken).toBeDefined();
    expect(login.body.tenantCode).toBe(tenantCode);
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
        currentScore: 590,
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
    expect(diagnosticStart.body.questions.some((q: { partNo: number }) => q.partNo >= 1 && q.partNo <= 4)).toBe(true);
    expect(diagnosticStart.body.questions.some((q: { partNo: number }) => q.partNo >= 5 && q.partNo <= 7)).toBe(true);

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

    const diagnosticResubmit = await request(app.getHttpServer())
      .post(`/api/v1/diagnostics/${diagnosticAttemptId}/submit`)
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader)
      .send({ answers: diagnosticAnswers });
    expect(diagnosticResubmit.status).toBe(400);

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

    const listeningBundle = await request(app.getHttpServer())
      .post("/api/v1/practice/sessions?partGroup=listening")
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader);
    expect(listeningBundle.status).toBe(201);
    expect(listeningBundle.body.questions.length).toBeGreaterThan(0);
    expect(
      listeningBundle.body.questions.every(
        (q: { partNo: number; mediaUrl?: string }) =>
          q.partNo >= 1 &&
          q.partNo <= 4 &&
          typeof q.mediaUrl === "string" &&
          /#t=\d+(?:\.\d+)?,\d+(?:\.\d+)?$/.test(q.mediaUrl),
      ),
    ).toBe(true);

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

    const targetedPracticeFollowUp = await request(app.getHttpServer())
      .post("/api/v1/practice/sessions?part=5&difficulty=2")
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader);
    expect(targetedPracticeFollowUp.status).toBe(201);
    const firstRoundIds = new Set(
      targetedPractice.body.questions.map((q: { id: string }) => q.id),
    );
    const overlapCount = targetedPracticeFollowUp.body.questions.filter(
      (q: { id: string }) => firstRoundIds.has(q.id),
    ).length;
    expect(overlapCount).toBe(0);

    const listeningPractice = await request(app.getHttpServer())
      .post("/api/v1/practice/sessions?part=2")
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader);
    expect(listeningPractice.status).toBe(201);
    expect(
      listeningPractice.body.questions.every(
        (q: { partNo: number; mediaUrl?: string; imageUrl?: string }) =>
          q.partNo === 2 &&
          typeof q.mediaUrl === "string" &&
          /#t=\d+(?:\.\d+)?,\d+(?:\.\d+)?$/.test(q.mediaUrl),
      ),
    ).toBe(true);

    const photoPractice = await request(app.getHttpServer())
      .post("/api/v1/practice/sessions?part=1")
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader);
    expect(photoPractice.status).toBe(201);
    expect(photoPractice.body.questions.length).toBeGreaterThan(0);
    expect(
      photoPractice.body.questions.every(
        (q: { partNo: number; mediaUrl?: string; imageUrl?: string; stem: string; options: Array<{ text: string }> }) =>
          q.partNo === 1 &&
          typeof q.mediaUrl === "string" &&
          /#t=\d+(?:\.\d+)?,\d+(?:\.\d+)?$/.test(q.mediaUrl) &&
          typeof q.imageUrl === "string" &&
          isAlignedPart1Visual(q),
      ),
    ).toBe(true);

    const textCompletionPractice = await request(app.getHttpServer())
      .post("/api/v1/practice/sessions?part=6")
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader);
    expect(textCompletionPractice.status).toBe(201);
    expect(textCompletionPractice.body.questions.length).toBeGreaterThan(0);
    expect(
      textCompletionPractice.body.questions.every(
        (q: { partNo: number; stem: string; passage?: string }) => {
          const context = `${q.passage ?? ""} ${q.stem}`.trim();
          return q.partNo === 6 && q.stem.includes("___") && context.length >= 60 && countSentences(context) >= 2;
        },
      ),
    ).toBe(true);

    const readingPractice = await request(app.getHttpServer())
      .post("/api/v1/practice/sessions?part=7")
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader);
    expect(readingPractice.status).toBe(201);
    expect(readingPractice.body.questions.length).toBeGreaterThan(0);
    expect(
      readingPractice.body.questions.every(
        (q: { partNo: number; stem: string; passage?: string }) =>
          q.partNo === 7 &&
          typeof q.passage === "string" &&
          q.passage.trim().length >= 90 &&
          countSentences(q.passage) >= 2 &&
          q.stem.trim().endsWith("?"),
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

    if (mistakeLibrary.body.length > 0) {
      const questionIds = mistakeLibrary.body.slice(0, 3).map((item: { questionId: string }) => item.questionId);
      const mistakeDrill = await request(app.getHttpServer())
        .post("/api/v1/practice/sessions/mistakes/start")
        .set("x-tenant-code", tenantCode)
        .set("Authorization", authHeader)
        .send({ questionIds, limit: 5 });
      expect(mistakeDrill.status).toBe(201);
      expect(mistakeDrill.body.questions.length).toBeGreaterThan(0);
      expect(
        mistakeDrill.body.questions.every((q: { id: string }) => questionIds.includes(q.id)),
      ).toBe(true);
    }

    const resolvableItem = mistakeLibrary.body.find(
      (item: { questionId: string; correctKey?: string | null }) => typeof item.correctKey === "string",
    ) as { questionId: string; correctKey: string } | undefined;
    if (resolvableItem) {
      const resolveDrill = await request(app.getHttpServer())
        .post("/api/v1/practice/sessions/mistakes/start")
        .set("x-tenant-code", tenantCode)
        .set("Authorization", authHeader)
        .send({ questionIds: [resolvableItem.questionId], limit: 5 });
      expect(resolveDrill.status).toBe(201);
      expect(resolveDrill.body.questions.length).toBeGreaterThan(0);

      const resolveAnswers = resolveDrill.body.questions.map(
        (q: { id: string; options: Array<{ key: string }> }) => ({
          questionId: q.id,
          selectedKey: q.id === resolvableItem.questionId ? resolvableItem.correctKey : q.options[0].key,
          durationMs: 7000,
        }),
      );
      const resolveSubmit = await request(app.getHttpServer())
        .post(`/api/v1/practice/sessions/${resolveDrill.body.attemptId}/complete`)
        .set("x-tenant-code", tenantCode)
        .set("Authorization", authHeader)
        .send({ answers: resolveAnswers });
      expect(resolveSubmit.status).toBe(201);

      const mistakeLibraryAfterResolve = await request(app.getHttpServer())
        .get("/api/v1/mistakes/library")
        .set("x-tenant-code", tenantCode)
        .set("Authorization", authHeader);
      expect(mistakeLibraryAfterResolve.status).toBe(200);
      expect(
        mistakeLibraryAfterResolve.body.some(
          (item: { questionId: string }) => item.questionId === resolvableItem.questionId,
        ),
      ).toBe(false);
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
    const mistakesBeforeQuickMock = await request(app.getHttpServer())
      .get("/api/v1/mistakes")
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader);
    expect(mistakesBeforeQuickMock.status).toBe(200);
    mistakesBeforeEmptyMock = mistakesBeforeQuickMock.body.length;

    const quickMock = await request(app.getHttpServer())
      .post("/api/v1/mock-tests/start")
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader);
    expect(quickMock.status).toBe(201);
    const quickMockSubmit = await request(app.getHttpServer())
      .post(`/api/v1/mock-tests/${quickMock.body.attemptId}/submit`)
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader)
      .send({ answers: [] });
    expect(quickMockSubmit.status).toBe(201);
    expect(quickMockSubmit.body.answered).toBe(0);
    const mistakesAfterQuickMock = await request(app.getHttpServer())
      .get("/api/v1/mistakes")
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader);
    expect(mistakesAfterQuickMock.status).toBe(200);
    expect(mistakesAfterQuickMock.body.length).toBe(mistakesBeforeEmptyMock);

    const strictPractice = await request(app.getHttpServer())
      .post("/api/v1/practice/sessions?part=5")
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader);
    expect(strictPractice.status).toBe(201);
    const strictPracticeSubmit = await request(app.getHttpServer())
      .post(`/api/v1/practice/sessions/${strictPractice.body.attemptId}/complete`)
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader)
      .send({ answers: [] });
    expect(strictPracticeSubmit.status).toBe(400);

    const prediction = await request(app.getHttpServer())
      .get("/api/v1/predictions/latest")
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader);
    expect(prediction.status).toBe(200);
    expect(prediction.body.predictedTotal).toBeGreaterThanOrEqual(10);
    expect(prediction.body.predictedTotal).toBeGreaterThanOrEqual(530);

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
    expect(analytics.body.goal.baselineScore).toBe(590);
    expect(typeof analytics.body.goal.gap).toBe("number");
    expect(typeof analytics.body.activeDays7).toBe("number");
    expect(typeof analytics.body.currentStreak).toBe("number");
    expect(typeof analytics.body.studyMinutes7).toBe("number");
    expect(analytics.body.modeBreakdown).toMatchObject({
      diagnostic: expect.any(Number),
      practice: expect.any(Number),
      mock: expect.any(Number),
      ip_simulation: expect.any(Number),
    });
    expect(analytics.body.goalPace).toMatchObject({
      daysToExam: expect.any(Number),
      requiredWeeklyGain: expect.any(Number),
      status: expect.stringMatching(/^(on_track|at_risk|critical|no_goal)$/),
    });

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
    expect(
      nextTasks.body.tasks.every((task: { action: string }) => isSupportedAction(task.action)),
    ).toBe(true);

    const dailyPlan = await request(app.getHttpServer())
      .get("/api/v1/learning/daily-plan")
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader);
    expect(dailyPlan.status).toBe(200);
    expect(dailyPlan.body.totalMinutes).toBe(60);
    expect(Array.isArray(dailyPlan.body.blocks)).toBe(true);
    expect(dailyPlan.body.blocks.length).toBeGreaterThan(0);
    expect(dailyPlan.body.blocks[0]).toMatchObject({
      id: expect.any(String),
      title: expect.any(String),
      minutes: expect.any(Number),
      reason: expect.any(String),
      action: expect.any(String),
    });
    expect(Array.isArray(dailyPlan.body.blocks[0].checklist)).toBe(true);
    expect(dailyPlan.body.blocks[0].checklist.length).toBeGreaterThan(0);
    expect(Array.isArray(dailyPlan.body.weekSchedule)).toBe(true);
    expect(dailyPlan.body.weekSchedule.length).toBe(7);
    expect(dailyPlan.body.weekSchedule[0]).toMatchObject({
      date: expect.any(String),
      dayLabel: expect.any(String),
      totalMinutes: expect.any(Number),
      tasks: expect.any(Array),
    });
    expect(dailyPlan.body.weekSchedule[0].tasks.length).toBeGreaterThan(0);
    expect(
      dailyPlan.body.weekSchedule.every(
        (day: { totalMinutes: number }) => day.totalMinutes >= 55 && day.totalMinutes <= 65,
      ),
    ).toBe(true);
    expect(
      dailyPlan.body.blocks.every((block: { action: string }) => isSupportedAction(block.action)),
    ).toBe(true);
    expect(
      dailyPlan.body.weekSchedule.every((day: { tasks: Array<{ action: string }> }) =>
        day.tasks.every((task) => isSupportedAction(task.action)),
      ),
    ).toBe(true);

    const actionSet = new Set<string>([
      ...nextTasks.body.tasks.map((task: { action: string }) => task.action),
      ...dailyPlan.body.blocks.map((block: { action: string }) => block.action),
      ...dailyPlan.body.weekSchedule.flatMap((day: { tasks: Array<{ action: string }> }) =>
        day.tasks.map((task) => task.action),
      ),
    ]);

    const executeGeneratedAction = async (action: string) => {
      const { command, query } = parseAction(action);
      const queryText = query.toString();
      const suffix = queryText ? `?${queryText}` : "";

      if (command === "practice:start") {
        const start = await request(app.getHttpServer())
          .post(`/api/v1/practice/sessions${suffix}`)
          .set("x-tenant-code", tenantCode)
          .set("Authorization", authHeader);
        expect(start.status).toBe(201);
        expect(start.body.questions.length).toBeGreaterThan(0);
        return;
      }

      if (command === "diagnostic:start") {
        const start = await request(app.getHttpServer())
          .post(`/api/v1/diagnostics/start${suffix}`)
          .set("x-tenant-code", tenantCode)
          .set("Authorization", authHeader);
        expect(start.status).toBe(201);
        expect(start.body.questions.length).toBeGreaterThan(0);
        return;
      }

      if (command === "mock:start") {
        const start = await request(app.getHttpServer())
          .post(`/api/v1/mock-tests/start${suffix}`)
          .set("x-tenant-code", tenantCode)
          .set("Authorization", authHeader);
        expect(start.status).toBe(201);
        expect(start.body.questions.length).toBeGreaterThan(0);
        return;
      }

      if (command === "mistakes:start") {
        const library = await request(app.getHttpServer())
          .get("/api/v1/mistakes/library")
          .set("x-tenant-code", tenantCode)
          .set("Authorization", authHeader);
        expect(library.status).toBe(200);
        return;
      }

      if (command === "vocab:start") {
        const cards = await request(app.getHttpServer())
          .get("/api/v1/learning/vocabulary/cards")
          .set("x-tenant-code", tenantCode)
          .set("Authorization", authHeader);
        expect(cards.status).toBe(200);
        return;
      }

      if (command === "shadowing:start") {
        expect(true).toBe(true);
        return;
      }

      throw new Error(`Unsupported action in test execution: ${action}`);
    };

    for (const action of actionSet) {
      await executeGeneratedAction(action);
    }

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

    const dedupeImport = await request(app.getHttpServer())
      .post(`/api/v1/ip/campaigns/${campaignId}/candidates/import`)
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader)
      .send({
        candidates: [
          { employeeNo: "E1001", fullName: "Alice Chen", email: "alice@example.com" },
          { fullName: "Alice Chen" },
          { fullName: "Carol Wu" },
        ],
      });
    expect(dedupeImport.status).toBe(201);
    expect(dedupeImport.body.imported).toBe(1);

    const candidates = await request(app.getHttpServer())
      .get(`/api/v1/ip/campaigns/${campaignId}/candidates`)
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader);
    expect(candidates.status).toBe(200);
    expect(candidates.body.length).toBe(3);
    candidateId = candidates.body[0].id;
    secondCandidateId = candidates.body[1].id;

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

    const sessionList = await request(app.getHttpServer())
      .get(`/api/v1/ip/campaigns/${campaignId}/sessions`)
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader);
    expect(sessionList.status).toBe(200);
    expect(sessionList.body.length).toBeGreaterThan(0);
    expect(sessionList.body[0]).toMatchObject({
      id: expect.any(String),
      seatCapacity: expect.any(Number),
      rosterSize: expect.any(Number),
      occupiedSeats: expect.any(Number),
      availableSeats: expect.any(Number),
      statusCount: expect.objectContaining({
        invited: expect.any(Number),
        checked_in: expect.any(Number),
        in_progress: expect.any(Number),
        submitted: expect.any(Number),
        absent: expect.any(Number),
      }),
    });

    const sessionCandidates = await request(app.getHttpServer())
      .get(`/api/v1/ip/sessions/${sessionId}/candidates`)
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader);
    expect(sessionCandidates.status).toBe(200);
    expect(sessionCandidates.body.length).toBeGreaterThan(0);
    expect(sessionCandidates.body[0]).toMatchObject({
      candidateId: expect.any(String),
      status: expect.any(String),
      fullName: expect.any(String),
    });

    const absent = await request(app.getHttpServer())
      .post(`/api/v1/ip/sessions/${sessionId}/absent`)
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader)
      .send({ candidateId: secondCandidateId });
    expect(absent.status).toBe(201);
    expect(absent.body.status).toBe("absent");

    const absentCheckin = await request(app.getHttpServer())
      .post(`/api/v1/ip/sessions/${sessionId}/check-in`)
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader)
      .send({ candidateId: secondCandidateId });
    expect(absentCheckin.status).toBe(400);

    const checkin = await request(app.getHttpServer())
      .post(`/api/v1/ip/sessions/${sessionId}/check-in`)
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader)
      .send({ candidateId });
    expect(checkin.status).toBe(201);
    expect(checkin.body.status).toBe("checked_in");

    const start = await request(app.getHttpServer())
      .post(`/api/v1/ip/sessions/${sessionId}/start`)
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader)
      .send({ candidateId });
    expect(start.status).toBe(201);
    expect(start.body.status).toBe("in_progress");

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
        rows: [{ candidateId: secondCandidateId, scoreL: 280, scoreR: 300 }],
      });
    expect(importResults.status).toBe(400);

    const importResultsAfterSubmit = await request(app.getHttpServer())
      .post(`/api/v1/ip/campaigns/${campaignId}/results/import`)
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader)
      .send({
        rows: [{ candidateId, scoreL: 300, scoreR: 320 }],
      });
    expect(importResultsAfterSubmit.status).toBe(201);
    expect(importResultsAfterSubmit.body.imported).toBe(1);

    const report = await request(app.getHttpServer())
      .get(`/api/v1/ip/campaigns/${campaignId}/reports`)
      .set("x-tenant-code", tenantCode)
      .set("Authorization", authHeader);
    expect(report.status).toBe(200);
    expect(report.body.campaignId).toBe(campaignId);
    expect(report.body.statusBreakdown).toMatchObject({
      invited: expect.any(Number),
      checked_in: expect.any(Number),
      in_progress: expect.any(Number),
      submitted: expect.any(Number),
      absent: expect.any(Number),
    });
    expect(typeof report.body.attendanceRate).toBe("number");
    expect(typeof report.body.submissionRate).toBe("number");
  });
});
