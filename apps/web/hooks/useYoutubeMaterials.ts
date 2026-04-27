"use client";
/**
 * useYoutubeMaterials — manages saved YouTube/subtitle materials and practice progress.
 * Handles localStorage persistence, snapshot merging, and CRUD operations.
 */
import { useState, useCallback, useRef, useEffect } from "react";
import type { ShadowingMaterial } from "../data/shadowing-materials";
import type { TrainingLanguage } from "../lib/shadowing-utils";
import {
  normalizeMaterialForStorage,
  parseTedSnapshotMaterials,
  parseJaYoutubeSnapshotMaterials,
  clampSentenceIndex,
  isPersistedVideoMaterial,
} from "../lib/shadowing-utils";
import {
  type MaterialProgressRecord,
  loadYoutubeMaterialsFromStorage,
  saveYoutubeMaterialsToStorage,
  loadYoutubeProgressFromStorage,
  saveYoutubeProgressToStorage,
  migrateYoutubeLegacyStorage,
  mergeSnapshotMaterials,
  YOUTUBE_MATERIALS_STORAGE_KEY_EN,
  YOUTUBE_MATERIALS_STORAGE_KEY_JA,
} from "../lib/youtube-materials-storage";

const TED_SNAPSHOT_SYNC_KEY = "toeicpass.ted-latest.generated-at.v1";
const JA_SNAPSHOT_SYNC_KEY = "toeicpass.ja-youtube.generated-at.v1";
import jaYoutubeShadowing from "../data/japanese-youtube-shadowing.json";

type TedLatestSnapshot = { generatedAt?: string };

export type UseYoutubeMaterialsReturn = {
  savedMaterials: ShadowingMaterial[];
  materialProgressMap: Record<string, MaterialProgressRecord>;
  upsertMaterial: (material: ShadowingMaterial) => void;
  deleteMaterial: (materialId: string) => void;
  resetProgress: (materialId: string) => void;
  persistProgress: (materialId: string, current: number, completed: Set<number>) => void;
  /** Bulk-import TED Latest snapshot (EN) */
  importTedLatestBatch: () => string | null;
  /** Bulk-import JA YouTube snapshot */
  importJaYoutubeBatch: () => string | null;
};

