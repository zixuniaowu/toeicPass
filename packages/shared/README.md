# @toeicpass/shared

> Shared type definitions and constants for the toeicPass ecosystem — zero runtime, zero dependencies, pure TypeScript types.

## Documentation

| Document | Description |
|---|---|
| [SPEC.md](./SPEC.md) | Specification — all type definitions, usage scenarios, cross-references |
| [INTEGRATION.md](./INTEGRATION.md) | Step-by-step integration guide |
| [CHANGELOG.md](./CHANGELOG.md) | Version changelog |

## Installation

```bash
npm install @toeicpass/shared
```

Or via monorepo workspace reference:
```json
{ "dependencies": { "@toeicpass/shared": "workspace:*" } }
```

## Usage

```typescript
import type {
  LearningActionCommand,
  LearningPartGroup,
  SessionFilters,
  SessionMode,
  Role,
  LangConfig,
  UiLang,
  NativeLang,
  TargetLang,
} from "@toeicpass/shared";

// Learning actions
const action: LearningActionCommand = "practice:start";
const filters: SessionFilters = { partNo: 5, difficulty: 2 };

// Language configuration
const lang: LangConfig = {
  uiLang: "zh",        // UI displayed in Chinese
  nativeLang: "zh",    // User's mother tongue
  targetLang: "en",    // Studying English
};

// RBAC
const role: Role = "learner";
```

## Architecture

### Design Principles

- **Pure Types**: This package contains only TypeScript type definitions and constants. Zero runtime code, zero dependencies. It adds nothing to your bundle size.
- **Contract Layer**: Serves as the single source of truth for type contracts between `apps/api` (NestJS backend) and `apps/web` (Next.js frontend).
- **Three-dimensional Language Model**: Separates UI language, native language, and target language into independent dimensions via `LangConfig`, avoiding the common pitfall of conflating display locale with learning target.

### Module Structure

```
src/
└── index.ts    # All type exports — LearningActionCommand, SessionFilters,
                # LangConfig, Role, SessionMode, and more
```

## Exported Types

### Learning

| Type | Description |
|---|---|
| `LearningActionCommand` | 6 learning action commands: `practice:start`, `diagnostic:start`, `mock:start`, `mistakes:start`, `vocab:start`, `shadowing:start` |
| `LearningPartGroup` | `"listening"` \| `"reading"` — TOEIC section discriminator |
| `SessionFilters` | Practice session filter parameters: `partNo`, `difficulty`, `partGroup` |
| `SessionMode` | `"diagnostic"` \| `"practice"` \| `"mock"` |

### Language Configuration

| Type | Description |
|---|---|
| `UiLang` | `"zh"` \| `"ja"` \| `"en"` — UI display language |
| `NativeLang` | `"zh"` \| `"ja"` \| `"en"` — user's mother tongue (translation target) |
| `TargetLang` | `"en"` \| `"ja"` — language being studied |
| `LangConfig` | Complete language config: `{ uiLang, nativeLang, targetLang }` |
| `Locale` | ⚠️ Deprecated — use `UiLang` instead. Kept for backward compatibility. |

### RBAC

| Type | Description |
|---|---|
| `Role` | `"learner"` \| `"coach"` \| `"tenant_admin"` \| `"super_admin"` |

## Who Uses This

| Consumer | How |
|---|---|
| `apps/api` | Imports `Role`, `SessionMode`, `LearningActionCommand` for request validation and domain logic |
| `apps/web` | Imports `LangConfig`, `SessionFilters`, `Role` for UI state and API calls |
| `@toeicpass/ad-system` | References `Locale` for i18n in ad components |
| `@toeicpass/conversation-ai` | References `Locale` for i18n in conversation UI |

## License

MIT — see [LICENSE](./LICENSE)
