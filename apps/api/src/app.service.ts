import { Injectable } from "@nestjs/common";
import {
  CheckInDto,
  ConversationReplyDto,
  CreateIpCampaignDto,
  CreateIpSessionDto,
  CreateQuestionDto,
  GoalDto,
  GradeCardDto,
  ImportCandidatesDto,
  ImportIpResultsDto,
  LoginDto,
  MistakeNoteDto,
  OAuthLoginDto,
  RegisterDto,
  StartMistakeDrillDto,
  SubmitAttemptDto,
} from "./dto";
import { RequestContext } from "./context";
import { AuthDomainService } from "./services/auth-domain.service";
import { AdminQuestionService } from "./services/admin-question.service";
import { EnterpriseIpService } from "./services/enterprise-ip.service";
import { LearningDomainService } from "./services/learning-domain.service";
import { SubscriptionService } from "./services/subscription.service";
import { StoreService } from "./store.service";
import { AttemptMode, ReviewCard } from "./types";
import { newId, nowIso } from "./utils";
import { BadRequestException } from "@nestjs/common";

@Injectable()
export class AppService {
  constructor(
    private readonly store: StoreService,
    private readonly authDomain: AuthDomainService,
    private readonly adminQuestionService: AdminQuestionService,
    private readonly enterpriseIpService: EnterpriseIpService,
    private readonly learningDomainService: LearningDomainService,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  persistStore(): void {
    this.store.persistSnapshot();
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

  async register(dto: RegisterDto): Promise<{ userId: string }> {
    return this.authDomain.register(dto);
  }

  async login(dto: LoginDto): Promise<{ accessToken: string; refreshToken: string; tenantCode: string }> {
    return this.authDomain.login(dto);
  }

  async refreshToken(userId: string): Promise<{ accessToken: string }> {
    return this.authDomain.refreshToken(userId);
  }

  async exchangeRefreshToken(rawToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    return this.authDomain.exchangeRefreshToken(rawToken);
  }

  async oauthLogin(dto: OAuthLoginDto): Promise<{ accessToken: string; tenantCode: string; isNewUser: boolean }> {
    return this.authDomain.oauthLogin(dto);
  }

  getMe(ctx: RequestContext): {
    id: string;
    email: string;
    displayName: string;
    roles: string[];
    tenantId: string;
  } {
    return this.authDomain.getMe(ctx);
  }

  createGoal(ctx: RequestContext, dto: GoalDto): { goalId: string } {
    return this.learningDomainService.createGoal(ctx, dto);
  }

  getCurrentGoal(ctx: RequestContext) {
    return this.learningDomainService.getCurrentGoal(ctx);
  }

  startAttempt(
    ctx: RequestContext,
    mode: AttemptMode,
    filters?: { partNo?: number; difficulty?: number; partGroup?: "listening" | "reading" },
  ) {
    // Check subscription limits
    const action = mode === "mock" ? "mock_test" : "practice_session";
    const limitCheck = this.subscriptionService.checkLimit(ctx, action as "practice_session" | "mock_test");
    if (!limitCheck.allowed) {
      throw new BadRequestException(limitCheck.reason);
    }
    const result = this.learningDomainService.startAttempt(ctx, mode, filters);
    // Track usage
    this.subscriptionService.incrementUsage(ctx, mode === "mock" ? "mockTests" : "practiceSessions");
    return result;
  }

  startMistakeDrill(ctx: RequestContext, dto: StartMistakeDrillDto) {
    return this.learningDomainService.startMistakeDrill(ctx, dto);
  }

  submitAttempt(ctx: RequestContext, attemptId: string, dto: SubmitAttemptDto) {
    return this.learningDomainService.submitAttempt(ctx, attemptId, dto);
  }

  analyticsOverview(ctx: RequestContext) {
    return this.learningDomainService.analyticsOverview(ctx);
  }

  nextTasks(ctx: RequestContext) {
    return this.learningDomainService.nextTasks(ctx);
  }

  dailyPlan(ctx: RequestContext) {
    return this.learningDomainService.dailyPlan(ctx);
  }

  getPracticeRecommendations(ctx: RequestContext) {
    return this.learningDomainService.getPracticeRecommendations(ctx);
  }

  listMistakes(ctx: RequestContext) {
    return this.learningDomainService.listMistakes(ctx);
  }

  getMistakeLibrary(ctx: RequestContext) {
    return this.learningDomainService.getMistakeLibrary(ctx);
  }

  addMistakeNote(ctx: RequestContext, attemptItemId: string, dto: MistakeNoteDto) {
    return this.learningDomainService.addMistakeNote(ctx, attemptItemId, dto);
  }

  getVocabularyCards(ctx: RequestContext) {
    return this.learningDomainService.getVocabularyCards(ctx);
  }

  gradeVocabularyCard(ctx: RequestContext, cardId: string, dto: GradeCardDto) {
    return this.learningDomainService.gradeVocabularyCard(ctx, cardId, dto);
  }

  getGrammarCards(ctx: RequestContext) {
    const cards = this.store.getGrammarCards(ctx.tenantId, ctx.userId);
    const today = new Date().toISOString().slice(0, 10);
    const dueCards = cards.filter((c) => c.dueAt <= today);
    return {
      summary: {
        total: cards.length,
        due: dueCards.length,
        learning: cards.filter((c) => c.intervalDays > 0 && c.intervalDays < 14).length,
        mastered: cards.filter((c) => c.intervalDays >= 14 && (c.lastGrade ?? 0) >= 4).length,
      },
      cards: cards.map((c) => ({
        ...c,
        due: c.dueAt <= today,
      })),
    };
  }

  gradeGrammarCard(ctx: RequestContext, cardId: string, dto: GradeCardDto) {
    const card = this.store.gradeGrammarCard(ctx.tenantId, ctx.userId, cardId, dto.grade);
    if (!card) {
      throw new Error("Grammar card not found");
    }
    return { success: true };
  }

  getDueCards(ctx: RequestContext) {
    return this.learningDomainService.getDueCards(ctx);
  }

  gradeCard(ctx: RequestContext, cardId: string, dto: GradeCardDto): ReviewCard {
    return this.learningDomainService.gradeCard(ctx, cardId, dto);
  }

  enqueueSrsCards(ctx: RequestContext, questionIds: string[]): { enqueued: number; skipped: number } {
    return this.learningDomainService.enqueueSrsCards(ctx, questionIds);
  }

  getMockHistory(ctx: RequestContext) {
    return this.learningDomainService.getMockHistory(ctx);
  }

  getLatestPrediction(ctx: RequestContext) {
    return this.learningDomainService.getLatestPrediction(ctx);
  }

  listConversationScenarios() {
    return this.learningDomainService.listConversationScenarios();
  }

  generateConversationReply(ctx: RequestContext, dto: ConversationReplyDto) {
    return this.learningDomainService.generateConversationReply(ctx, dto);
  }

  evaluateWriting(ctx: RequestContext, dto: { text: string }) {
    return this.learningDomainService.evaluateWriting(ctx, dto);
  }

  createQuestion(ctx: RequestContext, dto: CreateQuestionDto): { questionId: string } {
    return this.adminQuestionService.createQuestion(ctx, dto);
  }

  publishQuestion(ctx: RequestContext, questionId: string): { questionId: string; status: string } {
    return this.adminQuestionService.publishQuestion(ctx, questionId);
  }

  listQuestions(ctx: RequestContext, part?: number, difficulty?: number) {
    return this.adminQuestionService.listQuestions(ctx, part, difficulty);
  }

  getQuestionPoolHealth(ctx: RequestContext) {
    return this.adminQuestionService.getQuestionPoolHealth(ctx);
  }

  listAuditLogs(ctx: RequestContext) {
    return this.adminQuestionService.listAuditLogs(ctx);
  }

  createIpCampaign(ctx: RequestContext, dto: CreateIpCampaignDto) {
    return this.enterpriseIpService.createIpCampaign(ctx, dto);
  }

  listIpCampaigns(ctx: RequestContext) {
    return this.enterpriseIpService.listIpCampaigns(ctx);
  }

  listIpCandidates(ctx: RequestContext, campaignId: string) {
    return this.enterpriseIpService.listIpCandidates(ctx, campaignId);
  }

  importIpCandidates(ctx: RequestContext, campaignId: string, dto: ImportCandidatesDto) {
    return this.enterpriseIpService.importIpCandidates(ctx, campaignId, dto);
  }

  createIpSession(ctx: RequestContext, campaignId: string, dto: CreateIpSessionDto) {
    return this.enterpriseIpService.createIpSession(ctx, campaignId, dto);
  }

  listIpSessions(ctx: RequestContext, campaignId: string) {
    return this.enterpriseIpService.listIpSessions(ctx, campaignId);
  }

  listIpSessionCandidates(ctx: RequestContext, sessionId: string) {
    return this.enterpriseIpService.listIpSessionCandidates(ctx, sessionId);
  }

  checkInIpSessionCandidate(ctx: RequestContext, sessionId: string, dto: CheckInDto) {
    return this.enterpriseIpService.checkInIpSessionCandidate(ctx, sessionId, dto);
  }

  markIpSessionCandidateAbsent(ctx: RequestContext, sessionId: string, dto: CheckInDto) {
    return this.enterpriseIpService.markIpSessionCandidateAbsent(ctx, sessionId, dto);
  }

  startIpSessionCandidate(ctx: RequestContext, sessionId: string, dto: CheckInDto) {
    return this.enterpriseIpService.startIpSessionCandidate(ctx, sessionId, dto);
  }

  submitIpSessionCandidate(ctx: RequestContext, sessionId: string, dto: CheckInDto) {
    return this.enterpriseIpService.submitIpSessionCandidate(ctx, sessionId, dto);
  }

  importIpResults(ctx: RequestContext, campaignId: string, dto: ImportIpResultsDto) {
    return this.enterpriseIpService.importIpResults(ctx, campaignId, dto);
  }

  campaignReport(ctx: RequestContext, campaignId: string) {
    return this.enterpriseIpService.campaignReport(ctx, campaignId);
  }
}
