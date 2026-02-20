const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'data', 'word-dictionary.ts');
const src = fs.readFileSync(filePath, 'utf-8');

// Find the DICT object
const dictStart = src.indexOf('const DICT');
if (dictStart === -1) { console.error('Cannot find DICT'); process.exit(1); }

const beforeDict = src.substring(0, dictStart);

// Find the opening brace of the DICT object
const braceStart = src.indexOf('{', dictStart);
// We need to find the matching closing brace
// Split into lines and process
const lines = src.substring(braceStart).split('\n');

const seenKeys = new Set();
const resultLines = [];
let removedCount = 0;
let inDuplicateEntry = false;
let braceDepth = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const trimmed = line.trim();

  if (inDuplicateEntry) {
    // Track brace depth to know when the duplicate entry ends
    for (const ch of line) {
      if (ch === '{') braceDepth++;
      if (ch === '}') braceDepth--;
    }
    if (braceDepth <= 0) {
      inDuplicateEntry = false;
      braceDepth = 0;
    }
    continue; // Skip this line (part of duplicate)
  }

  // Check if this line starts a new dictionary entry
  const entryMatch = trimmed.match(/^"([^"]+)":\s*\{/);
  if (entryMatch) {
    const key = entryMatch[1];
    if (seenKeys.has(key)) {
      removedCount++;
      // Count braces to know if entry ends on this line or continues
      braceDepth = 0;
      for (const ch of line) {
        if (ch === '{') braceDepth++;
        if (ch === '}') braceDepth--;
      }
      if (braceDepth > 0) {
        inDuplicateEntry = true;
      }
      continue; // Skip duplicate
    }
    seenKeys.add(key);
  }

  resultLines.push(line);
}

const newContent = beforeDict + 'const DICT' + src.substring(dictStart + 'const DICT'.length, braceStart) + resultLines.join('\n');

fs.writeFileSync(filePath, newContent, 'utf-8');
console.log(`Done. Removed ${removedCount} duplicate entries. Total unique keys: ${seenKeys.size}`);
