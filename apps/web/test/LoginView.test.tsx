import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { LoginView } from "../components/auth/LoginView";
import type { AuthCredentials } from "../hooks/useAuth";

const defaultCredentials: AuthCredentials = {
  tenantCode: "",
  tenantName: "",
  email: "user@example.com",
  password: "pass123",
  displayName: "",
};

const mockOnCredentialsChange = vi.fn();
const mockOnLogin = vi.fn();
const mockOnRegister = vi.fn();
const mockOnLocaleChange = vi.fn();

function renderLogin(overrides: Record<string, unknown> = {}) {
  const props = {
    locale: "zh" as const,
    credentials: defaultCredentials,
    isSubmitting: false,
    message: "",
    onCredentialsChange: mockOnCredentialsChange,
    onLogin: mockOnLogin,
    onRegister: mockOnRegister,
    onLocaleChange: mockOnLocaleChange,
    ...overrides,
  };
  return render(<LoginView {...props} />);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("LoginView", () => {
  it("renders email and password fields with values", () => {
    renderLogin();

    const emailInput = screen.getByLabelText("Email") as HTMLInputElement;
    expect(emailInput.value).toBe("user@example.com");

    const passwordInput = screen.getByLabelText("Password") as HTMLInputElement;
    expect(passwordInput.value).toBe("pass123");
  });

  it("calls onCredentialsChange when email changes", () => {
    renderLogin();

    const emailInput = screen.getByLabelText("Email");
    fireEvent.change(emailInput, { target: { value: "new@example.com" } });

    expect(mockOnCredentialsChange).toHaveBeenCalledWith({ email: "new@example.com" });
  });

  it("calls onCredentialsChange when password changes", () => {
    renderLogin();

    const passwordInput = screen.getByLabelText("Password");
    fireEvent.change(passwordInput, { target: { value: "newpass" } });

    expect(mockOnCredentialsChange).toHaveBeenCalledWith({ password: "newpass" });
  });

  it("calls onLogin when login button clicked", () => {
    renderLogin();

    const loginButton = screen.getByRole("button", { name: "登录" });
    fireEvent.click(loginButton);

    expect(mockOnLogin).toHaveBeenCalledTimes(1);
  });

  it("shows loading text when isSubmitting is true", () => {
    renderLogin({ isSubmitting: true });

    const buttons = screen.getAllByRole("button", { name: /处理中/ });
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });

  it("displays message text", () => {
    renderLogin({ message: "Login failed" });

    expect(screen.getByText("Login failed")).toBeDefined();
  });

  it("renders locale switcher buttons", () => {
    renderLogin();

    expect(screen.getByText("中文")).toBeDefined();
    expect(screen.getByText("日本語")).toBeDefined();
  });

  it("calls onLocaleChange when locale button clicked", () => {
    renderLogin();

    fireEvent.click(screen.getByText("日本語"));

    expect(mockOnLocaleChange).toHaveBeenCalledWith("ja");
  });

  it("does not render locale switcher when onLocaleChange is undefined", () => {
    renderLogin({ onLocaleChange: undefined });

    expect(screen.queryByText("中文")).toBeNull();
    expect(screen.queryByText("日本語")).toBeNull();
  });

  it("renders brand title in Chinese locale", () => {
    renderLogin({ locale: "zh" });

    expect(screen.getByText("日语 · 英语 口语强化平台")).toBeDefined();
  });

  it("renders brand title in Japanese locale", () => {
    renderLogin({ locale: "ja" });

    expect(screen.getByText("日本語・英語 スピーキング強化")).toBeDefined();
  });

  it("renders feature list items", () => {
    renderLogin();

    expect(screen.getByText(/跟读训练/)).toBeDefined();
    expect(screen.getByText(/间隔重复词卡/)).toBeDefined();
  });

  it("renders stats section", () => {
    renderLogin();

    expect(screen.getByText("JP+EN")).toBeDefined();
    expect(screen.getByText("2000+")).toBeDefined();
    expect(screen.getByText("SRS")).toBeDefined();
  });

  it("renders form title", () => {
    renderLogin();

    expect(screen.getByText("登录 LangBoost")).toBeDefined();
  });

  it("renders Japanese form title when locale is ja", () => {
    renderLogin({ locale: "ja" });

    expect(screen.getByText("LangBoost ログイン")).toBeDefined();
  });
});
