#!/usr/bin/env node
/**
 * scripts/build-ja-dict.mjs
 *
 * Processes JMdict-simplified JSON into per-kana-initial JSON chunks.
 *
 * Usage:
 *   1. Download jmdict-simplified: https://github.com/scriptin/jmdict-simplified/releases
 *      Get jmdict-eng-3.x.x.json.gz and extract it
 *   2. Run: node scripts/build-ja-dict.mjs <path/to/jmdict-eng-3.x.x.json> <output-dir>
 *
 * Output: One file per kana row (あ行, か行 ... わ行), plus kanji.json for kanji headwords.
 * Each file is a Record<string, { cn: string; kana: string }>
 *
 * The final files go to: apps/web/public/dict/ja/
 *
 * Note: JMdict provides English glosses. We store the English gloss as "cn" here
 * since we don't have an authoritative JA→ZH dictionary. For production,
 * replace with a dedicated Japanese-Chinese dictionary (e.g. JA-CN parallel corpus).
 */

import fs from "fs";
import path from "path";

const [,, jmdictPath, outputDir] = process.argv;

if (!jmdictPath || !outputDir) {
  console.error("Usage: node build-ja-dict.mjs <jmdict-eng.json> <output-dir>");
  process.exit(1);
}

fs.mkdirSync(outputDir, { recursive: true });

console.log("Reading JMdict JSON (this may take a moment)...");
const raw = fs.readFileSync(jmdictPath, "utf-8");
const jmdict = JSON.parse(raw);

// JMdict simplified format:
// { words: [ { id, kanji: [{text}], kana: [{text, appliesToKanji}], sense: [{gloss: [{text, lang}]}] } ] }

// Kana row grouping: あ-お → a, か-こ → k, etc.
const KANA_ROWS = [
  ["あいうえおぁぃぅぇぉ", "a"],
  ["かきくけこがぎぐげご", "k"],
  ["さしすせそざじずぜぞ", "s"],
  ["たちつてとだぢづでどっ", "t"],
  ["なにぬねの", "n"],
  ["はひふへほばびぶべぼぱぴぷぺぽ", "h"],
  ["まみむめも", "m"],
  ["やゆよゃゅょ", "y"],
  ["らりるれろ", "r"],
  ["わをんゎゐゑ", "w"],
];

function kanaGroup(kana) {
  const first = kana[0];
  for (const [chars, label] of KANA_ROWS) {
    if (chars.includes(first)) return label;
  }
  return "misc";
}

/** @type {Map<string, Record<string, { cn: string; kana: string }>>} */
const chunks = new Map();
function getChunk(key) {
  if (!chunks.has(key)) chunks.set(key, {});
  return chunks.get(key);
}

const words = jmdict.words ?? [];
let processed = 0;

for (const entry of words) {
  // Only include common words to keep chunks manageable
  const isCommon = (entry.kana ?? []).some((k) => k.common) || (entry.kanji ?? []).some((k) => k.common);
  if (!isCommon) continue;

  const kanaForms = (entry.kana ?? []).map((k) => k.text).filter(Boolean);
  const kanjiForms = (entry.kanji ?? []).map((k) => k.text).filter(Boolean);

  // Get English gloss (we'll use it as the best available short definition)
  const senses = entry.sense ?? [];
  const glossTexts = senses
    .flatMap((s) => (s.gloss ?? []).filter((g) => g.lang === "eng").map((g) => g.text))
    .filter(Boolean)
    .slice(0, 2);  // at most 2 glosses

  if (glossTexts.length === 0) continue;
  const gloss = glossTexts.join("; ");

  const primaryKana = kanaForms[0];
  if (!primaryKana) continue;

  const entry_data = { cn: gloss.slice(0, 50), kana: primaryKana };  // 50 char cap
  const group = kanaGroup(primaryKana);

  // Index by kana forms
  for (const kana of kanaForms) {
    const chunk = getChunk(group);
    if (!chunk[kana]) chunk[kana] = entry_data;
  }

  // Index by kanji forms (in a separate kanji chunk)
  for (const kanji of kanjiForms) {
    const chunk = getChunk("kanji");
    if (!chunk[kanji]) chunk[kanji] = entry_data;
  }

  processed++;
}

let totalWords = 0;
for (const [key, data] of chunks) {
  const count = Object.keys(data).length;
  totalWords += count;
  const outFile = path.join(outputDir, `${key}.json`);
  fs.writeFileSync(outFile, JSON.stringify(data), "utf-8");
  console.log(`Wrote ${outFile} (${count} entries)`);
}

console.log(`\nProcessed ${processed} JMdict entries → ${totalWords} index entries in ${chunks.size} chunks`);
console.log(`Output directory: ${outputDir}`);
