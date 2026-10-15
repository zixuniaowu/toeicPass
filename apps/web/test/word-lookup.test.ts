import { describe, expect, it } from "vitest";
import { getShadowingMaterialsByLanguage } from "@toeicpass/shadowing-content";
import { arpabetToIpa, spellAcronymIpa, tokenizeEnglish } from "../lib/lookup-core";
import { findSentenceTranslation, lookupEnglishWord, lookupJapanese } from "../lib/word-lookup";
import { buildSelectionLookup } from "../lib/selection-lookup";
import { annotateEnglishSentence } from "../hooks/useWordAnnotation";

const SENTENCE = "We are opening a severity-one incident for the checkout API latency spike.";

describe("bundled lookup dictionary coverage", () => {
  it("covers 100% of words in every English material with IPA, zh and ja", () => {
    const missing: string[] = [];
    for (const m of getShadowingMaterialsByLanguage("en")) {
      for (const s of m.sentences) {
        for (const tk of tokenizeEnglish(s.text)) {
          for (const lang of ["zh", "ja"] as const) {
            const hit = lookupEnglishWord(tk.raw, lang);
            if (!hit.found || !hit.ipa || !hit.meaning) missing.push(`${m.id}#${s.id} ${tk.raw} (${lang})`);
          }
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it("covers 100% of Japanese material text with readings and Chinese meanings", () => {
    const missing: string[] = [];
    for (const m of getShadowingMaterialsByLanguage("ja")) {
      for (const s of m.sentences) {
        for (const seg of lookupJapanese(s.text).segments) {
          if (!seg.meaning && !/^[\d０-９A-Za-zＡ-Ｚａ-ｚ\s%％.,:：\-ー〜~/・…—]+$/.test(seg.surface)) missing.push(`${m.id}#${s.id} ${seg.surface}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it("every English sentence has zh + ja translations and every Japanese sentence has zh", () => {
    const gaps: string[] = [];
    for (const m of getShadowingMaterialsByLanguage("en")) {
      if (!m.translations.ja) gaps.push(`${m.id} title ja`);
      for (const s of m.sentences) {
        if (!s.translations.zh) gaps.push(`${m.id}#${s.id} zh`);
        if (!s.translations.ja) gaps.push(`${m.id}#${s.id} ja`);
      }
    }
    for (const m of getShadowingMaterialsByLanguage("ja")) for (const s of m.sentences) if (!s.translations.zh) gaps.push(`${m.id}#${s.id} zh`);
    expect(gaps).toEqual([]);
  });
});

describe("IPA", () => {
  it("converts CMUdict to clean American IPA", () => {
    expect(arpabetToIpa("L EY1 T AH0 N S IY0")).toBe("ˈleɪtənsi");
    expect(arpabetToIpa("AA1 R")).toBe("ɑːr");
  });
  it("spells acronyms letter by letter", () => {
    expect(spellAcronymIpa("API")).toBe("/ˌeɪ piː ˈaɪ/");
  });
  it("annotates the incident sentence fully with no stray spaces inside words", () => {
    const words = annotateEnglishSentence(SENTENCE, "ja");
    for (const w of words) {
      expect(w.ipa, w.word).toBeTruthy();
      expect(w.cn, w.word).toBeTruthy();
    }
    const byWord = Object.fromEntries(words.map((w) => [w.word.replace(/[.]/g, ""), w]));
    expect(byWord.are.ipa).toBe("/ɑːr/");
    expect(byWord.API.ipa).toBe("/ˌeɪ piː ˈaɪ/");
    expect(byWord.latency.ipa).toBe("/ˈleɪtənsi/");
    expect(byWord["severity-one"].ipa).toBe("/sɪˈverɪti wʌn/");
    expect(byWord.latency.cn).toMatch(/レイテンシ/);
  });
  it("glosses follow the UI language", () => {
    const zh = annotateEnglishSentence(SENTENCE, "zh").find((w) => w.word === "latency");
    expect(zh?.cn).toMatch(/延迟/);
  });
});

describe("selection lookup", () => {
  it("English word in Chinese UI → Chinese meaning + IPA", () => {
    const r = buildSelectionLookup("latency", "en", "zh")!;
    expect(r.ipa).toBe("/ˈleɪtənsi/");
    expect(r.meaning).toMatch(/延迟/);
    expect(r.meaning).not.toBe("latency");
  });
  it("English word in Japanese UI → Japanese meaning", () => {
    expect(buildSelectionLookup("latency", "en", "ja")!.meaning).toMatch(/レイテンシ/);
  });
  it("whole sentence selection uses the bundled translation in the UI language", () => {
    expect(buildSelectionLookup(SENTENCE, "en", "ja")!.meaning).toMatch(/インシデント/);
    expect(findSentenceTranslation(SENTENCE, "zh")).toMatch(/延迟/);
  });
  it("Japanese word → reading + Chinese meaning", () => {
    const r = buildSelectionLookup("納期", "ja", "zh")!;
    expect(r.reading).toBe("のうき");
    expect(r.meaning).toBeTruthy();
  });
});

describe("shortGloss", async () => {
  const { shortGloss } = await import("../lib/word-lookup");
  it("keeps parenthetical meaning for acronyms and strips notes otherwise", () => {
    expect(shortGloss("API（应用程序接口）")).toBe("应用程序接口");
    expect(shortGloss("一级严重（Sev1，最高级故障）")).toBe("一级严重");
    expect(shortGloss("开始;开口")).toBe("开始");
  });
});
