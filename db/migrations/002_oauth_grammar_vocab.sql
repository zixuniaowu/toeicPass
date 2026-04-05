-- Migration 002: OAuth support, grammar cards, vocabulary enhancements

-- ===== OAuth Fields on Users =====
ALTER TABLE users ADD COLUMN IF NOT EXISTS oauth_provider text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS oauth_provider_id text;
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_oauth
  ON users (oauth_provider, oauth_provider_id)
  WHERE oauth_provider IS NOT NULL AND oauth_provider_id IS NOT NULL;

-- ===== Vocabulary Cards Table =====
CREATE TABLE IF NOT EXISTS vocabulary_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  term text NOT NULL,
  pos text NOT NULL,
  definition text NOT NULL,
  example text NOT NULL DEFAULT '',
  source_part int NOT NULL CHECK (source_part BETWEEN 1 AND 7),
  tags text[] NOT NULL DEFAULT '{}',
  ease_factor numeric(4,2) NOT NULL DEFAULT 2.30,
  interval_days int NOT NULL DEFAULT 0,
  due_at date NOT NULL,
  last_grade smallint,
  cefr_level text CHECK (cefr_level IN ('A1','A2','B1','B2','C1','C2')),
  difficulty smallint CHECK (difficulty BETWEEN 1 AND 5),
  score_band text CHECK (score_band IN ('300-400','400-500','500-600','600-700','700-800','800-900','900+')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id, term, pos)
);

CREATE INDEX IF NOT EXISTS idx_vocabulary_cards_user
  ON vocabulary_cards (tenant_id, user_id);

-- ===== Grammar Cards Table =====
CREATE TABLE IF NOT EXISTS grammar_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rule_id text NOT NULL,
  title text NOT NULL,
  title_cn text NOT NULL DEFAULT '',
  title_ja text NOT NULL DEFAULT '',
  category text NOT NULL,
  explanation text NOT NULL,
  explanation_cn text NOT NULL DEFAULT '',
  explanation_ja text NOT NULL DEFAULT '',
  examples text[] NOT NULL DEFAULT '{}',
  source_part int NOT NULL DEFAULT 5,
  difficulty smallint NOT NULL DEFAULT 3 CHECK (difficulty BETWEEN 1 AND 5),
  cefr_level text CHECK (cefr_level IN ('A1','A2','B1','B2','C1','C2')),
  ease_factor numeric(4,2) NOT NULL DEFAULT 2.30,
  interval_days int NOT NULL DEFAULT 0,
  due_at date NOT NULL,
  last_grade smallint,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id, rule_id)
);

CREATE INDEX IF NOT EXISTS idx_grammar_cards_user
  ON grammar_cards (tenant_id, user_id);
