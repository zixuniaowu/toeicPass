import { resolve } from "node:path";
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PGlite } from "@electric-sql/pglite";
import { Client } from "pg";
import { StoreService } from "./store.service";
import {
  AdEvent,
  AdPlacement,
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
  ShadowingMaterialRecord,
  Tenant,
  User,
  VocabularyCard,
} from "./types";

@Injectable()
export class PgStoreService extends StoreService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PgStoreService.name);
  private client: Client | PGlite | null = null;

  constructor() {
    super();
  }

  async onModuleInit(): Promise<void> {
    const databaseUrl = process.env.DATABASE_URL;

    if (databaseUrl) {
      const client = new Client({ connectionString: databaseUrl });
      await client.connect();
      this.client = client;
      this.logger.log("Connected to PostgreSQL");
    } else {
      const dataDir = process.env.PGLITE_DATA_DIR ?? resolve(process.cwd(), ".local-pg");
      const client = new PGlite(dataDir);
      await client.waitReady;
      this.client = client;
      this.logger.log(`Connected to PGlite at ${dataDir}`);
    }

    await this.ensureAdTables();
    await this.ensureShadowingTables();
    await this.loadFromDatabase();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      if (this.client instanceof Client) {
        await this.client.end();
      } else {
        await this.client.close();
      }
      this.client = null;
    }
  }

  async persistSnapshot(): Promise<void> {
    super.persistSnapshot();

    if (this.client) {
      try {
        await this.syncToDatabase();
      } catch (error) {
        this.logger.error("Failed to sync snapshot to PostgreSQL", error as Error);
        throw error;
      }
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
      await this.loadAdTablesFromDatabase();
      await this.loadShadowingMaterialsFromDatabase();

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

  private async loadAdTablesFromDatabase(): Promise<void> {
    if (!this.client) {
      return;
    }

    try {
      const adPlacements = await this.queryRows<AdPlacement>(
        `SELECT id, slot, title, image_url AS "imageUrl", link_url AS "linkUrl",
                cta_text AS "ctaText", priority, target_plans AS "targetPlans",
                is_active AS "isActive", impressions, clicks,
                starts_at AS "startsAt", expires_at AS "expiresAt",
                created_at AS "createdAt"
         FROM ad_placements`,
      );
      const adEvents = await this.queryRows<AdEvent>(
        `SELECT id, placement_id AS "placementId", user_id AS "userId",
                event_type AS "eventType", created_at AS "createdAt"
         FROM ad_events
         ORDER BY created_at ASC`,
      );

      if (adPlacements.length > 0) {
        this.adPlacements = adPlacements.map((placement) => ({
          ...placement,
          targetPlans: Array.isArray(placement.targetPlans) ? placement.targetPlans : [],
        }));
      }

      this.adEvents = adEvents;
    } catch (error) {
      this.logger.warn("Ad tables unavailable in PostgreSQL; keeping in-memory ad store", error as Error);
    }
  }

  private async ensureAdTables(): Promise<void> {
    if (!this.client) {
      return;
    }

    const statements = [
      `CREATE TABLE IF NOT EXISTS ad_placements (
         id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
         slot text NOT NULL,
         title text NOT NULL,
         image_url text,
         link_url text NOT NULL,
         cta_text text NOT NULL DEFAULT 'Learn More',
         priority int NOT NULL DEFAULT 0,
         target_plans text[] NOT NULL DEFAULT '{free}',
         is_active boolean NOT NULL DEFAULT true,
         impressions int NOT NULL DEFAULT 0,
         clicks int NOT NULL DEFAULT 0,
         starts_at timestamptz,
         expires_at timestamptz,
         created_at timestamptz NOT NULL DEFAULT now()
       )`,
      `CREATE INDEX IF NOT EXISTS idx_ad_placements_slot
         ON ad_placements (slot, is_active, priority DESC)`,
      `CREATE TABLE IF NOT EXISTS ad_events (
         id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
         placement_id uuid NOT NULL REFERENCES ad_placements(id) ON DELETE CASCADE,
         user_id uuid REFERENCES users(id) ON DELETE SET NULL,
         event_type text NOT NULL CHECK (event_type IN ('impression', 'click', 'dismiss', 'reward_complete')),
         created_at timestamptz NOT NULL DEFAULT now()
       )`,
      `CREATE INDEX IF NOT EXISTS idx_ad_events_placement
         ON ad_events (placement_id, created_at DESC)`,
    ];

    for (const statement of statements) {
      await this.executeQuery(statement);
    }
  }

  private async syncToDatabase(): Promise<void> {
    if (!this.client) {
      return;
    }

    // Sync strategy: upsert core identity tables.
    // Full incremental sync for all tables is deferred to a follow-up task.
    // For now, sync only tenants and users as a working proof-of-concept.

    for (const tenant of this.tenants) {
      await this.executeQuery(
        `INSERT INTO tenants (id, name, code, created_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, code = EXCLUDED.code`,
        [tenant.id, tenant.name, tenant.code, tenant.createdAt],
      );
    }

    for (const user of this.users) {
      await this.executeQuery(
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
      await this.executeQuery(
        `INSERT INTO memberships (id, tenant_id, user_id, role)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role`,
        [membership.id, membership.tenantId, membership.userId, membership.role],
      );
    }

    await this.syncAdTablesToDatabase();
    await this.syncShadowingTablesToDatabase();
  }

  private async syncAdTablesToDatabase(): Promise<void> {
    if (!this.client) {
      return;
    }

    await this.executeQuery("BEGIN");

    try {
      for (const placement of this.adPlacements) {
        await this.executeQuery(
          `INSERT INTO ad_placements (
             id, slot, title, image_url, link_url, cta_text, priority,
             target_plans, is_active, impressions, clicks, starts_at, expires_at, created_at
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8::text[], $9, $10, $11, $12, $13, $14)
           ON CONFLICT (id) DO UPDATE SET
             slot = EXCLUDED.slot,
             title = EXCLUDED.title,
             image_url = EXCLUDED.image_url,
             link_url = EXCLUDED.link_url,
             cta_text = EXCLUDED.cta_text,
             priority = EXCLUDED.priority,
             target_plans = EXCLUDED.target_plans,
             is_active = EXCLUDED.is_active,
             impressions = EXCLUDED.impressions,
             clicks = EXCLUDED.clicks,
             starts_at = EXCLUDED.starts_at,
             expires_at = EXCLUDED.expires_at`,
          [
            placement.id,
            placement.slot,
            placement.title,
            placement.imageUrl ?? null,
            placement.linkUrl,
            placement.ctaText,
            placement.priority,
            placement.targetPlans,
            placement.isActive,
            placement.impressions,
            placement.clicks,
            placement.startsAt ?? null,
            placement.expiresAt ?? null,
            placement.createdAt,
          ],
        );
      }

      if (this.adPlacements.length > 0) {
        await this.executeQuery("DELETE FROM ad_placements WHERE id <> ALL($1::uuid[])", [
          this.adPlacements.map((placement) => placement.id),
        ]);
      } else {
        await this.executeQuery("DELETE FROM ad_placements");
      }

      for (const event of this.adEvents) {
        await this.executeQuery(
          `INSERT INTO ad_events (id, placement_id, user_id, event_type, created_at)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (id) DO UPDATE SET
             placement_id = EXCLUDED.placement_id,
             user_id = EXCLUDED.user_id,
             event_type = EXCLUDED.event_type,
             created_at = EXCLUDED.created_at`,
          [event.id, event.placementId, event.userId ?? null, event.eventType, event.createdAt],
        );
      }

      if (this.adEvents.length > 0) {
        await this.executeQuery("DELETE FROM ad_events WHERE id <> ALL($1::uuid[])", [
          this.adEvents.map((event) => event.id),
        ]);
      } else {
        await this.executeQuery("DELETE FROM ad_events");
      }

      await this.executeQuery("COMMIT");
    } catch (error) {
      await this.executeQuery("ROLLBACK");
      throw error;
    }
  }

  private async ensureShadowingTables(): Promise<void> {
    if (!this.client) {
      return;
    }

    const statements = [
      `CREATE TABLE IF NOT EXISTS shadowing_materials (
         id text PRIMARY KEY,
         language text NOT NULL CHECK (language IN ('en', 'ja')),
         title text NOT NULL,
         translations jsonb NOT NULL DEFAULT '{}'::jsonb,
         source text NOT NULL DEFAULT '',
         category text NOT NULL DEFAULT 'speech',
         difficulty smallint NOT NULL DEFAULT 2,
         youtube_video_id text,
         sentences jsonb NOT NULL DEFAULT '[]'::jsonb,
         published boolean NOT NULL DEFAULT true,
         created_at timestamptz NOT NULL DEFAULT now(),
         updated_at timestamptz NOT NULL DEFAULT now()
       )`,
      `CREATE INDEX IF NOT EXISTS idx_shadowing_materials_language
         ON shadowing_materials (language, published)`,
    ];

    for (const statement of statements) {
      await this.executeQuery(statement);
    }
  }

  /**
   * Shadowing materials are global content (not tenant-scoped). DB rows only
   * override the in-memory seed when the table is non-empty, so a fresh
   * database keeps serving the bundled seed content.
   */
  private async loadShadowingMaterialsFromDatabase(): Promise<void> {
    if (!this.client) {
      return;
    }

    try {
      const rows = await this.queryRows<ShadowingMaterialRecord & {
        createdAt: Date | string;
        updatedAt: Date | string;
      }>(
        `SELECT id, language, title, translations, source, category, difficulty,
                youtube_video_id AS "youtubeVideoId", sentences, published,
                created_at AS "createdAt", updated_at AS "updatedAt"
         FROM shadowing_materials`,
      );

      if (rows.length > 0) {
        this.shadowingMaterials = rows.map((row) => ({
          ...row,
          createdAt: new Date(row.createdAt).toISOString(),
          updatedAt: new Date(row.updatedAt).toISOString(),
        }));
      }
    } catch (error) {
      this.logger.warn("Shadowing materials table unavailable; keeping in-memory content", error as Error);
    }
  }

  private async syncShadowingTablesToDatabase(): Promise<void> {
    if (!this.client) {
      return;
    }

    await this.executeQuery("BEGIN");

    try {
      for (const material of this.shadowingMaterials) {
        await this.executeQuery(
          `INSERT INTO shadowing_materials (
             id, language, title, translations, source, category, difficulty,
             youtube_video_id, sentences, published, created_at, updated_at
           )
           VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9::jsonb, $10, $11, $12)
           ON CONFLICT (id) DO UPDATE SET
             language = EXCLUDED.language,
             title = EXCLUDED.title,
             translations = EXCLUDED.translations,
             source = EXCLUDED.source,
             category = EXCLUDED.category,
             difficulty = EXCLUDED.difficulty,
             youtube_video_id = EXCLUDED.youtube_video_id,
             sentences = EXCLUDED.sentences,
             published = EXCLUDED.published,
             updated_at = EXCLUDED.updated_at`,
          [
            material.id,
            material.language,
            material.title,
            JSON.stringify(material.translations ?? {}),
            material.source,
            material.category,
            material.difficulty,
            material.youtubeVideoId ?? null,
            JSON.stringify(material.sentences ?? []),
            material.published,
            material.createdAt,
            material.updatedAt,
          ],
        );
      }

      if (this.shadowingMaterials.length > 0) {
        await this.executeQuery("DELETE FROM shadowing_materials WHERE id <> ALL($1::text[])", [
          this.shadowingMaterials.map((material) => material.id),
        ]);
      } else {
        await this.executeQuery("DELETE FROM shadowing_materials");
      }

      await this.executeQuery("COMMIT");
    } catch (error) {
      await this.executeQuery("ROLLBACK");
      throw error;
    }
  }

  private async queryRows<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    if (!this.client) {
      return [];
    }
    const result = await this.executeQuery<T>(sql, params);
    return result.rows as T[];
  }

  private async executeQuery<T>(sql: string, params: unknown[] = []): Promise<{ rows: T[] }> {
    if (!this.client) {
      return { rows: [] };
    }

    if (this.client instanceof Client) {
      return this.client.query(sql, params) as unknown as Promise<{ rows: T[] }>;
    }

    return this.client.query<T>(sql, params) as Promise<{ rows: T[] }>;
  }
}
