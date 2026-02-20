# toeicPass

Monorepo for a TOEIC score improvement platform with enterprise TOEIC IP test operations.

## Stack
- `apps/api`: NestJS API (auth, RBAC, learning flows, enterprise IP flows, audit)
- `apps/web`: Next.js learner/admin portal
- `db/schema.sql`: initial PostgreSQL schema

## Quick Start
```bash
npm install
npm run db:migrate
npm run dev:api
npm run dev:web
```

API base URL: `http://localhost:8001/api/v1`

## Test
```bash
npm run test:e2e
```
