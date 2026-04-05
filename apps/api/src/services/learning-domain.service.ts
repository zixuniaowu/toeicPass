import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import {
  ConversationReplyDto,
  GoalDto,
  GradeCardDto,
  MistakeNoteDto,
  StartMistakeDrillDto,
  SubmitAttemptDto,
} from "../dto";
import { sanitizeLearningAction } from "../learning-action";
import {
  isAttemptSelectableQuestion,
  isDisplayablePart1Image,
  isQuestionEligible,
  isTrustedPart1VisualQuestion,
} from "../question-policy";
import { QueueService } from "../queue.service";
import { LearningConversationService } from "./learning-conversation.service";
import { StoreService } from "../store.service";
import { calculatePrediction, estimateRawCorrect, toToeicScaledListening, toToeicScaledReading } from "../scoring-policy";
import { Attempt, AttemptItem, AttemptMode, Question, ReviewCard, VocabularyCard } from "../types";
import { clamp, newId, nowIso } from "../utils";
import { RequestContext } from "../context";

type DailyPlanChecklistItem = {
  id: string;
  label: string;
  detail?: string;
  questionId?: string;
  partNo?: number | null;
};

type DailyPlanBlock = {
  id: string;
  title: string;
  minutes: number;
  reason: string;
  action: string;
  checklist: DailyPlanChecklistItem[];
};

type WeeklyPlanTask = {
  id: string;
  title: string;
  minutes: number;
  action: string;
  previews: string[];
};

type WeeklyPlanDay = {
  date: string;
  dayLabel: string;
  totalMinutes: number;
  tasks: WeeklyPlanTask[];
};

@Injectable()
export class LearningDomainService {
  constructor(
    private readonly store: StoreService,
    private readonly queue: QueueService,
    private readonly conversationService: LearningConversationService,
  ) {}

