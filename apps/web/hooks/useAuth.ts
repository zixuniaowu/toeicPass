"use client";

import { useState, useMemo, useCallback } from "react";
import * as api from "../lib/api";

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

export function useAuth() {
  const [token, setToken] = useState<string>("");
  const [credentials, setCredentials] = useState<AuthCredentials>({
    tenantCode: "demo",
    tenantName: "Demo Org",
    email: "owner@demo.com",
    password: "toeic123",
    displayName: "Owner",
  });
  const [message, setMessage] = useState<string>("先做一次听力或阅读练习，系统会开始生成真实数据。");

  const isLoggedIn = Boolean(token);
  const authHeader = useMemo(() => (token ? `Bearer ${token}` : null), [token]);

  const updateCredentials = useCallback((updates: Partial<AuthCredentials>) => {
    setCredentials((prev) => ({ ...prev, ...updates }));
  }, []);

  const register = useCallback(
    async (silent = false): Promise<boolean> => {
      const result = await api.register(credentials);
      if (!result.success) {
        if (!silent) setMessage(`注册失败: ${result.error}`);
        return false;
      }
      if (!silent) setMessage("注册成功，请登录。登录后会自动同步学习数据。");
      return true;
    },
    [credentials]
  );

  const login = useCallback(
    async (silent = false): Promise<string | null> => {
      const result = await api.login({
        tenantCode: credentials.tenantCode,
        email: credentials.email,
        password: credentials.password,
      });
      if (!result.success) {
        if (!silent) setMessage(`登录失败: ${result.error}`);
        return null;
      }
      setToken(result.token!);
      if (!silent) setMessage("登录成功，已准备好开始训练。");
      return result.token!;
    },
    [credentials]
  );

  const ensureSession = useCallback(async (): Promise<string | null> => {
    if (token) return token;

    const normalizedTenantCode = credentials.tenantCode.trim() || "demo";
    const normalizedTenantName = credentials.tenantName.trim() || "Demo Org";

    // Try login first
    let loginResult = await api.login({
      tenantCode: normalizedTenantCode,
      email: credentials.email,
      password: credentials.password,
    });

    if (!loginResult.success) {
      // Try register then login
      await api.register({
        tenantCode: normalizedTenantCode,
        tenantName: normalizedTenantName,
        email: credentials.email,
        password: credentials.password,
        displayName: credentials.displayName,
      });
      loginResult = await api.login({
        tenantCode: normalizedTenantCode,
        email: credentials.email,
        password: credentials.password,
      });
    }

    if (loginResult.success && loginResult.token) {
      setToken(loginResult.token);
      setMessage("已自动进入体验模式。");
      return loginResult.token;
    }

    // Fallback: create new demo account
    const fallbackEmail = `autodemo+${Date.now()}@example.com`;
    const fallbackCredentials = {
      tenantCode: normalizedTenantCode,
      tenantName: normalizedTenantName,
      email: fallbackEmail,
      password: "toeic123",
      displayName: "Auto Demo",
    };

    await api.register(fallbackCredentials);
    loginResult = await api.login({
      tenantCode: fallbackCredentials.tenantCode,
      email: fallbackCredentials.email,
      password: fallbackCredentials.password,
    });

    if (!loginResult.success || !loginResult.token) {
      setMessage("自动体验登录失败，请确认 API 端口 8001 正常。");
      return null;
    }

    setCredentials({
      tenantCode: fallbackCredentials.tenantCode,
      tenantName: fallbackCredentials.tenantName,
      email: fallbackCredentials.email,
      password: fallbackCredentials.password,
      displayName: fallbackCredentials.displayName,
    });
    setToken(loginResult.token);
    setMessage("已自动创建体验账号并登录。");
    return loginResult.token;
  }, [token, credentials]);

  const getRequestOptions = useCallback(
    (sessionToken?: string) => ({
      token: sessionToken ?? token,
      tenantCode: credentials.tenantCode,
    }),
    [token, credentials.tenantCode]
  );

  return {
    token,
    credentials,
    isLoggedIn,
    authHeader,
    message,
    setMessage,
    updateCredentials,
    register,
    login,
    ensureSession,
    getRequestOptions,
  };
}
