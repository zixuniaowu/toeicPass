import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { compare, hash } from "bcryptjs";
import {
  CheckInDto,
  CreateIpCampaignDto,
  CreateIpSessionDto,
  CreateQuestionDto,
  GoalDto,
  GradeCardDto,
  ImportCandidatesDto,
  ImportIpResultsDto,
  LoginDto,
  MistakeNoteDto,
  RegisterDto,
  SubmitAttemptDto,
} from "./dto";
import { QueueService } from "./queue.service";
import { StoreService } from "./store.service";
import { Attempt, AttemptItem, AttemptMode, ReviewCard } from "./types";
import { clamp, newId, nowIso } from "./utils";
import { RequestContext } from "./context";

@Injectable()
export class AppService {
  constructor(
    private readonly store: StoreService,
    private readonly jwtService: JwtService,
    private readonly queue: QueueService,
  ) {}

  async register(dto: RegisterDto): Promise<{ userId: string }> {
    const normalizedEmail = dto.email.toLowerCase().trim();
    const existingUser = this.store.users.find((item) => item.email === normalizedEmail);
    if (existingUser) {
      throw new BadRequestException("Email already registered");
    }

    let tenant = this.store.tenants.find((item) => item.code === dto.tenantCode);
    if (!tenant) {
      tenant = {
        id: newId(),
        code: dto.tenantCode,
        name: dto.tenantName,
        createdAt: nowIso(),
      };
      this.store.tenants.push(tenant);
    }

    const passwordHash = await hash(dto.password, 10);
    const user = {
      id: newId(),
      email: normalizedEmail,
      passwordHash,
      displayName: dto.displayName,
      isActive: true,
      createdAt: nowIso(),
    };
    this.store.users.push(user);

    const tenantUsers = this.store.memberships.filter((item) => item.tenantId === tenant!.id);
    const role = tenantUsers.length === 0 ? "tenant_admin" : "learner";
    this.store.memberships.push({
      id: newId(),
      tenantId: tenant.id,
      userId: user.id,
      role,
    });

    this.store.ensureSeedQuestions(tenant.id, user.id);
    this.store.ensureSeedVocabularyCards(tenant.id, user.id);

    return { userId: user.id };
  }

