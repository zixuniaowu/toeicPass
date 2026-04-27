/**
 * localStorage helpers for YouTube / subtitle materials and practice progress.
 * No React dependencies.
 */
import type { ShadowingMaterial } from "../data/shadowing-materials";
import type { TrainingLanguage } from "./shadowing-utils";
import { normalizeMaterialForStorage } from "./shadowing-utils";

const YOUTUBE_MATERIALS_STORAGE_KEY_LEGACY = "toeicpass.youtube-materials.v1";
const YOUTUBE_MATERIALS_STORAGE_KEY_EN = "toeicpass.youtube-materials.en.v1";
const YOUTUBE_MATERIALS_STORAGE_KEY_JA = "toeicpass.youtube-materials.ja.v1";
const YOUTUBE_PROGRESS_STORAGE_KEY = "toeicpass.youtube-material-progress.v1";

export { YOUTUBE_MATERIALS_STORAGE_KEY_LEGACY, YOUTUBE_MATERIALS_STORAGE_KEY_EN, YOUTUBE_MATERIALS_STORAGE_KEY_JA };

export type MaterialProgressRecord = {
  currentIndex: number;
  completedSentenceIds: number[];
  updatedAt: number;
};

function storageKey(lang: TrainingLanguage): string {
  return lang === "ja" ? YOUTUBE_MATERIALS_STORAGE_KEY_JA : YOUTUBE_MATERIALS_STORAGE_KEY_EN;
}

export function loadYoutubeMaterialsFromStorage(lang: TrainingLanguage): ShadowingMaterial[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey(lang));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    const list = Array.isArray(parsed) ? parsed : [];
    return list
      .map((item) => normalizeMaterialForStorage(item as ShadowingMaterial))
      .filter((item) => item.sentences.length > 0);
  } catch {
    return [];
  }
}

export function saveYoutubeMaterialsToStorage(
  materials: ShadowingMaterial[],
  lang: TrainingLanguage,
): void {
  if (typeof window === "undefined") return;
  const payload = materials.map((item) => normalizeMaterialForStorage(item)).slice(0, 30);
  window.localStorage.setItem(storageKey(lang), JSON.stringify(payload));
}

export function loadYoutubeProgressFromStorage(): Record<string, MaterialProgressRecord> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(YOUTUBE_PROGRESS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    const result: Record<string, MaterialProgressRecord> = {};
    Object.entries(parsed).forEach(([id, value]) => {
      if (!id || !value || typeof value !== "object" || Array.isArray(value)) return;
      const currentIndex = Number((value as { currentIndex?: unknown }).currentIndex);
      const completedRaw = (value as { completedSentenceIds?: unknown }).completedSentenceIds;
      const updatedAt = Number((value as { updatedAt?: unknown }).updatedAt);
      const completedSentenceIds = Array.isArray(completedRaw)
        ? completedRaw.map((i) => Number(i)).filter((i) => Number.isInteger(i) && i >= 0)
        : [];
      result[id] = {
        currentIndex:
          Number.isFinite(currentIndex) && currentIndex >= 0 ? Math.floor(currentIndex) : 0,
        completedSentenceIds: Array.from(new Set(completedSentenceIds)),
        updatedAt: Number.isFinite(updatedAt) ? updatedAt : 0,
      };
    });
    return result;
  } catch {
    return {};
  }
}

export function saveYoutubeProgressToStorage(
  progressMap: Record<string, MaterialProgressRecord>,
): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(YOUTUBE_PROGRESS_STORAGE_KEY, JSON.stringify(progressMap));
}

export function migrateYoutubeLegacyStorage(): void {
  if (typeof window === "undefined") return;
  const legacy = window.localStorage.getItem(YOUTUBE_MATERIALS_STORAGE_KEY_LEGACY);
  if (!legacy) return;
  try {
    const parsed: ShadowingMaterial[] = JSON.parse(legacy) as ShadowingMaterial[];
    const enItems = parsed.filter((m) => !m.id?.startsWith("jp-"));
    const jaItems = parsed.filter((m) => m.id?.startsWith("jp-"));
    if (!window.localStorage.getItem(YOUTUBE_MATERIALS_STORAGE_KEY_EN) && enItems.length > 0) {
      window.localStorage.setItem(YOUTUBE_MATERIALS_STORAGE_KEY_EN, JSON.stringify(enItems));
    }
    if (!window.localStorage.getItem(YOUTUBE_MATERIALS_STORAGE_KEY_JA) && jaItems.length > 0) {
      window.localStorage.setItem(YOUTUBE_MATERIALS_STORAGE_KEY_JA, JSON.stringify(jaItems));
    }
  } catch {
    /* ignore corrupt data */
  }
  window.localStorage.removeItem(YOUTUBE_MATERIALS_STORAGE_KEY_LEGACY);
}

export function mergeSnapshotMaterials(
  snapshotMaterials: ShadowingMaterial[],
  storedMaterials: ShadowingMaterial[],
): ShadowingMaterial[] {
  const merged = [
    ...snapshotMaterials,
    ...storedMaterials.map((item) => normalizeMaterialForStorage(item)),
  ];
  const deduped: ShadowingMaterial[] = [];
  const seen = new Set<string>();
  merged.forEach((item) => {
    const key = item.youtubeVideoId ? `video:${item.youtubeVideoId}` : `id:${item.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    deduped.push(item);
  });
  return deduped.slice(0, 60);
}
