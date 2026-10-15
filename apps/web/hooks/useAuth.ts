"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import type { Locale, TargetLang, UiLang } from "../types";
import { createT } from "@toeicpass/app-i18n";
import * as api from "../lib/api";
import { setOnUnauthorized } from "../lib/api";
import {
  persistStoredWebAppSession,
  readStoredWebAppSession,
  updateStoredWebAppSession,
} from "../lib/app-session-storage";

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


export function useAuth(
  locale: UiLang,
  sessionLang?: { uiLang: UiLang; targetLang: TargetLang },
) {
  const t = useMemo(() => createT(locale), [locale]);
  const storedSession = readStoredWebAppSession();
  const tenantCodeRef = useRef<string>(storedSession.tenantCode || DEFAULT_CREDENTIALS.tenantCode);
  const [token, setToken] = useState<string>(storedSession.token);
  const [credentials, setCredentials] = useState<AuthCredentials>(() => ({
    ...DEFAULT_CREDENTIALS,
    tenantCode: storedSession.tenantCode || DEFAULT_CREDENTIALS.tenantCode,
    email: storedSession.email || DEFAULT_CREDENTIALS.email,
  }));
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Empty = show the default "please log in" prompt, derived in the current UI language.
  const [rawMessage, setMessage] = useState<string>("");

  const isLoggedIn = Boolean(token);
  const authHeader = useMemo(() => (token ? `Bearer ${token}` : null), [token]);

  useEffect(() => {
    persistStoredWebAppSession({
      token,
      tenantCode: tenantCodeRef.current || credentials.tenantCode || DEFAULT_CREDENTIALS.tenantCode,
      email: credentials.email || DEFAULT_CREDENTIALS.email,
      uiLang: sessionLang?.uiLang ?? storedSession.uiLang,
      targetLang: sessionLang?.targetLang ?? storedSession.targetLang,
    });
  }, [credentials.email, credentials.tenantCode, sessionLang?.targetLang, sessionLang?.uiLang, storedSession.targetLang, storedSession.uiLang, token]);

  useEffect(() => {
    if (!token) setMessage("");
  }, [locale, token]);
  const message = rawMessage || (token ? "" : t("auth.pleaseLogin"));

  const updateCredentials = useCallback((updates: Partial<AuthCredentials>) => {
    if (typeof updates.tenantCode === "string") {
      tenantCodeRef.current = updates.tenantCode.trim();
      updateStoredWebAppSession({ tenantCode: updates.tenantCode.trim() });
    }
    if (typeof updates.email === "string") {
      updateStoredWebAppSession({ email: updates.email.trim().toLowerCase() });
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
        if (!silent) setMessage(t("auth.fillAllFields"));
        return false;
      }
      setIsSubmitting(true);
      try {
        try {
          const result = await api.register(normalized);
          if (!result.success) {
            if ((result.error ?? "").toLowerCase().includes("already registered")) {
              if (!silent) setMessage(t("auth.accountExists"));
              return true;
            }
            if (!silent) setMessage(t("auth.registerFailed", { error: result.error ?? "" }));
            return false;
          }
          if (!silent) setMessage(t("auth.registerSuccess"));
          return true;
        } catch (error) {
          if (!silent) {
            setMessage(
              t("auth.registerRequestFailed", { detail: error instanceof Error ? ` ${error.message}` : "" }).trim(),
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
        if (!silent) setMessage(t("auth.fillEmailPassword"));
        return null;
      }
      setIsSubmitting(true);
      try {
        try {
          const result = await api.login(normalized);
          if (!result.success || !result.token) {
            if (!silent) setMessage(t("auth.loginFailed", { error: result.error ?? "" }));
            return null;
          }
          const resolvedTenantCode = result.tenantCode ?? normalizedTenantCode;
          if (resolvedTenantCode) {
            tenantCodeRef.current = resolvedTenantCode;
            setCredentials((prev) => ({ ...prev, tenantCode: resolvedTenantCode }));
            updateStoredWebAppSession({ tenantCode: resolvedTenantCode });
          }
          setToken(result.token);
          if (!silent) setMessage(t("auth.loginSuccess"));
          return result.token;
        } catch (error) {
          if (!silent) {
            setMessage(
              t("auth.loginRequestFailed", { detail: error instanceof Error ? ` ${error.message}` : "" }).trim(),
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
    setMessage(t("auth.loginToStart"));
    return null;
  }, [locale, token]);

  const logout = useCallback(() => {
    setToken("");
    updateStoredWebAppSession({ token: "" });
    setMessage(t("auth.loggedOut"));
  }, [locale]);

  // Auto-logout on 401 Unauthorized responses from the API layer
  useEffect(() => {
    setOnUnauthorized(() => {
      setToken("");
      updateStoredWebAppSession({ token: "" });
      setMessage(t("auth.sessionExpired"));
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
          setMessage(t("auth.providerLoginFailed", { provider: providerLabel, error: result.error ?? "" }));
          return null;
        }
        const resolvedTenantCode = result.tenantCode ?? credentials.tenantCode.trim();
        if (resolvedTenantCode) {
          tenantCodeRef.current = resolvedTenantCode;
          setCredentials((prev) => ({ ...prev, tenantCode: resolvedTenantCode }));
          updateStoredWebAppSession({ tenantCode: resolvedTenantCode });
        }
        setToken(result.token);
        setMessage(t("auth.providerLoginSuccess", { provider: providerLabel }));
        return result.token;
      } catch (error) {
        setMessage(
          t("auth.providerRequestFailed", { provider: providerLabel, detail: error instanceof Error ? ` ${error.message}` : "" }).trim(),
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
