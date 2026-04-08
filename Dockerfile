FROM node:20-bookworm-slim AS build
WORKDIR /app

ENV CI=true

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/ad-system/package.json packages/ad-system/package.json
COPY packages/conversation-ai/package.json packages/conversation-ai/package.json

RUN npm ci

COPY . .

# Use same-origin API path in browser, proxied by Next.js to local Nest API.
ENV NEXT_PUBLIC_API_URL=/api/v1
ENV API_PROXY_TARGET=http://127.0.0.1:8001

RUN npm run build

FROM node:20-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_PUBLIC_API_URL=/api/v1
ENV API_PROXY_TARGET=http://127.0.0.1:8001

COPY --from=build /app /app

EXPOSE 7860

# Start Nest API on 8001, wait for it to be ready, then start Next.js on 7860.
CMD ["bash", "-lc", "PORT=8001 node apps/api/dist/apps/api/src/main.js & for i in $(seq 1 30); do node -e \"fetch('http://127.0.0.1:8001/api/v1').then(()=>process.exit(0)).catch(()=>process.exit(1))\" 2>/dev/null && break; sleep 1; done; cd apps/web && npx next start -p 7860"]
