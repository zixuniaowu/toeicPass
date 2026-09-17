# API Contract v1 (Draft)

## Auth
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`

## Learner Profile and Goal
- `GET /api/v1/me`
- `PUT /api/v1/me`
- `POST /api/v1/goals` (target score, exam date)
- `GET /api/v1/goals/current`

## Diagnostic and Practice
- `POST /api/v1/diagnostics/start`
- `POST /api/v1/diagnostics/{attemptId}/submit`
- `GET /api/v1/practice/recommendations`
- `POST /api/v1/practice/sessions`
- `POST /api/v1/practice/sessions/{sessionId}/answers`
- `POST /api/v1/practice/sessions/{sessionId}/complete`

## Mistakes and Review
- `GET /api/v1/mistakes`
- `POST /api/v1/mistakes/{itemId}/notes`
- `GET /api/v1/review/cards/due`
- `POST /api/v1/review/cards/{cardId}/grade`

## Mock Tests and Prediction
- `POST /api/v1/mock-tests/start`
- `POST /api/v1/mock-tests/{attemptId}/submit`
- `GET /api/v1/mock-tests/history`
- `GET /api/v1/predictions/latest`

## Enterprise TOEIC IP (Tenant Admin)
- `POST /api/v1/ip/campaigns`
- `GET /api/v1/ip/campaigns`
- `POST /api/v1/ip/campaigns/{campaignId}/candidates/import`
- `GET /api/v1/ip/campaigns/{campaignId}/candidates`
- `POST /api/v1/ip/campaigns/{campaignId}/sessions`
- `POST /api/v1/ip/sessions/{sessionId}/check-in`
- `POST /api/v1/ip/sessions/{sessionId}/submit`
- `POST /api/v1/ip/campaigns/{campaignId}/results/import`
- `GET /api/v1/ip/campaigns/{campaignId}/reports`

## Content Management (Admin)
- `POST /api/v1/admin/questions`
- `PUT /api/v1/admin/questions/{questionId}`
- `POST /api/v1/admin/questions/{questionId}/publish`
- `GET /api/v1/admin/questions?part=...&difficulty=...`

## Shadowing Content Distribution (Public)
Server-driven article updates for the mobile shadowing apps: content is
fetched at runtime so article changes do not require an app release.
- `GET /api/v1/content/shadowing?language=en|ja[&since=<ISO timestamp>]`
  - No auth. Returns `{ serverTime, language, materials: [...] }`.
  - `since` enables incremental sync: only materials with `updatedAt` after
    the timestamp are returned. Pass back the previous `serverTime`.
  - Material shape: `{ id, language, title, translations, source, category,
    difficulty, youtubeVideoId?, sentences: [{ id, text, translations,
    startSec?, endSec? }], published, createdAt, updatedAt }`.
- Admin management (tenant_admin / super_admin, global content):
  - `GET /api/v1/admin/shadowing-materials[?language=...]`
  - `POST /api/v1/admin/shadowing-materials` (id required, kebab-case)
  - `PUT /api/v1/admin/shadowing-materials/{materialId}`
  - `POST /api/v1/admin/shadowing-materials/{materialId}/publish`
  - `POST /api/v1/admin/shadowing-materials/{materialId}/unpublish`
  - `DELETE /api/v1/admin/shadowing-materials/{materialId}`
- New materials are created unpublished; publish to make them visible to
  clients. Updates and unpublish/delete are picked up by clients on their
  next sync (mobile syncs on app start with AsyncStorage cache fallback).

## Eventing and Audit
- Every write endpoint emits an audit event with actor, tenant, action, and payload hash.
- Use idempotency key header for session submit and result import endpoints.
