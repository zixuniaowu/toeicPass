import type { IShadowingContent } from "@toeicpass/shared";

export {
  defineShadowingMaterials,
  type ShadowingMaterial,
  type ShadowingSentence,
  type ShadowingTranslations,
  type ShadowingVocabNote,
} from "./shadowing-materials";
export { JAPANESE_LIFE_WORK_MATERIALS } from "./japanese-life-work-materials";
export { IT_MATERIALS_EN } from "./it-materials-en";
export { IT_MATERIALS_JA, ADVANCED_JA_MATERIALS } from "./it-materials-ja";
export {
  YOUTUBE_SHADOWING_MATERIALS,
  isJapaneseYoutubeMaterial,
} from "./youtube-shadowing-materials";

import {
  SHADOWING_MATERIALS as BASE_EN_MATERIALS,
  type ShadowingMaterial,
} from "./shadowing-materials";
import { JAPANESE_SHADOWING_MATERIALS as BASE_JA_MATERIALS } from "./japanese-shadowing-materials";
import { JAPANESE_LIFE_WORK_MATERIALS } from "./japanese-life-work-materials";
import { IT_MATERIALS_EN } from "./it-materials-en";
import { IT_MATERIALS_JA, ADVANCED_JA_MATERIALS } from "./it-materials-ja";

/** Older IT pieces were filed under generic categories; surface them in the IT category. */
function withItCategory(list: ShadowingMaterial[]): ShadowingMaterial[] {
  return list.map((m) => (/^(it-|jp-it-)/.test(m.id) ? { ...m, category: "it" as const } : m));
}

function uniqueById(list: ShadowingMaterial[]): ShadowingMaterial[] {
  const seen = new Set<string>();
  return list.filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true)));
}

/** All English shadowing materials (original / public-domain only). */
export const SHADOWING_MATERIALS: ShadowingMaterial[] = uniqueById(withItCategory([...BASE_EN_MATERIALS, ...IT_MATERIALS_EN]));

/** All Japanese shadowing materials: advanced passages and IT first, then everyday basics. */
export const JAPANESE_SHADOWING_MATERIALS: ShadowingMaterial[] = uniqueById(
  withItCategory([...ADVANCED_JA_MATERIALS, ...IT_MATERIALS_JA, ...BASE_JA_MATERIALS, ...JAPANESE_LIFE_WORK_MATERIALS]),
);
import {
  YOUTUBE_SHADOWING_MATERIALS,
  isJapaneseYoutubeMaterial,
} from "./youtube-shadowing-materials";

export function getShadowingMaterialsByLanguage(language: "en" | "ja"): ShadowingMaterial[] {
  const ttsMaterials =
    language === "ja"
      ? JAPANESE_SHADOWING_MATERIALS
      : SHADOWING_MATERIALS;
  const youtubeMaterials = YOUTUBE_SHADOWING_MATERIALS.filter((material) =>
    language === "ja" ? isJapaneseYoutubeMaterial(material) : !isJapaneseYoutubeMaterial(material),
  );
  return [...ttsMaterials, ...youtubeMaterials];
}

export function toShadowingContent(material: ShadowingMaterial, language: "en" | "ja"): IShadowingContent {
  return {
    id: material.id,
    title: material.title,
    description: material.source,
    language,
    sourceKind: material.youtubeVideoId ? "youtube" : "tts",
    audioRef: material.youtubeVideoId ?? material.id,
    transcript: material.sentences.map((sentence) => ({
      startSec: sentence.startSec ?? 0,
      endSec: sentence.endSec ?? sentence.startSec ?? 0,
      text: sentence.text,
    })),
    difficultyLabel: String(material.difficulty),
    tags: [material.category, material.source],
  };
}
