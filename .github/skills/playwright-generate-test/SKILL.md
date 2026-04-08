---
name: playwright-generate-test
description: 'Generate a Playwright test based on a scenario using Playwright MCP. Use when: creating browser E2E tests, generating test scripts from user flows, or automating regression test creation.'
---

# Test Generation with Playwright MCP

Your goal is to generate a Playwright test based on the provided scenario after completing all prescribed steps.

## Specific Instructions

- You are given a scenario, and you need to generate a Playwright test for it. If the user does not provide a scenario, ask them to provide one.
- DO NOT generate test code prematurely or based solely on the scenario without completing all prescribed steps.
- DO run steps one by one using the tools provided by the Playwright MCP.
- Only after all steps are completed, emit a Playwright TypeScript test that uses `@playwright/test` based on message history
- Save generated test file in the tests directory
- Execute the test file and iterate until the test passes

## Test Template

```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:8000');
  });

  test('should [expected behavior]', async ({ page }) => {
    // Arrange
    // Act
    // Assert
  });
});
```

## Project-Specific Context

- Web app runs on http://localhost:8000
- API runs on http://localhost:8001
- API is proxied through Next.js rewrites at /api/v1/*
- Auth uses JWT tokens (Bearer header)
- Multi-tenant: requests need x-tenant-code header
- Demo credentials: owner@demo.com / pass1234
