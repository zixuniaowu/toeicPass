---
name: nextjs-app-router
description: 'Next.js App Router patterns for this monorepo. Use when: creating pages, layouts, route handlers, client components, hooks, SSR/SSG patterns, API proxy rewrites, or fixing hydration issues in the apps/web directory.'
---

# Next.js App Router Patterns

## Project Structure

```
apps/web/
├── app/          # File-based routing (App Router)
├── components/   # React components
├── hooks/        # Custom React hooks
├── lib/          # API client functions (fetch wrapper)
├── types/        # TypeScript types (re-exports from packages)
├── styles/       # CSS/styles
├── data/         # Static data files
├── public/       # Static assets
└── test/         # Vitest unit tests
```

## API Proxy

Next.js rewrites `/api/v1/*` to the NestJS backend (port 8001):

```typescript
// next.config.ts
rewrites: async () => ({
  fallback: [
    { source: '/api/v1/:path*', destination: 'http://127.0.0.1:8001/api/v1/:path*' }
  ]
})
```

## Client vs Server Components

- Pages in `app/` are Server Components by default
- Add `'use client'` directive for components using hooks, event handlers, browser APIs
- Use `localStorage` only in client components behind a `mounted` guard

## Hydration Safety Pattern

When component depends on client-only state (e.g., `localStorage`), prevent SSR mismatch:

```typescript
'use client';
export default function ClientPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null; // or skeleton
  // Now safe to read localStorage, etc.
  return <ActualContent />;
}
```

## API Client Pattern

```typescript
// lib/api.ts
async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('token');
  const res = await fetch(`/api/v1${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
```

## Testing with Vitest

Tests in `test/` use Vitest + React Testing Library:

```typescript
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import MyComponent from '../components/MyComponent';

describe('MyComponent', () => {
  it('renders content', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeDefined();
  });
});
```

Run: `npm -w apps/web test`

## Key Conventions
- File naming: `kebab-case` (e.g., `study-plan.tsx`)
- Components: `PascalCase` (e.g., `StudyPlan.tsx`)
- Types re-exported from packages in `types/index.ts`
- Packages imported via TypeScript path aliases: `@toeicpass/ad-system/web`, `@toeicpass/conversation-ai/web`
