import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  CheckInDto,
  CreateIpCampaignDto,
  CreateIpSessionDto,
  ImportCandidatesDto,
  ImportIpResultsDto,
} from "../dto";
import { RequestContext } from "../context";
import { StoreService } from "../store.service";
import { newId, nowIso } from "../utils";

@Injectable()
export class EnterpriseIpService {
  constructor(private readonly store: StoreService) {}

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
    const existing = this.store.ipCandidates.filter(
      (item) => item.tenantId === ctx.tenantId && item.campaignId === campaignId,
    );
    const existingNames = new Set(existing.map((item) => item.fullName.toLowerCase().trim()).filter(Boolean));
    const existingKey = new Set(
      existing
        .map((item) => {
          const employeeNo = (item.employeeNo ?? "").trim();
          const email = (item.email ?? "").toLowerCase().trim();
          const fallbackName = item.fullName.toLowerCase().trim();
          return employeeNo || email ? `${employeeNo}::${email}` : `name::${fallbackName}`;
        })
        .filter(Boolean),
    );
    const created = dto.candidates.map((row) => {
      const employeeNo = (row.employeeNo ?? "").trim();
      const email = (row.email ?? "").toLowerCase().trim();
      const fallbackName = row.fullName.toLowerCase().trim();
      const dedupeKey = employeeNo || email ? `${employeeNo}::${email}` : `name::${fallbackName}`;
      if (dedupeKey && existingKey.has(dedupeKey)) {
        return null;
      }
      if (!employeeNo && !email && existingNames.has(fallbackName)) {
        return null;
      }
      const candidate = {
        id: newId(),
        tenantId: ctx.tenantId,
        campaignId,
        employeeNo: employeeNo || undefined,
        fullName: row.fullName,
        email: email || undefined,
      };
      this.store.ipCandidates.push(candidate);
      existingNames.add(fallbackName);
      if (dedupeKey) {
        existingKey.add(dedupeKey);
      }
      return candidate;
    });
    return { imported: created.filter(Boolean).length };
  }

  createIpSession(ctx: RequestContext, campaignId: string, dto: CreateIpSessionDto) {
    this.ensureCampaign(ctx.tenantId, campaignId);
    const starts = new Date(dto.startsAt).getTime();
    const ends = new Date(dto.endsAt).getTime();
    if (!Number.isFinite(starts) || !Number.isFinite(ends) || starts >= ends) {
      throw new BadRequestException("Invalid session window");
    }
    const duplicated = this.store.ipSessions.some(
      (item) =>
        item.tenantId === ctx.tenantId &&
        item.campaignId === campaignId &&
        item.sessionCode.toLowerCase() === dto.sessionCode.toLowerCase(),
    );
    if (duplicated) {
      throw new BadRequestException("Session code already exists in this campaign");
    }
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

  listIpSessions(ctx: RequestContext, campaignId: string) {
    this.ensureCampaign(ctx.tenantId, campaignId);
    const sessions = this.store.ipSessions
      .filter((item) => item.tenantId === ctx.tenantId && item.campaignId === campaignId)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

    return sessions.map((session) => {
      const candidates = this.store.ipSessionCandidates.filter(
        (item) => item.tenantId === ctx.tenantId && item.sessionId === session.id,
      );
      const statusCount = {
        invited: 0,
        checked_in: 0,
        in_progress: 0,
        submitted: 0,
        absent: 0,
      };
      candidates.forEach((item) => {
        statusCount[item.status] += 1;
      });
      const occupied = statusCount.checked_in + statusCount.in_progress + statusCount.submitted;
      return {
        ...session,
        rosterSize: candidates.length,
        occupiedSeats: occupied,
        availableSeats: Math.max(0, session.seatCapacity - occupied),
        statusCount,
      };
    });
  }

  listIpSessionCandidates(ctx: RequestContext, sessionId: string) {
    const session = this.store.ipSessions.find(
      (item) => item.tenantId === ctx.tenantId && item.id === sessionId,
    );
    if (!session) {
      throw new NotFoundException("Session not found");
    }
    const candidates = this.store.ipSessionCandidates
      .filter((item) => item.tenantId === ctx.tenantId && item.sessionId === sessionId)
      .map((item) => {
        const profile = this.store.ipCandidates.find(
          (candidate) =>
            candidate.tenantId === ctx.tenantId &&
            candidate.campaignId === session.campaignId &&
            candidate.id === item.candidateId,
        );
        return {
          ...item,
          fullName: profile?.fullName ?? null,
          employeeNo: profile?.employeeNo ?? null,
          email: profile?.email ?? null,
        };
      });
    return candidates.sort((a, b) => {
      if (a.status !== b.status) {
        return a.status.localeCompare(b.status);
      }
      return (a.fullName ?? "").localeCompare(b.fullName ?? "");
    });
  }

  checkInIpSessionCandidate(ctx: RequestContext, sessionId: string, dto: CheckInDto) {
    const session = this.store.ipSessions.find(
      (item) => item.tenantId === ctx.tenantId && item.id === sessionId,
    );
    if (!session) {
      throw new NotFoundException("Session not found");
    }
    const now = Date.now();
    const startsAt = new Date(session.startsAt).getTime();
    const endsAt = new Date(session.endsAt).getTime();
    const isPrivileged =
      ctx.roles.includes("tenant_admin") || ctx.roles.includes("super_admin") || ctx.roles.includes("coach");
    if (!isPrivileged && (now < startsAt - 30 * 60 * 1000 || now > endsAt + 10 * 60 * 1000)) {
      throw new BadRequestException("Check-in is outside session time window");
    }
    const sessionCandidate = this.store.ipSessionCandidates.find(
      (item) => item.tenantId === ctx.tenantId && item.sessionId === sessionId && item.candidateId === dto.candidateId,
    );
    if (!sessionCandidate) {
      throw new NotFoundException("Candidate not found in session");
    }
    if (sessionCandidate.status === "submitted") {
      throw new BadRequestException("Candidate already submitted");
    }
    if (sessionCandidate.status === "absent") {
      throw new BadRequestException("Candidate is marked absent");
    }
    if (sessionCandidate.status === "checked_in" || sessionCandidate.status === "in_progress") {
      return sessionCandidate;
    }
    const occupiedSeats = this.store.ipSessionCandidates.filter(
      (item) =>
        item.tenantId === ctx.tenantId &&
        item.sessionId === sessionId &&
        item.candidateId !== dto.candidateId &&
        (item.status === "checked_in" || item.status === "in_progress" || item.status === "submitted"),
    ).length;
    if (occupiedSeats >= session.seatCapacity) {
      throw new BadRequestException("Seat capacity reached for this session");
    }
    sessionCandidate.status = "checked_in";
    sessionCandidate.checkedInAt = nowIso();
    return sessionCandidate;
  }

  markIpSessionCandidateAbsent(ctx: RequestContext, sessionId: string, dto: CheckInDto) {
    const session = this.store.ipSessions.find(
      (item) => item.tenantId === ctx.tenantId && item.id === sessionId,
    );
    if (!session) {
      throw new NotFoundException("Session not found");
    }
    const sessionCandidate = this.store.ipSessionCandidates.find(
      (item) => item.tenantId === ctx.tenantId && item.sessionId === sessionId && item.candidateId === dto.candidateId,
    );
    if (!sessionCandidate) {
      throw new NotFoundException("Candidate not found in session");
    }
    if (sessionCandidate.status === "submitted") {
      throw new BadRequestException("Submitted candidate cannot be marked absent");
    }
    if (sessionCandidate.status === "checked_in" || sessionCandidate.status === "in_progress") {
      throw new BadRequestException("Checked-in candidate cannot be marked absent");
    }
    sessionCandidate.status = "absent";
    return sessionCandidate;
  }

  startIpSessionCandidate(ctx: RequestContext, sessionId: string, dto: CheckInDto) {
    const session = this.store.ipSessions.find(
      (item) => item.tenantId === ctx.tenantId && item.id === sessionId,
    );
    if (!session) {
      throw new NotFoundException("Session not found");
    }
    const sessionCandidate = this.store.ipSessionCandidates.find(
      (item) => item.tenantId === ctx.tenantId && item.sessionId === sessionId && item.candidateId === dto.candidateId,
    );
    if (!sessionCandidate) {
      throw new NotFoundException("Candidate not found in session");
    }
    if (sessionCandidate.status === "submitted") {
      throw new BadRequestException("Candidate already submitted");
    }
    if (sessionCandidate.status === "invited") {
      throw new BadRequestException("Candidate must check in before start");
    }
    if (sessionCandidate.status === "absent") {
      throw new BadRequestException("Candidate is marked absent");
    }
    sessionCandidate.status = "in_progress";
    return sessionCandidate;
  }

  submitIpSessionCandidate(ctx: RequestContext, sessionId: string, dto: CheckInDto) {
    const session = this.store.ipSessions.find(
      (item) => item.tenantId === ctx.tenantId && item.id === sessionId,
    );
    if (!session) {
      throw new NotFoundException("Session not found");
    }
    const now = Date.now();
    const endsAt = new Date(session.endsAt).getTime();
    const isPrivileged =
      ctx.roles.includes("tenant_admin") || ctx.roles.includes("super_admin") || ctx.roles.includes("coach");
    if (!isPrivileged && now > endsAt + 6 * 60 * 60 * 1000) {
      throw new BadRequestException("Submission window has expired");
    }
    const sessionCandidate = this.store.ipSessionCandidates.find(
      (item) => item.tenantId === ctx.tenantId && item.sessionId === sessionId && item.candidateId === dto.candidateId,
    );
    if (!sessionCandidate) {
      throw new NotFoundException("Candidate not found in session");
    }
    if (sessionCandidate.status !== "checked_in" && sessionCandidate.status !== "in_progress") {
      throw new BadRequestException("Candidate must be checked in before submit");
    }
    sessionCandidate.status = "submitted";
    sessionCandidate.submittedAt = nowIso();
    return sessionCandidate;
  }

  importIpResults(ctx: RequestContext, campaignId: string, dto: ImportIpResultsDto) {
    this.ensureCampaign(ctx.tenantId, campaignId);
    const campaignSessionIds = new Set(
      this.store.ipSessions
        .filter((item) => item.tenantId === ctx.tenantId && item.campaignId === campaignId)
        .map((item) => item.id),
    );
    let imported = 0;
    dto.rows.forEach((row) => {
      const candidate = this.store.ipCandidates.find(
        (item) => item.tenantId === ctx.tenantId && item.campaignId === campaignId && item.id === row.candidateId,
      );
      if (!candidate) {
        throw new NotFoundException(`Candidate not found: ${row.candidateId}`);
      }
      const submittedRecord = this.store.ipSessionCandidates.some(
        (item) =>
          item.tenantId === ctx.tenantId &&
          item.candidateId === row.candidateId &&
          campaignSessionIds.has(item.sessionId) &&
          item.status === "submitted",
      );
      if (!submittedRecord) {
        throw new BadRequestException(`Candidate has no submitted session record: ${row.candidateId}`);
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
    const campaignSessionIds = new Set(
      this.store.ipSessions
        .filter((item) => item.tenantId === ctx.tenantId && item.campaignId === campaignId)
        .map((item) => item.id),
    );
    const results = this.store.ipResults.filter(
      (item) => item.tenantId === ctx.tenantId && item.campaignId === campaignId,
    );
    const average =
      results.length === 0
        ? 0
        : Math.round(results.reduce((sum, item) => sum + item.scoreTotal, 0) / results.length);
    const attendance = this.store.ipSessionCandidates.filter(
      (item) => item.tenantId === ctx.tenantId && campaignSessionIds.has(item.sessionId),
    );
    const participantStatuses = new Map<string, (typeof attendance)[number]["status"]>();
    const rank: Record<(typeof attendance)[number]["status"], number> = {
      invited: 1,
      absent: 2,
      checked_in: 3,
      in_progress: 4,
      submitted: 5,
    };
    attendance.forEach((item) => {
      const prev = participantStatuses.get(item.candidateId);
      if (!prev || rank[item.status] > rank[prev]) {
        participantStatuses.set(item.candidateId, item.status);
      }
    });
    const statusBreakdown = {
      invited: 0,
      checked_in: 0,
      in_progress: 0,
      submitted: 0,
      absent: 0,
    };
    participantStatuses.forEach((status) => {
      statusBreakdown[status] += 1;
    });
    const participants = participantStatuses.size;
    const submitted = Array.from(participantStatuses.values()).filter((status) => status === "submitted").length;
    const checkedIn = Array.from(participantStatuses.values()).filter(
      (status) => status === "checked_in" || status === "in_progress" || status === "submitted",
    ).length;
    const absent = Array.from(participantStatuses.values()).filter((status) => status === "absent").length;
    const attendanceRate = participants > 0 ? Number((checkedIn / participants).toFixed(4)) : 0;
    const submissionRate = participants > 0 ? Number((submitted / participants).toFixed(4)) : 0;

    return {
      campaignId,
      participants,
      submitted,
      checkedIn,
      absent,
      attendanceRate,
      submissionRate,
      statusBreakdown,
      resultsCount: results.length,
      averageScore: average,
      minScore: results.length ? Math.min(...results.map((item) => item.scoreTotal)) : 0,
      maxScore: results.length ? Math.max(...results.map((item) => item.scoreTotal)) : 0,
    };
  }

  private ensureCampaign(tenantId: string, campaignId: string): void {
    const campaign = this.store.ipCampaigns.find(
      (item) => item.id === campaignId && item.tenantId === tenantId,
    );
    if (!campaign) {
      throw new NotFoundException("Campaign not found");
    }
  }
}
