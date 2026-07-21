# Mobile Architecture

## Goal

Keep the existing web app intact, add an Android-first mobile app, and preserve a path to iOS with the same mobile codebase.

## Reuse Strategy

The current web UI is heavily tied to browser APIs, CSS modules, speech synthesis, and Next.js routes. That means the highest-value reuse boundary is not the visual layer, but the app-facing domain layer:

- `packages/shared`
  - learning/session language primitives
- `packages/app-core`
  - shared API client
  - shared app-facing data contracts
  - shared mistake-coach logic for wrong-answer summaries and fix plans
  - shared app session model, normalization, persistence helpers, and request-option mapping
  - shared shadowing practice state helpers for material selection, sentence progress, and translation visibility
  - shared shadowing selection and review derivation helpers for active material/sentence lookup and post-recording score assembly
  - shared shadowing feedback-state helpers for recording URI, review payload, and UI status copy
  - shared shadowing runtime-state helpers for speaking / recording / playback flags
  - shared shadowing session-state helpers that compose practice + runtime + feedback into one reusable container
  - shared shadowing score calculator and metric suggestion helpers
  - shared shadowing transcript-compare engine for English and Japanese follow-along feedback
- `packages/app-i18n`
  - shared locale dictionaries
  - shared `createT()` translation helper
  - shared UI language list for web and mobile
- `packages/shadowing-content`
  - shared English and Japanese shadowing material catalogs
  - shared helpers to map materials into the existing `IShadowingContent` shape
- `apps/api`
  - one backend for web and mobile

This keeps the existing web app stable while allowing the mobile app to reuse backend contracts immediately.
The current web app now also reads and writes this shared session model while preserving its legacy localStorage keys for compatibility during the migration.

## Current Android Scope

`apps/mobile` is built with Expo / React Native so the same app can later target iOS.

Current mobile implementation includes:

- login against the existing backend
- analytics overview refresh
- next-task dashboard
- vocabulary review cards
- grammar review cards
- AI conversation scenarios and reply flow
- mistake library browsing
- mistake-note saving and targeted re-practice
- shadowing material selection
- sentence-by-sentence shadowing playback with Expo speech
- sentence-level self-recording and playback review in shadowing
- initial post-recording shadowing scoring with shared heuristics and manual subscore adjustment
- shared transcript comparison feedback in shadowing, ready for future Android/iOS speech-recognition input
- translation toggle during shadowing practice
- mock exam start / answer / submit flow
- language and session settings
- Android `RECORD_AUDIO` permission and iOS microphone usage messaging for shadowing practice
- successful Expo export validation for both Android and iOS bundles

The mobile app is also moving away from a single-file entrypoint:

- `apps/mobile/App.tsx`
  - orchestration layer for session state, API calls, and tab-level control
- `apps/mobile/app.json`
  - Expo application manifest for Android now and iOS later
  - now includes icon, splash, adaptive icon, deep-link scheme, iOS tablet stance, and keyboard layout hints needed for real device packaging
- `apps/mobile/app.config.js`
  - dynamic Expo config layer for build variants
  - keeps Android and iOS package identifiers, app names, and schemes aligned across development, preview, and production builds
  - now also accepts optional `EXPO_PUBLIC_LAN_API_URL` and `EXPO_PUBLIC_PREVIEW_API_URL` so mobile builds can expose device-friendly API presets without changing code
- `apps/mobile/eas.json`
  - EAS build profile map for Android preview APKs, Android production AABs, iOS preview builds, and iOS simulator builds
  - gives the project a real native packaging path instead of only a Metro/export path
- `apps/mobile/src/app-shell/mobile-app-shell.tsx`
  - shared top-level rendering shells for boot, guest, and authenticated app states
  - keeps status bar, top chrome, and root safe-area composition out of `App.tsx`
- `apps/mobile/src/navigation/mobile-root-stack.tsx`
  - root stack shell above the tab navigator
  - hosts non-tab flows such as active practice / mock sessions
  - now also carries iOS-friendly stack gesture/transition defaults
  - now also owns the app linking map so the Expo scheme resolves to concrete tab and session routes
  - now also supports stack-route blur cleanup so leaving a practice session by gesture or back navigation does not leave stale active-session state behind
  - now also guards unfinished sessions with a confirm-before-leave flow that covers iOS swipe-back and Android back navigation
- `apps/mobile/src/navigation/use-mobile-navigation-lifecycle.ts`
  - shared navigation lifecycle orchestration hook for tab focus, tab blur, pull-to-refresh wiring, and guarded session-route removal
  - keeps route lifecycle policy out of `App.tsx` so Android and future iOS navigation behavior is configured in one place
- `apps/mobile/src/navigation/mobile-tabs.tsx`
  - Expo-compatible bottom-tab navigation shell for Android now and iOS later
  - hides the tab bar while the keyboard is open to free space for iPhone-sized layouts
  - now also supports tab-blur cleanup hooks so audio-heavy flows can suspend cleanly when users switch tabs
  - now also supports shared pull-to-refresh handlers so tabs can refresh like a native mobile app without per-screen scroll duplication
  - now also supports tab-focus hooks so pages can refresh on return without duplicating focus logic in each screen
- `apps/mobile/src/conversation/use-conversation-practice.ts`
  - mobile conversation orchestration hook for scenario loading, target-language filtering, draft state, and reply flow
  - now also exposes stale-aware scenario reload behavior for tab-focus returns
