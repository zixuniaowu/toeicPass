const fs = require('fs');
const matSrc = fs.readFileSync('data/shadowing-materials.ts', 'utf8');
const dictSrc = fs.readFileSync('data/word-dictionary.ts', 'utf8');

// Extract all words from materials
const textMatches = matSrc.match(/text: "([^"]*)"/g) || [];
const allWords = new Set();
textMatches.forEach(m => {
  const text = m.replace(/^text: "/, '').replace(/"$/, '');
  text.split(/\s+/).forEach(w => {
    const clean = w.toLowerCase().replace(/[^a-z'-]/g, '').replace(/^-+|-+$/g, '');
    if (clean && clean.length > 0) allWords.add(clean);
  });
});

// Extract dict keys
const dictKeys = new Set();
const keyMatches = dictSrc.match(/"([^"]+)":\s*\{/g) || [];
keyMatches.forEach(m => {
  const key = m.match(/"([^"]+)"/)[1];
  if (key !== 'cn' && key !== 'ipa') dictKeys.add(key);
});

// Find missing words
const missing = [];
allWords.forEach(w => { if (!dictKeys.has(w)) missing.push(w); });
missing.sort();
console.log('Total unique words:', allWords.size);
console.log('In dictionary:', dictKeys.size);
console.log('Missing:', missing.length);
console.log(missing.join('\n'));
