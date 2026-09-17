import type { IShadowingContent } from "@toeicpass/shared";

export {
  defineShadowingMaterials,
  SHADOWING_MATERIALS,
  type ShadowingMaterial,
  type ShadowingSentence,
  type ShadowingTranslations,
} from "./shadowing-materials";
export { JAPANESE_SHADOWING_MATERIALS } from "./japanese-shadowing-materials";
export { JAPANESE_LIFE_WORK_MATERIALS } from "./japanese-life-work-materials";
export {
  YOUTUBE_SHADOWING_MATERIALS,
  isJapaneseYoutubeMaterial,
} from "./youtube-shadowing-materials";

import {
  SHADOWING_MATERIALS,
  type ShadowingMaterial,
} from "./shadowing-materials";
import { JAPANESE_SHADOWING_MATERIALS } from "./japanese-shadowing-materials";
import { JAPANESE_LIFE_WORK_MATERIALS } from "./japanese-life-work-materials";
import {
  YOUTUBE_SHADOWING_MATERIALS,
  isJapaneseYoutubeMaterial,
} from "./youtube-shadowing-materials";

export function getShadowingMaterialsByLanguage(language: "en" | "ja"): ShadowingMaterial[] {
  const ttsMaterials =
    language === "ja"
      ? [...JAPANESE_SHADOWING_MATERIALS, ...JAPANESE_LIFE_WORK_MATERIALS]
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
