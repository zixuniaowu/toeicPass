"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import type { Locale } from "../types";
import * as api from "../lib/api";
import { setOnUnauthorized } from "../lib/api";

export type AuthCredentials = {
  tenantCode: string;
  tenantName: string;
  email: string;
  password: string;
  displayName: string;
};

export type AuthState = {
  token: string;
  credentials: AuthCredentials;
  isLoggedIn: boolean;
};

const DEFAULT_CREDENTIALS: AuthCredentials = {
  tenantCode: "demo",
  tenantName: "",
  email: "owner@demo.com",
  password: "toeic123",
  displayName: "",
};

const byLocale = (locale: Locale, zh: string, ja: string) => (locale === "ja" ? ja : zh);

const STORAGE_KEY_TOKEN = "lb.token";
const STORAGE_KEY_TENANT = "lb.tenantCode";

function safeGetItem(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

function safeSetItem(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* noop */ }
}

function safeRemoveItem(key: string): void {
  try { localStorage.removeItem(key); } catch { /* noop */ }
}

function loadStoredToken(): string {
  if (typeof window === "undefined") return "";
  return safeGetItem(STORAGE_KEY_TOKEN) ?? "";
}

function loadStoredTenant(): string {
  if (typeof window === "undefined") return DEFAULT_CREDENTIALS.tenantCode;
  return safeGetItem(STORAGE_KEY_TENANT) ?? DEFAULT_CREDENTIALS.tenantCode;
}

