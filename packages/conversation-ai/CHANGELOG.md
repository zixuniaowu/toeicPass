# Changelog

All notable changes to `@toeicpass/conversation-ai` will be documented in this file.

## [1.0.0] — 2026-04-18

### Added
- Core `ConversationService` class with dual-mode AI (Gemini + rule-based fallback)
- 8 built-in TOEIC conversation scenarios across 3 difficulty levels
- 8 scenario categories with curated rule-based response banks
- Real-time grammar checking: capitalization, contractions, sentence length, punctuation
- `ConversationView` React component with full-screen chat UI
- Web Speech API integration: press-and-hold STT + auto-play TTS
- Bilingual UI support (Chinese `zh` / Japanese `ja`)
- `ConversationApiFunctions` interface for host app API injection
- CSS Modules for style isolation
- Full specification document (`SPEC.md`)
- Step-by-step integration guide (`INTEGRATION.md`)
