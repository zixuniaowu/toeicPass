# Continuous Improvement Log (2026-02-22)

## Objective
Run a focused improvement cycle for product quality and learning effectiveness with no idle gaps.

## Workstream Queue
1. Product quality: remove fake interactions, enforce real data flows, fix blocking UX bugs.
2. Learning effectiveness: improve adaptive diagnostics/practice and review loop quality.
3. Enterprise readiness: harden TOEIC IP workflow constraints and edge-case handling.
4. Reliability: keep `lint`, `test`, `build`, and UI smoke checks green after each batch.

## Progress Entries
- 11:35 - Batch 1 done: listening-only filter fixed, diagnostic coverage improved, mock=200/120, snapshot isolation in test, API+Web running on 8001/8000, lint/test/build + UI smoke passed.
- 14:58 - Batch 2 done: added mistake-drill API and UI flows (filtered drill, high-frequency drill, single-question drill), polished shell/topbar/dashboard visual hierarchy, reran lint/test/build and interactive UI smoke for mistake drills.
- 15:16 - Batch 3 done: added `/learning/daily-plan` (60-minute execution blocks), wired dashboard "立即开始" actions, expanded action parser for partGroup/diagnostic, reran lint/test/build + API/UI smoke.
- 15:35 - Batch 4 done: strengthened attempt integrity (no re-submit, duplicate/foreign answer checks, unanswered penalized), added enterprise session "start" transition + stricter result import precondition, improved campaign report metrics, reran lint/test/build + API/UI smoke.
- 15:41 - Batch 5 done: improved enterprise candidate dedupe behavior for name-only imports, expanded e2e coverage for dedupe and result-import guardrails, reran lint/test/build and restarted runtime services.
- 15:49 - Batch 6 done: enabled partial/timeout mock submission path (frontend + API) while keeping practice strict, added auto-submit readiness for mock timer workflow, expanded e2e and UI smoke around partial submission and report correctness.
- 16:02 - Batch 7 done: added consistency analytics (active days, streak, weekly study minutes, mode breakdown) for personalization, expanded enterprise report status breakdown assertions, reran lint/test/build and end-to-end UI smoke.
- 16:12 - Batch 8 done: added goal pace analytics (`daysToExam`, `requiredWeeklyGain`, `status`) and dashboard pace banner for actionable urgency, plus e2e assertions and API/UI smoke verification.
- 16:21 - Batch 9 done: added enterprise session list API with live seat/status telemetry (`rosterSize`, `occupiedSeats`, `availableSeats`, `statusCount`) and expanded e2e coverage for session observability.
- 16:31 - Batch 10 done: added session-candidate operations (`GET /ip/sessions/:sessionId/candidates`, `POST /ip/sessions/:sessionId/absent`), improved frontend API error parsing for cleaner messages, and expanded dashboard with mode-distribution panel.
- 20:38 - Batch 11 done: added recency-aware question selection to reduce repeated questions across consecutive sessions (diagnostic/practice/mock), expanded e2e with no-overlap assertion for back-to-back targeted practice sessions, reran lint/test/build and UI smoke on 8000/8001.
- 20:48 - Batch 12 done: redesigned web shell to full-width left-aligned workspace (removed centered layout), upgraded top bar/card/button/dashboard visual language, and fixed runtime interactivity by restarting web after rebuild to avoid stale Next chunk mismatch; UI smoke revalidated on 8000.
- 21:16 - Batch 13 done: fixed listening media usability by enforcing per-question clipped audio URLs (`#t=start,end`) for all listening questions (including migrated snapshot data), added Part 1/2 in-browser matching TTS readout ("题干朗读") to avoid option/audio mismatch, updated listening hint text, and revalidated lint/test/build + listening UI smoke.
- 21:24 - Batch 14 done: implemented word-selection pronunciation helper in question cards (highlight word -> popover with IPA/释义 + read/stop controls), enabled text selection on stem/passage/options, and validated with lint/test/build plus Playwright smoke for selection popup.
- 21:29 - Batch 15 done: clarified listening labels to indicate official clips are approximate (not exact per-item master audio), rebuilt and restarted web runtime, and reran integrated UI smoke (`FINAL_UI_OK`) plus listening media clip assertion.
- 21:34 - Batch 16 done: extended word-selection pronunciation to Shadowing practice sentence area (including annotated mode), added explicit study tip for划词 usage, and validated with Playwright smoke (`SHADOWING_SELECTION_OK`).
- 21:56 - Batch 17 done: added dashboard-visible 16-week score roadmap with manual baseline input (supports entering latest IP score like 590), milestone targets, and weekly rhythm guidance; validated with Playwright (`PLAN_UI_OK`).
- 21:57 - Batch 18 done: persisted manual baseline score in browser localStorage (`toeicpass.manualBaseline`) so IP baseline input remains after refresh/reopen.
- 22:15 - Batch 19 done: upgraded daily plan from generic blocks to concrete execution tasks with question-level checklist items and added a 7-day detailed schedule (day-by-day tasks + specific preview stems/terms). API and dashboard now expose/render concrete task content; validated via e2e + Playwright (`DAILY_PLAN_DETAIL_OK`).
- 22:24 - Batch 20 done: added execution tracking to dashboard plans (task-level and checklist-level checkboxes, completion progress bars, weekly completion stats) with persistence in localStorage (`toeicpass.planProgress.v1`); validated via Playwright reload persistence check (`PLAN_PROGRESS_UI_OK`).
