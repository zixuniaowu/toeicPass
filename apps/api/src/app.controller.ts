import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Put,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { AppService } from "./app.service";
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
import { JwtAuthGuard } from "./jwt-auth.guard";
import { Roles, JwtUser, TenantGuard } from "./auth";
import { RolesGuard } from "./roles.guard";
import { RequestContext } from "./context";

type ReqShape = {
  user?: JwtUser;
  tenantId?: string;
  tenantCode?: string;
  roles?: RequestContext["roles"];
};

const toCtx = (req: ReqShape): RequestContext => {
  if (!req.user?.sub || !req.tenantId || !req.tenantCode || !req.roles) {
    throw new UnauthorizedException("Missing request context");
  }
  return {
    userId: req.user.sub,
    tenantId: req.tenantId,
    tenantCode: req.tenantCode,
    roles: req.roles,
  };
};

@Controller("auth")
export class AuthController {
  constructor(private readonly appService: AppService) {}

  @Post("register")
  register(@Body() dto: RegisterDto) {
    return this.appService.register(dto);
  }

  @Post("login")
  login(@Body() dto: LoginDto, @Headers("x-tenant-code") tenantCode?: string) {
    if (tenantCode && !dto.tenantCode) {
      dto.tenantCode = tenantCode;
    }
    return this.appService.login(dto);
  }

  @Post("refresh")
  @UseGuards(JwtAuthGuard)
  refresh(@Req() req: ReqShape) {
    if (!req.user?.sub) {
      throw new UnauthorizedException("Missing user");
    }
    return this.appService.refreshToken(req.user.sub);
  }
}

