import type { TargetLang, UiLang } from "./types";
import { normalizeApiBase, type RequestOptions } from "./api";

export type AppSession = {
  token: string;
  tenantCode: string;
  email: string;
  uiLang: UiLang;
  targetLang: TargetLang;
  apiBase?: string;
};

export type SessionStore = {
  getItem(key: string): Promise<string | null> | string | null;
  setItem(key: string, value: string): Promise<void> | void;
  removeItem(key: string): Promise<void> | void;
};

export const DEFAULT_APP_SESSION_STORAGE_KEY = "toeicpass.app.session";
export const DEFAULT_APP_API_BASE_STORAGE_KEY = "toeicpass.app.apiBase";

function isUiLang(value: unknown): value is UiLang {
  return value === "zh" || value === "ja" || value === "en";
}

function isTargetLang(value: unknown): value is TargetLang {
  return value === "en" || value === "ja";
}

function isAppSession(value: unknown): value is AppSession {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<AppSession>;
  return (
    typeof candidate.token === "string" &&
    typeof candidate.tenantCode === "string" &&
    typeof candidate.email === "string" &&
    (typeof candidate.apiBase === "undefined" || typeof candidate.apiBase === "string") &&
    isUiLang(candidate.uiLang) &&
    isTargetLang(candidate.targetLang)
  );
}

export function normalizeAppSession(session: AppSession): AppSession {
  return {
    token: session.token.trim(),
    tenantCode: session.tenantCode.trim(),
    email: session.email.trim().toLowerCase(),
    uiLang: session.uiLang,
    targetLang: session.targetLang,
    ...(session.apiBase?.trim() ? { apiBase: normalizeApiBase(session.apiBase) } : {}),
  };
}

export function parseStoredAppSession(raw: string | null | undefined): AppSession | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    return isAppSession(parsed) ? normalizeAppSession(parsed) : null;
  } catch {
    return null;
  }
}

export function serializeAppSession(session: AppSession): string {
  return JSON.stringify(normalizeAppSession(session));
}

export async function loadStoredAppSession(
  store: SessionStore,
  storageKey = DEFAULT_APP_SESSION_STORAGE_KEY,
): Promise<AppSession | null> {
  const raw = await store.getItem(storageKey);
  return parseStoredAppSession(raw);
}

export async function saveStoredAppSession(
  store: SessionStore,
  session: AppSession,
  storageKey = DEFAULT_APP_SESSION_STORAGE_KEY,
): Promise<void> {
  await store.setItem(storageKey, serializeAppSession(session));
}

export async function clearStoredAppSession(
  store: SessionStore,
  storageKey = DEFAULT_APP_SESSION_STORAGE_KEY,
): Promise<void> {
  await store.removeItem(storageKey);
}

export async function loadStoredAppApiBase(
  store: SessionStore,
  storageKey = DEFAULT_APP_API_BASE_STORAGE_KEY,
): Promise<string | null> {
  const raw = await store.getItem(storageKey);
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return null;
  }
  return normalizeApiBase(raw);
}

export async function saveStoredAppApiBase(
  store: SessionStore,
  apiBase: string,
  storageKey = DEFAULT_APP_API_BASE_STORAGE_KEY,
): Promise<void> {
  await store.setItem(storageKey, normalizeApiBase(apiBase));
}

export async function clearStoredAppApiBase(
  store: SessionStore,
  storageKey = DEFAULT_APP_API_BASE_STORAGE_KEY,
): Promise<void> {
  await store.removeItem(storageKey);
}

export function createSessionRequestOptions(
  session: Pick<AppSession, "token" | "tenantCode" | "apiBase"> | null | undefined,
): RequestOptions {
  return {
    token: session?.token?.trim() ?? "",
    tenantCode: session?.tenantCode?.trim() ?? "",
    apiBase: session?.apiBase?.trim() ? normalizeApiBase(session.apiBase) : "",
  };
}
