---
name: javascript-typescript-jest
description: 'Best practices for writing JavaScript/TypeScript tests using Jest, including mocking strategies, test structure, and common patterns. Use when: writing unit tests, E2E tests, creating test files, improving test coverage, or debugging test failures in JS/TS projects.'
---

# JavaScript/TypeScript Jest Testing

## Test Structure
- Name test files with `.test.ts`, `.spec.ts`, or `.e2e-spec.ts` suffix
- Place test files next to the code they test or in a dedicated `test/` directory
- Use descriptive test names that explain the expected behavior
- Use nested `describe` blocks to organize related tests
- Follow the pattern: `describe('Component/Function/Class', () => { it('should do something', () => {}) })`

## Effective Mocking
- Mock external dependencies (APIs, databases, etc.) to isolate your tests
- Use `jest.mock()` for module-level mocks
- Use `jest.spyOn()` for specific function mocks
- Use `mockImplementation()` or `mockReturnValue()` to define mock behavior
- Reset mocks between tests with `jest.resetAllMocks()` in `afterEach`
- For NestJS E2E tests, use the Test module to create isolated app instances

## Testing Async Code
- Always return promises or use async/await syntax in tests
- Use `resolves`/`rejects` matchers for promises
- Set appropriate timeouts for slow tests with `jest.setTimeout()`

## Testing HTTP APIs (supertest)
- Use `supertest` with NestJS `TestingModule` for E2E API tests
- Test both success paths (2xx) and error paths (4xx, 5xx)
- Verify response structure, status codes, and headers
- Test authentication/authorization by including/omitting JWT tokens
- Test tenant isolation by verifying cross-tenant access is denied

## Common Jest Matchers
- Basic: `expect(value).toBe(expected)`, `expect(value).toEqual(expected)`
- Truthiness: `expect(value).toBeTruthy()`, `expect(value).toBeFalsy()`
- Numbers: `expect(value).toBeGreaterThan(3)`, `expect(value).toBeLessThanOrEqual(3)`
- Strings: `expect(value).toMatch(/pattern/)`, `expect(value).toContain('substring')`
- Arrays: `expect(array).toContain(item)`, `expect(array).toHaveLength(3)`
- Objects: `expect(object).toHaveProperty('key', value)`
- Exceptions: `expect(fn).toThrow()`, `expect(fn).toThrow(Error)`
- Mock functions: `expect(mockFn).toHaveBeenCalled()`, `expect(mockFn).toHaveBeenCalledWith(arg1, arg2)`

## Vitest (for Next.js/Vite projects)
- Use `vitest` for frontend component and hook tests
- Configure `resolve.alias` in `vitest.config.ts` for path aliases
- Use `@testing-library/react` for component rendering
- Use `jsdom` or `happy-dom` environment for DOM testing
- Mock `fetch`, `localStorage`, and browser APIs with `vi.fn()` / `vi.mock()`

## Best Practices
- Keep tests focused - one assertion per test when possible
- Use `beforeAll`/`afterAll` for expensive setup/teardown
- Use `beforeEach`/`afterEach` for per-test cleanup
- Run tests in isolation with `--runInBand` for E2E tests
- Use `--watch` mode during development for fast feedback
