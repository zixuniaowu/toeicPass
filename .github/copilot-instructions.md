# Copilot Instructions for toeicPass

This document provides essential context for AI assistants working in this monorepo.

## Build, Test, and Development Commands

### Development
- `npm run dev` – Start both API (port 8001) and web (port 8000) in development mode with hot reload
- `npm run dev:api` – Start only the NestJS API in watch mode
- `npm run dev:web:hot` – Start only the Next.js web app with hot reload

### Production Build
- `npm run build` – Compile both API (TypeScript → `dist/`) and web (Next.js production build)

### Testing
- `npm test` – Run full API test suite (E2E tests using Jest with PGLite in-memory DB)
- `npm run test:e2e` – Same as above (explicitly run E2E suite)
- Individual test files: `npm -w apps/api exec jest test/FILE.e2e-spec.ts --runInBand`

### Linting and Type Checking
- `npm run lint` – Type check both apps (runs `tsc --noEmit`)

### Database and Scripts
- `npm run db:migrate` – Run database migrations (uses `tsx` to load from `apps/api/scripts/migrate.ts`)
- `npm run audit:questions` – Run question quality audit script (in API workspace)

## High-Level Architecture

### Monorepo Structure
- **apps/api** – NestJS backend serving API at `/api/v1`
- **apps/web** – Next.js frontend (learner + admin portals)
- **packages/shared** – Shared types/utilities (currently minimal)
- **db/** – PostgreSQL schema initialization (`schema.sql`)
- **docs/** – Architecture and decision docs (system-blueprint.md, api-contract-v1.md, etc.)

### Core Product Domains

**Learning Engine**
- Diagnostic tests by TOEIC parts, baseline scoring, weak-point mapping
- Adaptive study plans based on target score and exam date
- Practice sessions with timer, explanations, difficulty labels
- Error notebook with spaced repetition cards
- Full mock exams with score conversion and section feedback

**Enterprise TOEIC IP Test Operations**
- Multi-tenant, RBAC-based (learner, coach, tenant_admin, super_admin roles)
- Compliance-aware: official-mode orchestration (candidate roster, attendance, result import) vs. simulation-mode (internal training mocks)
- Bulk candidate import, seat assignment, test window control, access tokens, identity verification

**Content System**
- Question bank with tags: part (1–7), skill, CEFR band, difficulty, source, quality status
- Versioned explanations, audio/image/text media
- Editorial workflow: draft → review → published → archived

**Analytics and Prediction**
- Trend tracking by part (accuracy, pace, retention)
- Score prediction using recent mocks and error distribution
- Plateau/schedule deviation alerts

### API Structure (NestJS)
- **Controllers** – HTTP entry points: `auth`, `learning`, `admin`, `enterprise`
- **Services** (domain-driven):
  - `AuthDomainService` – Registration, JWT, user context
  - `LearningDomainService` – Practice sessions, diagnostics, study plans
  - `AdminQuestionService` – Question publishing, tagging, versioning
  - `EnterpriseIpService` – Campaign creation, candidate import, result import
  - `LearningConversationService` – AI-powered error analysis and explanations
  - `QueueService` – Job scheduling via Redis + BullMQ (async scoring, report generation)
  - `StoreService` – Data layer abstraction (queries, transaction handling)

- **Guards and Interceptors**:
  - `JwtStrategy` + `TenantGuard` – Multi-tenant context extraction and validation
  - `RolesGuard` – RBAC enforcement (checks `memberships.role` against endpoint requirements)
  - `AuditInterceptor` – Logs all write operations for compliance (tenant, actor, action, payload hash)

- **Key Files**:
  - `auth.ts` – JWT and tenant guard logic
  - `types.ts` – Shared TypeScript interfaces (RequestContext, LearningAction, etc.)
  - `question-policy.ts` – Question eligibility and filtering rules
  - `session-filters.ts` – Practice/mock session initialization (adaptive difficulty, part selection)

### Web Frontend (Next.js)
- File-based routing in `apps/web/app/`
- UI components in `apps/web/components/`
- Shared hooks in `apps/web/hooks/`
- API client functions in `apps/web/lib/` (fetch wrapper with error handling)
- TypeScript types in `apps/web/types/`
- Static styles in `apps/web/styles/`

### Data Model (PostgreSQL)
- **Tenancy**: `tenants`, `users`, `memberships` (role-based: learner, coach, tenant_admin, super_admin)
- **Learning**: `goals`, `study_plans`, `practice_sessions`, `question_attempts`, `mock_attempts`
- **Content**: `questions`, `question_versions`, `question_explanations`, `question_tags`
- **Enterprise IP**: `ip_campaigns`, `ip_candidates`, `ip_sessions`, `ip_results`
- **Analytics**: `audit_logs` (all writes), `error_notebook`, `spaced_repetition_cards`
- All tables scoped by `tenant_id` for data isolation

## Key Conventions

### Code Style
- **Indentation**: 2 spaces (JS/TS/JSON/YAML)
- **Naming**: `camelCase` for vars/functions, `PascalCase` for classes/components, `kebab-case` for files
- **File naming**: `feature-name.service.ts`, `feature.controller.ts`, `feature.guard.ts`
- **Single-purpose functions** – Avoid side effects; compose via services
- **Lint before commit** – Run `npm run lint` to catch TypeScript errors

### NestJS Conventions
- **Modules** group controllers + services by domain (minimal use; currently single AppModule)
- **DTOs** use class-validator for input validation (whitelist unknown properties)
- **Global ValidationPipe** configured in `main.ts` with `whitelist: true`
- **JWT expiration**: 7 days (configurable via `JWT_SECRET` env var)
- **Idempotency**: Critical endpoints (session submit, result import) must support idempotency keys

### Request Context
- Extracted by `TenantGuard` middleware: `req.context` contains `tenantId`, `userId`, `role`
- All domain service methods expect `context: RequestContext` as first parameter
- Database queries auto-filtered by `tenant_id` (enforced in `StoreService`)

### Error Handling
- Use NestJS `HttpException` for client errors (4xx)
- Use `BadRequestException`, `ForbiddenException`, `NotFoundException` for clarity
- Audit errors with action and reason in `AuditInterceptor`
- E2E tests verify both success and error paths

### Database Migrations
- Use `tsx` to run `.ts` migration scripts (see `scripts/migrate.ts`)
- Always validate schema against expected constraints in tests
- Support PostgreSQL 15+ and PGLite (in-memory SQLite-compatible for testing)

### Testing Guidelines
- E2E tests in `test/` use `supertest` against NestJS test module
- Use PGLite (in-memory) for fast test isolation; no external DB needed
- Test both happy path and error cases (RBAC, tenant isolation, validation)
- File pattern: `feature.e2e-spec.ts`
- Run isolated: `npm -w apps/api exec jest test/auth.e2e-spec.ts --runInBand`

### Environment Variables (apps/api)
- `PORT` – API listen port (default: 8001)
- `JWT_SECRET` – Signing key for JWT tokens (dev default: "dev-secret")
- `WEB_ORIGIN` – CORS allowed origin (dev default: http://localhost:3000; CSV for multiple)
- `DATABASE_URL` – PostgreSQL connection string (optional; uses PGLite in dev)
- `REDIS_URL` – Redis connection for BullMQ jobs (optional; mock queue in dev)

### Commit Conventions
- Use **Conventional Commits**: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`
- Keep commits focused; avoid mixing refactors with behavior changes
- Link relevant issues/tasks
- PRs should explain *what*, *why*, and *how to test*

### Deployment
- CI/CD via `.github/workflows/deploy-huggingface.yml`
- Syncs `main` branch to Hugging Face Spaces (requires `HF_TOKEN`, `HF_REPO_ID` secrets)
- Configure in GitHub repo settings: `HF_REPO_TYPE` (space|model|dataset), `HF_REPO_BRANCH`

## MCP Servers

### Playwright (Browser Testing)
Playwright is already installed in the repo (`devDependencies` in root `package.json`). Configure it for end-to-end web testing:

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["mcp-playwright"],
      "description": "Browser automation for E2E testing against web (http://localhost:8000) and API (http://localhost:8001)"
    }
  }
}
```

**Use case**: Automate login flows, practice session interactions, quiz submissions, and learner dashboard workflows against the live Next.js frontend.

## Skills (`.github/skills/`)

Project-specific Copilot skills that provide domain context:

| Skill | Trigger |
|-------|---------|
| `nestjs-api-development` | Creating API endpoints, controllers, services, guards, DTOs |
| `nextjs-app-router` | Pages, layouts, client components, hydration, API proxy |
| `docker-deployment` | Dockerfile changes, CI/CD, HF Spaces deployment issues |
| `javascript-typescript-jest` | Writing or fixing Jest/Vitest tests |
| `webapp-testing` | Playwright browser E2E tests |
| `playwright-generate-test` | Auto-generating Playwright tests from scenarios |

## Additional Resources
- Architecture: `docs/system-blueprint.md`
- API contract: `docs/api-contract-v1.md`
- Question sourcing: `docs/official-question-sources.md`
- Repository bootstrap guidelines: `AGENTS.md`
