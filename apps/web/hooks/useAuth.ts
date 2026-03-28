"use client";

import { useState, useMemo, useCallback, useRef } from "react";
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

const DEFAULT_CREDENTIALS: AuthCredentials = {
  tenantCode: "demo",
  tenantName: "",
  email: "owner@demo.com",
  password: "toeic123",
  displayName: "",
};

export function useAuth() {
  const tenantCodeRef = useRef<string>(DEFAULT_CREDENTIALS.tenantCode);
  const [token, setToken] = useState<string>("");
  const [credentials, setCredentials] = useState<AuthCredentials>(DEFAULT_CREDENTIALS);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string>("请先登录。首次使用可先注册账号。");

  const isLoggedIn = Boolean(token);
  const authHeader = useMemo(() => (token ? `Bearer ${token}` : null), [token]);

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
        if (!silent) setMessage("请完整填写租户、姓名、邮箱和密码。");
        return false;
      }
      setIsSubmitting(true);
      try {
        try {
          const result = await api.register(normalized);
          if (!result.success) {
            if ((result.error ?? "").toLowerCase().includes("already registered")) {
              if (!silent) setMessage("账号已存在，正在直接登录。");
              return true;
            }
            if (!silent) setMessage(`注册失败: ${result.error}`);
            return false;
          }
          if (!silent) setMessage("注册成功，请继续登录。");
          return true;
        } catch (error) {
          if (!silent) {
            setMessage(
              `注册请求失败，请确认服务已启动（API: http://127.0.0.1:8001）。${error instanceof Error ? ` ${error.message}` : ""}`.trim(),
            );
          }
          return false;
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [credentials]
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
        if (!silent) setMessage("请先填写邮箱和密码。");
        return null;
      }
      setIsSubmitting(true);
      try {
        try {
          const result = await api.login(normalized);
          if (!result.success || !result.token) {
            if (!silent) setMessage(`登录失败: ${result.error}`);
            return null;
          }
          const resolvedTenantCode = result.tenantCode ?? normalizedTenantCode;
          if (resolvedTenantCode) {
            tenantCodeRef.current = resolvedTenantCode;
            setCredentials((prev) => ({ ...prev, tenantCode: resolvedTenantCode }));
          }
          setToken(result.token);
          if (!silent) setMessage("登录成功。");
          return result.token;
        } catch (error) {
          if (!silent) {
            setMessage(
              `登录请求失败，请确认服务已启动（API: http://127.0.0.1:8001）。${error instanceof Error ? ` ${error.message}` : ""}`.trim(),
            );
          }
          return null;
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [credentials]
  );

  const ensureSession = useCallback(async (): Promise<string | null> => {
    if (token) return token;
    setMessage("请先登录后再开始训练。");
    return null;
  }, [token]);

  const logout = useCallback(() => {
    setToken("");
    setMessage("已退出登录。请使用账号重新登录。");
  }, []);

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
    logout,
    ensureSession,
    getRequestOptions,
  };
}
