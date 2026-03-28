const fs = require("fs");
const path = require("path");

const dataDir = path.join(__dirname, "..", "data");
const materialSrc = fs.readFileSync(path.join(dataDir, "shadowing-materials.ts"), "utf8");
const tedSnapshot = JSON.parse(fs.readFileSync(path.join(dataDir, "ted-latest-shadowing.json"), "utf8"));
const dictSrc = fs.readFileSync(path.join(dataDir, "word-dictionary.ts"), "utf8");
const overrideSrc = fs.readFileSync(path.join(dataDir, "vocab-cn-overrides.ts"), "utf8");

function extractDictKeys(src) {
  const keys = new Set();
  const matches = src.match(/"([^"]+)":\s*\{/g) || [];
  matches.forEach((match) => {
    const key = match.match(/"([^"]+)"/)?.[1]?.toLowerCase();
    if (key && key !== "cn" && key !== "ipa") {
      keys.add(key);
    }
  });
  return keys;
}

function normalizeLookupTerm(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[\u2018\u2019\u2032]/g, "'")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[^a-z\s'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function baseFormCandidates(term) {
  const candidates = new Set([term]);
  if (term.endsWith("ies") && term.length > 4) candidates.add(`${term.slice(0, -3)}y`);
  if (term.endsWith("es") && term.length > 3) candidates.add(term.slice(0, -2));
  if (term.endsWith("s") && term.length > 3) candidates.add(term.slice(0, -1));
  if (term.endsWith("ied") && term.length > 4) candidates.add(`${term.slice(0, -3)}y`);
  if (term.endsWith("ed") && term.length > 3) {
    const base = term.slice(0, -2);
    candidates.add(base);
    candidates.add(`${base}e`);
    if (base.length >= 2 && base.at(-1) === base.at(-2)) {
      candidates.add(base.slice(0, -1));
    }
  }
  if (term.endsWith("ing") && term.length > 5) {
    const base = term.slice(0, -3);
    candidates.add(base);
    candidates.add(`${base}e`);
    if (base.length >= 2 && base.at(-1) === base.at(-2)) {
      candidates.add(base.slice(0, -1));
    }
  }
  return Array.from(candidates);
}

function addContractionCandidates(term, candidates) {
  if (term.includes(" ")) {
    return;
  }

  if (term.endsWith("'s") && term.length > 2) candidates.add(term.slice(0, -2));
  if (term.endsWith("s'") && term.length > 2) candidates.add(term.slice(0, -1));

  ["'d", "'ll", "'re", "'ve", "'m"].forEach((suffix) => {
    if (term.endsWith(suffix) && term.length > suffix.length) {
      candidates.add(term.slice(0, -suffix.length));
    }
  });

  if (term.endsWith("n't") && term.length > 3) {
    if (term === "won't") candidates.add("will");
    else if (term === "can't") candidates.add("can");
    else candidates.add(term.slice(0, -3));
  }

  if (term.startsWith("'") && term.length > 1) candidates.add(term.slice(1));
  if (term.endsWith("'") && term.length > 1) candidates.add(term.slice(0, -1));
}

function hasEntry(term, dictKeys) {
  const normalized = normalizeLookupTerm(term);
  if (!normalized) {
    return false;
  }

  const directCandidates = new Set([normalized]);
  addContractionCandidates(normalized, directCandidates);

  Array.from(directCandidates).forEach((candidate) => {
    if (candidate.includes("-")) {
      directCandidates.add(candidate.replace(/-/g, " "));
      directCandidates.add(candidate.replace(/-/g, ""));
    }
    if (candidate.includes(" ")) {
      directCandidates.add(candidate.replace(/\s+/g, "-"));
      directCandidates.add(candidate.replace(/\s+/g, ""));
    }
  });

  for (const candidate of directCandidates) {
    if (dictKeys.has(candidate)) {
      return true;
    }
  }

  if (normalized.includes(" ")) {
    return false;
  }

  const compact = normalized.replace(/[-']/g, "");
  for (const candidate of baseFormCandidates(compact)) {
    if (
      dictKeys.has(candidate) ||
      dictKeys.has(candidate.replace(/-/g, " ")) ||
      dictKeys.has(candidate.replace(/\s+/g, "-"))
    ) {
      return true;
    }
  }
  return false;
}

function collectCorpusTexts() {
  const texts = [];
  const textMatches = materialSrc.match(/text:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/g) || [];
  textMatches.forEach((match) => {
    const text = match.replace(/^text:\s*"/, "").replace(/"$/, "").replace(/\\"/g, "\"");
    if (text) {
      texts.push(text);
    }
  });

  const items = Array.isArray(tedSnapshot.items) ? tedSnapshot.items : [];
  items.forEach((item) => {
    const sentences = Array.isArray(item?.sentences) ? item.sentences : [];
    sentences.forEach((sentence) => {
      const text = String(sentence?.text ?? "").trim();
      if (text) {
        texts.push(text);
      }
    });
  });

  return texts;
}

const dictKeys = new Set([...extractDictKeys(dictSrc), ...extractDictKeys(overrideSrc)]);
const corpusTexts = collectCorpusTexts();
const missingFreq = new Map();
let totalTokens = 0;
let knownTokens = 0;

corpusTexts.forEach((text) => {
  text.split(/\s+/).forEach((token) => {
    const clean = token
      .replace(/[\u2018\u2019\u2032]/g, "'")
      .toLowerCase()
      .replace(/[^a-z'-]/g, "")
      .replace(/^[-']+|[-']+$/g, "");
    if (!clean) {
      return;
    }
    totalTokens += 1;
    if (hasEntry(clean, dictKeys)) {
      knownTokens += 1;
    } else {
      missingFreq.set(clean, (missingFreq.get(clean) || 0) + 1);
    }
  });
});

const missingRows = Array.from(missingFreq.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

console.log(`Corpus sentences: ${corpusTexts.length}`);
console.log(`Dictionary entries: ${dictKeys.size}`);
console.log(`Token coverage: ${knownTokens}/${totalTokens} (${((knownTokens / Math.max(1, totalTokens)) * 100).toFixed(2)}%)`);
console.log(`Missing unique words: ${missingRows.length}`);
console.log("--- Top missing words ---");
missingRows.slice(0, 250).forEach(([word, count]) => console.log(`${word}\t${count}`));
