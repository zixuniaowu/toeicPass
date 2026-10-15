import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getShadowingMaterialsByLanguage } from "@toeicpass/shadowing-content";
import { lookupJapanese } from "../lib/word-lookup";
import { buildSelectionLookup } from "../lib/selection-lookup";
import { pickBestVoice } from "../lib/tts";

const ja = getShadowingMaterialsByLanguage("ja");
const SYMBOLS = /^[\d０-９A-Za-zＡ-Ｚａ-ｚ\s%％.,:：\-ー〜~/・…—]+$/;

describe("English UI for Japanese learners", () => {
  it("every Japanese material has English title, intro, vocab notes and sentence translations", () => {
    const gaps: string[] = [];
    for (const m of ja) {
      if (!m.translations.en) gaps.push(`${m.id} title`);
      if (m.intro && !m.intro.en) gaps.push(`${m.id} intro`);
      for (const v of m.vocabulary ?? []) if (!v.en) gaps.push(`${m.id} vocab ${v.term}`);
      for (const s of m.sentences) if (!s.translations.en) gaps.push(`${m.id}#${s.id}`);
    }
    expect(gaps).toEqual([]);
  });

  it("Japanese dictionary covers 100% of material text with readings and English meanings", () => {
    const missing: string[] = [];
    for (const m of ja) for (const s of m.sentences) for (const seg of lookupJapanese(s.text, "en").segments) {
      if (!SYMBOLS.test(seg.surface) && (!seg.meaning || /[\u4e00-\u9fff]/.test(seg.meaning.replace(/[（(].*?[)）]/g, "")) && !/[a-z]/i.test(seg.meaning))) {
        missing.push(`${m.id}#${s.id} ${seg.surface} → ${seg.meaning}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("popup shows reading + English meaning in English UI", () => {
    const r = buildSelionOr("納期");
    expect(r.reading).toBe("のうき");
    expect(r.meaning).toMatch(/[a-z]/i);
  });

  it("pre-generated Japanese audio covers every sentence and files exist", () => {
    const dir = join(__dirname, "../public/audio/ja");
    const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8")) as Record<string, string>;
    const missing: string[] = [];
    for (const m of ja) for (const s of m.sentences) {
      const f = manifest[s.text.replace(/\s+/g, "")];
      if (!f || !existsSync(join(dir, f))) missing.push(`${m.id}#${s.id}`);
    }
    expect(missing).toEqual([]);
  });

  it("pickBestVoice prefers natural voices over eSpeak", () => {
    const v = (name: string, lang: string) => ({ name, lang }) as SpeechSynthesisVoice;
    const voices = [v("eSpeak Japanese", "ja"), v("Microsoft Haruka Desktop", "ja-JP"), v("Google 日本語", "ja-JP"), v("Google US English", "en-US")];
    expect(pickBestVoice("ja", voices)?.name).toBe("Google 日本語");
    expect(pickBestVoice("ja", voices.slice(0, 2))?.name).toBe("Microsoft Haruka Desktop");
    expect(pickBestVoice("en", voices)?.name).toBe("Google US English");
  });
});

function buildSelionOr(text: string) {
  return buildSelectionLookup(text, "ja", "en")!;
}
