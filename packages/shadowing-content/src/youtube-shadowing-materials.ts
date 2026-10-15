import { defineShadowingMaterials, type ShadowingMaterial } from "./shadowing-materials";

/**
 * YouTube-sourced materials removed for copyright safety.
 * Keep the export so mobile/API imports stay stable.
 */
export const YOUTUBE_SHADOWING_MATERIALS: ShadowingMaterial[] = defineShadowingMaterials([]);

export function isJapaneseYoutubeMaterial(material: ShadowingMaterial): boolean {
  return material.id.startsWith("yt-ja-");
}
