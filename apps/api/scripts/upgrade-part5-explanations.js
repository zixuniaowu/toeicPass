#!/usr/bin/env node
/**
 * Upgrade Part 5 explanations — read mapping from JSON, apply to question-bank.json
 */
const fs = require("fs");
const path = require("path");

const mapFile = path.join(__dirname, "part5-explanation-map.json");
const bankFile = path.join(__dirname, "..", "src", "question-bank.json");

const map = JSON.parse(fs.readFileSync(mapFile, "utf8"));
const bank = JSON.parse(fs.readFileSync(bankFile, "utf8"));

let updated = 0;
for (const q of bank.questions) {
  if (Number(q.partNo) !== 5) continue;
  if (map[q.stem]) {
    q.explanation = map[q.stem];
    updated++;
  }
}

fs.writeFileSync(bankFile, JSON.stringify(bank, null, 2) + "\n", "utf8");
console.log(`Updated ${updated} / 113 Part 5 explanations`);
