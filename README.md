# toeicPass

A full-stack TOEIC score improvement platform with enterprise TOEIC IP test operations.

Closed-loop learning flow: **assess → plan → practice → review → mock → predict**.

## Architecture

```
toeicPass/
├── apps/
│   ├── api/          NestJS REST API (port 8001)
│   └── web/          Next.js frontend (port 8000)
├── packages/
│   └── shared/       Shared TypeScript types (@toeicpass/shared)
├── db/
│   ├── schema.sql    PostgreSQL schema (v15+)
│   └── migrations/   Incremental migration scripts
└── docs/             Architecture docs & decision records
```

**Monorepo** managed with npm workspaces (`apps/*`, `packages/*`).

### Tech Stack

| Layer | Technology |
|-------|-----------|
| API | NestJS, TypeScript, JWT + RBAC, multi-tenant |
| Web | Next.js, React, CSS Modules |
| DB | PostgreSQL 15+ (PGLite for tests) |
| Queue | Redis + BullMQ (optional; mock in dev) |
| Shared | `@toeicpass/shared` — shared types across API & Web |
| CI/CD | GitHub Actions → Hugging Face Spaces |
| Container | Docker (Node 20, single-image build) |

## Core Domains

### Learning Engine
- Diagnostic tests by TOEIC part (1–7), baseline scoring, weak-point mapping
- Adaptive study plans based on target score and exam date
- Practice sessions with timer, explanations, difficulty labels
- Error notebook with spaced repetition cards
- Full mock exams with score conversion and section-level feedback
- AI-powered error analysis and conversation-based explanations

### Enterprise TOEIC IP Test Operations
- Multi-tenant, RBAC-based (learner, coach, tenant_admin, super_admin)
- Official-mode orchestration: candidate roster, attendance, result import
- Simulation-mode: internal training mocks (not official score)
- Bulk candidate import, seat assignment, test window control, identity verification

### Content System
- Question bank tagged by part, skill, CEFR band, difficulty, source, quality status
- Editorial workflow: draft → review → published → archived
- Versioned explanations with audio/image/text media

### Analytics & Prediction
- Trend tracking by part (accuracy, pace, retention)
- Score prediction from recent mocks and error distribution
- Plateau and schedule deviation alerts

## Quick Start

```bash
# Install dependencies
npm install

# Run database migrations (optional — PGLite used in dev by default)
npm run db:migrate

# Start API (port 8001) and Web (port 8000) together
npm run dev
```

| URL | Description |
|-----|------------|
| `http://localhost:8000` | Web frontend |
| `http://localhost:8001/api/v1` | API base URL |

## Scripts

| Command | Description |
|---------|------------|
| `npm run dev` | Start API + Web in development mode |
| `npm run dev:api` | Start NestJS API only (watch mode) |
| `npm run dev:web:hot` | Start Next.js Web only (hot reload) |
| `npm run build` | Production build (API + Web) |
| `npm test` | Run full test suite |
| `npm run test:e2e` | Run E2E tests (same as `npm test`) |
| `npm run lint` | TypeScript type checking (both apps) |
| `npm run db:migrate` | Run database migrations |

### Running a Single Test File

```bash
npm -w apps/api exec jest test/auth.e2e-spec.ts --runInBand
```

## Testing

- **Unit tests**: scoring policy, question policy, session filters, learning action logic
- **E2E tests**: auth, learning flows, admin operations, enterprise IP flows
- All tests use **PGLite** (in-memory) — no external database required
- Tests verify both happy paths and error cases (RBAC, tenant isolation, validation)

## Data Model

All tables are scoped by `tenant_id` for data isolation.

- **Tenancy**: `tenants`, `users`, `memberships`
- **Learning**: `goals`, `study_plans`, `attempts`, `attempt_items`, `review_cards`
- **Content**: `questions`, `question_options`
- **Enterprise IP**: `ip_campaigns`, `ip_candidates`, `ip_sessions`, `ip_results`
- **Analytics**: `mistake_notes`, `score_predictions`

See [`db/schema.sql`](db/schema.sql) for the full schema.

## Environment Variables

| Variable | Default | Description |
|----------|---------|------------|
| `PORT` | `8001` | API listen port |
| `JWT_SECRET` | `dev-secret` | JWT signing key |
| `WEB_ORIGIN` | `http://localhost:3000` | CORS allowed origin (CSV for multiple) |
| `DATABASE_URL` | — | PostgreSQL connection string (PGLite used if absent) |
| `REDIS_URL` | — | Redis for BullMQ jobs (mock queue if absent) |

## Deployment

### Docker

```bash
docker build -t toeicpass .
docker run -p 7860:7860 toeicpass
```

The container runs NestJS on port 8001 internally and Next.js on port 7860 (exposed).

### Hugging Face Spaces

CI/CD workflow: `.github/workflows/deploy-huggingface.yml`

Required GitHub secrets/variables:
- `HF_TOKEN` — Hugging Face write token
- `HF_REPO_ID` — e.g. `username/toeicpass-space`
- `HF_REPO_TYPE` — `space` | `model` | `dataset` (default: `space`)
- `HF_REPO_BRANCH` — optional (default: `main`)

Each push to `main` triggers automatic sync to the target Hugging Face repo.

## Documentation

- [System Blueprint](docs/system-blueprint.md) — Architecture and product goals
- [API Contract](docs/api-contract-v1.md) — REST API specification
- [Official Question Sources](docs/official-question-sources.md) — Licensed content guidelines
- [Official Question Pack](docs/official-question-pack.md) — Built-in TOEIC-style content

## License

ISC
