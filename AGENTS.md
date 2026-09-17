# Repository Guidelines

npm-workspaces monorepo (Node 20, npm + package-lock.json, no pnpm/yarn). Deployed from `main` to a Hugging Face Space via GitHub Actions — treat `main` as deploy-ready.

## Layout

- `apps/api` — NestJS REST API, port 8001, global prefix `api/v1` (so routes are `/api/v1/...`).
- `apps/web` — Next.js 15 frontend, port 8000. Browser calls same-origin `/api/v1`, proxied to the Nest API via `NEXT_PUBLIC_API_URL` / `API_PROXY_TARGET` (set this way in the Dockerfile).
- `apps/mobile` — Expo / React Native (EAS builds). Dual-flavor via `APP_LANG` in `app.config.js`: `en` → `com.toeicpass.english` (英语跟读), `ja` → `com.toeicpass.japanese` (日语跟读), default `both` (dev, in-app language toggle). Build: `npm run build:mobile:android:production:en` / `:ja` (or `preview:en`/`:ja`). Local device run: `set APP_LANG=en&& npx expo prebuild -p android --clean && npx expo run:android` (set JAVA_HOME to the Android Studio JBR). Per-profile app-id suffixes `.dev` / `.preview` still apply. `android/` is gitignored — flavor app-ids only materialize at prebuild/EAS time.
- `packages/*` — seven shared packages (`@toeicpass/shared`, `conversation-ai`, `ad-system`, `word-annotation`, `app-core`, `app-i18n`, `shadowing-content`).
- `db/` — `schema.sql` + `db/migrations/*.sql`. Multi-tenant data model (register/login require `tenantCode`).

Do not confuse root-level `classes.jar`, `classes16.dex`, `AndroidManifest.xml`, `jni/`, `META-INF/` (extracted-APK artifacts), `ecdict.zip` / `jmdict.zip` + `*-tmp/` (dictionary build inputs), `.logs/`, `.next/`, `.runtime/` with application code.

## Critical: packages compile to `dist/`

All `@toeicpass/*` packages resolve `main`/`exports` to `dist/` — apps import compiled output, not source. Consequences:

- Run `npm run build:packages` before any api/web lint, test, or build, and after editing anything in `packages/` (or run `npm run dev:packages` for watch mode).
- Use the root scripts (`npm run lint`, `npm test`, `npm run build`) — they already chain `build:packages` in a fixed dependency order. If you add a package, add it to the `build:packages`, `dev:packages`, and `typecheck:packages` chains in the root `package.json`.

## Commands

- `npm run dev` — packages watch + API (`start:dev` via ts-node) + web hot reload, all at once.
- `npm run lint` — despite the name, this is the full verify gate: build packages, typecheck packages, then `tsc --noEmit` for api and web. There is no ESLint/Prettier config.
- `npm test` — build packages, then api tests, then web tests.

Tests:

- API tests are Jest e2e-style supertest specs in `apps/api/test/*.e2e-spec.ts`, always `--runInBand`. Single file: `npm run -w apps/api test -- auth.e2e-spec.ts`.
- Web tests are Vitest + jsdom + Testing Library in `apps/web/test/**/*.test.{ts,tsx}`. Single file: `npm run -w apps/web test -- test/foo.test.ts`.
- No external services needed: with no `DATABASE_URL`, the API uses embedded PGlite at `apps/api/.local-pg` (tests boot the full `AppModule` against it). Delete `.local-pg` to reset local data.

Database:

- `npm run db:migrate` applies `db/schema.sql` (must run via workspace from `apps/api`; it resolves `../../db/schema.sql` relative to cwd). Targets `DATABASE_URL` if set, else local PGlite.
- `npm run -w apps/api run audit:questions -- --strict` audits question-content quality; CI runs it strict and it fails the build on violations.

## CI (`.github/workflows/quality-gate.yml`, on PRs and `main`)

1. `npm run lint`
2. `npm --prefix apps/api run test:e2e`
3. `audit:questions --strict`

Run all three locally before pushing. Pushes to `main` also trigger the Hugging Face deploy workflow (Docker Space, port 7860: Nest API on 8001 + Next on 7860).

## Conventions

- Conventional Commits (`feat:`, `fix:`, `refactor:`, ...); keep refactors separate from behavior changes.
- API contract is documented in `docs/api-contract-v1.md`; architecture in `docs/system-blueprint.md` and `docs/mobile-architecture.md`. Update docs alongside API/UI behavior changes.
- Web/API shared logic (e.g. transcript comparison) belongs in `packages/app-core`, not duplicated per app.

## Shadowing content flow

Shadowing articles are server-driven: `GET /api/v1/content/shadowing?language=en|ja` (public) is the source of truth for apps; `packages/shadowing-content` is only the offline/fallback seed, seeded into the API store at boot (`StoreService.ensureSeedShadowingMaterials`, table `shadowing_materials`). Admin CRUD lives under `/api/v1/admin/shadowing-materials`. Mobile syncs on startup (`apps/mobile/src/services/content-sync.ts`) with AsyncStorage cache → bundled fallback. To update articles in production: `POST/PUT /api/v1/admin/shadowing-materials/...` — no app release needed. Japanese sentences get furigana `annotations` computed server-side (kuromoji, `JapaneseReadingService`) at serve time.

Device quirks: `recordingOptions.persist` (saving the recognizer audio) and `audioSource` only work on Android 13+; on older Android the app offers a separate record-only button (expo-av) since the mic is exclusive across processes.
