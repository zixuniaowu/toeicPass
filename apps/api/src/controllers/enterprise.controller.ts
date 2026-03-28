import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { AppService } from "../app.service";
import {
  CheckInDto,
  CreateIpCampaignDto,
  CreateIpSessionDto,
  ImportCandidatesDto,
  ImportIpResultsDto,
} from "../dto";
import { JwtAuthGuard } from "../jwt-auth.guard";
import { Roles, TenantGuard } from "../auth";
import { RolesGuard } from "../roles.guard";
import { ReqShape, toCtx } from "../request-context";

@Controller("ip")
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class EnterpriseController {
  constructor(private readonly appService: AppService) {}

  @Post("campaigns")
  @Roles("tenant_admin", "super_admin")
  createIpCampaign(@Req() req: ReqShape, @Body() dto: CreateIpCampaignDto) {
    return this.appService.createIpCampaign(toCtx(req), dto);
  }

  @Get("campaigns")
  @Roles("tenant_admin", "coach", "super_admin")
  listIpCampaigns(@Req() req: ReqShape) {
    return this.appService.listIpCampaigns(toCtx(req));
  }

  @Post("campaigns/:campaignId/candidates/import")
  @Roles("tenant_admin", "super_admin")
  importIpCandidates(
    @Req() req: ReqShape,
    @Param("campaignId") campaignId: string,
    @Body() dto: ImportCandidatesDto,
  ) {
    return this.appService.importIpCandidates(toCtx(req), campaignId, dto);
  }

  @Get("campaigns/:campaignId/candidates")
  @Roles("tenant_admin", "coach", "super_admin")
  listIpCandidates(@Req() req: ReqShape, @Param("campaignId") campaignId: string) {
    return this.appService.listIpCandidates(toCtx(req), campaignId);
  }

  @Post("campaigns/:campaignId/sessions")
  @Roles("tenant_admin", "super_admin")
  createIpSession(
    @Req() req: ReqShape,
    @Param("campaignId") campaignId: string,
    @Body() dto: CreateIpSessionDto,
  ) {
    return this.appService.createIpSession(toCtx(req), campaignId, dto);
  }

  @Get("campaigns/:campaignId/sessions")
  @Roles("tenant_admin", "coach", "super_admin")
  listIpSessions(@Req() req: ReqShape, @Param("campaignId") campaignId: string) {
    return this.appService.listIpSessions(toCtx(req), campaignId);
  }

  @Get("sessions/:sessionId/candidates")
  @Roles("tenant_admin", "coach", "super_admin")
  listIpSessionCandidates(@Req() req: ReqShape, @Param("sessionId") sessionId: string) {
    return this.appService.listIpSessionCandidates(toCtx(req), sessionId);
  }

  @Post("sessions/:sessionId/check-in")
  @Roles("tenant_admin", "coach", "super_admin")
  checkInIpSession(
    @Req() req: ReqShape,
    @Param("sessionId") sessionId: string,
    @Body() dto: CheckInDto,
  ) {
    return this.appService.checkInIpSessionCandidate(toCtx(req), sessionId, dto);
  }

  @Post("sessions/:sessionId/absent")
  @Roles("tenant_admin", "coach", "super_admin")
  absentIpSession(
    @Req() req: ReqShape,
    @Param("sessionId") sessionId: string,
    @Body() dto: CheckInDto,
  ) {
    return this.appService.markIpSessionCandidateAbsent(toCtx(req), sessionId, dto);
  }

  @Post("sessions/:sessionId/start")
  @Roles("tenant_admin", "coach", "super_admin")
  startIpSession(
    @Req() req: ReqShape,
    @Param("sessionId") sessionId: string,
    @Body() dto: CheckInDto,
  ) {
    return this.appService.startIpSessionCandidate(toCtx(req), sessionId, dto);
  }

  @Post("sessions/:sessionId/submit")
  @Roles("tenant_admin", "coach", "super_admin")
  submitIpSession(
    @Req() req: ReqShape,
    @Param("sessionId") sessionId: string,
    @Body() dto: CheckInDto,
  ) {
    return this.appService.submitIpSessionCandidate(toCtx(req), sessionId, dto);
  }

  @Post("campaigns/:campaignId/results/import")
  @Roles("tenant_admin", "super_admin")
  importIpResults(
    @Req() req: ReqShape,
    @Param("campaignId") campaignId: string,
    @Body() dto: ImportIpResultsDto,
  ) {
    return this.appService.importIpResults(toCtx(req), campaignId, dto);
  }

  @Get("campaigns/:campaignId/reports")
  @Roles("tenant_admin", "coach", "super_admin")
  getCampaignReport(@Req() req: ReqShape, @Param("campaignId") campaignId: string) {
    return this.appService.campaignReport(toCtx(req), campaignId);
  }
}
