# Changelog

All notable changes to `@toeicpass/ad-system` will be documented in this file.

## [1.0.0] — 2026-04-18

### Added
- Core `AdService` class with user-facing and admin operations
- `IAdStore` interface for database abstraction
- 4 ad slot types: `banner_top`, `interstitial`, `native_feed`, `reward_video`
- 4 event types: `impression`, `click`, `dismiss`, `reward_complete`
- CTR calculation and per-slot analytics
- React frontend components: `AdBanner`, `NativeFeedAd`, `InterstitialAd`, `RewardVideoAd`, `AdManagerView`
- Google AdSense waterfall support via `GoogleAdUnit`
- `AdApiFunctions` / `AdminAdApiFunctions` API injection interfaces
- Bilingual UI support (Chinese `zh` / Japanese `ja`)
- 7 seed ads for quick bootstrapping (`DEFAULT_AD_SEEDS`)
- Plan-tier targeting (show ads based on user subscription plan)
- Time-windowed scheduling (`startsAt` / `expiresAt`)
- Full specification document (`SPEC.md`)
- Step-by-step integration guide (`INTEGRATION.md`)
- PostgreSQL schema reference
