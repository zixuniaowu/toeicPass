const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
const tsFile = path.join(dataDir, 'shadowing-materials.ts');

// Read the expanded JSON files
const expandedB = JSON.parse(fs.readFileSync(path.join(dataDir, 'shadowing-materials-expanded-b.json'), 'utf-8'));
const expandedC = JSON.parse(fs.readFileSync(path.join(dataDir, 'shadowing-materials-expanded-c.json'), 'utf-8'));

const arrB = Array.isArray(expandedB) ? expandedB : expandedB.materials || [];
const arrC = Array.isArray(expandedC) ? expandedC : expandedC.materials || [];

// Build a map of id -> sentences
const expansionMap = {};
for (const m of [...arrB, ...arrC]) {
  if (m.id && m.sentences && m.sentences.length > 0) {
    expansionMap[m.id] = m.sentences;
  }
}

console.log('Expansion map has', Object.keys(expansionMap).length, 'materials');

// Read the TS file
let src = fs.readFileSync(tsFile, 'utf-8');

// For each material in the expansion map, find it in the TS file and replace its sentences
for (const [id, sentences] of Object.entries(expansionMap)) {
  // Find the material block by its id
  const idPattern = `id: "${id}"`;
  const idIndex = src.indexOf(idPattern);
  if (idIndex === -1) {
    console.log('  SKIP: id not found:', id);
    continue;
  }

  // Find the "sentences: [" after this id
  const sentencesStart = src.indexOf('sentences: [', idIndex);
  if (sentencesStart === -1 || sentencesStart - idIndex > 500) {
    console.log('  SKIP: sentences not found for:', id);
    continue;
  }

  // Find the matching closing bracket
  let depth = 0;
  let sentencesEnd = -1;
  for (let i = sentencesStart + 'sentences: '.length; i < src.length; i++) {
    if (src[i] === '[') depth++;
    if (src[i] === ']') {
      depth--;
      if (depth === 0) {
        sentencesEnd = i + 1;
        break;
      }
    }
  }

  if (sentencesEnd === -1) {
    console.log('  SKIP: closing bracket not found for:', id);
    continue;
  }

  // Check current sentence count
  const currentBlock = src.substring(sentencesStart, sentencesEnd);
  const currentCount = (currentBlock.match(/\{\s*id:\s*\d+/g) || []).length;

  if (sentences.length <= currentCount) {
    console.log('  SKIP:', id, '- already has', currentCount, 'sentences, expansion has', sentences.length);
    continue;
  }

  // Build the new sentences array
  const sentenceLines = sentences.map(s => {
    const text = s.text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const translation = s.translation.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return `      { id: ${s.id}, text: "${text}", translation: "${translation}" }`;
  });

  const newSentencesBlock = `sentences: [\n${sentenceLines.join(',\n')}\n    ]`;

  // Replace
  src = src.substring(0, sentencesStart) + newSentencesBlock + src.substring(sentencesEnd);
  console.log('  UPDATED:', id, currentCount, '->', sentences.length, 'sentences');
}

fs.writeFileSync(tsFile, src, 'utf-8');
console.log('\nDone! File written.');
