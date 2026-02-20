-- PostgreSQL v15+

create extension if not exists "pgcrypto";

-- ===== Tenancy and Identity =====
create table tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  created_at timestamptz not null default now()
);

create table users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  display_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role text not null check (role in ('learner','coach','tenant_admin','super_admin')),
  unique (tenant_id, user_id)
);

-- ===== Learning Goal and Plan =====
create table goals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  target_score int not null check (target_score between 10 and 990),
  target_exam_date date not null,
  baseline_score int check (baseline_score between 10 and 990),
  created_at timestamptz not null default now()
);

create table study_plans (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  plan_date date not null,
  task_type text not null check (task_type in ('vocab','listening','reading','review','mock')),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'todo' check (status in ('todo','done','skipped')),
  unique (tenant_id, user_id, plan_date, task_type)
);

-- ===== Content =====
create table questions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  part_no int not null check (part_no between 1 and 7),
  skill_tag text not null,
  difficulty smallint not null check (difficulty between 1 and 5),
  stem text not null,
  explanation text,
  media_url text,
  status text not null default 'draft' check (status in ('draft','review','published','archived')),
  created_by uuid references users(id),
  created_at timestamptz not null default now()
);

create table question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references questions(id) on delete cascade,
  option_key text not null check (option_key in ('A','B','C','D')),
  option_text text not null,
  is_correct boolean not null default false,
  unique (question_id, option_key)
);

-- ===== Practice and Mock =====
create table attempts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  mode text not null check (mode in ('diagnostic','practice','mock','ip_simulation')),
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  score_l int check (score_l between 5 and 495),
  score_r int check (score_r between 5 and 495),
  score_total int generated always as (coalesce(score_l,0) + coalesce(score_r,0)) stored
);

create table attempt_items (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references attempts(id) on delete cascade,
  question_id uuid not null references questions(id),
  selected_key text check (selected_key in ('A','B','C','D')),
  is_correct boolean,
  duration_ms int,
  created_at timestamptz not null default now()
);

create index idx_attempt_items_attempt_id on attempt_items(attempt_id);

create table mistake_notes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  attempt_item_id uuid not null references attempt_items(id) on delete cascade,
  root_cause text,
  note text,
  created_at timestamptz not null default now()
);

create table review_cards (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  question_id uuid not null references questions(id),
  ease_factor numeric(4,2) not null default 2.50,
  interval_days int not null default 1,
  due_at date not null,
  last_grade smallint,
  unique (tenant_id, user_id, question_id)
);

create table score_predictions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  predicted_total int not null check (predicted_total between 10 and 990),
  confidence numeric(5,4) not null check (confidence between 0 and 1),
  factors jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ===== Enterprise TOEIC IP =====
create table org_units (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  parent_id uuid references org_units(id) on delete set null
);

create table ip_campaigns (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  mode text not null check (mode in ('official','simulation')),
  planned_date date not null,
  status text not null default 'draft' check (status in ('draft','published','closed')),
  created_by uuid references users(id),
  created_at timestamptz not null default now()
);

create table ip_candidates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  campaign_id uuid not null references ip_campaigns(id) on delete cascade,
  employee_no text,
  full_name text not null,
  email text,
  org_unit_id uuid references org_units(id),
  unique (campaign_id, employee_no)
);

create table ip_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  campaign_id uuid not null references ip_campaigns(id) on delete cascade,
  session_code text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  seat_capacity int not null,
  proctor_user_id uuid references users(id),
  unique (campaign_id, session_code)
);

create table ip_session_candidates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  session_id uuid not null references ip_sessions(id) on delete cascade,
  candidate_id uuid not null references ip_candidates(id) on delete cascade,
  status text not null default 'invited'
    check (status in ('invited','checked_in','in_progress','submitted','absent')),
  checked_in_at timestamptz,
  submitted_at timestamptz,
  unique (session_id, candidate_id)
);

create table ip_results (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  campaign_id uuid not null references ip_campaigns(id) on delete cascade,
  candidate_id uuid not null references ip_candidates(id) on delete cascade,
  source text not null check (source in ('official_import','simulation_scored')),
  score_l int check (score_l between 5 and 495),
  score_r int check (score_r between 5 and 495),
  score_total int generated always as (coalesce(score_l,0) + coalesce(score_r,0)) stored,
  percentile numeric(5,2),
  imported_at timestamptz not null default now(),
  unique (campaign_id, candidate_id)
);

-- ===== Audit =====
create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade,
  actor_user_id uuid references users(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_audit_logs_tenant_created_at on audit_logs(tenant_id, created_at desc);
