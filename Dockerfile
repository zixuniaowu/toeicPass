FROM node:20-bookworm-slim AS build
WORKDIR /app

ENV CI=true

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/ad-system/package.json packages/ad-system/package.json
COPY packages/conversation-ai/package.json packages/conversation-ai/package.json
COPY packages/word-annotation/package.json packages/word-annotation/package.json
COPY packages/app-core/package.json packages/app-core/package.json
COPY packages/app-i18n/package.json packages/app-i18n/package.json
COPY packages/shadowing-content/package.json packages/shadowing-content/package.json

RUN npm ci

COPY . .

# Use same-origin API path in browser, proxied by Next.js to local Nest API.
ENV NEXT_PUBLIC_API_URL=/api/v1
ENV API_PROXY_TARGET=http://127.0.0.1:8001

RUN npm run build

# Strip dev dependencies for the API runtime (web runs from Next standalone output).
FROM build AS prune
RUN npm prune --omit=dev && rm -rf apps/web/node_modules

FROM node:20-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_PUBLIC_API_URL=/api/v1
ENV API_PROXY_TARGET=http://127.0.0.1:8001
ENV HOSTNAME=0.0.0.0

# API: production node_modules + compiled workspace packages + api dist
COPY --from=prune /app/package.json /app/package.json
COPY --from=prune /app/node_modules /app/node_modules
COPY --from=prune /app/packages /app/packages
COPY --from=prune /app/apps/api /app/apps/api
# API reads vocabulary dictionaries from the web data folder at runtime
COPY --from=build /app/apps/web/data /app/apps/web/data

# Web: Next.js standalone server with static assets and public files
COPY --from=build /app/apps/web/.next/standalone /app/web
COPY --from=build /app/apps/web/.next/static /app/web/apps/web/.next/static
COPY --from=build /app/apps/web/public /app/web/apps/web/public

EXPOSE 7860

# Start Nest API on 8001, wait for it to be ready, then start Next.js on 7860.
CMD ["bash", "-lc", "PORT=8001 node apps/api/dist/src/main.js & for i in $(seq 1 30); do node -e \"fetch('http://127.0.0.1:8001/api/v1').then(()=>process.exit(0)).catch(()=>process.exit(1))\" 2>/dev/null && break; sleep 1; done; cd /app/web/apps/web && PORT=7860 node server.js"]
