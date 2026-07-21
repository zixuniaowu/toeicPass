"use client";

import {
  DEFAULT_APP_SESSION_STORAGE_KEY,
  normalizeAppSession,
  parseStoredAppSession,
  serializeAppSession,
  type AppSession,
} from "@toeicpass/app-core";
import type { LangConfig, TargetLang, UiLang } from "../types";

const LEGACY_TOKEN_KEY = "lb.token";
const LEGACY_TENANT_KEY = "lb.tenantCode";
const LEGACY_LANG_CONFIG_KEY = "langboost-lang-config";

export const DEFAULT_WEB_APP_SESSION: AppSession = {
  token: "",
  tenantCode: "demo",
  email: "owner@demo.com",
  uiLang: "ja",
  targetLang: "en",
};

function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore storage quota / privacy mode failures.
  }
}

function safeRemoveItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore storage quota / privacy mode failures.
  }
}

function isUiLang(value: unknown): value is UiLang {
  return value === "zh" || value === "ja" || value === "en";
}

function isTargetLang(value: unknown): value is TargetLang {
  return value === "en" || value === "ja";
}

function readLegacyLangConfig(): LangConfig {
  const fallback = {
    uiLang: DEFAULT_WEB_APP_SESSION.uiLang,
    nativeLang: DEFAULT_WEB_APP_SESSION.uiLang,
    targetLang: DEFAULT_WEB_APP_SESSION.targetLang,
  } as LangConfig;

  const raw = safeGetItem(LEGACY_LANG_CONFIG_KEY);
  if (!raw) {
    return fallback;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<LangConfig>;
    if (isUiLang(parsed.uiLang) && isTargetLang(parsed.targetLang)) {
      return {
        uiLang: parsed.uiLang,
        nativeLang: isUiLang(parsed.nativeLang) ? parsed.nativeLang : parsed.uiLang,
        targetLang: parsed.targetLang,
      };
    }
  } catch {
    // Ignore corrupt legacy payloads.
  }
  return fallback;
}

function buildLegacySession(): AppSession {
  const lang = readLegacyLangConfig();
  return normalizeAppSession({
    token: safeGetItem(LEGACY_TOKEN_KEY) ?? DEFAULT_WEB_APP_SESSION.token,
    tenantCode: safeGetItem(LEGACY_TENANT_KEY) ?? DEFAULT_WEB_APP_SESSION.tenantCode,
    email: DEFAULT_WEB_APP_SESSION.email,
    uiLang: lang.uiLang,
    targetLang: lang.targetLang,
  });
}

export function readStoredWebAppSession(): AppSession {
  if (typeof window === "undefined") {
    return DEFAULT_WEB_APP_SESSION;
  }
  const stored = parseStoredAppSession(safeGetItem(DEFAULT_APP_SESSION_STORAGE_KEY));
  return stored ?? buildLegacySession();
}

export function persistStoredWebAppSession(session: AppSession): AppSession {
  const normalized = normalizeAppSession(session);
  if (typeof window === "undefined") {
    return normalized;
  }

  safeSetItem(DEFAULT_APP_SESSION_STORAGE_KEY, serializeAppSession(normalized));

  if (normalized.token) {
    safeSetItem(LEGACY_TOKEN_KEY, normalized.token);
  } else {
    safeRemoveItem(LEGACY_TOKEN_KEY);
  }

  if (normalized.tenantCode) {
    safeSetItem(LEGACY_TENANT_KEY, normalized.tenantCode);
  } else {
    safeRemoveItem(LEGACY_TENANT_KEY);
  }

  const legacyLangConfig: LangConfig = {
    uiLang: normalized.uiLang,
    nativeLang: normalized.uiLang,
    targetLang: normalized.targetLang,
  };
  safeSetItem(LEGACY_LANG_CONFIG_KEY, JSON.stringify(legacyLangConfig));

  return normalized;
}

export function updateStoredWebAppSession(partial: Partial<AppSession>): AppSession {
  const current = readStoredWebAppSession();
  return persistStoredWebAppSession({
    ...current,
    ...partial,
  });
}
