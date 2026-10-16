#!/usr/bin/env node
/**
 * Import daily root-based vocabulary (toeic-vocab site format) into the app.
 *
 *   node scripts/import-vocab-days.mjs [sourceRepo=/workspace/toeic-vocab] [--days 1-14|all]
 *
 * Reads <source>/data/dayN.json + <source>/audio/dayN/<slug>.mp3 / <slug>_ex.mp3 and writes
 *   public/vocab-roots/dayN.json   normalized day data (loaded lazily by the Vocabulary tab)
 *   public/vocab-roots/index.json  day list (title, intro, roots)
 *   public/audio/vocab/dayN/*.mp3  word + example audio
 * Re-running is idempotent; new days are picked up automatically. Exits non-zero on invalid data.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, "..");
const args = process.argv.slice(2);
const source = path.resolve(args.find((a) => !a.startsWith("--")) ?? "/workspace/toeic-vocab");
const daysArg = (() => { const i = args.indexOf("--days"); return i >= 0 ? args[i + 1] : "all"; })();

export const slug = (w) => String(w).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "word";
const tr = (zh, ja, en) => ({ zh: zh ?? "", ja: ja ?? "", ...(en ? { en } : {}) });
const pairList = (rows) => (rows ?? []).map(([text, zh, ja, en]) => ({ text, ...tr(zh, ja, en) }));

export function normalizeDay(raw, { audioDir } = {}) {
  const errors = [];
  const need = (cond, msg) => { if (!cond) errors.push(`day${raw?.day}: ${msg}`); };
  need(Number.isInteger(raw?.day) && raw.day > 0, "missing day number");
  need(Array.isArray(raw?.roots) && raw.roots.length > 0, "no roots");
  need(Array.isArray(raw?.groups) && raw.groups.length > 0, "no groups");
  const day = raw.day;
  const rootIds = new Set();
  const roots = (raw.roots ?? []).map((r) => {
    need(r.root && r.zh && r.ja && r.exp_zh && r.exp_ja, `root ${r.root} incomplete`);
    return { root: r.root, origin: r.origin ?? "", meaning: tr(r.zh, r.ja, r.en), explanation: tr(r.exp_zh, r.exp_ja, r.exp_en), examples: r.examples ?? [] };
  });
  const seen = new Set();
  const groups = (raw.groups ?? []).map((g, gi) => {
    const rootIdx = roots.findIndex((r) => r.root.replace(/[-\s]/g, "").split("/").some((p) => p && p.startsWith(g.id)) || r.root.includes(g.id));
    const kind = rootIdx >= 0 && gi < roots.length ? "root" : "theme";
    if (kind === "root") rootIds.add(g.id);
    const words = (g.words ?? []).map((w) => {
      const s = slug(w.w);
      need(!seen.has(s), `duplicate word ${w.w}`); seen.add(s);
      need(w.w && w.ipa && w.zh && w.ja && w.ex && w.ex_zh && w.ex_ja, `word ${w.w} incomplete`);
      if (audioDir) {
        need(fs.existsSync(path.join(audioDir, `${s}.mp3`)), `missing audio ${s}.mp3`);
        need(fs.existsSync(path.join(audioDir, `${s}_ex.mp3`)), `missing audio ${s}_ex.mp3`);
      }
      return {
        id: s, w: w.w, pos: w.pos ?? "", ipa: w.ipa,
        meaning: tr(w.zh, w.ja, w.en),
        ex: w.ex, exTr: tr(w.ex_zh, w.ex_ja, w.ex_en),
        parts: pairList(w.parts), forms: pairList(w.forms),
        note: w.note ? tr(w.note.zh, w.note.ja, w.note.en) : null,
        tip: w.tip ? tr(w.tip.zh, w.tip.ja, w.tip.en) : null,
        audio: `/audio/vocab/day${day}/${s}.mp3`, exAudio: `/audio/vocab/day${day}/${s}_ex.mp3`,
      };
    });
    return { id: g.id, kind, rootIndex: kind === "root" ? rootIdx : -1, title: tr(g.title_zh, g.title_ja, g.title_en), words };
  });
  return {
    errors,
    day: { day, date: raw.date ?? "", title: tr(raw.title_zh, raw.title_ja, raw.title_en), intro: tr(raw.intro_zh, raw.intro_ja, raw.intro_en), roots, groups },
  };
}

function main() {
  const dataDir = path.join(source, "data");
  let files = fs.readdirSync(dataDir).filter((f) => /^day\d+\.json$/.test(f)).map((f) => Number(f.match(/\d+/)[0])).sort((a, b) => a - b);
  if (daysArg !== "all") { const [a, b = a] = daysArg.split("-").map(Number); files = files.filter((n) => n >= a && n <= b); }
  const outDir = path.join(webRoot, "public/vocab-roots");
  fs.mkdirSync(outDir, { recursive: true });
  const allErrors = [];
  for (const n of files) {
    const raw = JSON.parse(fs.readFileSync(path.join(dataDir, `day${n}.json`), "utf8"));
    const audioDir = path.join(source, "audio", `day${n}`);
    const { errors, day } = normalizeDay(raw, { audioDir });
    if (errors.length) { allErrors.push(...errors); continue; }
    fs.writeFileSync(path.join(outDir, `day${n}.json`), JSON.stringify(day));
    const dest = path.join(webRoot, "public/audio/vocab", `day${n}`);
    fs.mkdirSync(dest, { recursive: true });
    for (const g of day.groups) for (const w of g.words) for (const f of [`${w.id}.mp3`, `${w.id}_ex.mp3`]) {
      const to = path.join(dest, f);
      if (!fs.existsSync(to) || fs.statSync(to).size !== fs.statSync(path.join(audioDir, f)).size) fs.copyFileSync(path.join(audioDir, f), to);
    }
    console.log(`day${n}: ${day.roots.length} roots, ${day.groups.reduce((s, g) => s + g.words.length, 0)} words`);
  }
  if (allErrors.length) { console.error(allErrors.join("\n")); process.exit(1); }
  // Rebuild index from everything present in public/vocab-roots (keeps previously imported days).
  const index = fs.readdirSync(outDir).filter((f) => /^day\d+\.json$/.test(f))
    .map((f) => JSON.parse(fs.readFileSync(path.join(outDir, f), "utf8")))
    .sort((a, b) => a.day - b.day)
    .map((d) => ({ day: d.day, date: d.date, title: d.title, intro: d.intro, roots: d.roots.map((r) => ({ root: r.root, meaning: r.meaning })), wordCount: d.groups.reduce((s, g) => s + g.words.length, 0) }));
  fs.writeFileSync(path.join(outDir, "index.json"), JSON.stringify({ days: index }));
  console.log(`index: ${index.length} days`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
