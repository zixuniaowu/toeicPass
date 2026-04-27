#!/usr/bin/env node
/**
 * scripts/build-en-dict-sqlite.mjs
 *
 * Processes ECDICT SQLite database (stardict.db) into per-letter JSON chunks.
 *
 * Usage:
 *   node apps/web/scripts/build-en-dict-sqlite.mjs <path/to/stardict.db> <output-dir>
 *
 * Requires: npm install better-sqlite3 (or use the one in the project)
 *
 * Output: a.json, b.json ... z.json in output-dir
 * Each file: Record<string, { cn: string; ipa: string }>
 */

import fs from "fs";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

const [,, dbPath, outputDir] = process.argv;

if (!dbPath || !outputDir) {
  console.error("Usage: node build-en-dict-sqlite.mjs <stardict.db> <output-dir>");
  process.exit(1);
}

// Dynamically require better-sqlite3 (install if missing)
let Database;
try {
  Database = require("better-sqlite3");
} catch {
  console.error("better-sqlite3 not found. Install it: npm install -D better-sqlite3");
  process.exit(1);
}

fs.mkdirSync(outputDir, { recursive: true });

const db = new Database(dbPath, { readonly: true });

// ECDICT schema: word, sw (simplified word), phonetic, definition, translation, pos, collins, oxford, frq, bnc...
// Filter: frq > 0 keeps only ~42K words with COCA/BNC frequency data (common words learners actually encounter)
const rows = db.prepare("SELECT word, phonetic, translation FROM stardict WHERE frq > 0 AND word GLOB '[a-zA-Z]*' ORDER BY word").all();
db.close();

console.log(`Loaded ${rows.length} rows from stardict.db`);

/** @type {Map<string, Record<string, { cn: string; ipa: string }>>} */
const chunks = new Map();

for (const row of rows) {
  const word = String(row.word ?? "").trim().toLowerCase();
  if (!word || !/^[a-z]/.test(word)) continue;

  const phonetic = String(row.phonetic ?? "").trim();
  const translation = String(row.translation ?? "").trim();
  if (!translation) continue;

  // Take first meaningful CN translation line (strip POS tags like "n.", "v.")
  const cnLines = translation
    .split(/\n/)
    .map((l) => l.replace(/^[a-z]+\.?\s+/i, "").trim())
    .filter(Boolean);
  const cn = cnLines[0] ?? "";
  if (!cn) continue;

  const letter = word[0];
  if (!chunks.has(letter)) chunks.set(letter, {});
  const chunk = chunks.get(letter);
  if (!chunk[word]) {
    chunk[word] = { cn: cn.slice(0, 60), ipa: phonetic ? `/${phonetic}/` : "" };
  }
}

let totalWords = 0;
for (const [letter, data] of chunks) {
  const count = Object.keys(data).length;
  totalWords += count;
  const outFile = path.join(outputDir, `${letter}.json`);
  fs.writeFileSync(outFile, JSON.stringify(data), "utf-8");
  console.log(`  ${outFile} — ${count} words`);
}

console.log(`\nTotal: ${totalWords} words across ${chunks.size} chunks`);
