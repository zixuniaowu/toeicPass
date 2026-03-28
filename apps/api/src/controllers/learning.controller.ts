import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { AppService } from "../app.service";
import {
  ConversationReplyDto,
  GoalDto,
  GradeCardDto,
  MistakeNoteDto,
  StartMistakeDrillDto,
  SubmitAttemptDto,
  WritingEvaluateDto,
} from "../dto";
import { JwtAuthGuard } from "../jwt-auth.guard";
import { TenantGuard } from "../auth";
import { RolesGuard } from "../roles.guard";
import { ReqShape, toCtx } from "../request-context";
import { parseAttemptFilters } from "../session-filters";

@Controller()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class LearningController {
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
    @Query("partGroup") partGroup?: string,
  ) {
    return this.appService.startAttempt(
      toCtx(req),
      "diagnostic",
      parseAttemptFilters({ part, difficulty, partGroup }),
    );
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

  @Get("learning/daily-plan")
  dailyPlan(@Req() req: ReqShape) {
    return this.appService.dailyPlan(toCtx(req));
  }

  @Get("conversation/scenarios")
  conversationScenarios() {
    return this.appService.listConversationScenarios();
  }

  @Post("conversation/reply")
  conversationReply(@Req() req: ReqShape, @Body() dto: ConversationReplyDto) {
    return this.appService.generateConversationReply(toCtx(req), dto);
  }

  @Post("writing/evaluate")
  evaluateWriting(@Req() req: ReqShape, @Body() dto: WritingEvaluateDto) {
    return this.appService.evaluateWriting(toCtx(req), dto);
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
    @Query("partGroup") partGroup?: string,
  ) {
    return this.appService.startAttempt(
      toCtx(req),
      "practice",
      parseAttemptFilters({ part, difficulty, partGroup }),
    );
  }

  @Post("practice/sessions/mistakes/start")
  startMistakeDrill(@Req() req: ReqShape, @Body() dto: StartMistakeDrillDto) {
    return this.appService.startMistakeDrill(toCtx(req), dto);
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
    @Query("partGroup") partGroup?: string,
  ) {
    return this.appService.startAttempt(
      toCtx(req),
      "mock",
      parseAttemptFilters({ part, difficulty, partGroup }),
    );
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
}
