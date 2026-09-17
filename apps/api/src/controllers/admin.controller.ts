import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { AppService } from "../app.service";
import { CreateQuestionDto, UpsertShadowingMaterialDto } from "../dto";
import { JwtAuthGuard } from "../jwt-auth.guard";
import { Roles, TenantGuard } from "../auth";
import { RolesGuard } from "../roles.guard";
import { ReqShape, toCtx } from "../request-context";
import { ContentService } from "../services/content.service";

@Controller("admin")
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class AdminController {
  constructor(
    private readonly appService: AppService,
    private readonly contentService: ContentService,
  ) {}

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

  // ===== Shadowing materials (global content, not tenant-scoped) =====

  @Get("shadowing-materials")
  @Roles("tenant_admin", "super_admin")
  listShadowingMaterials(@Query("language") language?: string) {
    const lang = language === "ja" || language === "en" ? language : undefined;
    return this.contentService.listAllMaterials(lang);
  }

  @Post("shadowing-materials")
  @Roles("tenant_admin", "super_admin")
  createShadowingMaterial(@Req() req: ReqShape, @Body() dto: UpsertShadowingMaterialDto) {
    return this.contentService.createMaterial(toCtx(req), dto);
  }

  @Put("shadowing-materials/:materialId")
  @Roles("tenant_admin", "super_admin")
  updateShadowingMaterial(
    @Req() req: ReqShape,
    @Param("materialId") materialId: string,
    @Body() dto: UpsertShadowingMaterialDto,
  ) {
    return this.contentService.updateMaterial(toCtx(req), materialId, dto);
  }

  @Post("shadowing-materials/:materialId/publish")
  @Roles("tenant_admin", "super_admin")
  publishShadowingMaterial(@Param("materialId") materialId: string) {
    return this.contentService.setPublished(materialId, true);
  }

  @Post("shadowing-materials/:materialId/unpublish")
  @Roles("tenant_admin", "super_admin")
  unpublishShadowingMaterial(@Param("materialId") materialId: string) {
    return this.contentService.setPublished(materialId, false);
  }

  @Delete("shadowing-materials/:materialId")
  @Roles("tenant_admin", "super_admin")
  deleteShadowingMaterial(@Param("materialId") materialId: string) {
    return this.contentService.deleteMaterial(materialId);
  }
}
