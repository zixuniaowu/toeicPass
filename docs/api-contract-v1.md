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

## Eventing and Audit
- Every write endpoint emits an audit event with actor, tenant, action, and payload hash.
- Use idempotency key header for session submit and result import endpoints.
