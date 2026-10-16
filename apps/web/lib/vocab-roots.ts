/** Root-based daily vocabulary (imported by scripts/import-vocab-days.mjs into /public/vocab-roots). */
export type Tr = { zh: string; ja: string; en?: string };
export type VocabRootPart = Tr & { text: string };
export type VocabRootWord = {
  id: string; w: string; pos: string; ipa: string; meaning: Tr; ex: string; exTr: Tr;
  parts: VocabRootPart[]; forms: VocabRootPart[]; note: Tr | null; tip: Tr | null; audio: string; exAudio: string;
};
export type VocabRootGroup = { id: string; kind: "root" | "theme"; rootIndex: number; title: Tr; words: VocabRootWord[] };
export type VocabRoot = { root: string; origin: string; meaning: Tr; explanation: Tr; examples: string[] };
export type VocabDay = { day: number; date: string; title: Tr; intro: Tr; roots: VocabRoot[]; groups: VocabRootGroup[] };
export type VocabDaySummary = { day: number; date: string; title: Tr; intro: Tr; roots: { root: string; meaning: Tr }[]; wordCount: number };

/** Pick the UI-language text; English UI falls back to the English field, then Chinese. */
export function pickTr(t: Tr | null | undefined, ui: "zh" | "ja" | "en"): string {
  if (!t) return "";
  if (ui === "ja") return t.ja || t.zh;
  if (ui === "en") return t.en || t.zh;
  return t.zh || t.ja;
}

export async function loadVocabIndex(): Promise<VocabDaySummary[]> {
  const r = await fetch("/vocab-roots/index.json");
  if (!r.ok) return [];
  return ((await r.json()) as { days: VocabDaySummary[] }).days;
}

const dayCache = new Map<number, Promise<VocabDay | null>>();
export function loadVocabDay(day: number): Promise<VocabDay | null> {
  if (!dayCache.has(day)) {
    dayCache.set(day, fetch(`/vocab-roots/day${day}.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null));
  }
  return dayCache.get(day)!;
}

const MASTERED_KEY = "lb.vocabRoots.mastered";
export function readMastered(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(MASTERED_KEY) ?? "[]")); } catch { return new Set(); }
}
export function writeMastered(s: Set<string>): void {
  try { localStorage.setItem(MASTERED_KEY, JSON.stringify([...s])); } catch { /* ignore */ }
}
export const masteredKey = (day: number, wordId: string) => `${day}:${wordId}`;
