import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import type { ShadowingMaterial } from "@toeicpass/shadowing-content";

const CACHE_KEY_PREFIX = "shadowing.materials.v2.";
const SYNCED_AT_PREFIX = "shadowing.syncedAt.v2.";

/**
 * Default content API. The Hugging Face Space routes `/api/v1` from the
 * Next.js server to the NestJS API, so the same base URL works for the web
 * app and for device builds. Override with EXPO_PUBLIC_API_URL (build time).
 */
const DEFAULT_API_BASE = "https://peanutao-toeicpass.hf.space/api/v1";

export type ShadowingContentSource = "server" | "cache" | "bundled";

export function resolveShadowingApiBase(): string {
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;
  // Note: the Expo manifest serializes null extra values as `{}` (truthy), so
  // `??` chains cannot be used here — pick the first usable string instead.
  const candidates = [extra.apiBase, extra.lanApiBase, extra.previewApiBase];
  const candidate = candidates.find(
    (value): value is string => typeof value === "string" && value.trim().length > 0,
  );
  const base = candidate ? candidate.trim() : DEFAULT_API_BASE;
  return base.replace(/\/+$/, "");
}

function normalizeMaterial(raw: unknown): ShadowingMaterial | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const material = raw as Record<string, unknown>;
  const id = typeof material.id === "string" ? material.id : null;
  const title = typeof material.title === "string" ? material.title : null;
  const sentences = Array.isArray(material.sentences) ? material.sentences : null;
  if (!id || !title || !sentences || sentences.length === 0) {
    return null;
  }
  return {
    id,
    title,
    translations: (material.translations ?? {}) as ShadowingMaterial["translations"],
    source: typeof material.source === "string" ? material.source : "",
    category:
      material.category === "ted" || material.category === "drama" || material.category === "speech"
        ? material.category
        : "speech",
    difficulty:
      material.difficulty === 1 || material.difficulty === 2 || material.difficulty === 3
        ? material.difficulty
        : 2,
    ...(typeof material.youtubeVideoId === "string" && material.youtubeVideoId.length > 0
      ? { youtubeVideoId: material.youtubeVideoId }
      : {}),
    sentences: sentences
      .map((sentence: Record<string, unknown>, index: number) => ({
        id: typeof sentence.id === "number" ? sentence.id : index + 1,
        text: typeof sentence.text === "string" ? sentence.text : "",
        translations: (sentence.translations ?? {}) as ShadowingMaterial["translations"],
        ...(typeof sentence.startSec === "number" ? { startSec: sentence.startSec } : {}),
        ...(typeof sentence.endSec === "number" ? { endSec: sentence.endSec } : {}),
        ...(Array.isArray(sentence.annotations)
          ? {
              annotations: (sentence.annotations as Array<Record<string, unknown>>)
                .filter(
                  (segment) =>
                    typeof segment?.surface === "string" && typeof segment?.reading === "string",
                )
                .map((segment) => ({
                  surface: segment.surface as string,
                  reading: segment.reading as string,
                })),
            }
          : {}),
      }))
      .filter((sentence) => sentence.text.length > 0),
  };
}

/** Read the last successfully synced material list for a language. */
export async function loadCachedShadowingMaterials(
  targetLang: "en" | "ja",
): Promise<ShadowingMaterial[] | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY_PREFIX + targetLang);
    if (!raw) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return null;
    }
    const materials = parsed
      .map(normalizeMaterial)
      .filter((material): material is ShadowingMaterial => material !== null);
    return materials.length > 0 ? materials : null;
  } catch {
    return null;
  }
}

/**
 * Fetch published materials from the content API and refresh the cache.
 * Returns null on any failure so callers can fall back to cache/bundled data.
 */
export async function syncShadowingMaterials(
  targetLang: "en" | "ja",
  apiBase: string,
): Promise<{ materials: ShadowingMaterial[]; source: ShadowingContentSource } | null> {
  try {
    const response = await fetch(`${apiBase}/content/shadowing?language=${targetLang}`, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      return null;
    }
    const payload = (await response.json()) as { materials?: unknown[]; serverTime?: string };
    if (!Array.isArray(payload.materials) || payload.materials.length === 0) {
      return null;
    }
    const materials = payload.materials
      .map(normalizeMaterial)
      .filter((material): material is ShadowingMaterial => material !== null);
    if (materials.length === 0) {
      return null;
    }
    await AsyncStorage.setItem(CACHE_KEY_PREFIX + targetLang, JSON.stringify(materials));
    await AsyncStorage.setItem(
      SYNCED_AT_PREFIX + targetLang,
      typeof payload.serverTime === "string" ? payload.serverTime : new Date().toISOString(),
    );
    return { materials, source: "server" };
  } catch {
    return null;
  }
}
