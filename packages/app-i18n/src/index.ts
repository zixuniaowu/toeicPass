import { type UiLang } from "@toeicpass/shared";
export type { UiLang };

import enJSON from "./locales/en.json";
import jaJSON from "./locales/ja.json";
import zhJSON from "./locales/zh.json";

export type TranslationMap = Record<string, string>;

export const messages: Record<UiLang, TranslationMap> = {
  zh: zhJSON,
  ja: jaJSON,
  en: enJSON,
};

function interpolate(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) =>
    params[key] !== undefined ? String(params[key]) : `{${key}}`,
  );
}

export function createT(lang: UiLang) {
  const primary = messages[lang] ?? messages.en;
  const fallback = messages.en;

  return function t(key: string, params?: Record<string, string | number>): string {
    const raw = primary[key] ?? fallback[key] ?? key;
    return params ? interpolate(raw, params) : raw;
  };
}

export const UI_LANGS: readonly UiLang[] = ["zh", "ja", "en"] as const;
