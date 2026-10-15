"use client";

import { useCallback, useEffect, useState } from "react";
import type { UiLang, NativeLang, TargetLang, LangConfig } from "../types";
import { readStoredWebAppSession, updateStoredWebAppSession } from "../lib/app-session-storage";

const STORAGE_KEY = "langboost-lang-config";

/** UI languages offered. English UI is for English speakers learning Japanese. */
export const SELECTABLE_UI_LANGS: readonly UiLang[] = ["zh", "ja", "en"] as const;

/** Defaults: learning English (TOEIC) with a Chinese UI. */
function defaultConfig(): LangConfig {
  return { uiLang: "zh", nativeLang: "zh", targetLang: "en" };
}

/**
 * UI (= explanation) languages allowed per learning target:
 * - learning English: 中文 / 日本語 (explanations need a language other than the target)
 * - learning Japanese: 中文 / English
 */
export function allowedUiLangs(targetLang: TargetLang): UiLang[] {
  return targetLang === "ja" ? ["zh", "en"] : ["zh", "ja"];
}

/**
 * Normalise any stored/requested config into a sensible combination:
 * - combinations outside allowedUiLangs() fall back to Chinese
 * - nativeLang always follows the UI language
 */
export function sanitizeLangConfig(cfg: Partial<LangConfig> | null | undefined): LangConfig {
  const targetLang: TargetLang = cfg?.targetLang === "ja" ? "ja" : "en";
  let uiLang: UiLang = cfg?.uiLang === "ja" || cfg?.uiLang === "en" ? cfg.uiLang : "zh";
  if (!allowedUiLangs(targetLang).includes(uiLang)) uiLang = "zh";
  return { uiLang, nativeLang: uiLang as NativeLang, targetLang };
}

function loadConfig(): LangConfig {
  if (typeof window === "undefined") return defaultConfig();
  const storedSession = readStoredWebAppSession();
  if (storedSession.uiLang && storedSession.targetLang) {
    return sanitizeLangConfig({ uiLang: storedSession.uiLang, targetLang: storedSession.targetLang });
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultConfig();
    const parsed = JSON.parse(raw);
    if (parsed.uiLang && parsed.nativeLang && parsed.targetLang) {
      return sanitizeLangConfig(parsed as LangConfig);
    }
  } catch { /* ignore corrupt data */ }
  return defaultConfig();
}

function saveConfig(cfg: LangConfig) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  updateStoredWebAppSession({
    uiLang: cfg.uiLang,
    targetLang: cfg.targetLang,
  });
}

/**
 * Hook to manage the three-dimensional language configuration.
 *
 * Returns the current config + setters for each dimension.
 * Changes are persisted to localStorage automatically.
 *
 * **Migration note**: Components still using the old `locale: Locale` prop
 * can derive it via `langConfig.uiLang as Locale` (safe as long as uiLang is zh | ja).
 */
export function useLangConfig() {
  const [config, setConfig] = useState<LangConfig>(defaultConfig);
  const [isFirstVisit, setIsFirstVisit] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  // Hydrate from localStorage after mount (avoid SSR mismatch)
  useEffect(() => {
    if (typeof window !== "undefined" && !localStorage.getItem(STORAGE_KEY)) {
      setIsFirstVisit(true);
    }
    const loaded = loadConfig();
    setConfig(loaded);
    // Migrate legacy/invalid stored combinations in place.
    if (localStorage.getItem(STORAGE_KEY)) saveConfig(loaded);
    setIsHydrated(true);
  }, []);

  const setUiLang = useCallback((uiLang: UiLang) => {
    setConfig((prev) => {
      // Sync nativeLang with uiLang — most users' native language matches their UI preference
      const next = sanitizeLangConfig({ ...prev, uiLang });
      saveConfig(next);
      return next;
    });
  }, []);

  const setNativeLang = useCallback((nativeLang: NativeLang) => {
    setConfig((prev) => {
      const next = { ...prev, nativeLang: (prev.uiLang as NativeLang) ?? nativeLang };
      saveConfig(next);
      return next;
    });
  }, []);

  const setTargetLang = useCallback((targetLang: TargetLang) => {
    setConfig((prev) => {
      const next = sanitizeLangConfig({ ...prev, targetLang });
      saveConfig(next);
      return next;
    });
  }, []);

  /** Convenience: set whole config at once (e.g. from Settings form). */
  const setLangConfig = useCallback((cfg: LangConfig) => {
    const next = sanitizeLangConfig(cfg);
    setConfig(next);
    saveConfig(next);
  }, []);

  /** Backward-compatible locale getter for legacy components. */
  const locale = (config.uiLang === "ja" ? "ja" : "zh") as "zh" | "ja";

  return {
    langConfig: config,
    locale,
    isFirstVisit,
    isHydrated,
    setIsFirstVisit,
    setUiLang,
    setNativeLang,
    setTargetLang,
    setLangConfig,
  };
}
