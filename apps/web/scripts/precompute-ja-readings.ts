/**
 * Precompute kuromoji readings for every built-in Japanese shadowing sentence so the
 * client can score immediately without a /api/japanese-reading round-trip.
 * Run: npx tsx apps/web/scripts/precompute-ja-readings.ts
 */
import fs from "fs";
import path from "path";
import kuromoji from "kuromoji";
import { JAPANESE_SHADOWING_MATERIALS } from "../../../packages/shadowing-content/src/index";

const root = path.resolve(__dirname, "../../..");
const dicPath = path.join(root, "node_modules/kuromoji/dict");
const out = path.join(root, "apps/web/public/data/ja-readings.json");
const kata2hira = (t: string) => t.replace(/[\u30A1-\u30F6]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));

kuromoji.builder({ dicPath }).build((err, tokenizer) => {
  if (err) throw err;
  const map: Record<string, Array<{ surface: string; reading: string | null; hasKanji: boolean }>> = {};
  for (const m of JAPANESE_SHADOWING_MATERIALS) {
    for (const s of m.sentences) {
      const key = s.text.trim();
      map[key] = tokenizer
        .tokenize(key)
        .filter((t) => t.surface_form.trim())
        .map((t) => {
          const hasKanji = /[一-龯々]/u.test(t.surface_form);
          const r = t.reading && t.reading !== "*" ? kata2hira(t.reading) : "";
          return { surface: t.surface_form, reading: hasKanji && r && r !== t.surface_form ? r : null, hasKanji };
        });
    }
  }
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(map));
  console.log(`wrote ${Object.keys(map).length} sentences → ${path.relative(root, out)}`);
});