  async login(dto: LoginDto): Promise<{ accessToken: string }> {
    const normalizedEmail = dto.email.toLowerCase().trim();
    const user = this.store.users.find((item) => item.email === normalizedEmail);
    if (!user) {
      throw new UnauthorizedException("Invalid credentials");
    }
    const matched = await compare(dto.password, user.passwordHash);
    if (!matched) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const tenant = this.store.tenants.find((item) => item.code === dto.tenantCode);
    if (!tenant) {
      throw new UnauthorizedException("Tenant not found");
    }
    const membership = this.store.memberships.find(
      (item) => item.tenantId === tenant.id && item.userId === user.id,
    );
    if (!membership) {
      throw new UnauthorizedException("No tenant access");
    }
    this.store.ensureSeedQuestions(tenant.id, user.id);
    this.store.ensureSeedVocabularyCards(tenant.id, user.id);

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
    });
    return { accessToken };
  }

  async refreshToken(userId: string): Promise<{ accessToken: string }> {
    const user = this.store.users.find((item) => item.id === userId);
    if (!user) {
      throw new NotFoundException("User not found");
    }
    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
    });
    return { accessToken };
  }

  getMe(ctx: RequestContext): {
    id: string;
    email: string;
    displayName: string;
    roles: string[];
    tenantId: string;
  } {
    const user = this.store.users.find((item) => item.id === ctx.userId);
    if (!user) {
      throw new NotFoundException("User not found");
    }
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      roles: ctx.roles,
      tenantId: ctx.tenantId,
    };
  }

  createGoal(ctx: RequestContext, dto: GoalDto): { goalId: string } {
    const goal = {
      id: newId(),
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      targetScore: dto.targetScore,
      targetExamDate: dto.targetExamDate,
      baselineScore: this.latestScore(ctx),
      createdAt: nowIso(),
    };
    this.store.goals.push(goal);
    return { goalId: goal.id };
  }

  getCurrentGoal(ctx: RequestContext) {
    return this.store.goals
      .filter((item) => item.userId === ctx.userId && item.tenantId === ctx.tenantId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
  }

  createQuestion(ctx: RequestContext, dto: CreateQuestionDto): { questionId: string } {
    const correctCount = dto.options.filter((item) => Boolean(item.isCorrect)).length;
    if (correctCount !== 1) {
      throw new BadRequestException("Exactly one option must be marked correct");
    }
    const question = {
      id: newId(),
      tenantId: ctx.tenantId,
      partNo: dto.partNo,
      skillTag: dto.skillTag,
      difficulty: dto.difficulty,
      stem: dto.stem,
      explanation: dto.explanation,
      status: "draft" as const,
      createdBy: ctx.userId,
      createdAt: nowIso(),
      options: dto.options.map((item) => ({
        key: item.key,
        text: item.text,
        isCorrect: Boolean(item.isCorrect),
      })),
    };
    this.store.questions.push(question);
    return { questionId: question.id };
  }

  publishQuestion(ctx: RequestContext, questionId: string): { questionId: string; status: string } {
    const question = this.store.questions.find(
      (item) => item.id === questionId && item.tenantId === ctx.tenantId,
    );
    if (!question) {
      throw new NotFoundException("Question not found");
    }
    question.status = "published";
    return { questionId: question.id, status: question.status };
  }

  listQuestions(ctx: RequestContext, part?: number, difficulty?: number) {
    return this.store.questions.filter((item) => {
      if (item.tenantId !== ctx.tenantId) {
        return false;
      }
      if (typeof part === "number" && item.partNo !== part) {
        return false;
      }
      if (typeof difficulty === "number" && item.difficulty !== difficulty) {
        return false;
      }
      return true;
    });
  }

  listAuditLogs(ctx: RequestContext) {
    return this.store.auditLogs
      .filter((item) => !item.tenantId || item.tenantId === ctx.tenantId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 200);
  }

  startAttempt(
    ctx: RequestContext,
    mode: AttemptMode,
    filters?: { partNo?: number; difficulty?: number },
  ): {
    attemptId: string;
    mode: AttemptMode;
    questions: Array<{
      id: string;
      stem: string;
      partNo: number;
      mediaUrl?: string;
      imageUrl?: string;
      options: Array<{ key: string; text: string }>;
    }>;
  } {
    const questionPool = this.store.questions.filter(
      (item) =>
        item.tenantId === ctx.tenantId &&
        item.status === "published" &&
        (typeof filters?.partNo === "number" ? item.partNo === filters.partNo : true) &&
        (typeof filters?.difficulty === "number" ? item.difficulty === filters.difficulty : true),
    );
    if (questionPool.length === 0) {
      throw new BadRequestException("No published questions available");
    }
    const targetCount =
      mode === "diagnostic" ? 20 : mode === "practice" ? 12 : mode === "mock" ? 30 : 30;
    const selected = this.shuffle(questionPool).slice(0, Math.min(targetCount, questionPool.length));
    const attempt: Attempt = {
      id: newId(),
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      mode,
      startedAt: nowIso(),
    };
    this.store.attempts.push(attempt);

    selected.forEach((question) => {
      this.store.attemptItems.push({
        id: newId(),
        attemptId: attempt.id,
        questionId: question.id,
        createdAt: nowIso(),
      });
    });

    return {
      attemptId: attempt.id,
      mode,
      questions: selected.map((q) => ({
        id: q.id,
        stem: q.stem,
        partNo: q.partNo,
        mediaUrl: q.mediaUrl,
        imageUrl: q.imageUrl,
        options: q.options.map((item) => ({ key: item.key, text: item.text })),
      })),
    };
  }

  submitAttempt(ctx: RequestContext, attemptId: string, dto: SubmitAttemptDto) {
    const attempt = this.store.attempts.find(
      (item) => item.id === attemptId && item.tenantId === ctx.tenantId && item.userId === ctx.userId,
    );
    if (!attempt) {
      throw new NotFoundException("Attempt not found");
    }

    const items = this.store.attemptItems.filter((item) => item.attemptId === attempt.id);
    const byQuestion = new Map(items.map((item) => [item.questionId, item]));
    dto.answers.forEach((answer) => {
      const item = byQuestion.get(answer.questionId);
      if (!item) {
        return;
      }
      item.selectedKey = answer.selectedKey;
      item.durationMs = answer.durationMs ?? 0;
      const question = this.store.questions.find((q) => q.id === answer.questionId);
      if (question) {
        const correct = question.options.find((opt) => opt.isCorrect)?.key;
        item.isCorrect = correct === answer.selectedKey;
      }
    });

    const scoredItems = items.filter((item) => typeof item.isCorrect === "boolean");
    const listeningItems = scoredItems.filter((item) => this.questionPart(item.questionId) <= 4);
    const readingItems = scoredItems.filter((item) => this.questionPart(item.questionId) >= 5);
    const lCorrect = listeningItems.filter((item) => item.isCorrect).length;
    const rCorrect = readingItems.filter((item) => item.isCorrect).length;
    const scoreL = clamp(Math.round((lCorrect / Math.max(1, listeningItems.length)) * 490 + 5), 5, 495);
    const scoreR = clamp(Math.round((rCorrect / Math.max(1, readingItems.length)) * 490 + 5), 5, 495);

    attempt.submittedAt = nowIso();
    attempt.scoreL = scoreL;
    attempt.scoreR = scoreR;
    attempt.scoreTotal = scoreL + scoreR;

    this.createOrRefreshReviewCards(ctx, scoredItems);
    const prediction = this.recalculatePrediction(ctx);
    this.queue.enqueue("prediction.recalculate", {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      predictionId: prediction.id,
    });

    return {
      attemptId,
      scoreL,
      scoreR,
      scoreTotal: attempt.scoreTotal,
      correct: scoredItems.filter((item) => item.isCorrect).length,
      answered: scoredItems.length,
      review: items.map((item) => {
        const question = this.store.questions.find((q) => q.id === item.questionId);
        const correctKey = question?.options.find((opt) => opt.isCorrect)?.key;
        return {
          questionId: item.questionId,
          partNo: question?.partNo ?? null,
          stem: question?.stem ?? "",
          mediaUrl: question?.mediaUrl ?? null,
          imageUrl: question?.imageUrl ?? null,
          selectedKey: item.selectedKey ?? null,
          correctKey: correctKey ?? null,
          isCorrect: item.isCorrect ?? false,
          explanation: question?.explanation ?? "",
        };
      }),
    };
  }

  analyticsOverview(ctx: RequestContext): {
    attempts: number;
    questionsAnswered: number;
    overallAccuracy: number;
    avgDurationMs: number;
    latestScore: number | null;
    scoreHistory: number[];
    byPart: Array<{
      partNo: number;
      answered: number;
      correct: number;
      accuracy: number;
      avgDurationMs: number;
    }>;
    goal: {
      targetScore: number | null;
      gap: number | null;
      targetExamDate: string | null;
    };
  } {
    const userAttempts = this.store.attempts.filter(
      (item) => item.tenantId === ctx.tenantId && item.userId === ctx.userId && Boolean(item.submittedAt),
    );
    const attemptIds = new Set(userAttempts.map((item) => item.id));
    const answeredItems = this.store.attemptItems.filter(
      (item) => attemptIds.has(item.attemptId) && typeof item.isCorrect === "boolean",
    );

    const totalAnswered = answeredItems.length;
    const totalCorrect = answeredItems.filter((item) => item.isCorrect).length;
    const totalDuration = answeredItems.reduce((sum, item) => sum + (item.durationMs ?? 0), 0);

    const partMap = new Map<number, { answered: number; correct: number; duration: number }>();
    answeredItems.forEach((item) => {
      const partNo = this.questionPart(item.questionId);
      const bucket = partMap.get(partNo) ?? { answered: 0, correct: 0, duration: 0 };
      bucket.answered += 1;
      if (item.isCorrect) {
        bucket.correct += 1;
      }
      bucket.duration += item.durationMs ?? 0;
      partMap.set(partNo, bucket);
    });

    const byPart = Array.from(partMap.entries())
      .map(([partNo, value]) => ({
        partNo,
        answered: value.answered,
        correct: value.correct,
        accuracy: value.answered ? Number((value.correct / value.answered).toFixed(4)) : 0,
        avgDurationMs: value.answered ? Math.round(value.duration / value.answered) : 0,
      }))
      .sort((a, b) => a.partNo - b.partNo);

    const scoreHistory = userAttempts
      .filter((item) => typeof item.scoreTotal === "number")
      .sort((a, b) => (b.submittedAt ?? "").localeCompare(a.submittedAt ?? ""))
      .slice(0, 10)
      .map((item) => item.scoreTotal ?? 0);

    const currentGoal =
      this.store.goals
        .filter((item) => item.tenantId === ctx.tenantId && item.userId === ctx.userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
    const latestScore = this.latestScore(ctx) ?? null;
    const gap =
      typeof currentGoal?.targetScore === "number" && typeof latestScore === "number"
        ? Math.max(0, currentGoal.targetScore - latestScore)
        : null;

    return {
      attempts: userAttempts.length,
      questionsAnswered: totalAnswered,
      overallAccuracy: totalAnswered ? Number((totalCorrect / totalAnswered).toFixed(4)) : 0,
      avgDurationMs: totalAnswered ? Math.round(totalDuration / totalAnswered) : 0,
      latestScore,
      scoreHistory,
      byPart,
      goal: {
        targetScore: currentGoal?.targetScore ?? null,
        gap,
        targetExamDate: currentGoal?.targetExamDate ?? null,
      },
    };
  }

  nextTasks(ctx: RequestContext): {
    generatedAt: string;
    tasks: Array<{ id: string; title: string; reason: string; action: string; priority: number }>;
  } {
    const analytics = this.analyticsOverview(ctx);
    const dueCards = this.getDueCards(ctx).length;
    const today = new Date().toISOString().slice(0, 10);
    const dueVocab = this.store.vocabularyCards.filter(
      (item) => item.tenantId === ctx.tenantId && item.userId === ctx.userId && item.dueAt <= today,
    ).length;
    const weakParts = [...analytics.byPart]
      .filter((item) => item.answered > 0)
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 2);
    const tasks: Array<{ id: string; title: string; reason: string; action: string; priority: number }> = [];

    if (weakParts[0]) {
      tasks.push({
        id: `weak-part-${weakParts[0].partNo}`,
        title: `强化 Part ${weakParts[0].partNo}`,
        reason: `当前正确率 ${(weakParts[0].accuracy * 100).toFixed(0)}%`,
        action: `practice:start?part=${weakParts[0].partNo}`,
        priority: 1,
      });
    }

    if (weakParts[1]) {
      tasks.push({
        id: `weak-part-${weakParts[1].partNo}`,
        title: `补强 Part ${weakParts[1].partNo}`,
        reason: `当前正确率 ${(weakParts[1].accuracy * 100).toFixed(0)}%`,
        action: `practice:start?part=${weakParts[1].partNo}`,
        priority: 2,
      });
    }

    if (dueCards > 0) {
      tasks.push({
        id: "review-cards",
        title: `复习 ${dueCards} 道到期错题`,
        reason: "间隔复习到期，优先复盘可稳住记忆曲线",
        action: "review:start",
        priority: 1,
      });
    }

    if (dueVocab > 0) {
      tasks.push({
        id: "vocab-due",
        title: `复习 ${dueVocab} 个词卡`,
        reason: "词汇是听读共同基础，先清空到期词卡提升理解速度",
        action: "vocab:start",
        priority: 1,
      });
    }

    if ((analytics.goal.gap ?? 0) > 0) {
      tasks.push({
        id: "mock-gap",
        title: "执行一次完整模测",
        reason: `距目标还差 ${analytics.goal.gap} 分，需要真实压力下评估`,
        action: "mock:start",
        priority: 2,
      });
    }

    if (analytics.questionsAnswered < 40) {
      tasks.push({
        id: "volume-build",
        title: "补足做题量（至少 40 题）",
        reason: "当前样本过小，预测分数置信度不足",
        action: "practice:start",
        priority: 3,
      });
    }

    if (tasks.length === 0) {
      tasks.push({
        id: "maintenance-practice",
        title: "维持训练强度",
        reason: "本周数据平衡，继续保持每日训练节奏",
        action: "practice:start",
        priority: 3,
      });
    }

    return {
      generatedAt: nowIso(),
      tasks: tasks.sort((a, b) => a.priority - b.priority).slice(0, 6),
    };
  }

  getPracticeRecommendations(ctx: RequestContext) {
    const byPart = new Map<number, { answered: number; correct: number }>();
    this.store.attemptItems.forEach((item) => {
      const attempt = this.store.attempts.find((a) => a.id === item.attemptId);
      if (!attempt || attempt.tenantId !== ctx.tenantId || attempt.userId !== ctx.userId) {
        return;
      }
      const part = this.questionPart(item.questionId);
      const bucket = byPart.get(part) ?? { answered: 0, correct: 0 };
      bucket.answered += 1;
      if (item.isCorrect) {
        bucket.correct += 1;
      }
      byPart.set(part, bucket);
    });

    const recommendations = Array.from(byPart.entries())
      .map(([part, value]) => ({
        part,
        accuracy: value.answered ? value.correct / value.answered : 0,
      }))
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 3)
      .map((item) => ({
        part: item.part,
        message: `Focus Part ${item.part}; current accuracy ${(item.accuracy * 100).toFixed(0)}%`,
      }));

    return recommendations.length > 0 ? recommendations : [{ part: 1, message: "Start with Part 1 fundamentals." }];
  }

  listMistakes(ctx: RequestContext) {
    const userAttempts = this.store.attempts
      .filter((item) => item.userId === ctx.userId && item.tenantId === ctx.tenantId)
      .map((item) => item.id);
    const badItems = this.store.attemptItems.filter(
      (item) => userAttempts.includes(item.attemptId) && item.isCorrect === false,
    );
    return badItems.map((item) => ({
      attemptItemId: item.id,
      questionId: item.questionId,
      questionStem: this.store.questions.find((q) => q.id === item.questionId)?.stem ?? "",
      note: this.store.mistakeNotes
        .filter((note) => note.attemptItemId === item.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null,
    }));
  }

  getMistakeLibrary(ctx: RequestContext) {
    const userAttempts = this.store.attempts.filter(
      (item) => item.userId === ctx.userId && item.tenantId === ctx.tenantId,
    );
    const attemptMap = new Map(userAttempts.map((item) => [item.id, item]));
    const wrongItems = this.store.attemptItems.filter(
      (item) => attemptMap.has(item.attemptId) && item.isCorrect === false,
    );
    const grouped = new Map<string, AttemptItem[]>();
    wrongItems.forEach((item) => {
      const bucket = grouped.get(item.questionId) ?? [];
      bucket.push(item);
      grouped.set(item.questionId, bucket);
    });

    const library = Array.from(grouped.entries()).map(([questionId, items]) => {
      const question = this.store.questions.find((q) => q.id === questionId);
      const correctKey = question?.options.find((opt) => opt.isCorrect)?.key ?? null;
      const ranked = [...items].sort((a, b) => {
        const aAttemptAt = attemptMap.get(a.attemptId)?.submittedAt ?? a.createdAt;
        const bAttemptAt = attemptMap.get(b.attemptId)?.submittedAt ?? b.createdAt;
        return bAttemptAt.localeCompare(aAttemptAt);
      });
      const latestItem = ranked[0];
      const latestWrongAt = attemptMap.get(latestItem.attemptId)?.submittedAt ?? latestItem.createdAt;
      const attemptItemIds = new Set(ranked.map((item) => item.id));
      const latestNote =
        this.store.mistakeNotes
          .filter((note) => attemptItemIds.has(note.attemptItemId))
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;

      return {
        questionId,
        partNo: question?.partNo ?? null,
        stem: question?.stem ?? "",
        explanation: question?.explanation ?? "",
        mediaUrl: question?.mediaUrl ?? null,
        imageUrl: question?.imageUrl ?? null,
        options: (question?.options ?? []).map((opt) => ({ key: opt.key, text: opt.text })),
        correctKey,
        wrongCount: ranked.length,
        latestAttemptItemId: latestItem.id,
        lastSelectedKey: latestItem.selectedKey ?? null,
        lastWrongAt: latestWrongAt,
        latestNote: latestNote
          ? {
              note: latestNote.note,
              rootCause: latestNote.rootCause ?? null,
              createdAt: latestNote.createdAt,
            }
          : null,
      };
    });

    return library.sort((a, b) => b.lastWrongAt.localeCompare(a.lastWrongAt));
  }

  addMistakeNote(ctx: RequestContext, attemptItemId: string, dto: MistakeNoteDto) {
    const attemptItem = this.store.attemptItems.find((item) => item.id === attemptItemId);
    if (!attemptItem) {
      throw new NotFoundException("Attempt item not found");
    }
    const attempt = this.store.attempts.find((item) => item.id === attemptItem.attemptId);
    if (!attempt || attempt.userId !== ctx.userId || attempt.tenantId !== ctx.tenantId) {
      throw new UnauthorizedException("No access");
    }
    const note = {
      id: newId(),
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      attemptItemId,
      rootCause: dto.rootCause,
      note: dto.note,
      createdAt: nowIso(),
    };
    this.store.mistakeNotes.push(note);
    return note;
  }

  getVocabularyCards(ctx: RequestContext) {
    this.store.ensureSeedVocabularyCards(ctx.tenantId, ctx.userId);
    const today = new Date().toISOString().slice(0, 10);
    const cards = this.store.vocabularyCards
      .filter((item) => item.tenantId === ctx.tenantId && item.userId === ctx.userId)
      .sort((a, b) => {
        const dueCompare = a.dueAt.localeCompare(b.dueAt);
        return dueCompare !== 0 ? dueCompare : a.term.localeCompare(b.term);
      });
    const dueCount = cards.filter((card) => card.dueAt <= today).length;
    const masteredCount = cards.filter((card) => card.intervalDays >= 14 && (card.lastGrade ?? 0) >= 4).length;
    return {
      generatedAt: nowIso(),
      summary: {
        total: cards.length,
        due: dueCount,
        learning: cards.length - masteredCount,
        mastered: masteredCount,
      },
      cards: cards.map((card) => ({
        ...card,
        due: card.dueAt <= today,
      })),
    };
  }

  gradeVocabularyCard(ctx: RequestContext, cardId: string, dto: GradeCardDto) {
    const card = this.store.vocabularyCards.find(
      (item) => item.id === cardId && item.tenantId === ctx.tenantId && item.userId === ctx.userId,
    );
    if (!card) {
      throw new NotFoundException("Vocabulary card not found");
    }

    const baseInterval = card.intervalDays <= 0 ? 1 : card.intervalDays;
    const easeDelta = dto.grade >= 4 ? 0.12 : dto.grade === 3 ? 0.05 : -0.22;
    card.easeFactor = clamp(Number((card.easeFactor + easeDelta).toFixed(2)), 1.3, 3.2);

    if (dto.grade >= 4) {
      card.intervalDays = Math.max(2, Math.round(baseInterval * card.easeFactor));
    } else if (dto.grade === 3) {
      card.intervalDays = Math.max(1, Math.round(baseInterval * 1.6));
    } else {
      card.intervalDays = 1;
    }

    card.lastGrade = dto.grade;
    card.dueAt = this.plusDays(card.intervalDays);
    return card;
  }

  getDueCards(ctx: RequestContext) {
    const today = new Date().toISOString().slice(0, 10);
    return this.store.reviewCards
      .filter((item) => item.tenantId === ctx.tenantId && item.userId === ctx.userId && item.dueAt <= today)
      .map((card) => ({
        ...card,
        question: this.store.questions.find((q) => q.id === card.questionId),
      }));
  }

  gradeCard(ctx: RequestContext, cardId: string, dto: GradeCardDto): ReviewCard {
    const card = this.store.reviewCards.find(
      (item) => item.id === cardId && item.tenantId === ctx.tenantId && item.userId === ctx.userId,
    );
    if (!card) {
      throw new NotFoundException("Card not found");
    }
    const easeDelta = dto.grade >= 3 ? 0.15 : -0.2;
    card.easeFactor = clamp(Number((card.easeFactor + easeDelta).toFixed(2)), 1.3, 3.0);
    card.intervalDays = dto.grade >= 3 ? Math.max(1, Math.round(card.intervalDays * card.easeFactor)) : 1;
    card.lastGrade = dto.grade;
    card.dueAt = this.plusDays(card.intervalDays);
    return card;
  }

  getMockHistory(ctx: RequestContext) {
    return this.store.attempts
      .filter((item) => item.tenantId === ctx.tenantId && item.userId === ctx.userId && item.mode === "mock")
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }

  getLatestPrediction(ctx: RequestContext) {
    return (
      this.store.predictions
        .filter((item) => item.tenantId === ctx.tenantId && item.userId === ctx.userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null
    );
  }

  createIpCampaign(ctx: RequestContext, dto: CreateIpCampaignDto) {
    const campaign = {
      id: newId(),
      tenantId: ctx.tenantId,
      name: dto.name,
      mode: dto.mode,
      plannedDate: dto.plannedDate,
      status: "draft" as const,
      createdBy: ctx.userId,
      createdAt: nowIso(),
    };
    this.store.ipCampaigns.push(campaign);
    return campaign;
  }

  listIpCampaigns(ctx: RequestContext) {
    return this.store.ipCampaigns
      .filter((item) => item.tenantId === ctx.tenantId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  listIpCandidates(ctx: RequestContext, campaignId: string) {
    this.ensureCampaign(ctx.tenantId, campaignId);
    return this.store.ipCandidates.filter(
      (item) => item.tenantId === ctx.tenantId && item.campaignId === campaignId,
    );
  }

  importIpCandidates(ctx: RequestContext, campaignId: string, dto: ImportCandidatesDto) {
    this.ensureCampaign(ctx.tenantId, campaignId);
    const created = dto.candidates.map((row) => {
      const candidate = {
        id: newId(),
        tenantId: ctx.tenantId,
        campaignId,
        employeeNo: row.employeeNo,
        fullName: row.fullName,
        email: row.email,
      };
      this.store.ipCandidates.push(candidate);
      return candidate;
    });
    return { imported: created.length };
  }

  createIpSession(ctx: RequestContext, campaignId: string, dto: CreateIpSessionDto) {
    this.ensureCampaign(ctx.tenantId, campaignId);
    const session = {
      id: newId(),
      tenantId: ctx.tenantId,
      campaignId,
      sessionCode: dto.sessionCode,
      startsAt: dto.startsAt,
      endsAt: dto.endsAt,
      seatCapacity: dto.seatCapacity,
      proctorUserId: ctx.userId,
    };
    this.store.ipSessions.push(session);

    const campaignCandidates = this.store.ipCandidates.filter((item) => item.campaignId === campaignId);
    campaignCandidates.forEach((candidate) => {
      this.store.ipSessionCandidates.push({
        id: newId(),
        tenantId: ctx.tenantId,
        sessionId: session.id,
        candidateId: candidate.id,
        status: "invited",
      });
    });
    return session;
  }

  checkInIpSessionCandidate(ctx: RequestContext, sessionId: string, dto: CheckInDto) {
    const sessionCandidate = this.store.ipSessionCandidates.find(
      (item) => item.tenantId === ctx.tenantId && item.sessionId === sessionId && item.candidateId === dto.candidateId,
    );
    if (!sessionCandidate) {
      throw new NotFoundException("Candidate not found in session");
    }
    sessionCandidate.status = "checked_in";
    sessionCandidate.checkedInAt = nowIso();
    return sessionCandidate;
  }

  submitIpSessionCandidate(ctx: RequestContext, sessionId: string, dto: CheckInDto) {
    const sessionCandidate = this.store.ipSessionCandidates.find(
      (item) => item.tenantId === ctx.tenantId && item.sessionId === sessionId && item.candidateId === dto.candidateId,
    );
    if (!sessionCandidate) {
      throw new NotFoundException("Candidate not found in session");
    }
    sessionCandidate.status = "submitted";
    sessionCandidate.submittedAt = nowIso();
    return sessionCandidate;
  }

  importIpResults(ctx: RequestContext, campaignId: string, dto: ImportIpResultsDto) {
    this.ensureCampaign(ctx.tenantId, campaignId);
    let imported = 0;
    dto.rows.forEach((row) => {
      const candidate = this.store.ipCandidates.find(
        (item) => item.tenantId === ctx.tenantId && item.campaignId === campaignId && item.id === row.candidateId,
      );
      if (!candidate) {
        throw new NotFoundException(`Candidate not found: ${row.candidateId}`);
      }
      const existing = this.store.ipResults.find(
        (item) => item.tenantId === ctx.tenantId && item.campaignId === campaignId && item.candidateId === row.candidateId,
      );
      const scoreTotal = row.scoreL + row.scoreR;
      if (existing) {
        existing.scoreL = row.scoreL;
        existing.scoreR = row.scoreR;
        existing.scoreTotal = scoreTotal;
        existing.importedAt = nowIso();
      } else {
        this.store.ipResults.push({
          id: newId(),
          tenantId: ctx.tenantId,
          campaignId,
          candidateId: row.candidateId,
          source: "official_import",
          scoreL: row.scoreL,
          scoreR: row.scoreR,
          scoreTotal,
          importedAt: nowIso(),
        });
      }
      imported += 1;
    });
    return { imported };
  }

  campaignReport(ctx: RequestContext, campaignId: string) {
    this.ensureCampaign(ctx.tenantId, campaignId);
    const results = this.store.ipResults.filter(
      (item) => item.tenantId === ctx.tenantId && item.campaignId === campaignId,
    );
    const average =
      results.length === 0
        ? 0
        : Math.round(results.reduce((sum, item) => sum + item.scoreTotal, 0) / results.length);
    const attendance = this.store.ipSessionCandidates.filter((item) => {
      const session = this.store.ipSessions.find((s) => s.id === item.sessionId);
      return session?.campaignId === campaignId;
    });
    const submitted = attendance.filter((item) => item.status === "submitted").length;
    return {
      campaignId,
      participants: attendance.length,
      submitted,
      resultsCount: results.length,
      averageScore: average,
    };
  }

  addAuditLog(params: {
    tenantId?: string;
    actorUserId?: string;
    action: string;
    entityType: string;
    entityId?: string;
    payloadHash: string;
  }): void {
    this.store.auditLogs.push({
      id: newId(),
      ...params,
      createdAt: nowIso(),
    });
  }

  private questionPart(questionId: string): number {
    return this.store.questions.find((item) => item.id === questionId)?.partNo ?? 7;
  }

  private plusDays(days: number): string {
    const dt = new Date();
    dt.setDate(dt.getDate() + days);
    return dt.toISOString().slice(0, 10);
  }

  private latestScore(ctx: RequestContext): number | undefined {
    const latest = this.store.attempts
      .filter((item) => item.tenantId === ctx.tenantId && item.userId === ctx.userId && item.scoreTotal)
      .sort((a, b) => (b.submittedAt ?? "").localeCompare(a.submittedAt ?? ""))[0];
    return latest?.scoreTotal;
  }

  private createOrRefreshReviewCards(ctx: RequestContext, items: AttemptItem[]): void {
    const wrongQuestionIds = items.filter((item) => item.isCorrect === false).map((item) => item.questionId);
    wrongQuestionIds.forEach((questionId) => {
      const existing = this.store.reviewCards.find(
        (item) => item.tenantId === ctx.tenantId && item.userId === ctx.userId && item.questionId === questionId,
      );
      if (existing) {
        existing.dueAt = this.plusDays(1);
        existing.intervalDays = 1;
        return;
      }
      this.store.reviewCards.push({
        id: newId(),
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        questionId,
        easeFactor: 2.5,
        intervalDays: 1,
        dueAt: this.plusDays(1),
      });
    });
  }

  private recalculatePrediction(ctx: RequestContext) {
    const completed = this.store.attempts
      .filter(
        (item) =>
          item.tenantId === ctx.tenantId &&
          item.userId === ctx.userId &&
          Boolean(item.scoreTotal) &&
          (item.mode === "diagnostic" || item.mode === "mock" || item.mode === "practice"),
      )
      .sort((a, b) => (b.submittedAt ?? "").localeCompare(a.submittedAt ?? ""))
      .slice(0, 5);

    const average = completed.length
      ? Math.round(completed.reduce((sum, item) => sum + (item.scoreTotal ?? 0), 0) / completed.length)
      : 400;
    const recent = completed[0]?.scoreTotal ?? average;
    const predictedTotal = clamp(Math.round(average * 0.7 + recent * 0.3), 10, 990);
    const confidence = clamp(0.5 + completed.length * 0.08, 0.5, 0.92);
    const prediction = {
      id: newId(),
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      predictedTotal,
      confidence,
      factors: {
        attemptsUsed: completed.length,
        recentScore: recent,
      },
      createdAt: nowIso(),
    };
    this.store.predictions.push(prediction);
    return prediction;
  }

  private ensureCampaign(tenantId: string, campaignId: string): void {
    const campaign = this.store.ipCampaigns.find(
      (item) => item.id === campaignId && item.tenantId === tenantId,
    );
    if (!campaign) {
      throw new NotFoundException("Campaign not found");
    }
  }

  private shuffle<T>(items: T[]): T[] {
    const cloned = [...items];
    for (let idx = cloned.length - 1; idx > 0; idx -= 1) {
      const rand = Math.floor(Math.random() * (idx + 1));
      [cloned[idx], cloned[rand]] = [cloned[rand], cloned[idx]];
    }
    return cloned;
  }
}
