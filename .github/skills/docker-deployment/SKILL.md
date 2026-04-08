---
name: docker-deployment
description: 'Docker and deployment patterns for this monorepo. Use when: modifying Dockerfile, fixing container build issues, debugging HF Spaces deployment, configuring CI/CD workflows, or troubleshooting production startup errors.'
---

# Docker & Deployment

## Dockerfile Structure

Single-stage build using `node:20-bookworm-slim`:

1. Copy root `package.json` + all workspace `package.json` files
2. `npm ci --ignore-scripts` to install dependencies
3. Copy full source
4. Build API: `npm run build -w apps/api` (tsc + tsc-alias)
5. Build Web: `npm run build -w apps/web` (Next.js)
6. Start: API first, wait for health, then Next.js

## Startup Sequence (Critical)

The CMD must start API first and wait for it to be healthy before starting Next.js:

```bash
PORT=8001 node apps/api/dist/apps/api/src/main.js &
# Health check loop — wait up to 30s
for i in $(seq 1 30); do
  node -e "fetch('http://127.0.0.1:8001/api/v1').then(()=>process.exit(0)).catch(()=>process.exit(1))" 2>/dev/null && break
  sleep 1
done
cd apps/web && npx next start -p 7860
```

**Why**: Next.js rewrites `/api/v1/*` to the API backend. If Next.js starts before the API is ready, requests fail with "BodyStreamBuffer was aborted".

## Package.json COPY Order

When adding a new package to the monorepo, you MUST add its package.json COPY to the Dockerfile:

```dockerfile
COPY package.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY packages/ad-system/package.json packages/ad-system/
COPY packages/conversation-ai/package.json packages/conversation-ai/
# ^^^ Add new packages here BEFORE npm ci
```

Missing a package.json causes `npm ci` to skip that workspace, leading to runtime "Cannot find module" errors.

## tsc-alias for Path Resolution

TypeScript `paths` aliases (`@toeicpass/*`) are NOT rewritten by `tsc`. The API build uses `tsc-alias` post-build:

```json
"build": "tsc -p tsconfig.build.json && tsc-alias -p tsconfig.build.json"
```

Verify no unresolved aliases in compiled output:
```bash
grep -r "@toeicpass/" apps/api/dist/ --include="*.js"
# Should return nothing
```

## CI/CD Workflows

### Deploy to Hugging Face (`.github/workflows/deploy-huggingface.yml`)
- Triggers on push to `main`
- Syncs repo to HF Spaces using `HF_TOKEN` and `HF_REPO_ID` secrets
- HF Spaces rebuilds Docker image automatically

### Quality Gate (`.github/workflows/quality-gate.yml`)
- Runs on PR and push
- Steps: install → lint → test (API + Web)

## Environment Variables (Production)
- `PORT=8001` — API listen port
- `JWT_SECRET` — Must be set in production (not "dev-secret")
- `WEB_ORIGIN` — CORS allowed origins (CSV)
- `DATABASE_URL` — PostgreSQL connection (optional; in-memory store if unset)
- `REDIS_URL` — BullMQ connection (optional; mock queue if unset)

## Common Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| BodyStreamBuffer aborted | API not ready when Next.js starts | Add health check wait loop |
| Cannot find module @toeicpass/* | tsc-alias not running or missing from build | Ensure build script includes `tsc-alias` |
| npm ci fails in Docker | Missing workspace package.json COPY | Add COPY line for new package |
| 500 on login in production | JWT_SECRET not set | Set proper JWT_SECRET env var |