@Controller()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get("me")
  me(@Req() req: ReqShape) {
    return this.appService.getMe(toCtx(req));
  }

  @Post("goals")
  createGoal(@Req() req: ReqShape, @Body() dto: GoalDto) {
    return this.appService.createGoal(toCtx(req), dto);
  }

  @Get("goals/current")
  currentGoal(@Req() req: ReqShape) {
    return this.appService.getCurrentGoal(toCtx(req));
  }

  @Post("diagnostics/start")
  startDiagnostic(
    @Req() req: ReqShape,
    @Query("part") part?: string,
    @Query("difficulty") difficulty?: string,
  ) {
    const parsedPart = part ? Number(part) : undefined;
    const parsedDifficulty = difficulty ? Number(difficulty) : undefined;
    return this.appService.startAttempt(toCtx(req), "diagnostic", {
      partNo: Number.isNaN(parsedPart) ? undefined : parsedPart,
      difficulty: Number.isNaN(parsedDifficulty) ? undefined : parsedDifficulty,
    });
  }

  @Post("diagnostics/:attemptId/submit")
  submitDiagnostic(
    @Req() req: ReqShape,
    @Param("attemptId") attemptId: string,
    @Body() dto: SubmitAttemptDto,
  ) {
    return this.appService.submitAttempt(toCtx(req), attemptId, dto);
  }

  @Get("practice/recommendations")
  practiceRecommendations(@Req() req: ReqShape) {
    return this.appService.getPracticeRecommendations(toCtx(req));
  }

  @Get("analytics/overview")
  analyticsOverview(@Req() req: ReqShape) {
    return this.appService.analyticsOverview(toCtx(req));
  }

  @Get("learning/next-tasks")
  nextTasks(@Req() req: ReqShape) {
    return this.appService.nextTasks(toCtx(req));
  }

  @Get("learning/vocabulary/cards")
  vocabularyCards(@Req() req: ReqShape) {
    return this.appService.getVocabularyCards(toCtx(req));
  }

  @Post("learning/vocabulary/cards/:cardId/grade")
  gradeVocabularyCard(@Req() req: ReqShape, @Param("cardId") cardId: string, @Body() dto: GradeCardDto) {
    return this.appService.gradeVocabularyCard(toCtx(req), cardId, dto);
  }

  @Post("practice/sessions")
  startPractice(
    @Req() req: ReqShape,
    @Query("part") part?: string,
    @Query("difficulty") difficulty?: string,
  ) {
    const parsedPart = part ? Number(part) : undefined;
    const parsedDifficulty = difficulty ? Number(difficulty) : undefined;
    return this.appService.startAttempt(toCtx(req), "practice", {
      partNo: Number.isNaN(parsedPart) ? undefined : parsedPart,
      difficulty: Number.isNaN(parsedDifficulty) ? undefined : parsedDifficulty,
    });
  }

  @Post("practice/sessions/:sessionId/complete")
  completePractice(
    @Req() req: ReqShape,
    @Param("sessionId") sessionId: string,
    @Body() dto: SubmitAttemptDto,
  ) {
    return this.appService.submitAttempt(toCtx(req), sessionId, dto);
  }

  @Post("practice/sessions/:sessionId/answers")
  submitPracticeAnswers(
    @Req() req: ReqShape,
    @Param("sessionId") sessionId: string,
    @Body() dto: SubmitAttemptDto,
  ) {
    return this.appService.submitAttempt(toCtx(req), sessionId, dto);
  }

  @Get("mistakes")
  mistakes(@Req() req: ReqShape) {
    return this.appService.listMistakes(toCtx(req));
  }

  @Get("mistakes/library")
  mistakeLibrary(@Req() req: ReqShape) {
    return this.appService.getMistakeLibrary(toCtx(req));
  }

  @Post("mistakes/:itemId/notes")
  addMistakeNote(@Req() req: ReqShape, @Param("itemId") itemId: string, @Body() dto: MistakeNoteDto) {
    return this.appService.addMistakeNote(toCtx(req), itemId, dto);
  }

  @Get("review/cards/due")
  dueCards(@Req() req: ReqShape) {
    return this.appService.getDueCards(toCtx(req));
  }

  @Post("review/cards/:cardId/grade")
  gradeCard(@Req() req: ReqShape, @Param("cardId") cardId: string, @Body() dto: GradeCardDto) {
    return this.appService.gradeCard(toCtx(req), cardId, dto);
  }

  @Post("mock-tests/start")
  startMock(
    @Req() req: ReqShape,
    @Query("part") part?: string,
    @Query("difficulty") difficulty?: string,
  ) {
    const parsedPart = part ? Number(part) : undefined;
    const parsedDifficulty = difficulty ? Number(difficulty) : undefined;
    return this.appService.startAttempt(toCtx(req), "mock", {
      partNo: Number.isNaN(parsedPart) ? undefined : parsedPart,
      difficulty: Number.isNaN(parsedDifficulty) ? undefined : parsedDifficulty,
    });
  }

  @Post("mock-tests/:attemptId/submit")
  submitMock(@Req() req: ReqShape, @Param("attemptId") attemptId: string, @Body() dto: SubmitAttemptDto) {
    return this.appService.submitAttempt(toCtx(req), attemptId, dto);
  }

  @Get("mock-tests/history")
  mockHistory(@Req() req: ReqShape) {
    return this.appService.getMockHistory(toCtx(req));
  }

  @Get("predictions/latest")
  latestPrediction(@Req() req: ReqShape) {
    return this.appService.getLatestPrediction(toCtx(req));
  }

  @Post("admin/questions")
  @Roles("tenant_admin", "coach", "super_admin")
  createQuestion(@Req() req: ReqShape, @Body() dto: CreateQuestionDto) {
    return this.appService.createQuestion(toCtx(req), dto);
  }

  @Put("admin/questions/:questionId")
  @Roles("tenant_admin", "coach", "super_admin")
  updateQuestion(@Req() req: ReqShape, @Param("questionId") questionId: string) {
    return this.appService.publishQuestion(toCtx(req), questionId);
  }

  @Post("admin/questions/:questionId/publish")
  @Roles("tenant_admin", "coach", "super_admin")
  publishQuestion(@Req() req: ReqShape, @Param("questionId") questionId: string) {
    return this.appService.publishQuestion(toCtx(req), questionId);
  }

  @Get("admin/questions")
  @Roles("tenant_admin", "coach", "super_admin")
  listQuestions(
    @Req() req: ReqShape,
    @Query("part") part?: string,
    @Query("difficulty") difficulty?: string,
  ) {
    const p = part ? Number(part) : undefined;
    const d = difficulty ? Number(difficulty) : undefined;
    return this.appService.listQuestions(toCtx(req), p, d);
  }

  @Get("admin/audit-logs")
  @Roles("tenant_admin", "super_admin")
  listAuditLogs(@Req() req: ReqShape) {
    return this.appService.listAuditLogs(toCtx(req));
  }

  @Post("ip/campaigns")
  @Roles("tenant_admin", "super_admin")
  createIpCampaign(@Req() req: ReqShape, @Body() dto: CreateIpCampaignDto) {
    return this.appService.createIpCampaign(toCtx(req), dto);
  }

  @Get("ip/campaigns")
  @Roles("tenant_admin", "coach", "super_admin")
  listIpCampaigns(@Req() req: ReqShape) {
    return this.appService.listIpCampaigns(toCtx(req));
  }

  @Post("ip/campaigns/:campaignId/candidates/import")
  @Roles("tenant_admin", "super_admin")
  importIpCandidates(
    @Req() req: ReqShape,
    @Param("campaignId") campaignId: string,
    @Body() dto: ImportCandidatesDto,
  ) {
    return this.appService.importIpCandidates(toCtx(req), campaignId, dto);
  }

  @Get("ip/campaigns/:campaignId/candidates")
  @Roles("tenant_admin", "coach", "super_admin")
  listIpCandidates(@Req() req: ReqShape, @Param("campaignId") campaignId: string) {
    return this.appService.listIpCandidates(toCtx(req), campaignId);
  }

  @Post("ip/campaigns/:campaignId/sessions")
  @Roles("tenant_admin", "super_admin")
  createIpSession(
    @Req() req: ReqShape,
    @Param("campaignId") campaignId: string,
    @Body() dto: CreateIpSessionDto,
  ) {
    return this.appService.createIpSession(toCtx(req), campaignId, dto);
  }

  @Post("ip/sessions/:sessionId/check-in")
  @Roles("tenant_admin", "coach", "super_admin")
  checkInIpSession(
    @Req() req: ReqShape,
    @Param("sessionId") sessionId: string,
    @Body() dto: CheckInDto,
  ) {
    return this.appService.checkInIpSessionCandidate(toCtx(req), sessionId, dto);
  }

  @Post("ip/sessions/:sessionId/submit")
  @Roles("tenant_admin", "coach", "super_admin")
  submitIpSession(
    @Req() req: ReqShape,
    @Param("sessionId") sessionId: string,
    @Body() dto: CheckInDto,
  ) {
    return this.appService.submitIpSessionCandidate(toCtx(req), sessionId, dto);
  }

  @Post("ip/campaigns/:campaignId/results/import")
  @Roles("tenant_admin", "super_admin")
  importIpResults(
    @Req() req: ReqShape,
    @Param("campaignId") campaignId: string,
    @Body() dto: ImportIpResultsDto,
  ) {
    return this.appService.importIpResults(toCtx(req), campaignId, dto);
  }

  @Get("ip/campaigns/:campaignId/reports")
  @Roles("tenant_admin", "coach", "super_admin")
  getCampaignReport(@Req() req: ReqShape, @Param("campaignId") campaignId: string) {
    return this.appService.campaignReport(toCtx(req), campaignId);
  }
}
