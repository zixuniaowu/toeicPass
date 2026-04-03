import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useAuth } from "../hooks/useAuth";

vi.mock("../lib/api", () => ({
  register: vi.fn(),
  login: vi.fn(),
  setOnUnauthorized: vi.fn(),
}));

import * as api from "../lib/api";

const mockRegister = vi.mocked(api.register);
const mockLogin = vi.mocked(api.login);

describe("useAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts logged out with default credentials", () => {
    const { result } = renderHook(() => useAuth("zh"));
    expect(result.current.isLoggedIn).toBe(false);
    expect(result.current.token).toBe("");
    expect(result.current.credentials.email).toBe("owner@demo.com");
    expect(result.current.credentials.tenantCode).toBe("demo");
  });

  it("updates credentials", () => {
    const { result } = renderHook(() => useAuth("zh"));
    act(() => {
      result.current.updateCredentials({ email: "test@example.com", password: "pass123" });
    });
    expect(result.current.credentials.email).toBe("test@example.com");
    expect(result.current.credentials.password).toBe("pass123");
    // Other fields unchanged
    expect(result.current.credentials.tenantCode).toBe("demo");
  });

  it("login success sets token and isLoggedIn", async () => {
    mockLogin.mockResolvedValueOnce({ success: true, token: "jwt-abc", tenantCode: "demo" });
    const { result } = renderHook(() => useAuth("zh"));

    let token: string | null = null;
    await act(async () => {
      token = await result.current.login();
    });

    expect(token).toBe("jwt-abc");
    expect(result.current.isLoggedIn).toBe(true);
    expect(result.current.token).toBe("jwt-abc");
    expect(result.current.message).toContain("成功");
  });

  it("login failure returns null and shows error", async () => {
    mockLogin.mockResolvedValueOnce({ success: false, error: "Invalid credentials" });
    const { result } = renderHook(() => useAuth("zh"));

    let token: string | null = "not-null";
    await act(async () => {
      token = await result.current.login();
    });

    expect(token).toBeNull();
    expect(result.current.isLoggedIn).toBe(false);
    expect(result.current.message).toContain("Invalid credentials");
  });

  it("login with empty email/password shows validation message", async () => {
    const { result } = renderHook(() => useAuth("zh"));
    act(() => {
      result.current.updateCredentials({ email: "", password: "" });
    });

    let token: string | null = "not-null";
    await act(async () => {
      token = await result.current.login();
    });

    expect(token).toBeNull();
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it("register validates required fields", async () => {
    const { result } = renderHook(() => useAuth("zh"));
    act(() => {
      result.current.updateCredentials({ tenantName: "", displayName: "" });
    });

    let success = true;
    await act(async () => {
      success = await result.current.register();
    });

    expect(success).toBe(false);
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it("register success returns true", async () => {
    mockRegister.mockResolvedValueOnce({ success: true });
    const { result } = renderHook(() => useAuth("zh"));
    act(() => {
      result.current.updateCredentials({
        tenantName: "Demo Corp",
        displayName: "Test User",
      });
    });

    let success = false;
    await act(async () => {
      success = await result.current.register();
    });

    expect(success).toBe(true);
    expect(mockRegister).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantCode: "demo",
        email: "owner@demo.com",
        tenantName: "Demo Corp",
        displayName: "Test User",
      }),
    );
  });

  it("register handles already-registered gracefully", async () => {
    mockRegister.mockResolvedValueOnce({ success: false, error: "Already registered" });
    const { result } = renderHook(() => useAuth("zh"));
    act(() => {
      result.current.updateCredentials({ tenantName: "Demo Corp", displayName: "Test" });
    });

    let success = false;
    await act(async () => {
      success = await result.current.register();
    });

    expect(success).toBe(true);
  });

  it("logout clears token", async () => {
    mockLogin.mockResolvedValueOnce({ success: true, token: "jwt-abc" });
    const { result } = renderHook(() => useAuth("zh"));

    await act(async () => {
      await result.current.login();
    });
    expect(result.current.isLoggedIn).toBe(true);

    act(() => {
      result.current.logout();
    });
    expect(result.current.isLoggedIn).toBe(false);
    expect(result.current.token).toBe("");
  });

  it("ensureSession returns token when logged in", async () => {
    mockLogin.mockResolvedValueOnce({ success: true, token: "jwt-abc" });
    const { result } = renderHook(() => useAuth("zh"));

    await act(async () => {
      await result.current.login();
    });

    let session: string | null = null;
    await act(async () => {
      session = await result.current.ensureSession();
    });

    expect(session).toBe("jwt-abc");
  });

  it("ensureSession returns null when not logged in", async () => {
    const { result } = renderHook(() => useAuth("zh"));

    let session: string | null = "not-null";
    await act(async () => {
      session = await result.current.ensureSession();
    });

    expect(session).toBeNull();
  });

  it("getRequestOptions includes token and tenantCode", async () => {
    mockLogin.mockResolvedValueOnce({ success: true, token: "jwt-abc", tenantCode: "demo" });
    const { result } = renderHook(() => useAuth("zh"));

    await act(async () => {
      await result.current.login();
    });

    const opts = result.current.getRequestOptions();
    expect(opts.token).toBe("jwt-abc");
    expect(opts.tenantCode).toBe("demo");
  });

  it("japanese locale shows jp messages", async () => {
    const { result } = renderHook(() => useAuth("ja"));
    expect(result.current.message).toContain("ログイン");
  });

  it("login network error shows error message", async () => {
    mockLogin.mockRejectedValueOnce(new Error("Network error"));
    const { result } = renderHook(() => useAuth("zh"));

    await act(async () => {
      await result.current.login();
    });

    expect(result.current.isLoggedIn).toBe(false);
    expect(result.current.message).toContain("Network error");
  });
});
