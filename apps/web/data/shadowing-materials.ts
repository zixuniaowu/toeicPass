/**
 * Shadowing materials live in @toeicpass/shadowing-content (single source of truth,
 * shared with the API and the mobile app). This module re-exports them for legacy imports.
 */
export {
  defineShadowingMaterials,
  SHADOWING_MATERIALS,
  JAPANESE_SHADOWING_MATERIALS,
  type ShadowingMaterial,
  type ShadowingSentence,
  type ShadowingTranslations,
  type ShadowingVocabNote,
} from "@toeicpass/shadowing-content";
