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

## CI/CD: GitHub -> Hugging Face
Workflow file: `.github/workflows/deploy-huggingface.yml`

Configure in GitHub repository settings:
- Secret: `HF_TOKEN` (Hugging Face write token)
- Variable: `HF_REPO_ID` (for example `username/toeicpass-space`)
- Variable: `HF_REPO_TYPE` (`space` | `model` | `dataset`, default `space`)
- Variable: `HF_REPO_BRANCH` (optional, default `main`)

After configuration, each push to `main` triggers automatic sync to the target Hugging Face repo.

## Question Pack
- Built-in content is TOEIC-style.
- For licensed official materials, see `docs/official-question-pack.md`.
