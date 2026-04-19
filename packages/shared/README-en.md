# @toeicpass/shared

> Shared type definitions for the toeicPass ecosystem — zero runtime, zero dependencies, pure TypeScript types.

## Docs

| Document | Description |
|---|---|
| [SPEC.md](./SPEC.md) | Specification — all type docs, usage scenarios, cross-module references |
| [CHANGELOG.md](./CHANGELOG.md) | Version changelog |
| [README.md](./README.md) | Chinese (中文) version of this document |

## Install

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
  Locale,
  SessionMode,
  Role,
} from "@toeicpass/shared";

// Examples
const action: LearningActionCommand = "practice:start";
const filters: SessionFilters = { partNo: 5, difficulty: 2 };
const locale: Locale = "zh";
const role: Role = "learner";
```

## Exports

| Type | Description |
|---|---|
| `LearningActionCommand` | 6 learning action commands (`practice:start`, `diagnostic:start`, `mock:start`, `mistakes:start`, `vocab:start`, `shadowing:start`) |
| `LearningPartGroup` | `"listening"` \| `"reading"` |
| `SessionFilters` | Practice filter parameters (`partNo`, `difficulty`, `partGroup`) |
| `Locale` | `"zh"` \| `"ja"` |
| `SessionMode` | `"diagnostic"` \| `"practice"` \| `"mock"` |
| `Role` | 4 RBAC roles (`learner`, `coach`, `tenant_admin`, `super_admin`) |

## Package Characteristics

- **Pure types** — no runtime code, zero bundle size impact
- **Zero dependencies** — no peerDependencies
- **Shared across frontend & backend** — API and Web import from the same source

## License

MIT
