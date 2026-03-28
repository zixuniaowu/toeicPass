FROM node:20-bookworm-slim AS build
WORKDIR /app

ENV CI=true

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json

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

# Start Nest API on 8001 and Next.js on 7860 (HF Space public port).
CMD ["bash", "-lc", "PORT=8001 node apps/api/dist/main.js & cd apps/web && npx next start -p 7860"]
