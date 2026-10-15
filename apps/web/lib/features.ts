/**
 * Feature flags. The app focuses on shadowing & pronunciation; exam-style
 * features are hidden (code kept) and can be re-enabled here.
 */
import type { ViewTab } from "../types";

export const FEATURES = {
  shadowing: true,
  vocab: true,
  review: true,
  settings: true,
  conversation: false,
  mock: false,
  grammar: false,
  textcompletion: false,
  reading: false,
  listening: false,
  practice: false,
  writing: false,
  mistakes: false,
  subscription: false,
  ads: false,
  admin: false,
  /** Live news RSS passages (third-party copyrighted text) */
  newsFeed: false,
} as const;

/** Main navigation, in display order. */
export const NAV_ITEMS: Array<{ key: ViewTab; zh: string; ja: string; en: string; icon: string }> = [
  { key: "shadowing", zh: "跟读", ja: "シャドーイング", en: "Shadowing", icon: "🎙" },
  { key: "vocab", zh: "词汇", ja: "語彙", en: "Vocabulary", icon: "📚" },
  { key: "review", zh: "复习", ja: "復習", en: "Review", icon: "🔁" },
  { key: "settings", zh: "设置", ja: "設定", en: "Settings", icon: "⚙️" },
];

export function isViewEnabled(view: ViewTab): boolean {
  if (view === "dashboard") return false;
  return Boolean((FEATURES as Record<string, boolean>)[view]);
}