- `apps/mobile/src/auth/use-mobile-auth-session.ts`
  - mobile auth/bootstrap/session-persistence hook for login state, unauthorized reset, and local session restoration
  - now also owns the runtime API target for real-device usage, so preview builds can switch between Hugging Face, LAN dev APIs, and future iOS test backends without rebuilding
  - now also runs backend connectivity probes for the current runtime API target so Android and iOS preview builds can confirm `/health` before login
- `apps/mobile/src/dashboard/use-dashboard-data.ts`
  - mobile dashboard/data-refresh orchestration hook for analytics, tasks, review payloads, mistake library, and refresh state
  - now also exposes stale-aware refresh behavior so tab returns do not blindly refetch every time
- `apps/mobile/src/learning/use-mobile-learning-hub.tsx`
  - shared mobile learning-orchestration hook that composes dashboard, review, session, conversation, and shadowing flows
  - keeps cross-feature app logic out of `App.tsx` while preserving the existing shared packages and route lifecycle hooks
- `apps/mobile/src/platform/mobile-safe-shell.tsx`
  - safe-area shell layer that keeps Android unchanged while making iPhone top/bottom insets behave correctly
  - now also provides shared keyboard-aware and scroll-aware wrappers so tab screens and stack screens do not fork their inset behavior
  - now also provides shared refresh-control support for mobile scroll containers
  - now also owns shared mobile status-bar rendering and background color tokens so boot, login, and authenticated shells stay consistent across Android and iOS
- `apps/mobile/src/platform/use-app-state-effect.ts`
  - shared mobile app lifecycle hook for foreground/background transitions
  - now used to keep dashboard refresh and audio cleanup behavior consistent across Android and iOS
- `apps/mobile/src/platform/use-mobile-runtime-info.ts`
  - shared runtime-info hook for current app variant, platform, scheme, app identifier, and execution environment
- `apps/mobile/src/platform/runtime-diagnostics-panel.tsx`
  - reusable device-side diagnostics panel shown on login and settings screens
  - keeps runtime and backend debugging consistent across Android now and iOS preview later
- `apps/mobile/src/platform/use-mobile-api-presets.ts`
  - shared API-target preset hook for build default, emulator, simulator, and optional LAN or preview backends
- `apps/mobile/src/platform/api-base-controls.tsx`
  - shared API configuration panel used by login and settings screens
  - keeps real-device backend switching behavior aligned across Android and future iOS builds
- `apps/mobile/src/mistakes/use-mistake-review.ts`
  - mobile mistake-library orchestration hook for note drafts, root-cause selection, save state, and persistence flow
- `apps/mobile/src/review/use-graded-review.ts`
  - reusable mobile review helper for due-item filtering, reveal state, and grade submission flow
- `apps/mobile/src/review/use-vocab-review.ts`
  - mobile vocabulary review orchestration hook built on the shared graded-review helper
- `apps/mobile/src/review/use-grammar-review.ts`
  - mobile grammar review orchestration hook built on the shared graded-review helper
- `apps/mobile/src/session/use-session-practice.ts`
  - mobile mock and practice-session orchestration hook for start, answer, submit, retry, and report state
  - now also exposes route-exit cleanup for abandoning unfinished sessions without wiping saved reports
- `apps/mobile/src/shadowing/shadowing-audio-adapter.ts`
  - platform-facing contract for speech, recording, playback, and cleanup
- `apps/mobile/src/shadowing/expo-shadowing-audio.ts`
  - Expo-specific implementation of the shadowing audio adapter
- `apps/mobile/src/shadowing/use-shadowing-audio.ts`
  - React Native hook that binds persistent recording and playback refs to the adapter
- `apps/mobile/src/shadowing/use-shadowing-training.ts`
  - mobile shadowing orchestration hook that composes shared session logic, scoring, and audio control
  - now also suspends speech/recording/playback on app backgrounding and screen blur to match iOS lifecycle expectations more closely
  - now also owns transcript-draft and compare-feedback state so future Android/iOS recognition sources can plug into one result surface
- `apps/mobile/src/ui.tsx`
  - shared React Native UI primitives and styling tokens
  - shared iOS-friendly form input primitives for keyboard appearance, selection color, and placeholder behavior
- `apps/mobile/src/screens/use-mobile-screen-registry.tsx`
  - shared screen-assembly hook that composes tab screens and the active session screen outside the app entrypoint
  - keeps `App.tsx` focused on bootstrap, auth, and top-level app wiring instead of page registration details
- `apps/mobile/src/screens/`
  - screen-level UI slices extracted from `App.tsx`
  - current extracted screens: login, home, mock, vocab, grammar, conversation, mistakes, shadowing, settings
  - login and settings now both expose the runtime API base so device builds are not locked to a single backend URL
- `apps/api/src/controllers/system.controller.ts`
  - public `/health` endpoint for device-side connectivity checks without requiring auth

## Deliberate Boundary

The following web features were not forced into the first mobile pass because the browser implementation would not transfer cleanly:

- full pronunciation scoring / follow-along evaluation driven by real speech recognition
- selection-based translation UI
- CSS-module-driven component system

These should move next into either:

- a React Native specific UI layer, or
- a deeper shared engine package if the logic is framework-agnostic

## Next Steps

1. Replace the current heuristic Android shadowing score with real pronunciation / follow-along evaluation.
2. Finish migrating the remaining web-only auth/session edge cases onto the shared `packages/app-core` session model, then remove the legacy compatibility keys.
3. Move more temporary or task-focused flows onto the root stack instead of leaving them inside root tabs.
4. Extract more shadowing progress state into shared hooks or a framework-agnostic engine where it pays off.
