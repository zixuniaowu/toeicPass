-- Migration 004: Performance indexes, UserActivityLog, refresh token store

-- ===== Vocabulary: Fast Fuzzy Search & Mastery Filtering =====

-- Full-text search index on vocabulary term + definition
CREATE INDEX IF NOT EXISTS idx_vocab_term_fts
  ON vocabulary_cards
  USING gin (to_tsvector('english', term || ' ' || definition));

-- Japanese vocabulary: trigram index for fast LIKE/ILIKE queries
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_vocab_term_trigram
  ON vocabulary_cards USING gin (term gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_vocab_definition_trigram
  ON vocabulary_cards USING gin (definition gin_trgm_ops);

-- Mastery (due-date, ease-factor, interval) filtering
CREATE INDEX IF NOT EXISTS idx_vocab_mastery
  ON vocabulary_cards (tenant_id, user_id, due_at, ease_factor, interval_days);

-- Score band + CEFR filtering
CREATE INDEX IF NOT EXISTS idx_vocab_band_cefr
  ON vocabulary_cards (tenant_id, user_id, score_band, cefr_level)
  WHERE score_band IS NOT NULL;

-- ===== UserActivityLog =====
-- Granular per-action event log for heatmap analytics and plateau detection.
-- Complements daily_usage (which is aggregated) with raw event records.

CREATE TABLE IF NOT EXISTS user_activity_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  -- ISO 8601 date of the activity (extracted from created_at for fast range queries)
  activity_date date NOT NULL DEFAULT CURRENT_DATE,
  -- Canonical activity type
  activity_type text NOT NULL CHECK (activity_type IN (
    'practice_start',
    'practice_submit',
    'mock_start',
    'mock_submit',
    'vocab_review',
    'grammar_review',
    'shadowing_attempt',
    'diagnostic_start',
    'diagnostic_submit',
    'conversation_turn',
    'login',
    'goal_set'
  )),
  -- Optional reference to the driving entity
  entity_type text,            -- e.g. 'attempt', 'vocabulary_card', 'mock_attempt'
  entity_id   uuid,
  -- Lightweight payload for additional context (part_no, score, etc.)
  meta        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Primary access pattern: all activity for a user in a date range (heatmap)
CREATE INDEX IF NOT EXISTS idx_activity_log_user_date
  ON user_activity_logs (tenant_id, user_id, activity_date DESC);

-- Aggregation by type for analytics dashboards
CREATE INDEX IF NOT EXISTS idx_activity_log_type
  ON user_activity_logs (tenant_id, user_id, activity_type, activity_date DESC);

-- ===== Refresh Tokens (persistent JWT refresh token store) =====

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- SHA-256 hex digest of the opaque random token value
  token_hash   text NOT NULL UNIQUE,
  expires_at   timestamptz NOT NULL,
  revoked      boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user
  ON refresh_tokens (user_id, revoked, expires_at DESC);

-- Periodic cleanup: remove expired/revoked tokens older than 30 days
-- (run as a cron job or maintenance task)
-- DELETE FROM refresh_tokens WHERE revoked = true OR expires_at < now() - interval '30 days';
