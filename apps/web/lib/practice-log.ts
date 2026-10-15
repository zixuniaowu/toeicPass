/** Local log of shadowing attempts, used by the Review (复习) page. */
import type { CompareWord, TrainingLanguage } from "@toeicpass/app-core/shadowing-compare";

export type PracticeAttempt = {
  text: string;
  lang: TrainingLanguage;
  accuracy: number;
  bestAccuracy: number;
  attempts: number;
  issues: Array<Pick<CompareWord, "word" | "status" | "heard" | "tip">>;
  updatedAt: string;
};

const KEY = "lb.practiceLog.v1";
const MAX = 300;

export function readPracticeLog(): PracticeAttempt[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as PracticeAttempt[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function recordPracticeAttempt(text: string, lang: TrainingLanguage, accuracy: number, words: CompareWord[]): void {
  if (typeof window === "undefined" || !text.trim()) return;
  const log = readPracticeLog();
  const idx = log.findIndex((a) => a.text === text && a.lang === lang);
  const issues = words.filter((w) => w.status !== "correct").slice(0, 10).map(({ word, status, heard, tip }) => ({ word, status, heard, tip }));
  const prev = idx >= 0 ? log[idx] : null;
  const entry: PracticeAttempt = {
    text,
    lang,
    accuracy,
    bestAccuracy: Math.max(accuracy, prev?.bestAccuracy ?? 0),
    attempts: (prev?.attempts ?? 0) + 1,
    issues,
    updatedAt: new Date().toISOString(),
  };
  if (idx >= 0) log.splice(idx, 1);
  log.unshift(entry);
  try { localStorage.setItem(KEY, JSON.stringify(log.slice(0, MAX))); } catch { /* quota */ }
}

export function removePracticeAttempt(text: string, lang: TrainingLanguage): void {
  const log = readPracticeLog().filter((a) => !(a.text === text && a.lang === lang));
  try { localStorage.setItem(KEY, JSON.stringify(log)); } catch { /* ignore */ }
}
