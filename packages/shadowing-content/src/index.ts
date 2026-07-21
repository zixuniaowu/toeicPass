import type { IShadowingContent } from "@toeicpass/shared";

export {
  defineShadowingMaterials,
  SHADOWING_MATERIALS,
  type ShadowingMaterial,
  type ShadowingSentence,
  type ShadowingTranslations,
} from "./shadowing-materials";
export { JAPANESE_SHADOWING_MATERIALS } from "./japanese-shadowing-materials";

import {
  SHADOWING_MATERIALS,
  type ShadowingMaterial,
} from "./shadowing-materials";
import { JAPANESE_SHADOWING_MATERIALS } from "./japanese-shadowing-materials";

export function getShadowingMaterialsByLanguage(language: "en" | "ja"): ShadowingMaterial[] {
  return language === "ja" ? JAPANESE_SHADOWING_MATERIALS : SHADOWING_MATERIALS;
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
