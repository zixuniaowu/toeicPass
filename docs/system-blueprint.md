# TOEIC Score Platform Blueprint

## 1) Product Goal
- Help learners improve TOEIC Listening + Reading scores with a closed loop: assess -> plan -> practice -> review -> mock -> predict.
- Start with single-user usage, then scale to a multi-tenant product for schools and enterprises.
- Include an enterprise-grade TOEIC IP Test workflow for group testing operations.

## 2) User Roles
- Learner: takes diagnostics, daily practice, mock tests, and reviews mistakes.
- Coach/Admin: manages content, learning plans, and performance dashboards.
- Enterprise HR/L&D Admin: creates TOEIC IP campaigns, imports candidates, tracks attendance and score outcomes.
- Super Admin: tenant setup, billing, compliance, and global reporting.

## 3) Core Functional Domains
### Learning Engine
- Diagnostic test by TOEIC parts (Part 1-7), baseline score estimate, weak-point map.
- Adaptive study plan based on target score and exam date.
- Practice sessions with timer, explanations, and difficulty labels.
- Error notebook + spaced repetition cards.
- Full mock exams with score conversion and section-level feedback.

### Content System
- Question bank with tags: part, skill, CEFR band, difficulty, source, and quality status.
- Versioned explanations and media (audio/image/text).
- Editorial workflow: draft -> review -> published -> archived.

### Analytics and Prediction
- Trend views for accuracy, pace, and retention by part.
- Score prediction model using recent mocks, response speed, and error distribution.
- Alerts for plateaus and schedule deviation.

## 4) Enterprise TOEIC IP Test Domain
### Important Compliance Boundary
- TOEIC IP official score issuance must follow authorized provider policy.
- Platform should support both:
  - Official-mode orchestration: campaign scheduling, candidate roster, attendance, result import.
  - Simulation-mode: TOEIC-IP-format internal mock for training only (not official score).

### Enterprise Features
- Organization and department hierarchy.
- Bulk candidate import (CSV), seat assignment, test window control.
- Access tokens, identity verification steps, and proctor checklist.
- Session status tracking: invited, checked-in, in-progress, submitted, absent.
- Result pipeline: raw upload/import, validation, report generation, manager dashboard export.

## 5) Recommended Architecture
- Frontend: Next.js web app (learner + admin portals).
- Backend: NestJS modular monolith (easy MVP speed, future service split).
- DB: PostgreSQL.
- Queue: Redis + BullMQ for async scoring/report jobs.
- Storage: S3-compatible object store for audio and report files.
- Auth: JWT + RBAC with tenant scoping.
- Observability: OpenTelemetry + centralized logs + audit trail.

## 6) Non-Functional Requirements
- Data isolation by `tenant_id`.
- Audit logs for admin actions and score imports.
- Idempotent job handling for scoring/report generation.
- P95 API latency target < 300 ms for core read endpoints.
- Backup, restore drill, and incident runbook before enterprise rollout.
