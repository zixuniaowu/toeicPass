# Implementation Roadmap

## Phase 0 (Week 1): Foundation
- Set up monorepo folders: `apps/web`, `apps/api`, `db`, `docs`.
- Implement auth, tenant model, RBAC guards, audit middleware.
- Deliverables: login/register, tenant bootstrap script, initial DB migration.

## Phase 1 (Week 2-4): Personal Score Improvement MVP
- Diagnostic test flow + baseline scoring.
- Daily plan generation from target score/date.
- Practice session, answer submission, explanation view.
- Mistake notes + spaced-repetition due list.
- Mock test and score prediction endpoint.
- Acceptance: one learner can complete a full weekly cycle end-to-end.

## Phase 2 (Week 5-7): Content and Quality
- Admin question management (draft/review/publish).
- Media support for listening items.
- Analytics dashboard (accuracy, speed, part-level weakness).
- Acceptance: admin can ship new question sets without code changes.

## Phase 3 (Week 8-10): Enterprise TOEIC IP Module
- Campaign creation, candidate import, session scheduling.
- Check-in flow, proctor view, attendance tracking.
- Results pipeline for official import + simulation scoring.
- Org-level report export (CSV/PDF).
- Acceptance: one enterprise tenant runs one full campaign lifecycle.

## Phase 4 (Week 11-12): Hardening and Launch
- Observability dashboards, error budget alerts.
- Data backup/restore test and runbook.
- Security checks: rate limiting, tenant isolation tests, audit review.
- Acceptance: launch checklist signed off for pilot customers.

## KPI Targets
- Learner side: 4-week average predicted score increase >= 45.
- Engagement: weekly active learners / total learners >= 60%.
- Enterprise side: campaign completion rate >= 95%.
- System quality: P95 API latency < 300 ms on core read APIs.
