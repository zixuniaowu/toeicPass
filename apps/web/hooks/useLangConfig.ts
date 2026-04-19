"use client";

import { useCallback, useEffect, useState } from "react";
import type { UiLang, NativeLang, TargetLang, LangConfig } from "../types";

const STORAGE_KEY = "langboost-lang-config";

/** Derive sensible defaults: uiLang ↔ nativeLang, targetLang always the "other" language. */
function defaultConfig(): LangConfig {
  return { uiLang: "ja", nativeLang: "ja", targetLang: "en" };
}

function loadConfig(): LangConfig {
  if (typeof window === "undefined") return defaultConfig();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultConfig();
    const parsed = JSON.parse(raw);
    if (parsed.uiLang && parsed.nativeLang && parsed.targetLang) {
      return parsed as LangConfig;
    }
  } catch { /* ignore corrupt data */ }
  return defaultConfig();
}

function saveConfig(cfg: LangConfig) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
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

  // Hydrate from localStorage after mount (avoid SSR mismatch)
  useEffect(() => {
    if (typeof window !== "undefined" && !localStorage.getItem(STORAGE_KEY)) {
      setIsFirstVisit(true);
    }
    setConfig(loadConfig());
  }, []);

  const setUiLang = useCallback((uiLang: UiLang) => {
    setConfig((prev) => {
      // Sync nativeLang with uiLang — most users' native language matches their UI preference
      const next = { ...prev, uiLang, nativeLang: uiLang as NativeLang };
      saveConfig(next);
      return next;
    });
  }, []);

  const setNativeLang = useCallback((nativeLang: NativeLang) => {
    setConfig((prev) => {
      const next = { ...prev, nativeLang };
      saveConfig(next);
      return next;
    });
  }, []);

  const setTargetLang = useCallback((targetLang: TargetLang) => {
    setConfig((prev) => {
      const next = { ...prev, targetLang };
      saveConfig(next);
      return next;
    });
  }, []);

  /** Convenience: set whole config at once (e.g. from Settings form). */
  const setLangConfig = useCallback((cfg: LangConfig) => {
    setConfig(cfg);
    saveConfig(cfg);
  }, []);

  /** Backward-compatible locale getter for legacy components. */
  const locale = (config.uiLang === "en" ? "ja" : config.uiLang) as "zh" | "ja";

  return {
    langConfig: config,
    locale,
    isFirstVisit,
    setIsFirstVisit,
    setUiLang,
    setNativeLang,
    setTargetLang,
    setLangConfig,
  };
}
