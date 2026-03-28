import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { AppService } from "../app.service";
import { CreateQuestionDto } from "../dto";
import { JwtAuthGuard } from "../jwt-auth.guard";
import { Roles, TenantGuard } from "../auth";
import { RolesGuard } from "../roles.guard";
import { ReqShape, toCtx } from "../request-context";

@Controller("admin")
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class AdminController {
  constructor(private readonly appService: AppService) {}

  @Post("questions")
  @Roles("tenant_admin", "coach", "super_admin")
  createQuestion(@Req() req: ReqShape, @Body() dto: CreateQuestionDto) {
    return this.appService.createQuestion(toCtx(req), dto);
  }

  @Put("questions/:questionId")
  @Roles("tenant_admin", "coach", "super_admin")
  updateQuestion(@Req() req: ReqShape, @Param("questionId") questionId: string) {
    return this.appService.publishQuestion(toCtx(req), questionId);
  }

  @Post("questions/:questionId/publish")
  @Roles("tenant_admin", "coach", "super_admin")
  publishQuestion(@Req() req: ReqShape, @Param("questionId") questionId: string) {
    return this.appService.publishQuestion(toCtx(req), questionId);
  }

  @Get("questions")
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

  @Get("question-pool-health")
  @Roles("tenant_admin", "coach", "super_admin")
  questionPoolHealth(@Req() req: ReqShape) {
    return this.appService.getQuestionPoolHealth(toCtx(req));
  }

  @Get("audit-logs")
  @Roles("tenant_admin", "super_admin")
  listAuditLogs(@Req() req: ReqShape) {
    return this.appService.listAuditLogs(toCtx(req));
  }
}
