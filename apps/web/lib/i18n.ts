/**
 * Lightweight i18n framework for LangBoost.
 *
 * Usage:
 *   import { createT } from "@/lib/i18n";
 *   const t = createT("zh");
 *   t("brand.title") // => "LangBoost"
 *   t("home.jumpMockPart", { part: 3 }) // => parameterised string
 */
import type { UiLang } from "../types";

import zhJSON from "../locales/zh.json";
import jaJSON from "../locales/ja.json";
import enJSON from "../locales/en.json";

export type TranslationMap = Record<string, string>;

const messages: Record<UiLang, TranslationMap> = {
  zh: zhJSON,
  ja: jaJSON,
  en: enJSON,
};

/**
 * Interpolate `{key}` placeholders in a template string.
 * @example interpolate("第 {idx} 题", { idx: 3 }) => "第 3 题"
 */
function interpolate(
  template: string,
  params: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, key) =>
    params[key] !== undefined ? String(params[key]) : `{${key}}`,
  );
}

/**
 * Create a translation function bound to a specific UI language.
 *
 * @param lang - The UI language to use for translations.
 * @returns A `t(key, params?)` function.
 *
 * If a key is missing in the target language it falls back to English,
 * then returns the raw key as a last resort.
 */
export function createT(lang: UiLang) {
  const primary = messages[lang] ?? messages.en;
  const fallback = messages.en;

  return function t(
    key: string,
    params?: Record<string, string | number>,
  ): string {
    const raw = primary[key] ?? fallback[key] ?? key;
    return params ? interpolate(raw, params) : raw;
  };
}

/** All supported UI languages for iteration (e.g. language pickers). */
export const UI_LANGS: readonly UiLang[] = ["zh", "ja", "en"] as const;
