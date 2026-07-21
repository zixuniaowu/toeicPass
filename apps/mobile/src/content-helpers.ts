import type { UiLang } from "@toeicpass/app-core";
import type { ShadowingMaterial, ShadowingTranslations } from "@toeicpass/shadowing-content";

export function getShadowingTranslation(translations: ShadowingTranslations, uiLang: UiLang): string {
  if (uiLang === "ja") {
    return translations.ja || translations.zh || translations.en || "";
  }
  if (uiLang === "en") {
    return translations.en || translations.zh || translations.ja || "";
  }
  return translations.zh || translations.ja || translations.en || "";
}

export function getShadowingTitle(material: ShadowingMaterial, uiLang: UiLang): string {
  return getShadowingTranslation(material.translations, uiLang) || material.title;
}

export function getShadowingMaterialHint(material: ShadowingMaterial, uiLang: UiLang): string {
  const firstSentence = material.sentences[0];
  return firstSentence ? getShadowingTranslation(firstSentence.translations, uiLang) || firstSentence.text : material.source;
}
