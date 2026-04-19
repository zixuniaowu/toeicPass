# @toeicpass/shared — Integration Guide

## Step 1: Install

```bash
# From npm (after publishing)
npm install @toeicpass/shared

# Or in monorepo workspace
# package.json: { "dependencies": { "@toeicpass/shared": "workspace:*" } }
```

## Step 2: Configure TypeScript

Ensure your `tsconfig.json` includes `"strict": true` for best type inference.

If using monorepo workspace references, add path mapping:

```json
{
  "compilerOptions": {
    "paths": {
      "@toeicpass/shared": ["../../packages/shared/src"]
    }
  }
}
```

## Step 3: Import Types

All exports are type-only. Use `import type` for zero runtime overhead:

```typescript
import type {
  LearningActionCommand,
  SessionFilters,
  LangConfig,
  Role,
} from "@toeicpass/shared";
```

## Step 4: Use in Your Application

### Backend — Request Validation

```typescript
function startSession(command: LearningActionCommand, filters: SessionFilters) {
  if (command === "practice:start" && !filters.partNo) {
    throw new Error("partNo is required for practice sessions");
  }
  // ...
}
```

### Backend — RBAC Guard

```typescript
import type { Role } from "@toeicpass/shared";

function requireRole(userRole: Role, allowed: Role[]) {
  if (!allowed.includes(userRole)) {
    throw new ForbiddenException();
  }
}
```

### Frontend — Language Config

```typescript
import type { LangConfig } from "@toeicpass/shared";

const defaultLang: LangConfig = {
  uiLang: "en",
  nativeLang: "zh",
  targetLang: "en",
};
```

## Notes

- This package has **zero runtime code** — it only provides TypeScript types that are erased at compile time.
- No peer dependencies required.
- Works with any TypeScript version >= 4.5.