export function useAuth(locale: Locale) {
  const tenantCodeRef = useRef<string>(loadStoredTenant());
  const [token, setToken] = useState<string>(loadStoredToken);
  const [credentials, setCredentials] = useState<AuthCredentials>(() => ({
    ...DEFAULT_CREDENTIALS,
    tenantCode: loadStoredTenant(),
  }));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string>(
    byLocale(locale, "请先登录。首次使用可先注册账号。", "先にログインしてください。初回は登録から開始できます。"),
  );

  const isLoggedIn = Boolean(token);
  const authHeader = useMemo(() => (token ? `Bearer ${token}` : null), [token]);

  // Persist token to localStorage
  useEffect(() => {
    if (token) {
      safeSetItem(STORAGE_KEY_TOKEN, token);
    } else {
      safeRemoveItem(STORAGE_KEY_TOKEN);
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
      setMessage(byLocale(locale, "请先登录。首次使用可先注册账号。", "先にログインしてください。初回は登録から開始できます。"));
    }
  }, [locale, token]);

  const updateCredentials = useCallback((updates: Partial<AuthCredentials>) => {
    if (typeof updates.tenantCode === "string") {
      tenantCodeRef.current = updates.tenantCode.trim();
    }
    setCredentials((prev) => ({ ...prev, ...updates }));
  }, []);

  const register = useCallback(
    async (silent = false): Promise<boolean> => {
      const normalized: AuthCredentials = {
        tenantCode: credentials.tenantCode.trim(),
        tenantName: credentials.tenantName.trim(),
        email: credentials.email.trim().toLowerCase(),
        password: credentials.password,
        displayName: credentials.displayName.trim(),
      };
      if (!normalized.tenantCode || !normalized.tenantName || !normalized.email || !normalized.password || !normalized.displayName) {
        if (!silent) setMessage(byLocale(locale, "请完整填写租户、姓名、邮箱和密码。", "テナント・氏名・メール・パスワードをすべて入力してください。"));
        return false;
      }
      setIsSubmitting(true);
      try {
        try {
          const result = await api.register(normalized);
          if (!result.success) {
            if ((result.error ?? "").toLowerCase().includes("already registered")) {
              if (!silent) setMessage(byLocale(locale, "账号已存在，正在直接登录。", "アカウントは既に存在します。直接ログインします。"));
              return true;
            }
            if (!silent) setMessage(byLocale(locale, `注册失败: ${result.error}`, `登録失敗: ${result.error}`));
            return false;
          }
          if (!silent) setMessage(byLocale(locale, "注册成功，请继续登录。", "登録が完了しました。続けてログインしてください。"));
          return true;
        } catch (error) {
          if (!silent) {
            setMessage(
              byLocale(
                locale,
                `注册请求失败，请确认服务已启动（API: http://127.0.0.1:8001）。${error instanceof Error ? ` ${error.message}` : ""}`.trim(),
                `登録リクエストに失敗しました。サービス起動を確認してください（API: http://127.0.0.1:8001）。${error instanceof Error ? ` ${error.message}` : ""}`.trim(),
              ),
            );
          }
          return false;
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [credentials, locale]
  );

  const login = useCallback(
    async (silent = false): Promise<string | null> => {
      const normalizedTenantCode = credentials.tenantCode.trim();
      const normalized = {
        ...(normalizedTenantCode ? { tenantCode: normalizedTenantCode } : {}),
        email: credentials.email.trim().toLowerCase(),
        password: credentials.password,
      };
      if (!normalized.email || !normalized.password) {
        if (!silent) setMessage(byLocale(locale, "请先填写邮箱和密码。", "メールアドレスとパスワードを入力してください。"));
        return null;
      }
      setIsSubmitting(true);
      try {
        try {
          const result = await api.login(normalized);
          if (!result.success || !result.token) {
            if (!silent) setMessage(byLocale(locale, `登录失败: ${result.error}`, `ログイン失敗: ${result.error}`));
            return null;
          }
          const resolvedTenantCode = result.tenantCode ?? normalizedTenantCode;
          if (resolvedTenantCode) {
            tenantCodeRef.current = resolvedTenantCode;
            setCredentials((prev) => ({ ...prev, tenantCode: resolvedTenantCode }));
            safeSetItem(STORAGE_KEY_TENANT, resolvedTenantCode);
          }
          setToken(result.token);
          if (!silent) setMessage(byLocale(locale, "登录成功。", "ログイン成功。"));
          return result.token;
        } catch (error) {
          if (!silent) {
            setMessage(
              byLocale(
                locale,
                `登录请求失败，请确认服务已启动（API: http://127.0.0.1:8001）。${error instanceof Error ? ` ${error.message}` : ""}`.trim(),
                `ログインリクエストに失敗しました。サービス起動を確認してください（API: http://127.0.0.1:8001）。${error instanceof Error ? ` ${error.message}` : ""}`.trim(),
              ),
            );
          }
          return null;
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [credentials, locale]
  );

  const ensureSession = useCallback(async (): Promise<string | null> => {
    if (token) return token;
    setMessage(byLocale(locale, "请先登录后再开始训练。", "先にログインしてから学習を開始してください。"));
    return null;
  }, [locale, token]);

  const logout = useCallback(() => {
    setToken("");
    safeRemoveItem(STORAGE_KEY_TOKEN);
    safeRemoveItem(STORAGE_KEY_TENANT);
    setMessage(byLocale(locale, "已退出登录。请使用账号重新登录。", "ログアウトしました。アカウントで再ログインしてください。"));
  }, [locale]);

  // Auto-logout on 401 Unauthorized responses from the API layer
  useEffect(() => {
    setOnUnauthorized(() => {
      setToken("");
      safeRemoveItem(STORAGE_KEY_TOKEN);
      safeRemoveItem(STORAGE_KEY_TENANT);
      setMessage(byLocale(locale, "登录已过期，请重新登录。", "セッションの有効期限が切れました。再ログインしてください。"));
    });
    return () => setOnUnauthorized(null);
  }, [locale]);

  const googleLogin = useCallback(
    async (code: string, redirectUri: string, provider = "google"): Promise<string | null> => {
      setIsSubmitting(true);
      const providerLabel = provider === "wechat" ? "WeChat" : provider === "line" ? "LINE" : "Google";
      try {
        const result = await api.oauthLogin({
          provider,
          code,
          redirectUri,
          tenantCode: credentials.tenantCode.trim() || undefined,
        });
        if (!result.success || !result.token) {
          setMessage(byLocale(locale, `${providerLabel} 登录失败: ${result.error}`, `${providerLabel} ログイン失敗: ${result.error}`));
          return null;
        }
        const resolvedTenantCode = result.tenantCode ?? credentials.tenantCode.trim();
        if (resolvedTenantCode) {
          tenantCodeRef.current = resolvedTenantCode;
          setCredentials((prev) => ({ ...prev, tenantCode: resolvedTenantCode }));
          safeSetItem(STORAGE_KEY_TENANT, resolvedTenantCode);
        }
        setToken(result.token);
        setMessage(byLocale(locale, `${providerLabel} 登录成功。`, `${providerLabel} ログインに成功しました。`));
        return result.token;
      } catch (error) {
        setMessage(
          byLocale(
            locale,
            `${providerLabel} 登录请求失败。${error instanceof Error ? ` ${error.message}` : ""}`.trim(),
            `${providerLabel} ログインリクエストに失敗しました。${error instanceof Error ? ` ${error.message}` : ""}`.trim(),
          ),
        );
        return null;
      } finally {
        setIsSubmitting(false);
      }
    },
    [credentials.tenantCode, locale],
  );

  const getRequestOptions = useCallback(
    (sessionToken?: string) => ({
      token: sessionToken ?? token,
      tenantCode: tenantCodeRef.current || credentials.tenantCode,
    }),
    [token, credentials.tenantCode]
  );

  return {
    token,
    credentials,
    isLoggedIn,
    isSubmitting,
    authHeader,
    message,
    setMessage,
    updateCredentials,
    register,
    login,
    googleLogin,
    logout,
    ensureSession,
    getRequestOptions,
  };
}
