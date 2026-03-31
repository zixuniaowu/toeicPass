import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Client } from "pg";
import { StoreService } from "./store.service";
import {
  Attempt,
  AttemptItem,
  AuditLog,
  Goal,
  IpCampaign,
  IpCandidate,
  IpResult,
  IpSession,
  IpSessionCandidate,
  Membership,
  MistakeNote,
  OrgUnit,
  Question,
  ReviewCard,
  ScorePrediction,
  Tenant,
  User,
  VocabularyCard,
} from "./types";

@Injectable()
export class PgStoreService extends StoreService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PgStoreService.name);
  private client: Client | null = null;

  constructor() {
    super();
  }

  async onModuleInit(): Promise<void> {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      this.logger.warn("DATABASE_URL not set — PgStoreService will fall back to in-memory mode");
      return;
    }

    this.client = new Client({ connectionString: databaseUrl });
    await this.client.connect();
    this.logger.log("Connected to PostgreSQL");
    await this.loadFromDatabase();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.end();
      this.client = null;
    }
  }

  persistSnapshot(): void {
    super.persistSnapshot();

    if (this.client) {
      this.syncToDatabase().catch((error) => {
        this.logger.error("Failed to sync snapshot to PostgreSQL", error);
      });
    }
  }

  private async loadFromDatabase(): Promise<void> {
    if (!this.client) {
      return;
    }

    try {
      this.tenants = await this.queryRows<Tenant>(
        "SELECT id, name, code, created_at AS \"createdAt\" FROM tenants",
      );
      this.users = await this.queryRows<User>(
        `SELECT id, email, password_hash AS "passwordHash", display_name AS "displayName",
                is_active AS "isActive", created_at AS "createdAt" FROM users`,
      );
      this.memberships = await this.queryRows<Membership>(
        `SELECT id, tenant_id AS "tenantId", user_id AS "userId", role FROM memberships`,
      );
      this.goals = await this.queryRows<Goal>(
        `SELECT id, tenant_id AS "tenantId", user_id AS "userId",
                target_score AS "targetScore", target_exam_date AS "targetExamDate",
                baseline_score AS "baselineScore", created_at AS "createdAt" FROM goals`,
      );
      this.attempts = await this.queryRows<Attempt>(
        `SELECT id, tenant_id AS "tenantId", user_id AS "userId", mode,
                started_at AS "startedAt", submitted_at AS "submittedAt",
                score_l AS "scoreL", score_r AS "scoreR" FROM attempts`,
      );
      this.attemptItems = await this.queryRows<AttemptItem>(
        `SELECT id, attempt_id AS "attemptId", question_id AS "questionId",
                selected_key AS "selectedKey", is_correct AS "isCorrect",
                duration_ms AS "durationMs", created_at AS "createdAt" FROM attempt_items`,
      );
      this.predictions = await this.queryRows<ScorePrediction>(
        `SELECT id, tenant_id AS "tenantId", user_id AS "userId",
                predicted_total AS "predictedTotal", confidence, factors,
                created_at AS "createdAt" FROM score_predictions`,
      );
      this.auditLogs = await this.queryRows<AuditLog>(
        `SELECT id, tenant_id AS "tenantId", actor_user_id AS "actorUserId",
                action, entity_type AS "entityType", entity_id AS "entityId",
                payload, created_at AS "createdAt" FROM audit_logs`,
      );

      await this.loadQuestionsFromDatabase();
      await this.loadReviewCardsFromDatabase();
      await this.loadMistakeNotesFromDatabase();
      await this.loadIpTablesFromDatabase();

      this.logger.log(
        `Loaded from PostgreSQL: ${this.tenants.length} tenants, ${this.users.length} users, ` +
        `${this.questions.length} questions, ${this.attempts.length} attempts`,
      );
    } catch (error) {
      this.logger.error("Failed to load from PostgreSQL — falling back to snapshot data", error);
    }
  }

  private async loadQuestionsFromDatabase(): Promise<void> {
    if (!this.client) {
      return;
    }

    const questionRows = await this.queryRows<Question & { options?: unknown }>(
      `SELECT id, tenant_id AS "tenantId", part_no AS "partNo", skill_tag AS "skillTag",
              difficulty, stem, explanation, media_url AS "mediaUrl",
              status, created_by AS "createdBy", created_at AS "createdAt"
       FROM questions`,
    );

    const optionRows = await this.queryRows<{
      questionId: string;
      optionKey: string;
      optionText: string;
      isCorrect: boolean;
    }>(
      `SELECT question_id AS "questionId", option_key AS "optionKey",
              option_text AS "optionText", is_correct AS "isCorrect"
       FROM question_options ORDER BY question_id, option_key`,
    );

    const optionsByQuestion = new Map<string, Array<{ key: string; text: string; isCorrect: boolean }>>();
    optionRows.forEach((row) => {
      const bucket = optionsByQuestion.get(row.questionId) ?? [];
      bucket.push({ key: row.optionKey, text: row.optionText, isCorrect: row.isCorrect });
      optionsByQuestion.set(row.questionId, bucket);
    });

    this.questions = questionRows.map((row) => ({
      ...row,
      options: (optionsByQuestion.get(row.id) ?? []).map((opt) => ({
        key: opt.key as "A" | "B" | "C" | "D",
        text: opt.text,
        isCorrect: opt.isCorrect,
      })),
    }));
  }

  private async loadReviewCardsFromDatabase(): Promise<void> {
    if (!this.client) {
      return;
    }
    this.reviewCards = await this.queryRows<ReviewCard>(
      `SELECT id, tenant_id AS "tenantId", user_id AS "userId",
              question_id AS "questionId", ease_factor AS "easeFactor",
              interval_days AS "intervalDays", due_at AS "dueAt",
              last_grade AS "lastGrade" FROM review_cards`,
    );
  }

  private async loadMistakeNotesFromDatabase(): Promise<void> {
    if (!this.client) {
      return;
    }
    this.mistakeNotes = await this.queryRows<MistakeNote>(
      `SELECT id, tenant_id AS "tenantId", user_id AS "userId",
              attempt_item_id AS "attemptItemId", root_cause AS "rootCause",
              note, created_at AS "createdAt" FROM mistake_notes`,
    );
  }

  private async loadIpTablesFromDatabase(): Promise<void> {
    if (!this.client) {
      return;
    }
    this.orgUnits = await this.queryRows<OrgUnit>(
      `SELECT id, tenant_id AS "tenantId", name, parent_id AS "parentId" FROM org_units`,
    );
    this.ipCampaigns = await this.queryRows<IpCampaign>(
      `SELECT id, tenant_id AS "tenantId", name, mode, planned_date AS "plannedDate",
              status, created_by AS "createdBy", created_at AS "createdAt" FROM ip_campaigns`,
    );
    this.ipCandidates = await this.queryRows<IpCandidate>(
      `SELECT id, tenant_id AS "tenantId", campaign_id AS "campaignId",
              employee_no AS "employeeNo", full_name AS "fullName",
              email, org_unit_id AS "orgUnitId" FROM ip_candidates`,
    );
    this.ipSessions = await this.queryRows<IpSession>(
      `SELECT id, tenant_id AS "tenantId", campaign_id AS "campaignId",
              session_code AS "sessionCode", starts_at AS "startsAt",
              ends_at AS "endsAt", seat_capacity AS "seatCapacity",
              proctor_user_id AS "proctorUserId" FROM ip_sessions`,
    );
    this.ipSessionCandidates = await this.queryRows<IpSessionCandidate>(
      `SELECT id, tenant_id AS "tenantId", session_id AS "sessionId",
              candidate_id AS "candidateId", status,
              checked_in_at AS "checkedInAt", submitted_at AS "submittedAt"
       FROM ip_session_candidates`,
    );
    this.ipResults = await this.queryRows<IpResult>(
      `SELECT id, tenant_id AS "tenantId", campaign_id AS "campaignId",
              candidate_id AS "candidateId", source,
              score_l AS "scoreL", score_r AS "scoreR",
              percentile, imported_at AS "importedAt" FROM ip_results`,
    );
  }

  private async syncToDatabase(): Promise<void> {
    if (!this.client) {
      return;
    }

    // Sync strategy: upsert core identity tables.
    // Full incremental sync for all tables is deferred to a follow-up task.
    // For now, sync only tenants and users as a working proof-of-concept.

    for (const tenant of this.tenants) {
      await this.client.query(
        `INSERT INTO tenants (id, name, code, created_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, code = EXCLUDED.code`,
        [tenant.id, tenant.name, tenant.code, tenant.createdAt],
      );
    }

    for (const user of this.users) {
      await this.client.query(
        `INSERT INTO users (id, email, password_hash, display_name, is_active, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email,
           password_hash = EXCLUDED.password_hash,
           display_name = EXCLUDED.display_name,
           is_active = EXCLUDED.is_active`,
        [user.id, user.email, user.passwordHash, user.displayName, user.isActive ?? true, user.createdAt],
      );
    }

    for (const membership of this.memberships) {
      await this.client.query(
        `INSERT INTO memberships (id, tenant_id, user_id, role)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role`,
        [membership.id, membership.tenantId, membership.userId, membership.role],
      );
    }
  }

  private async queryRows<T>(sql: string): Promise<T[]> {
    if (!this.client) {
      return [];
    }
    const result = await this.client.query(sql);
    return result.rows as T[];
  }
}
