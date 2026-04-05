-- Migration 003: Subscription tiers, usage tracking, and ad system

-- ===== Subscription Plans (static catalog) =====
CREATE TABLE IF NOT EXISTS subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,            -- 'free', 'basic', 'premium', 'enterprise'
  name_en text NOT NULL,
  name_zh text NOT NULL,
  name_ja text NOT NULL,
  price_monthly int NOT NULL DEFAULT 0, -- cents (USD)
  price_yearly int NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  features jsonb NOT NULL DEFAULT '{}', -- feature flags & limits
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ===== User Subscriptions =====
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES subscription_plans(id),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'cancelled', 'expired', 'past_due')),
  billing_cycle text NOT NULL DEFAULT 'monthly'
    CHECK (billing_cycle IN ('monthly', 'yearly', 'lifetime')),
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  cancelled_at timestamptz,
  payment_provider text,       -- 'stripe', 'wechat_pay', 'alipay', null (free)
  payment_provider_id text,    -- external subscription ID
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user
  ON user_subscriptions (user_id, status);

-- ===== Daily Usage Tracking =====
CREATE TABLE IF NOT EXISTS daily_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  usage_date date NOT NULL DEFAULT CURRENT_DATE,
  practice_sessions int NOT NULL DEFAULT 0,
  mock_tests int NOT NULL DEFAULT 0,
  questions_answered int NOT NULL DEFAULT 0,
  vocab_reviews int NOT NULL DEFAULT 0,
  ai_conversations int NOT NULL DEFAULT 0,
  UNIQUE (tenant_id, user_id, usage_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_usage_user_date
  ON daily_usage (user_id, usage_date DESC);

-- ===== Ad Placements =====
CREATE TABLE IF NOT EXISTS ad_placements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot text NOT NULL,                   -- 'banner_top', 'interstitial', 'native_feed', 'reward_video'
  title text NOT NULL,
  image_url text,
  link_url text NOT NULL,
  cta_text text NOT NULL DEFAULT 'Learn More',
  priority int NOT NULL DEFAULT 0,
  target_plans text[] NOT NULL DEFAULT '{free}',  -- which plan tiers see this ad
  is_active boolean NOT NULL DEFAULT true,
  impressions int NOT NULL DEFAULT 0,
  clicks int NOT NULL DEFAULT 0,
  starts_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ad_placements_slot
  ON ad_placements (slot, is_active, priority DESC);

-- ===== Ad Events (analytics) =====
CREATE TABLE IF NOT EXISTS ad_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  placement_id uuid NOT NULL REFERENCES ad_placements(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN ('impression', 'click', 'dismiss', 'reward_complete')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ad_events_placement
  ON ad_events (placement_id, created_at DESC);

-- ===== Seed default subscription plans =====
INSERT INTO subscription_plans (code, name_en, name_zh, name_ja, price_monthly, price_yearly, currency, features, sort_order)
VALUES
  ('free', 'Free', '免费版', '無料プラン', 0, 0, 'USD',
   '{"daily_practice_sessions": 50, "daily_mock_tests": 10, "daily_questions": 500, "vocab_cards": 100, "ai_conversations": 3, "show_ads": true, "explanation_detail": "basic", "score_prediction": false, "export_data": false}'::jsonb,
   0),
  ('basic', 'Basic', '基础版', 'ベーシック', 999, 9990, 'USD',
   '{"daily_practice_sessions": 10, "daily_mock_tests": 1, "daily_questions": 200, "vocab_cards": 5000, "ai_conversations": 5, "show_ads": false, "explanation_detail": "full", "score_prediction": true, "export_data": false}'::jsonb,
   1),
  ('premium', 'Premium', '高级版', 'プレミアム', 1999, 19990, 'USD',
   '{"daily_practice_sessions": -1, "daily_mock_tests": -1, "daily_questions": -1, "vocab_cards": -1, "ai_conversations": -1, "show_ads": false, "explanation_detail": "full", "score_prediction": true, "export_data": true}'::jsonb,
   2),
  ('enterprise', 'Enterprise', '企业版', 'エンタープライズ', 0, 0, 'USD',
   '{"daily_practice_sessions": -1, "daily_mock_tests": -1, "daily_questions": -1, "vocab_cards": -1, "ai_conversations": -1, "show_ads": false, "explanation_detail": "full", "score_prediction": true, "export_data": true}'::jsonb,
   3)
ON CONFLICT (code) DO NOTHING;
