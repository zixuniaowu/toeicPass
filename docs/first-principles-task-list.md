# First-Principles Task List (Execution Checklist)

Goal: maximize real TOEIC score gain, not fake dashboard numbers.

## Principle A: Every score must come from real question interactions
- [x] A1. Use human-readable TOEIC-style seeded questions (not placeholder options).
- [x] A2. Let users answer each question manually before submit.
- [x] A3. Return per-question review data (`selected`, `correct`, `explanation`) on submit.
- [x] A4. Support targeted training by weak part/difficulty filter.

## Principle B: System must decide what to do next from data
- [x] B1. Add analytics API with real stats: attempts, accuracy, part breakdown, avg time, score trend.
- [x] B2. Add next-task recommendation API from weak parts + due review + goal gap.
- [x] B3. Calculate target gap using latest score and goal.

## Principle C: Learner workflow must be directly executable
- [x] C1. Dashboard cards must use real API data, not hardcoded text.
- [x] C2. Session area must show actual questions/options and answer selection.
- [x] C3. Result area must show detailed explanations and correctness.
- [x] C4. Recommendation panel must provide immediate next actions.

## Principle D: Reliability gates before claiming completion
- [x] D1. Fix API runtime stability issue caused by dev runner/decorator metadata mismatch.
- [x] D2. Extend e2e tests for new adaptive/analytics flows and review payload.
- [x] D3. Pass `lint`, `build`, `test:e2e`.
- [x] D4. Verify runtime on `http://localhost:8000` and `http://localhost:8001/api/v1`.

## Principle E: Listening training must include real playable audio
- [x] E1. Download official public TOEIC listening tracks into local static assets.
- [x] E2. Return `mediaUrl` from session APIs for listening parts.
- [x] E3. Add in-page audio player for listening questions and review replay.
- [x] E4. Verify audio files are served and playable from `http://localhost:8000`.

## Principle F: Learning UX must reduce cognitive overload
- [x] F1. Replace one-page clutter with tabbed workflow (Dashboard / Listening / Reading / Review / Settings).
- [x] F2. Use one-question-at-a-time answering flow with clear next/prev navigation.
- [x] F3. Show listening visual context image and official audio on question card.
