#!/usr/bin/env node
/**
 * scripts/build-en-dict.mjs
 *
 * Processes ECDICT CSV (ecdict.csv) into per-letter JSON chunks.
 *
 * Usage:
 *   1. Download ECDICT: https://github.com/skywind3000/ECDICT/releases
 *      Get stardict.zip and extract ecdict.csv
 *   2. Run: node scripts/build-en-dict.mjs <path/to/ecdict.csv> <output-dir>
 *
 * Output: One file per letter, e.g. a.json, b.json ... z.json, misc.json
 * Each file is a Record<string, { cn: string; ipa: string }>
 *
 * The final files go to: apps/web/public/dict/en/
 */

import fs from "fs";
import path from "path";
import { createReadStream } from "fs";
import readline from "readline";

const [,, csvPath, outputDir] = process.argv;

if (!csvPath || !outputDir) {
  console.error("Usage: node build-en-dict.mjs <ecdict.csv> <output-dir>");
  process.exit(1);
}

fs.mkdirSync(outputDir, { recursive: true });

// Map: letter → { word: { cn, ipa } }
/** @type {Map<string, Record<string, { cn: string; ipa: string }>>} */
const chunks = new Map();
function getChunk(letter) {
  if (!chunks.has(letter)) chunks.set(letter, {});
  return chunks.get(letter);
}

const rl = readline.createInterface({ input: createReadStream(csvPath) });

let lineNo = 0;
let headerCols = [];

rl.on("line", (line) => {
  lineNo++;
  // ECDICT CSV header: word,phonetic,definition,translation,pos,collins,oxford,tag,...
  if (lineNo === 1) {
    headerCols = line.split(",");
    return;
  }

  // Simple CSV parse (handles quoted fields with commas)
  const cols = parseCSVLine(line);
  if (cols.length < 4) return;

  const word = cols[0].trim().toLowerCase();
  if (!word || !/^[a-z]/.test(word)) return;  // skip non-ASCII starts

  const phonetic = cols[1].trim();   // IPA
  const translation = cols[3].trim(); // Chinese translation lines

  if (!translation) return;

  // Take only the first meaningful translation line
  const cnLines = translation
    .split(/\n|\\n/)
    .map((l) => l.replace(/^[a-z]+\.?\s*/i, "").trim())  // strip pos like "n.", "v."
    .filter(Boolean);
  const cn = cnLines[0] ?? "";
  if (!cn) return;

  const letter = word[0];
  const chunk = getChunk(letter);
  // Don't overwrite a better entry
  if (!chunk[word]) {
    chunk[word] = { cn: cn.slice(0, 60), ipa: phonetic ? `/${phonetic}/` : "" };
  }
});

rl.on("close", () => {
  let totalWords = 0;
  for (const [letter, data] of chunks) {
    const count = Object.keys(data).length;
    totalWords += count;
    const outFile = path.join(outputDir, `${letter}.json`);
    fs.writeFileSync(outFile, JSON.stringify(data), "utf-8");
    console.log(`Wrote ${outFile} (${count} words)`);
  }
  console.log(`\nTotal: ${totalWords} words in ${chunks.size} chunks`);
  console.log(`Output directory: ${outputDir}`);
});

/**
 * Minimal CSV line parser (handles double-quoted fields with embedded commas/newlines).
 * @param {string} line
 * @returns {string[]}
 */
function parseCSVLine(line) {
  const result = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(field);
      field = "";
    } else {
      field += ch;
    }
  }
  result.push(field);
  return result;
}