  createGoal(ctx: RequestContext, dto: GoalDto): { goalId: string } {
    const baselineScore =
      typeof dto.currentScore === "number"
        ? clamp(Math.round(dto.currentScore), 10, 990)
        : this.latestScore(ctx);
    const goal = {
      id: newId(),
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      targetScore: dto.targetScore,
      targetExamDate: dto.targetExamDate,
      baselineScore,
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

  startAttempt(
    ctx: RequestContext,
    mode: AttemptMode,
    filters?: { partNo?: number; difficulty?: number; partGroup?: "listening" | "reading" },
  ): {
    attemptId: string;
    mode: AttemptMode;
    questions: Array<{
      id: string;
      stem: string;
      passage?: string;
      partNo: number;
      mediaUrl?: string;
      imageUrl?: string;
      explanation: string;
      correctKey: "A" | "B" | "C" | "D" | null;
      options: Array<{ key: string; text: string }>;
    }>;
  } {
    const questionPool = this.store.questions.filter(
      (item) =>
        item.tenantId === ctx.tenantId &&
        item.status === "published" &&
        isAttemptSelectableQuestion(item) &&
        (filters?.partGroup === "listening"
          ? item.partNo >= 1 && item.partNo <= 4
          : filters?.partGroup === "reading"
            ? item.partNo >= 5 && item.partNo <= 7
            : true) &&
        (typeof filters?.partNo === "number" ? item.partNo === filters.partNo : true) &&
        (typeof filters?.difficulty === "number" ? item.difficulty === filters.difficulty : true),
    );
    if (questionPool.length === 0) {
      throw new BadRequestException("当前筛选条件下没有可用题，请调整筛选或补充题库。");
    }
    const selected = this.selectQuestionsForAttempt(ctx, mode, questionPool, filters);
    return this.createAttemptSession(ctx, mode, selected);
  }

  startMistakeDrill(ctx: RequestContext, dto: StartMistakeDrillDto) {
    const targetCount = clamp(dto.limit ?? 12, 5, 30);
    const activeQuestionIds = this.activeMistakeQuestionIds(ctx);
    if (activeQuestionIds.size === 0) {
      throw new BadRequestException("No mistakes available. Complete at least one practice session first.");
    }
    const scopedAttempts = this.store.attempts.filter(
      (item) => item.tenantId === ctx.tenantId && item.userId === ctx.userId,
    );
    const attemptMap = new Map(scopedAttempts.map((item) => [item.id, item]));
    const wrongItems = this.store.attemptItems.filter(
      (item) =>
        attemptMap.has(item.attemptId) &&
        activeQuestionIds.has(item.questionId) &&
        item.isCorrect === false &&
        typeof item.selectedKey === "string",
    );

    const restrictedIds = dto.questionIds ? new Set(dto.questionIds) : null;
    const candidatesById = new Map<
      string,
      { wrongCount: number; latestWrongAt: string; question: Question }
    >();
    wrongItems.forEach((item) => {
      if (restrictedIds && !restrictedIds.has(item.questionId)) {
        return;
      }
      const question = this.store.questions.find(
        (q) =>
          q.id === item.questionId &&
          q.tenantId === ctx.tenantId &&
          q.status === "published" &&
          isAttemptSelectableQuestion(q) &&
          (typeof dto.partNo === "number" ? q.partNo === dto.partNo : true),
      );
      if (!question) {
        return;
      }
      const attempt = attemptMap.get(item.attemptId);
      const wrongAt = attempt?.submittedAt ?? item.createdAt;
      const existing = candidatesById.get(question.id);
      if (!existing) {
        candidatesById.set(question.id, { wrongCount: 1, latestWrongAt: wrongAt, question });
        return;
      }
      existing.wrongCount += 1;
      if (wrongAt.localeCompare(existing.latestWrongAt) > 0) {
        existing.latestWrongAt = wrongAt;
      }
    });

    const selected = Array.from(candidatesById.values())
      .sort((a, b) => {
        if (b.wrongCount !== a.wrongCount) {
          return b.wrongCount - a.wrongCount;
        }
        return b.latestWrongAt.localeCompare(a.latestWrongAt);
      })
      .slice(0, targetCount)
      .map((item) => item.question);

    if (selected.length === 0) {
      throw new BadRequestException("No mistake questions matched your filters.");
    }

    return this.createAttemptSession(ctx, "practice", selected);
  }

  submitAttempt(ctx: RequestContext, attemptId: string, dto: SubmitAttemptDto) {
    const attempt = this.store.attempts.find(
      (item) => item.id === attemptId && item.tenantId === ctx.tenantId && item.userId === ctx.userId,
    );
    if (!attempt) {
      throw new NotFoundException("Attempt not found");
    }
    if (attempt.submittedAt) {
      throw new BadRequestException("Attempt already submitted");
    }

    const items = this.store.attemptItems.filter((item) => item.attemptId === attempt.id);
    const byQuestion = new Map(items.map((item) => [item.questionId, item]));
    const questionIds = new Set(items.map((item) => item.questionId));
    const answerSet = new Set<string>();
    dto.answers.forEach((answer) => {
      if (!questionIds.has(answer.questionId)) {
        throw new BadRequestException(`Question does not belong to attempt: ${answer.questionId}`);
      }
      if (answerSet.has(answer.questionId)) {
        throw new BadRequestException(`Duplicate answer for question: ${answer.questionId}`);
      }
      answerSet.add(answer.questionId);
    });

    if (answerSet.size === 0 && attempt.mode !== "mock") {
      throw new BadRequestException("No answers submitted");
    }

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

    items.forEach((item) => {
      if (typeof item.selectedKey !== "string") {
        item.isCorrect = undefined;
      } else if (typeof item.isCorrect !== "boolean") {
        item.isCorrect = false;
      }
      if (typeof item.durationMs !== "number") {
        item.durationMs = 0;
      }
    });

    const scoredItems = items;
    const listeningItems = scoredItems.filter((item) => this.questionPart(item.questionId) <= 4);
    const readingItems = scoredItems.filter((item) => this.questionPart(item.questionId) >= 5);
    const lCorrect = listeningItems.filter((item) => item.isCorrect).length;
    const rCorrect = readingItems.filter((item) => item.isCorrect).length;
    const rawListening = estimateRawCorrect(listeningItems, 100);
    const rawReading = estimateRawCorrect(readingItems, 100);
    const scoreL = toToeicScaledListening(rawListening);
    const scoreR = toToeicScaledReading(rawReading);

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
      rawListening,
      rawReading,
      correct: scoredItems.filter((item) => item.isCorrect).length,
      answered: answerSet.size,
      review: items.map((item) => {
        const question = this.store.questions.find((q) => q.id === item.questionId);
        const correctKey = this.resolveCorrectKey(question);
        return {
          questionId: item.questionId,
          partNo: question?.partNo ?? null,
          stem: question?.stem ?? "",
          mediaUrl: question?.mediaUrl ?? null,
          imageUrl: question?.imageUrl ?? null,
          selectedKey: item.selectedKey ?? null,
          correctKey: correctKey ?? null,
          isCorrect: item.isCorrect ?? false,
          explanation: this.resolveQuestionExplanation(question),
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
    activeDays7: number;
    currentStreak: number;
    studyMinutes7: number;
    modeBreakdown: Record<AttemptMode, number>;
    goalPace: {
      daysToExam: number | null;
      requiredWeeklyGain: number | null;
      status: "no_goal" | "on_track" | "at_risk" | "critical";
    };
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
      baselineScore: number | null;
    };
  } {
    const userAttempts = this.store.attempts.filter(
      (item) => item.tenantId === ctx.tenantId && item.userId === ctx.userId && Boolean(item.submittedAt),
    );
    const attemptIds = new Set(userAttempts.map((item) => item.id));
    const answeredItems = this.store.attemptItems.filter(
      (item) =>
        attemptIds.has(item.attemptId) &&
        typeof item.selectedKey === "string" &&
        typeof item.isCorrect === "boolean",
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

    const scoredAttempts = userAttempts.filter((item) => typeof item.scoreTotal === "number");
    const representativeAttempts = scoredAttempts.filter((item) => this.isAttemptRepresentative(item));
    const scoreHistorySource = representativeAttempts.length > 0 ? representativeAttempts : scoredAttempts;
    const scoreHistory = scoreHistorySource
      .sort((a, b) => (b.submittedAt ?? "").localeCompare(a.submittedAt ?? ""))
      .slice(0, 10)
      .map((item) => item.scoreTotal ?? 0);

    const currentGoal =
      this.store.goals
        .filter((item) => item.tenantId === ctx.tenantId && item.userId === ctx.userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
    const latestScore = this.currentBenchmarkScore(ctx, currentGoal) ?? null;
    const gap =
      typeof currentGoal?.targetScore === "number" && typeof latestScore === "number"
        ? Math.max(0, currentGoal.targetScore - latestScore)
        : null;

    let daysToExam: number | null = null;
    let requiredWeeklyGain: number | null = null;
    let paceStatus: "no_goal" | "on_track" | "at_risk" | "critical" = "no_goal";
    if (currentGoal?.targetExamDate) {
      const ms = new Date(currentGoal.targetExamDate).getTime() - Date.now();
      daysToExam = Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
    }
    if (typeof gap === "number" && typeof daysToExam === "number" && daysToExam > 0) {
      const weeks = Math.max(1, daysToExam / 7);
      requiredWeeklyGain = Number((gap / weeks).toFixed(1));
      paceStatus = requiredWeeklyGain > 35 ? "critical" : requiredWeeklyGain > 18 ? "at_risk" : "on_track";
    } else if (typeof gap === "number" && gap === 0) {
      requiredWeeklyGain = 0;
      paceStatus = "on_track";
    }

    const modeBreakdown: Record<AttemptMode, number> = {
      diagnostic: 0,
      practice: 0,
      mock: 0,
      ip_simulation: 0,
    };
    userAttempts.forEach((item) => {
      modeBreakdown[item.mode] += 1;
    });

    const today = new Date();
    const todayKey = today.toISOString().slice(0, 10);
    const prevDay = new Date(today);
    prevDay.setDate(prevDay.getDate() - 1);
    const prevDayKey = prevDay.toISOString().slice(0, 10);
    const dateSet = new Set(
      userAttempts
        .map((item) => (item.submittedAt ?? item.startedAt).slice(0, 10))
        .filter((item) => item.length > 0),
    );
    const activeSince = new Date(today);
    activeSince.setDate(activeSince.getDate() - 6);
    const activeSinceKey = activeSince.toISOString().slice(0, 10);
    const activeDays7 = Array.from(dateSet).filter((key) => key >= activeSinceKey && key <= todayKey).length;

    let currentStreak = 0;
    let cursor: Date | null = null;
    if (dateSet.has(todayKey)) {
      cursor = new Date(today);
    } else if (dateSet.has(prevDayKey)) {
      cursor = new Date(prevDay);
    }
    while (cursor) {
      const key = cursor.toISOString().slice(0, 10);
      if (!dateSet.has(key)) {
        break;
      }
      currentStreak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }

    const attemptDateById = new Map(
      userAttempts.map((item) => [item.id, (item.submittedAt ?? item.startedAt).slice(0, 10)]),
    );
    const studyMs7 = answeredItems.reduce((sum, item) => {
      const dateKey = attemptDateById.get(item.attemptId);
      if (!dateKey || dateKey < activeSinceKey || dateKey > todayKey) {
        return sum;
      }
      return sum + (item.durationMs ?? 0);
    }, 0);

    return {
      attempts: userAttempts.length,
      questionsAnswered: totalAnswered,
      overallAccuracy: totalAnswered ? Number((totalCorrect / totalAnswered).toFixed(4)) : 0,
      avgDurationMs: totalAnswered ? Math.round(totalDuration / totalAnswered) : 0,
      latestScore,
      scoreHistory,
      activeDays7,
      currentStreak,
      studyMinutes7: Math.round(studyMs7 / 60000),
      modeBreakdown,
      goalPace: {
        daysToExam,
        requiredWeeklyGain,
        status: paceStatus,
      },
      byPart,
      goal: {
        targetScore: currentGoal?.targetScore ?? null,
        gap,
        targetExamDate: currentGoal?.targetExamDate ?? null,
        baselineScore: currentGoal?.baselineScore ?? null,
      },
    };
  }

  nextTasks(ctx: RequestContext): {
    generatedAt: string;
    tasks: Array<{ id: string; title: string; reason: string; action: string; priority: number }>;
  } {
    const analytics = this.analyticsOverview(ctx);
    const dueCards = this.getDueCards(ctx).length;
    const mistakeBatchSize = 20;
    const todayMistakeCount = Math.min(dueCards, mistakeBatchSize);
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
        id: "mistake-cards",
        title:
          dueCards > mistakeBatchSize
            ? `错题强化（今日 ${todayMistakeCount} 题）`
            : `错题强化（${todayMistakeCount} 题）`,
        reason:
          dueCards > mistakeBatchSize
            ? `错题池待清理 ${dueCards} 题，按日分批完成更稳定（今天先做 ${todayMistakeCount} 题）`
            : "错题到期，优先强化可稳住记忆曲线",
        action: "mistakes:start",
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
      tasks: tasks
        .sort((a, b) => a.priority - b.priority)
        .slice(0, 6)
        .map((task) => ({
          ...task,
          action: sanitizeLearningAction(task.action),
        })),
    };
  }

  dailyPlan(ctx: RequestContext): {
    generatedAt: string;
    totalMinutes: number;
    focusPart: number | null;
    blocks: DailyPlanBlock[];
    weekSchedule: WeeklyPlanDay[];
  } {
    const analytics = this.analyticsOverview(ctx);
    const tasks = this.nextTasks(ctx).tasks;
    const weakPartTask = tasks.find((item) => item.action.startsWith("practice:start?part="));
    const focusPart = weakPartTask
      ? Number(new URLSearchParams(weakPartTask.action.split("?")[1]).get("part") ?? "")
      : null;

    const today = new Date().toISOString().slice(0, 10);
    const dueVocabCards = this.store.vocabularyCards.filter(
      (item) => item.tenantId === ctx.tenantId && item.userId === ctx.userId && item.dueAt <= today,
    );
    const dueReviewCards = this.getDueCards(ctx);
    const mistakeLibrary = this.getMistakeLibrary(ctx);
    const mistakeQuestionIds = new Set(mistakeLibrary.map((item) => item.questionId));
    const focusPartNo = Number.isFinite(focusPart) ? Number(focusPart) : null;
    const daySeed = Number(new Date().toISOString().slice(8, 10));
    const daysToExam = analytics.goalPace.daysToExam ?? null;
    const scoreGap = analytics.goal.gap ?? 0;
    const sprintMode =
      analytics.goalPace.status === "critical" ||
      (analytics.goalPace.status === "at_risk" && scoreGap >= 140) ||
      (typeof daysToExam === "number" && daysToExam <= 100 && scoreGap >= 180);
    const targetDailyMinutes = 60;
    const reviewMinutes = 10;
    const focusMinutes = sprintMode ? 30 : 25;
    const vocabOrVolumeMinutes = sprintMode ? 10 : 15;
    const pressureMinutes = targetDailyMinutes - reviewMinutes - focusMinutes - vocabOrVolumeMinutes;

    const blocks: DailyPlanBlock[] = [];

    if (dueReviewCards.length > 0) {
      const reviewTargetCount = Math.min(dueReviewCards.length, 20);
      const reviewQuestions = dueReviewCards
        .map((card) => card.question)
        .filter((question): question is Question => Boolean(question))
        .slice(0, 5);
      blocks.push({
        id: "mistakes-due",
        title:
          dueReviewCards.length > 20
            ? `错题强化（今日 ${reviewTargetCount} 题 / 待清理 ${dueReviewCards.length}）`
            : `错题强化（${reviewTargetCount} 题）`,
        minutes: reviewMinutes,
        reason:
          dueReviewCards.length > 20
            ? `错题池较大，今天先完成 ${reviewTargetCount} 题，按日清理避免挫败感`
            : "先清理到期错题，避免重复犯错",
        action: "mistakes:start",
        checklist: reviewQuestions.map((question, index) =>
          this.toQuestionChecklistItem(question, index + 1, "先说错因，再说正确依据"),
        ),
      });
    } else {
      const mistakes = mistakeLibrary.slice(0, 5);
      blocks.push({
        id: "mistakes",
        title: "高频错题冲刺",
        minutes: reviewMinutes,
        reason: "没有到期强化任务时，先打掉高频错题",
        action: "mistakes:start",
        checklist: mistakes.map((item, index) => ({
          id: `mistake-${index + 1}`,
          label: `Part ${item.partNo ?? "-"} · ${this.trimForPlan(item.stem, 76)}`,
          detail: `累计错 ${item.wrongCount} 次`,
          questionId: item.questionId,
          partNo: item.partNo,
        })),
      });
    }

    const focusQuestions = this.pickPlanQuestions(ctx, {
      count: sprintMode ? 8 : 6,
      partNo: focusPartNo ?? undefined,
      preferQuestionIds: mistakeQuestionIds,
      offset: daySeed,
    });
    blocks.push({
      id: "focus-part",
      title: focusPartNo ? `弱项强化 Part ${focusPartNo}` : "综合训练主段",
      minutes: focusMinutes,
      reason: sprintMode
        ? "冲分阶段优先拉弱项，确保每天有稳定高强度训练"
        : focusPartNo
          ? "优先补短板，提升总分效率最高"
          : "先做一轮综合题建立样本",
      action: focusPartNo ? `practice:start?part=${focusPartNo}` : "practice:start",
      checklist: focusQuestions.map((question, index) =>
        this.toQuestionChecklistItem(question, index + 1, "按考试节奏限时作答"),
      ),
    });

    if (dueVocabCards.length > 0) {
      blocks.push({
        id: "vocab",
        title: `词汇复习 (${Math.min(dueVocabCards.length, 30)} 词)`,
        minutes: vocabOrVolumeMinutes,
        reason: "词汇稳定后，听力和阅读都会更稳",
        action: "vocab:start",
        checklist: dueVocabCards.slice(0, sprintMode ? 8 : 10).map((card, index) => ({
          id: `vocab-${index + 1}`,
          label: card.term,
          detail: `${card.pos} · ${this.trimForPlan(card.definition, 52)}`,
        })),
      });
    } else {
      const volumeQuestions = this.pickPlanQuestions(ctx, {
        count: sprintMode ? 4 : 5,
        preferQuestionIds: mistakeQuestionIds,
        offset: daySeed + 5,
      });
      blocks.push({
        id: "volume",
        title: sprintMode ? "冲刺补量" : "补足做题量",
        minutes: vocabOrVolumeMinutes,
        reason: "无到期词卡时，补样本提升预测稳定性",
        action: "practice:start",
        checklist: volumeQuestions.map((question, index) =>
          this.toQuestionChecklistItem(question, index + 1, "先做题再看解析"),
        ),
      });
    }

    const pressureQuestions = this.pickPlanQuestions(ctx, {
      count: sprintMode ? 7 : 6,
      partGroup: "mixed",
      preferQuestionIds: mistakeQuestionIds,
      offset: daySeed + 11,
    });
    blocks.push({
      id: "pressure",
      title: sprintMode ? "限时冲刺段" : "限时压力段",
      minutes: pressureMinutes,
      reason: sprintMode ? "冲分阶段每天保留限时段，提升实战稳定性" : "收尾做限时题保持考试节奏",
      action: (analytics.goal.gap ?? 0) > 80 ? "mock:start" : "practice:start",
      checklist: pressureQuestions.map((question, index) =>
        this.toQuestionChecklistItem(question, index + 1, "目标 45~75 秒/题"),
      ),
    });

    const weekSchedule = this.buildWeeklySchedule(
      ctx,
      focusPartNo,
      dueVocabCards,
      mistakeQuestionIds,
      sprintMode,
    );

    return {
      generatedAt: nowIso(),
      totalMinutes: blocks.reduce((sum, item) => sum + item.minutes, 0),
      focusPart: focusPartNo,
      blocks: blocks.map((block) => ({
        ...block,
        action: sanitizeLearningAction(block.action),
      })),
      weekSchedule: weekSchedule.map((day) => ({
        ...day,
        tasks: day.tasks.map((task) => ({
          ...task,
          action: sanitizeLearningAction(task.action),
        })),
      })),
    };
  }

  private buildWeeklySchedule(
    ctx: RequestContext,
    focusPart: number | null,
    dueVocabCards: VocabularyCard[],
    mistakeQuestionIds: Set<string>,
    sprintMode: boolean,
  ): WeeklyPlanDay[] {
    const weekdayNames = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
    const weekDays: WeeklyPlanDay[] = [];

    for (let offset = 0; offset < 7; offset += 1) {
      const date = new Date();
      date.setDate(date.getDate() + offset);
      const dayLabel = weekdayNames[date.getDay()];
      const dateKey = date.toISOString().slice(0, 10);
      const seed = Number(dateKey.slice(8, 10));
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;

      const tasks: WeeklyPlanTask[] = [];
      if (!isWeekend) {
        const diagnosticQuestions = this.pickPlanQuestions(ctx, {
          count: 4,
          partGroup: "mixed",
          preferQuestionIds: mistakeQuestionIds,
          offset: seed,
        });
        tasks.push({
          id: `diag-${offset}`,
          title: "10 分钟诊断热身",
          minutes: 10,
          action: "diagnostic:start",
          previews: diagnosticQuestions.slice(0, 2).map((q) => this.toPlanPreview(q)),
        });

        const focusQuestions = this.pickPlanQuestions(ctx, {
          count: sprintMode ? 8 : 6,
          partNo: focusPart ?? undefined,
          preferQuestionIds: mistakeQuestionIds,
          offset: seed + 3,
        });
        tasks.push({
          id: `focus-${offset}`,
          title: focusPart ? `弱项 Part ${focusPart} 主训` : "综合专项主训",
          minutes: sprintMode ? 30 : 25,
          action: focusPart ? `practice:start?part=${focusPart}` : "practice:start",
          previews: focusQuestions.slice(0, 3).map((q) => this.toPlanPreview(q)),
        });

        if (dueVocabCards.length > 0) {
          tasks.push({
            id: `vocab-${offset}`,
            title: "词汇复习",
            minutes: sprintMode ? 10 : 15,
            action: "vocab:start",
            previews: dueVocabCards
              .slice(offset, offset + 3)
              .map((card) => `${card.term} (${card.pos})`),
          });
        } else {
          const readingQuestions = this.pickPlanQuestions(ctx, {
            count: 4,
            partGroup: "reading",
            preferQuestionIds: mistakeQuestionIds,
            offset: seed + 7,
          });
          tasks.push({
            id: `volume-${offset}`,
            title: "阅读补量",
            minutes: sprintMode ? 10 : 15,
            action: "practice:start?partGroup=reading",
            previews: readingQuestions.slice(0, 2).map((q) => this.toPlanPreview(q)),
          });
        }

        const pressureQuestions = this.pickPlanQuestions(ctx, {
          count: 4,
          partGroup: "mixed",
          preferQuestionIds: mistakeQuestionIds,
          offset: seed + 9,
        });
        tasks.push({
          id: `pressure-${offset}`,
          title: sprintMode ? "限时冲刺段" : "限时压力段",
          minutes: 10,
          action: sprintMode ? "mock:start" : "practice:start",
          previews: pressureQuestions.slice(0, 2).map((q) => this.toPlanPreview(q)),
        });
      } else if (date.getDay() === 6) {
        const mockQuestions = this.pickPlanQuestions(ctx, {
          count: sprintMode ? 8 : 6,
          partGroup: "mixed",
          preferQuestionIds: mistakeQuestionIds,
          offset: seed,
        });
        const mockMinutes = sprintMode ? 35 : 30;
        const reviewMinutes = sprintMode ? 15 : 20;
        const vocabMinutes = Math.max(10, 60 - mockMinutes - reviewMinutes);
        tasks.push({
          id: `mock-full-${offset}`,
          title: sprintMode ? "周六模考冲刺" : "周六模考",
          minutes: mockMinutes,
          action: "mock:start",
          previews: mockQuestions.slice(0, 4).map((q) => this.toPlanPreview(q)),
        });
        const reviewQuestions = this.pickPlanQuestions(ctx, {
          count: 4,
          preferQuestionIds: mistakeQuestionIds,
          offset: seed + 4,
        });
        tasks.push({
          id: `mistakes-weekend-${offset}`,
          title: "模考错题强化",
          minutes: reviewMinutes,
          action: "mistakes:start",
          previews: reviewQuestions.slice(0, 3).map((q) => this.toPlanPreview(q)),
        });
        tasks.push({
          id: `vocab-weekend-${offset}`,
          title: "词汇巩固",
          minutes: vocabMinutes,
          action: "vocab:start",
          previews: dueVocabCards.slice(0, 3).map((card) => `${card.term} (${card.pos})`),
        });
      } else {
        const mistakeQuestions = this.pickPlanQuestions(ctx, {
          count: sprintMode ? 7 : 6,
          preferQuestionIds: mistakeQuestionIds,
          offset: seed + 2,
        });
        const mistakeMinutes = sprintMode ? 25 : 20;
        const vocabMinutes = 15;
        const shadowingMinutes = 60 - mistakeMinutes - vocabMinutes;
        tasks.push({
          id: `mistake-clean-${offset}`,
          title: "错题清零",
          minutes: mistakeMinutes,
          action: "mistakes:start",
          previews: mistakeQuestions.slice(0, 4).map((q) => this.toPlanPreview(q)),
        });
        tasks.push({
          id: `vocab-sunday-${offset}`,
          title: "词汇 + 跟读",
          minutes: vocabMinutes,
          action: "vocab:start",
          previews: dueVocabCards.slice(0, 3).map((card) => `${card.term} (${card.pos})`),
        });
        tasks.push({
          id: `shadowing-${offset}`,
          title: "影子跟读",
          minutes: shadowingMinutes,
          action: "shadowing:start",
          previews: ["乔布斯演讲 6 句", "新闻材料 4 句"],
        });
      }

      weekDays.push({
        date: dateKey,
        dayLabel,
        totalMinutes: tasks.reduce((sum, item) => sum + item.minutes, 0),
        tasks,
      });
    }

    return weekDays;
  }

  private toPlanPreview(question: Question): string {
    return `Part ${question.partNo}: ${this.trimForPlan(question.stem, 56)}`;
  }

  private toQuestionChecklistItem(
    question: Question,
    index: number,
    detail?: string,
  ): DailyPlanChecklistItem {
    return {
      id: `q-${index}-${question.id}`,
      label: `Part ${question.partNo} · ${this.trimForPlan(question.stem, 72)}`,
      detail,
      questionId: question.id,
      partNo: question.partNo,
    };
  }

  private trimForPlan(text: string, limit: number): string {
    const normalized = text.trim().replace(/\s+/g, " ");
    if (normalized.length <= limit) {
      return normalized;
    }
    return `${normalized.slice(0, limit)}...`;
  }

  private pickPlanQuestions(
    ctx: RequestContext,
    params: {
      count: number;
      partNo?: number;
      partGroup?: "listening" | "reading" | "mixed";
      preferQuestionIds?: Set<string>;
      offset?: number;
    },
  ): Question[] {
    const pool = this.store.questions
      .filter((question) => {
        if (question.tenantId !== ctx.tenantId || question.status !== "published") {
          return false;
        }
        if (!isQuestionEligible(question)) {
          return false;
        }
        if (typeof params.partNo === "number" && question.partNo !== params.partNo) {
          return false;
        }
        if (params.partGroup === "listening" && (question.partNo < 1 || question.partNo > 4)) {
          return false;
        }
        if (params.partGroup === "reading" && (question.partNo < 5 || question.partNo > 7)) {
          return false;
        }
        return true;
      })
      .sort((a, b) => a.id.localeCompare(b.id));

    if (pool.length === 0) {
      return [];
    }

    const offset = params.offset ?? 0;
    const preferred = params.preferQuestionIds
      ? pool.filter((question) => params.preferQuestionIds?.has(question.id))
      : [];
    const regular = params.preferQuestionIds
      ? pool.filter((question) => !params.preferQuestionIds?.has(question.id))
      : pool;

    const rotatedPreferred = this.rotateByOffset(preferred, offset);
    const rotatedRegular = this.rotateByOffset(regular, offset + preferred.length);
    const merged = [...rotatedPreferred, ...rotatedRegular];
    const unique = new Map(merged.map((question) => [question.id, question]));
    return Array.from(unique.values()).slice(0, Math.min(params.count, unique.size));
  }

  private rotateByOffset<T>(items: T[], offset: number): T[] {
    if (items.length <= 1) {
      return items;
    }
    const normalized = ((offset % items.length) + items.length) % items.length;
    if (normalized === 0) {
      return [...items];
    }
    return [...items.slice(normalized), ...items.slice(0, normalized)];
  }

  getPracticeRecommendations(ctx: RequestContext) {
    const byPart = new Map<number, { answered: number; correct: number }>();
    this.store.attemptItems.forEach((item) => {
      const attempt = this.store.attempts.find((a) => a.id === item.attemptId);
      if (!attempt || attempt.tenantId !== ctx.tenantId || attempt.userId !== ctx.userId) {
        return;
      }
      if (typeof item.selectedKey !== "string") {
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
    return this.getMistakeLibrary(ctx).map((item) => ({
      attemptItemId: item.latestAttemptItemId,
      questionId: item.questionId,
      questionStem: item.stem,
      note: item.latestNote,
    }));
  }

  getMistakeLibrary(ctx: RequestContext) {
    const activeQuestionIds = this.activeMistakeQuestionIds(ctx);
    if (activeQuestionIds.size === 0) {
      return [];
    }
    const userAttempts = this.store.attempts.filter(
      (item) => item.userId === ctx.userId && item.tenantId === ctx.tenantId,
    );
    const attemptMap = new Map(userAttempts.map((item) => [item.id, item]));
    const wrongItems = this.store.attemptItems.filter(
      (item) =>
        attemptMap.has(item.attemptId) &&
        item.isCorrect === false &&
        typeof item.selectedKey === "string",
    );
    const grouped = new Map<string, AttemptItem[]>();
    wrongItems.forEach((item) => {
      const bucket = grouped.get(item.questionId) ?? [];
      bucket.push(item);
      grouped.set(item.questionId, bucket);
    });

    const library: Array<{
      questionId: string;
      partNo: number;
      stem: string;
      explanation: string;
      mediaUrl: string | null;
      imageUrl: string | null;
      options: Array<{ key: "A" | "B" | "C" | "D"; text: string }>;
      correctKey: "A" | "B" | "C" | "D" | null;
      wrongCount: number;
      latestAttemptItemId: string;
      lastSelectedKey: "A" | "B" | "C" | "D" | null;
      lastWrongAt: string;
      latestNote: { note: string; rootCause: string | null; createdAt: string } | null;
    }> = [];

    Array.from(grouped.entries()).forEach(([questionId, items]) => {
      if (!activeQuestionIds.has(questionId)) {
        return;
      }
      const question = this.store.questions.find((q) => q.id === questionId);
      if (!question || !isQuestionEligible(question)) {
        return;
      }
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

      library.push({
        questionId,
        partNo: question.partNo,
        stem: question.stem,
        explanation: this.resolveQuestionExplanation(question),
        mediaUrl: question.mediaUrl ?? null,
        imageUrl: question.imageUrl ?? null,
        options: question.options.map((opt) => ({ key: opt.key, text: opt.text })),
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
      });
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

    // Backfill scoreBand for cards that were created before score bands existed
    const total = cards.length;
    cards.forEach((card, i) => {
      if (!card.scoreBand) {
        const ratio = total > 0 ? i / total : 0;
        card.scoreBand = ratio < 0.30 ? "600" : ratio < 0.60 ? "700" : ratio < 0.85 ? "800" : "900";
      }
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
    const answeredWrongQuestionIds = this.answeredWrongQuestionIds(ctx);
    return this.store.reviewCards
      .filter(
        (item) =>
          item.tenantId === ctx.tenantId &&
          item.userId === ctx.userId &&
          item.dueAt <= today &&
          answeredWrongQuestionIds.has(item.questionId),
      )
      .map((card) => ({
        ...card,
        question: this.store.questions.find((q) => q.id === card.questionId),
      }))
      .filter((card) => card.question && isQuestionEligible(card.question));
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
    const currentGoal =
      this.store.goals
        .filter((item) => item.tenantId === ctx.tenantId && item.userId === ctx.userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
    const expectedBaselineAnchor =
      typeof currentGoal?.baselineScore === "number"
        ? clamp(Math.round(currentGoal.baselineScore), 10, 990)
        : null;

    const latestPrediction =
      this.store.predictions
        .filter((item) => item.tenantId === ctx.tenantId && item.userId === ctx.userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
    const scoredAttempts = this.store.attempts
      .filter(
        (item) =>
          item.tenantId === ctx.tenantId &&
          item.userId === ctx.userId &&
          typeof item.scoreTotal === "number",
      )
      .sort((a, b) => (b.submittedAt ?? b.startedAt).localeCompare(a.submittedAt ?? a.startedAt));
    const latestScoredAttempt = scoredAttempts[0] ?? null;
    const representativeScoredAttempts = scoredAttempts.filter((item) => this.isAttemptRepresentative(item));
    const expectedPredictionSampleSize =
      (representativeScoredAttempts.length > 0 ? representativeScoredAttempts : scoredAttempts).slice(0, 5).length;
    const expectedRecentScore =
      representativeScoredAttempts[0]?.scoreTotal ?? latestScoredAttempt?.scoreTotal ?? null;
    const expectedPredictionFloor =
      typeof expectedBaselineAnchor === "number"
        ? expectedPredictionSampleSize < 3
          ? expectedBaselineAnchor - 10
          : expectedBaselineAnchor - 60
        : null;
    const expectedPredictionCeiling =
      typeof expectedBaselineAnchor === "number" ? expectedBaselineAnchor + 180 : null;
    const isOutsideExpectedBand =
      typeof expectedPredictionFloor === "number" &&
      typeof expectedPredictionCeiling === "number" &&
      !!latestPrediction &&
      (latestPrediction.predictedTotal < expectedPredictionFloor ||
        latestPrediction.predictedTotal > expectedPredictionCeiling);
    if (!latestScoredAttempt) {
      if (
        typeof expectedBaselineAnchor === "number" &&
        (!latestPrediction ||
          latestPrediction.factors?.baselineAnchor !== expectedBaselineAnchor ||
          isOutsideExpectedBand)
      ) {
        return this.recalculatePrediction(ctx);
      }
      return latestPrediction;
    }
    const latestAttemptAt = latestScoredAttempt.submittedAt ?? latestScoredAttempt.startedAt;
    if (
      !latestPrediction ||
      latestPrediction.createdAt.localeCompare(latestAttemptAt) < 0 ||
      (typeof expectedBaselineAnchor === "number" &&
        latestPrediction.factors?.baselineAnchor !== expectedBaselineAnchor) ||
      (typeof expectedRecentScore === "number" &&
        latestPrediction.factors?.recentScore !== expectedRecentScore) ||
      isOutsideExpectedBand
    ) {
      return this.recalculatePrediction(ctx);
    }
    return latestPrediction;
  }

  listConversationScenarios() {
    return this.conversationService.listConversationScenarios();
  }

  generateConversationReply(
    _ctx: RequestContext,
    dto: ConversationReplyDto,
  ): Promise<{ content: string; corrections: string[]; suggestions: string[] }> {
    return this.conversationService.generateConversationReply(dto);
  }

  private createAttemptSession(
    ctx: RequestContext,
    mode: AttemptMode,
    selected: Question[],
  ): {
    attemptId: string;
    mode: AttemptMode;
    questions: Array<{
      id: string;
      stem: string;
      passage?: string;
      partNo: number;
      mediaUrl?: string;
      imageUrl?: string;
      explanation: string;
      correctKey: "A" | "B" | "C" | "D" | null;
      options: Array<{ key: string; text: string }>;
    }>;
  } {
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
        passage: q.passage,
        partNo: q.partNo,
        mediaUrl: q.mediaUrl,
        imageUrl: q.imageUrl,
        explanation: this.resolveQuestionExplanation(q),
        correctKey: this.resolveCorrectKey(q),
        options: q.options.map((item) => ({ key: item.key, text: item.text })),
      })),
    };
  }

  private resolveCorrectKey(question?: Question | null): "A" | "B" | "C" | "D" | null {
    if (!question) {
      return null;
    }
    const fromOptions = question.options.find((opt) => opt.isCorrect)?.key;
    if (fromOptions === "A" || fromOptions === "B" || fromOptions === "C" || fromOptions === "D") {
      return fromOptions;
    }
    const legacyCorrectKey = (question as Question & { correctKey?: unknown }).correctKey;
    if (
      legacyCorrectKey === "A" ||
      legacyCorrectKey === "B" ||
      legacyCorrectKey === "C" ||
      legacyCorrectKey === "D"
    ) {
      return legacyCorrectKey;
    }
    return null;
  }

  private resolveQuestionExplanation(question?: Question | null): string {
    if (!question) {
      return "";
    }
    const explicit = String(question.explanation ?? "").trim();
    const correctKey = this.resolveCorrectKey(question);
    const correctOption = correctKey
      ? question.options.find((opt) => opt.key === correctKey)
      : undefined;
    const lead =
      explicit.length > 0
        ? `题目解析：${explicit}`
        : `题目解析：${this.defaultExplanationLeadByPart(question.partNo)}`;

    if (!correctKey) {
      return `${lead}\n当前题目未标注标准答案，请结合题干关键词与逻辑关系排除干扰项。`;
    }

    const optionLines = question.options.map((opt) => {
      const verdict = opt.key === correctKey ? "正确" : "错误";
      const reason = this.optionReasonByPart(question.partNo, opt.key === correctKey);
      return `${opt.key}. ${opt.text}（${verdict}：${reason}）`;
    });

    const answerLine = correctOption?.text
      ? `正确答案：${correctKey}. ${correctOption.text}`
      : `正确答案：${correctKey}`;

    return [
      lead,
      answerLine,
      "选项解析：",
      ...optionLines,
      `做题提示：${this.answerTipByPart(question.partNo)}`,
    ].join("\n");
  }

  private defaultExplanationLeadByPart(partNo: number): string {
    if (partNo === 1) {
      return "优先匹配图片中的主体、动作和位置关系，再排除不符合画面的选项。";
    }
    if (partNo === 2) {
      return "先判断问句类型（疑问词/一般疑问句/陈述句），再选语义与语气匹配的回答。";
    }
    if (partNo === 3 || partNo === 4) {
      return "抓住对话或独白中的时间、地点、目的、数字等关键词，再对照选项。";
    }
    if (partNo === 5 || partNo === 6) {
      return "结合语法线索与上下文语义，判断最符合句意和搭配的选项。";
    }
    return "先定位题干关键词，再回到原文证据句，避免仅凭印象作答。";
  }

  private optionReasonByPart(partNo: number, isCorrect: boolean): string {
    if (partNo === 1) {
      return isCorrect
        ? "与画面中的人物动作或场景细节一致"
        : "与画面中的动作、主体或位置关系不符";
    }
    if (partNo === 2) {
      return isCorrect
        ? "与问句语义及语气匹配"
        : "答非所问或语气、时态不匹配";
    }
    if (partNo === 3 || partNo === 4) {
      return isCorrect
        ? "与听力中的关键信息一致"
        : "与听力细节不一致或属于干扰信息";
    }
    if (partNo === 5 || partNo === 6) {
      return isCorrect
        ? "语法结构和语义搭配都成立"
        : "语法、搭配或上下文语义存在冲突";
    }
    return isCorrect
      ? "与原文证据句含义一致"
      : "与原文关键信息不一致或缺乏直接证据";
  }

  private answerTipByPart(partNo: number): string {
    if (partNo <= 2) {
      return "听力先抓关键词，再排除明显不匹配的干扰项。";
    }
    if (partNo <= 4) {
      return "关注转折词、数字和因果关系，避免只听到局部词汇就作答。";
    }
    if (partNo <= 6) {
      return "先看空格前后语法结构，再验证整句语义是否自然。";
    }
    return "先定位证据句，再核对选项中的细节表达是否完全一致。";
  }

  private questionPart(questionId: string): number {
    return this.store.questions.find((item) => item.id === questionId)?.partNo ?? 7;
  }

  private selectQuestionsForAttempt(
    ctx: RequestContext,
    mode: AttemptMode,
    pool: Question[],
    filters?: { partNo?: number; difficulty?: number; partGroup?: "listening" | "reading" },
  ) {
    const filteredPool =
      filters?.partNo === 1 ? this.pickTrustedPart1Pool(pool) : pool;
    const recentQuestionIds = this.collectRecentQuestionIds(ctx);
    const questionPriority = this.buildQuestionPriorityMap(ctx, pool);
    const hasFilter =
      typeof filters?.partNo === "number" ||
      typeof filters?.difficulty === "number" ||
      typeof filters?.partGroup === "string";

    if (mode === "diagnostic" && !hasFilter) {
      const diagnosticBlueprint: Record<number, number> = {
        1: 2,
        2: 3,
        3: 3,
        4: 2,
        5: 4,
        6: 2,
        7: 4,
      };
      const selectedIds = new Set<string>();
      const selected = Object.entries(diagnosticBlueprint).flatMap(([part, count]) => {
        const partNo = Number(part);
        const candidates = pool.filter((item) => item.partNo === partNo);
        return this.pickQuestions(candidates, count, recentQuestionIds, selectedIds, questionPriority);
      });
      if (selected.length >= 20) {
        return selected.slice(0, 20);
      }
      const fallback = this.pickQuestions(
        pool,
        20 - selected.length,
        recentQuestionIds,
        selectedIds,
        questionPriority,
      );
      return selected.concat(fallback);
    }

    if (
      mode !== "mock" ||
      hasFilter
    ) {
      const targetCount = mode === "diagnostic" ? 20 : mode === "practice" ? 12 : mode === "mock" ? 200 : 30;
      if (mode === "practice" && !hasFilter) {
        const practiceBlueprint: Record<number, number> = {
          1: 1,
          2: 2,
          3: 2,
          4: 1,
          5: 2,
          6: 2,
          7: 2,
        };
        const selectedIds = new Set<string>();
        const selected = Object.entries(practiceBlueprint).flatMap(([part, count]) => {
          const partNo = Number(part);
          const candidates = filteredPool.filter((item) => item.partNo === partNo);
          return this.pickQuestions(candidates, count, recentQuestionIds, selectedIds, questionPriority);
        });
        if (selected.length >= targetCount) {
          return selected.slice(0, targetCount);
        }
        const fallback = this.pickQuestions(
          filteredPool,
          targetCount - selected.length,
          recentQuestionIds,
          selectedIds,
          questionPriority,
        );
        return selected.concat(fallback);
      }
      if (filters?.partNo === 1) {
        return this.pickPart1Questions(filteredPool, targetCount, recentQuestionIds);
      }
      if (this.shouldPreferRichReadingQuestions(mode, filters)) {
        const selectedIds = new Set<string>();
        const preferredPool = filteredPool.filter((question) => this.isRichPart7Question(question));
        const preferred = this.pickQuestions(
          preferredPool,
          targetCount,
          recentQuestionIds,
          selectedIds,
          questionPriority,
        );
        if (preferred.length >= targetCount) {
          return preferred;
        }
        const fallback = this.pickQuestions(
          filteredPool,
          targetCount - preferred.length,
          recentQuestionIds,
          selectedIds,
          questionPriority,
        );
        return preferred.concat(fallback);
      }
      return this.pickQuestions(filteredPool, targetCount, recentQuestionIds, new Set<string>(), questionPriority);
    }

    const mockBlueprint: Record<number, number> = {
      1: 6,
      2: 25,
      3: 39,
      4: 30,
      5: 30,
      6: 16,
      7: 54,
    };
    const selectedIds = new Set<string>();
    const selected = Object.entries(mockBlueprint).flatMap(([part, count]) => {
      const partNo = Number(part);
      const candidates = pool.filter((item) => item.partNo === partNo);
      return this.pickQuestions(candidates, count, recentQuestionIds, selectedIds, questionPriority);
    });
    if (selected.length >= 200) {
      return selected.slice(0, 200);
    }
    const fallback = this.pickQuestions(
      pool,
      200 - selected.length,
      recentQuestionIds,
      selectedIds,
      questionPriority,
    );
    return selected.concat(fallback);
  }

  private collectRecentQuestionIds(ctx: RequestContext, attemptWindow = 8): Set<string> {
    const recentAttempts = this.store.attempts
      .filter((item) => item.tenantId === ctx.tenantId && item.userId === ctx.userId)
      .sort((a, b) =>
        (b.submittedAt ?? b.startedAt).localeCompare(a.submittedAt ?? a.startedAt),
      )
      .slice(0, attemptWindow);
    const recentAttemptIds = new Set(recentAttempts.map((item) => item.id));
    const ids = new Set<string>();
    this.store.attemptItems.forEach((item) => {
      if (recentAttemptIds.has(item.attemptId)) {
        ids.add(item.questionId);
      }
    });
    return ids;
  }

  private buildQuestionPriorityMap(ctx: RequestContext, candidates: Question[]): Map<string, number> {
    const candidateIds = new Set(candidates.map((item) => item.id));
    if (candidateIds.size === 0) {
      return new Map<string, number>();
    }

    const userAttempts = this.store.attempts.filter(
      (item) => item.tenantId === ctx.tenantId && item.userId === ctx.userId,
    );
    const attemptById = new Map(userAttempts.map((item) => [item.id, item]));
    const stats = new Map<
      string,
      {
        seen: number;
        wrong: number;
        lastSeenAt: string;
      }
    >();

    this.store.attemptItems.forEach((item) => {
      if (!candidateIds.has(item.questionId) || typeof item.selectedKey !== "string") {
        return;
      }
      const attempt = attemptById.get(item.attemptId);
      if (!attempt) {
        return;
      }
      const seenAt = attempt.submittedAt ?? attempt.startedAt;
      const entry = stats.get(item.questionId) ?? {
        seen: 0,
        wrong: 0,
        lastSeenAt: seenAt,
      };
      entry.seen += 1;
      if (item.isCorrect === false) {
        entry.wrong += 1;
      }
      if (seenAt.localeCompare(entry.lastSeenAt) > 0) {
        entry.lastSeenAt = seenAt;
      }
      stats.set(item.questionId, entry);
    });

    const priorityMap = new Map<string, number>();
    candidates.forEach((question) => {
      const stat = stats.get(question.id);
      if (!stat) {
        // First-time exposure gets a strong priority boost.
        priorityMap.set(question.id, 90);
        return;
      }
      const wrongRate = stat.wrong / Math.max(1, stat.seen);
      const recencyDays = this.daysSinceIso(stat.lastSeenAt);
      let score = wrongRate * 70 + Math.min(recencyDays, 30) * 0.8 + Math.max(0, 12 - stat.seen * 2);
      if (wrongRate === 0 && stat.seen >= 3) {
        score -= 8;
      }
      priorityMap.set(question.id, Number(score.toFixed(4)));
    });
    return priorityMap;
  }

  private daysSinceIso(iso: string): number {
    const parsed = Date.parse(iso);
    if (!Number.isFinite(parsed)) {
      return 0;
    }
    const diffMs = Date.now() - parsed;
    if (diffMs <= 0) {
      return 0;
    }
    return diffMs / (24 * 60 * 60 * 1000);
  }

  private rankQuestionsByPriority(candidates: Question[], priorityMap: Map<string, number>): Question[] {
    return [...candidates].sort((a, b) => {
      const scoreDiff = (priorityMap.get(b.id) ?? 0) - (priorityMap.get(a.id) ?? 0);
      if (scoreDiff !== 0) {
        return scoreDiff;
      }
      return a.id.localeCompare(b.id);
    });
  }

  private pickQuestions(
    candidates: Question[],
    desiredCount: number,
    recentQuestionIds: Set<string>,
    selectedIds: Set<string> = new Set<string>(),
    priorityMap: Map<string, number> = new Map<string, number>(),
  ): Question[] {
    const targetCount = Math.min(desiredCount, candidates.length);
    if (targetCount <= 0) {
      return [];
    }

    const fresh = candidates.filter(
      (item) => !recentQuestionIds.has(item.id) && !selectedIds.has(item.id),
    );
    const pickedFresh = this.rankQuestionsByPriority(fresh, priorityMap).slice(0, targetCount);
    const pickedIds = new Set(pickedFresh.map((item) => item.id));

    if (pickedFresh.length < targetCount) {
      const fallback = candidates.filter(
        (item) => !selectedIds.has(item.id) && !pickedIds.has(item.id),
      );
      const pickedFallback = this.rankQuestionsByPriority(fallback, priorityMap).slice(
        0,
        targetCount - pickedFresh.length,
      );
      pickedFallback.forEach((item) => {
        pickedFresh.push(item);
      });
    }

    pickedFresh.forEach((item) => selectedIds.add(item.id));
    return pickedFresh;
  }

  private pickPart1Questions(
    candidates: Question[],
    desiredCount: number,
    recentQuestionIds: Set<string>,
  ): Question[] {
    const targetCount = Math.min(desiredCount, candidates.length);
    if (targetCount <= 0) {
      return [];
    }

    const usedImageKeys = new Set<string>();
    const fresh = candidates.filter((item) => !recentQuestionIds.has(item.id));
    const pickedFresh = this.pickDiversePart1ByImage(
      fresh,
      targetCount,
      usedImageKeys,
      false,
    );
    if (pickedFresh.length >= targetCount) {
      return this.balancePart1VisualOrder(pickedFresh);
    }

    const pickedIds = new Set(pickedFresh.map((item) => item.id));
    const fallbackPool = candidates.filter((item) => !pickedIds.has(item.id));
    const pickedFallback = this.pickDiversePart1ByImage(
      fallbackPool,
      targetCount - pickedFresh.length,
      usedImageKeys,
    );
    return this.balancePart1VisualOrder([...pickedFresh, ...pickedFallback]);
  }

  private pickDiversePart1ByImage(
    candidates: Question[],
    desiredCount: number,
    usedImageKeys: Set<string> = new Set<string>(),
    allowImageReuseWhenShort = true,
  ): Question[] {
    const targetCount = Math.min(desiredCount, candidates.length);
    if (targetCount <= 0) {
      return [];
    }

    const shuffled = this.shuffle(candidates);
    const uniqueFirst: Question[] = [];
    const leftovers: Question[] = [];
    const seenImageKeys = new Set<string>();

    shuffled.forEach((question) => {
      const key = this.part1ImageKey(question);
      if (uniqueFirst.length < targetCount && !seenImageKeys.has(key) && !usedImageKeys.has(key)) {
        uniqueFirst.push(question);
        seenImageKeys.add(key);
        usedImageKeys.add(key);
      } else {
        leftovers.push(question);
      }
    });

    const result = [...uniqueFirst];
    if (result.length < targetCount && allowImageReuseWhenShort) {
      const needed = targetCount - result.length;
      leftovers.slice(0, needed).forEach((question) => {
        result.push(question);
        usedImageKeys.add(this.part1ImageKey(question));
      });
    }
    return result.slice(0, targetCount);
  }

  private part1ImageKey(question: Question): string {
    return (question.imageUrl ?? question.id).trim() || question.id;
  }

  private balancePart1VisualOrder(questions: Question[]): Question[] {
    if (questions.length <= 1) {
      return questions;
    }

    const buckets = new Map<string, Question[]>();
    questions.forEach((question) => {
      const key = this.part1ImageKey(question);
      const list = buckets.get(key) ?? [];
      list.push(question);
      buckets.set(key, list);
    });

    const ordered: Question[] = [];
    let lastKey = "";

    while (ordered.length < questions.length) {
      let candidateEntries = Array.from(buckets.entries())
        .filter(([, list]) => list.length > 0 && list[0] && lastKey !== "")
        .filter(([key]) => key !== lastKey);

      if (candidateEntries.length === 0) {
        candidateEntries = Array.from(buckets.entries()).filter(([, list]) => list.length > 0);
      }

      if (candidateEntries.length === 0) {
        break;
      }

      candidateEntries.sort((a, b) => b[1].length - a[1].length);
      const [pickedKey, pickedList] = candidateEntries[0];
      const nextQuestion = pickedList.shift();
      if (!nextQuestion) {
        buckets.delete(pickedKey);
        continue;
      }
      ordered.push(nextQuestion);
      lastKey = pickedKey;
      if (pickedList.length === 0) {
        buckets.delete(pickedKey);
      } else {
        buckets.set(pickedKey, pickedList);
      }
    }

    return ordered.length === questions.length ? ordered : questions;
  }

  private shouldPreferRichReadingQuestions(
    mode: AttemptMode,
    filters?: { partNo?: number; difficulty?: number; partGroup?: "listening" | "reading" },
  ): boolean {
    if (mode !== "practice" && mode !== "diagnostic") {
      return false;
    }
    if (filters?.partNo === 7) {
      return true;
    }
    return filters?.partGroup === "reading";
  }

  private isRichPart7Question(question: Question): boolean {
    if (question.partNo !== 7) {
      return true;
    }
    return isQuestionEligible(question);
  }

  private pickTrustedPart1Pool(pool: Question[]): Question[] {
    const visual = pool.filter(
      (question) =>
        isDisplayablePart1Image(question) &&
        isQuestionEligible(question),
    );
    if (visual.length >= 4) {
      return visual;
    }
    const trusted = pool.filter((question) => isTrustedPart1VisualQuestion(question));
    return trusted.length >= 4 ? trusted : pool;
  }

  private plusDays(days: number): string {
    const dt = new Date();
    dt.setDate(dt.getDate() + days);
    return dt.toISOString().slice(0, 10);
  }

  private latestScore(ctx: RequestContext): number | undefined {
    const scoredAttempts = this.store.attempts
      .filter(
        (item) =>
          item.tenantId === ctx.tenantId &&
          item.userId === ctx.userId &&
          typeof item.scoreTotal === "number",
      )
      .sort((a, b) => (b.submittedAt ?? "").localeCompare(a.submittedAt ?? ""));
    const latestRepresentative = scoredAttempts.find((item) => this.isAttemptRepresentative(item));
    return latestRepresentative?.scoreTotal ?? scoredAttempts[0]?.scoreTotal;
  }

  private answeredWrongQuestionIds(ctx: RequestContext): Set<string> {
    return this.activeMistakeQuestionIds(ctx);
  }

  private currentBenchmarkScore(
    ctx: RequestContext,
    currentGoal?: { baselineScore?: number } | null,
  ): number | undefined {
    const latest = this.latestScore(ctx);
    const baseline = currentGoal?.baselineScore;
    if (typeof latest === "number" && typeof baseline === "number") {
      return Math.max(latest, baseline);
    }
    if (typeof latest === "number") {
      return latest;
    }
    if (typeof baseline === "number") {
      return baseline;
    }
    return undefined;
  }

  private createOrRefreshReviewCards(ctx: RequestContext, items: AttemptItem[]): void {
    const wrongQuestionIds = items
      .filter((item) => item.isCorrect === false && typeof item.selectedKey === "string")
      .map((item) => item.questionId)
      .filter((questionId) => {
        const question = this.store.questions.find((candidate) => candidate.id === questionId);
        return Boolean(question && isQuestionEligible(question));
      });
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

    const activeQuestionIds = this.activeMistakeQuestionIds(ctx);
    this.store.reviewCards = this.store.reviewCards.filter(
      (card) =>
        card.tenantId !== ctx.tenantId ||
        card.userId !== ctx.userId ||
        activeQuestionIds.has(card.questionId),
    );
  }

  private latestAnsweredAttemptItemsByQuestion(
    ctx: RequestContext,
  ): Map<string, { item: AttemptItem; submittedAt: string }> {
    const scopedAttemptMap = new Map(
      this.store.attempts
        .filter(
          (attempt) =>
            attempt.tenantId === ctx.tenantId &&
            attempt.userId === ctx.userId &&
            Boolean(attempt.submittedAt),
        )
        .map((attempt) => [attempt.id, attempt]),
    );

    const latest = new Map<string, { item: AttemptItem; submittedAt: string }>();
    this.store.attemptItems.forEach((item) => {
      if (typeof item.selectedKey !== "string") {
        return;
      }
      const attempt = scopedAttemptMap.get(item.attemptId);
      if (!attempt) {
        return;
      }
      const submittedAt = attempt.submittedAt ?? attempt.startedAt;
      const previous = latest.get(item.questionId);
      if (!previous) {
        latest.set(item.questionId, { item, submittedAt });
        return;
      }
      const isNewerSubmission = submittedAt.localeCompare(previous.submittedAt) > 0;
      const isSameSubmissionNewerItem =
        submittedAt === previous.submittedAt &&
        item.createdAt.localeCompare(previous.item.createdAt) > 0;
      if (isNewerSubmission || isSameSubmissionNewerItem) {
        latest.set(item.questionId, { item, submittedAt });
      }
    });
    return latest;
  }

  private activeMistakeQuestionIds(ctx: RequestContext): Set<string> {
    const latestByQuestion = this.latestAnsweredAttemptItemsByQuestion(ctx);
    return new Set(
      Array.from(latestByQuestion.entries())
        .filter(([, payload]) => payload.item.isCorrect === false)
        .map(([questionId]) => questionId),
    );
  }

  private recalculatePrediction(ctx: RequestContext) {
    const currentGoal =
      this.store.goals
        .filter((item) => item.tenantId === ctx.tenantId && item.userId === ctx.userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
    const baselineAnchor =
      typeof currentGoal?.baselineScore === "number"
        ? clamp(Math.round(currentGoal.baselineScore), 10, 990)
        : null;

    const scoredAttempts = this.store.attempts
      .filter(
        (item) =>
          item.tenantId === ctx.tenantId &&
          item.userId === ctx.userId &&
          typeof item.scoreTotal === "number" &&
          (item.mode === "diagnostic" || item.mode === "mock" || item.mode === "practice"),
      )
      .sort((a, b) => (b.submittedAt ?? "").localeCompare(a.submittedAt ?? ""));

    const result = calculatePrediction({
      baselineAnchor,
      scoredAttempts: scoredAttempts.map((item) => ({
        scoreTotal: item.scoreTotal ?? 0,
        mode: item.mode,
        isRepresentative: this.isAttemptRepresentative(item),
      })),
    });

    const prediction = {
      id: newId(),
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      predictedTotal: result.predictedTotal,
      confidence: result.confidence,
      factors: result.factors,
      createdAt: nowIso(),
    };
    this.store.predictions.push(prediction);
    return prediction;
  }

  private getAttemptAnswerStats(attemptId: string): { answered: number; total: number } {
    const items = this.store.attemptItems.filter((item) => item.attemptId === attemptId);
    const total = items.length;
    const answered = items.filter((item) => typeof item.selectedKey === "string").length;
    return { answered, total };
  }

  private isAttemptRepresentative(attempt: Attempt): boolean {
    const stats = this.getAttemptAnswerStats(attempt.id);
    if (stats.total === 0) {
      return false;
    }
    const ratio = stats.answered / stats.total;
    if (attempt.mode === "mock") {
      return stats.answered >= 80 || ratio >= 0.4;
    }
    if (attempt.mode === "diagnostic") {
      return stats.answered >= 12 || ratio >= 0.6;
    }
    if (attempt.mode === "practice") {
      return stats.answered >= 8 || ratio >= 0.6;
    }
    return ratio >= 0.6;
  }

  private shuffle<T>(items: T[]): T[] {
    const cloned = [...items];
    for (let idx = cloned.length - 1; idx > 0; idx -= 1) {
      const rand = Math.floor(Math.random() * (idx + 1));
      [cloned[idx], cloned[rand]] = [cloned[rand], cloned[idx]];
    }
    return cloned;
  }

  evaluateWriting(ctx: RequestContext, dto: { text: string }) {
    const text = dto.text.trim();
    if (!text) {
      throw new BadRequestException("Text is required");
    }
    // Simulate an AI evaluation for English writing
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    let score = 0;
    const feedback: string[] = [];
    
    if (wordCount < 50) {
      score = Math.floor(Math.random() * 20) + 40; // 40-59
      feedback.push("Your essay is too short. Try to elaborate on your points with more details.");
    } else if (wordCount < 150) {
      score = Math.floor(Math.random() * 20) + 60; // 60-79
      feedback.push("Good length, but try to use more complex sentence structures.");
    } else {
      score = Math.floor(Math.random() * 20) + 80; // 80-99
      feedback.push("Great length and detail.");
    }

    if (!/\b(However|Therefore|Moreover|In addition|Furthermore|Although)\b/i.test(text)) {
      feedback.push("Try using transition words (e.g., However, Therefore) to connect your ideas.");
    }

    return {
      score,
      wordCount,
      feedback,
    };
  }
}

