import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as api from "../lib/api";

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
  mockFetch.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function errorResponse(body: string, status = 400): Response {
  return new Response(body, { status });
}

describe("api.register", () => {
  it("sends correct payload and returns success", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({}));

    const result = await api.register({
      tenantCode: "demo",
      tenantName: "Demo Corp",
      email: "user@example.com",
      password: "pass123",
      displayName: "Test User",
    });

    expect(result).toEqual({ success: true });
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/auth/register"),
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("returns error message on failure", async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(JSON.stringify({ message: "Email taken" }), 409));

    const result = await api.register({
      tenantCode: "demo",
      tenantName: "Corp",
      email: "dup@example.com",
      password: "pass",
      displayName: "Dup",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Email taken");
  });
});

describe("api.login", () => {
  it("returns token on success", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ accessToken: "jwt-token-123", tenantCode: "demo" }),
    );

    const result = await api.login({
      tenantCode: "demo",
      email: "user@example.com",
      password: "pass123",
    });

    expect(result.success).toBe(true);
    expect(result.token).toBe("jwt-token-123");
    expect(result.tenantCode).toBe("demo");
  });

  it("includes x-tenant-code header when tenantCode is provided", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ accessToken: "abc" }));

    await api.login({ tenantCode: "corp-123", email: "a@b.com", password: "p" });

    const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
    expect(lastCall[1].headers["x-tenant-code"]).toBe("corp-123");
  });

  it("omits x-tenant-code header when tenantCode is empty", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ accessToken: "abc" }));

    await api.login({ email: "a@b.com", password: "p" });

    const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
    expect(lastCall[1].headers["x-tenant-code"]).toBeUndefined();
  });

  it("returns error on 401", async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(JSON.stringify({ message: "Invalid password" }), 401));

    const result = await api.login({ email: "a@b.com", password: "wrong" });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Invalid password");
  });

  it("handles array error messages", async () => {
    mockFetch.mockResolvedValueOnce(
      errorResponse(JSON.stringify({ message: ["email must be an email", "password too short"] }), 400),
    );

    const result = await api.login({ email: "bad", password: "x" });

    expect(result.success).toBe(false);
    expect(result.error).toContain("email must be an email");
    expect(result.error).toContain("password too short");
  });
});

describe("api.startSession", () => {
  it("sends mock mode to correct endpoint", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ attemptId: "att-1", questions: [{ id: "q1", partNo: 5, stem: "test", options: {} }] }),
    );

    const result = await api.startSession("mock", undefined, { token: "jwt", tenantCode: "demo" });

    expect(result.success).toBe(true);
    expect(result.attemptId).toBe("att-1");
    const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
    expect(lastCall[0]).toContain("/mock-tests/start");
  });

  it("sends practice mode with filters", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ attemptId: "att-2", questions: [] }));

    await api.startSession("practice", { partNo: 5, difficulty: 2 }, { token: "jwt", tenantCode: "demo" });

    const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
    const url = lastCall[0] as string;
    expect(url).toContain("/practice/sessions");
    expect(url).toContain("part=5");
    expect(url).toContain("difficulty=2");
  });

  it("sends diagnostic mode to correct endpoint", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ attemptId: "att-3", questions: [] }));

    await api.startSession("diagnostic", undefined, { token: "jwt" });

    const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
    expect(lastCall[0]).toContain("/diagnostics/start");
  });

  it("includes authorization header", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ attemptId: "att-4", questions: [] }));

    await api.startSession("practice", undefined, { token: "my-jwt-token", tenantCode: "corp" });

    const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
    const headers = lastCall[1].headers;
    expect(headers["Authorization"]).toBe("Bearer my-jwt-token");
    expect(headers["x-tenant-code"]).toBe("corp");
  });
});