export function useYoutubeMaterials(
  trainingLanguage: TrainingLanguage,
): UseYoutubeMaterialsReturn {
  const [savedMaterials, setSavedMaterials] = useState<ShadowingMaterial[]>([]);
  const [materialProgressMap, setMaterialProgressMap] = useState<
    Record<string, MaterialProgressRecord>
  >({});
  const trainingLanguageRef = useRef(trainingLanguage);
  trainingLanguageRef.current = trainingLanguage;

  // Load materials + run snapshot sync on mount / language change
  useEffect(() => {
    migrateYoutubeLegacyStorage();
    let storedMaterials = loadYoutubeMaterialsFromStorage(trainingLanguage);

    // Clean cross-language contamination from earlier combined storage
    const cleaned =
      trainingLanguage === "en"
        ? storedMaterials.filter((m) => !m.id?.startsWith("jp-"))
        : storedMaterials;
    if (cleaned.length !== storedMaterials.length) {
      saveYoutubeMaterialsToStorage(cleaned, trainingLanguage);
      storedMaterials = cleaned;
    }

    if (trainingLanguage === "en") {
      const tedSnapshot = parseTedSnapshotMaterials();
      if (
        typeof window !== "undefined" &&
        tedSnapshot.materials.length > 0 &&
        tedSnapshot.generatedAt
      ) {
        const syncedAt = String(
          window.localStorage.getItem(TED_SNAPSHOT_SYNC_KEY) ?? "",
        ).trim();
        if (syncedAt !== tedSnapshot.generatedAt) {
          const merged = mergeSnapshotMaterials(tedSnapshot.materials, storedMaterials);
          saveYoutubeMaterialsToStorage(merged, "en");
          window.localStorage.setItem(TED_SNAPSHOT_SYNC_KEY, tedSnapshot.generatedAt);
          storedMaterials = merged;
        }
      }
    } else {
      const jaSnapshot = parseJaYoutubeSnapshotMaterials();
      if (typeof window !== "undefined" && jaSnapshot.materials.length > 0) {
        const syncedAt = String(
          window.localStorage.getItem(JA_SNAPSHOT_SYNC_KEY) ?? "",
        ).trim();
        const jaGeneratedAt = String(
          (jaYoutubeShadowing as TedLatestSnapshot)?.generatedAt ?? "",
        ).trim();
        if (jaGeneratedAt && syncedAt !== jaGeneratedAt) {
          const merged = mergeSnapshotMaterials(jaSnapshot.materials, storedMaterials);
          saveYoutubeMaterialsToStorage(merged, "ja");
          window.localStorage.setItem(JA_SNAPSHOT_SYNC_KEY, jaGeneratedAt);
          storedMaterials = merged;
        }
      }
    }

    setSavedMaterials(storedMaterials);
    setMaterialProgressMap(loadYoutubeProgressFromStorage());
  }, [trainingLanguage]);

  const upsertMaterial = useCallback((material: ShadowingMaterial) => {
    const normalized = normalizeMaterialForStorage(material);
    setSavedMaterials((prev) => {
      const deduped = prev.filter((item) => {
        if (item.id === normalized.id) return false;
        if (
          item.youtubeVideoId &&
          normalized.youtubeVideoId &&
          item.youtubeVideoId === normalized.youtubeVideoId
        ) return false;
        if (
          !item.youtubeVideoId &&
          !normalized.youtubeVideoId &&
          item.title === normalized.title &&
          item.source === normalized.source
        ) return false;
        return true;
      });
      const next = [normalized, ...deduped].slice(0, 30);
      saveYoutubeMaterialsToStorage(next, trainingLanguageRef.current);
      return next;
    });
  }, []);

  const deleteMaterial = useCallback(
    (materialId: string) => {
      setSavedMaterials((prev) => {
        const next = prev.filter((item) => item.id !== materialId);
        saveYoutubeMaterialsToStorage(next, trainingLanguageRef.current);
        return next;
      });
      setMaterialProgressMap((prev) => {
        if (!(materialId in prev)) return prev;
        const next = { ...prev };
        delete next[materialId];
        saveYoutubeProgressToStorage(next);
        return next;
      });
    },
    [],
  );

  const resetProgress = useCallback((materialId: string) => {
    setMaterialProgressMap((prev) => {
      if (!(materialId in prev)) return prev;
      const next = { ...prev };
      delete next[materialId];
      saveYoutubeProgressToStorage(next);
      return next;
    });
  }, []);

  const persistProgress = useCallback(
    (materialId: string, current: number, completedSet: Set<number>) => {
      setMaterialProgressMap((prev) => {
        const nextRecord: MaterialProgressRecord = {
          currentIndex: Math.max(0, Math.floor(current)),
          completedSentenceIds: Array.from(completedSet)
            .filter((id) => Number.isInteger(id) && id >= 0)
            .sort((a, b) => a - b),
          updatedAt: Date.now(),
        };
        const next = { ...prev, [materialId]: nextRecord };
        saveYoutubeProgressToStorage(next);
        return next;
      });
    },
    [],
  );

  const importTedLatestBatch = useCallback((): string | null => {
    const { materials } = parseTedSnapshotMaterials();
    if (materials.length === 0) return "no-materials";
    setSavedMaterials((prev) => {
      const merged = mergeSnapshotMaterials(materials, prev);
      saveYoutubeMaterialsToStorage(merged, "en");
      return merged;
    });
    return null;
  }, []);

  const importJaYoutubeBatch = useCallback((): string | null => {
    const { materials } = parseJaYoutubeSnapshotMaterials();
    if (materials.length === 0) return "no-materials";
    setSavedMaterials((prev) => {
      const merged = mergeSnapshotMaterials(materials, prev);
      saveYoutubeMaterialsToStorage(merged, "ja");
      return merged;
    });
    return null;
  }, []);

  return {
    savedMaterials,
    materialProgressMap,
    upsertMaterial,
    deleteMaterial,
    resetProgress,
    persistProgress,
    importTedLatestBatch,
    importJaYoutubeBatch,
  };
}

// Re-export for convenience
export { clampSentenceIndex, isPersistedVideoMaterial };
export type { MaterialProgressRecord };
export { YOUTUBE_MATERIALS_STORAGE_KEY_EN, YOUTUBE_MATERIALS_STORAGE_KEY_JA };
