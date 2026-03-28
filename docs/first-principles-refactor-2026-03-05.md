# First-Principles Refactor (2026-03-05)

## Why
Current code had two structural risks:
- Business policy and orchestration were mixed in large files (`AppService`, `ClientHome`).
- The same learning-action rules were reimplemented in multiple places with drift risk.

This refactor applies first principles: keep *policy* pure and centralized, keep *adapters/controllers/views* thin.

## First Principles Used
1. Single source of truth for domain rules:
   - Action grammar (`practice:start?...`)
   - Question eligibility / attempt-selectable policy
2. Boundary parsing at the edge:
   - HTTP query parsing in controller layer
3. Orchestration only in service/view:
   - AppService and ClientHome now delegate rule details to focused modules

## Changes
- API (Domain split):
  - Added `apps/api/src/services/auth-domain.service.ts`
    - Registration/login/token refresh/me profile responsibilities moved out of facade.
  - Added `apps/api/src/services/admin-question.service.ts`
    - Question CRUD + pool health + audit listing moved out of facade.
  - Added `apps/api/src/services/enterprise-ip.service.ts`
    - Enterprise TOEIC IP campaign/session/result lifecycle moved out of facade.
  - Added `apps/api/src/services/learning-domain.service.ts`
    - All learning workflows (attempt/submit/analytics/plan/mistake/review/vocab/prediction/conversation) moved into dedicated domain service.
  - Added `apps/api/src/services/learning-conversation.service.ts`
    - Conversation scenarios + reply generation extracted from learning domain service.
  - Updated `apps/api/src/app.service.ts`
    - Converted from "all-in-one implementation" to thin orchestration facade.
    - File size reduced from ~2.4k LOC to ~230 LOC.

- API (Controller split):
  - Added `apps/api/src/controllers/auth.controller.ts`
  - Added `apps/api/src/controllers/learning.controller.ts`
  - Added `apps/api/src/controllers/admin.controller.ts`
  - Added `apps/api/src/controllers/enterprise.controller.ts`
  - Added `apps/api/src/request-context.ts` for unified request-context extraction.
  - Removed monolithic `apps/api/src/app.controller.ts`.
  - Updated `apps/api/src/app.module.ts` to register split controllers/services.

- API (Shared policy):
  - Added `apps/api/src/learning-action.ts` for action sanitization.
  - Added `apps/api/src/question-policy.ts` for attempt-selectable eligibility.
  - Added `apps/api/src/session-filters.ts` for query parsing boundaries.

- Web:
  - Added `apps/web/lib/learning-action.ts` for action/filter canonical parsing.
  - Added `apps/web/hooks/useLearningCommandRunner.ts`
    - Extracted command execution state machine out of `ClientHome`.
  - Updated `apps/web/components/ClientHome.tsx`
    - Reduced orchestration complexity by delegating action execution and view routing.
  - Updated `apps/web/hooks/index.ts` to export new hook.

## Architectural Outcome
- API moved from monolithic entrypoint to explicit domain boundaries:
  - `Auth`, `Learning`, `Admin`, `Enterprise`.
- Core domain policies are centralized and reusable.
- Frontend page component orchestration is reduced; command execution became a dedicated hook.
- Future changes (new command grammar, eligibility rules, enterprise policies) are localized instead of cross-file edits.

## Suggested Next Refactor Slice
1. Extract attempt scoring/prediction math from `AppService` into `apps/api/src/scoring-policy.ts`.
2. Split `ClientHome` command orchestration into `useLearningCommandRunner` hook.
