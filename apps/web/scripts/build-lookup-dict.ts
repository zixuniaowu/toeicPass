/**
 * Builds the bundled lookup dictionary used by the selection popup and inline glosses.
 * Every word in every bundled shadowing material must resolve (100% coverage, checked in tests).
 */
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { getShadowingMaterialsByLanguage } from "@toeicpass/shadowing-content";
import { annotateTerm } from "../data/word-dictionary";
import { arpabetToIpa, spellAcronymIpa, tokenizeEnglish } from "../lib/lookup-core";

const here = __dirname;
const dataDir = path.join(here, "lookup-data");
const outDir = path.join(here, "..", "data", "lookup");
const readJson = (f: string) => JSON.parse(fs.readFileSync(path.join(dataDir, f), "utf8")) as Record<string, string>;
const readOver = (f: string) =>
  Object.fromEntries(
    fs.readFileSync(path.join(dataDir, f), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
  );

const cmuPath = "/tmp/cmudict.dict";
if (!fs.existsSync(cmuPath)) execSync(`curl -sL -o ${cmuPath} https://raw.githubusercontent.com/cmusphinx/cmudict/master/cmudict.dict`);
const cmu = new Map<string, string>();
for (const line of fs.readFileSync(cmuPath, "utf8").split("\n")) {
  const m = line.match(/^(\S+?)(?:\(\d+\))?\s+(.+?)(?:\s+#.*)?$/);
  if (m && !cmu.has(m[1])) cmu.set(m[1], m[2]);
}

const enJa = { ...readJson("mt-en-ja.json"), ...readOver("ja-over.txt") };
const enZh = { ...readJson("mt-en-zh.json"), ...readOver("zh-en-over.txt") };
const ipaOver = readOver("ipa-over.txt");
const zhEnOver = readOver("zh-en-over.txt");
const PARTICLES: Record<string, string> = {
  は: "（主题助词）", が: "（主语助词）；但是", を: "（宾语助词）", に: "在；向；给", で: "在；用；以", と: "和；与；（引用）",
  も: "也", の: "的", へ: "向；往", から: "从；因为", まで: "到；直到", より: "比；从", や: "和（列举）", か: "吗（疑问）；或",
  ね: "呢；吧（确认）", よ: "哟（提醒）", て: "（连接）", で_: "", た: "（过去／完成）", ます: "（礼貌语尾）", です: "是（礼貌）",
  ない: "不；没有", だ: "是", れる: "被；能（助动词）", られる: "被；能（助动词）", せる: "使；让", させる: "使；让", たい: "想要",
  う: "吧（意志）", よう: "吧；好像", ん: "（口语）", ば: "如果", けど: "但是", けれど: "但是", ながら: "一边～一边",
  など: "等等", ので: "因为", のに: "却；明明", し: "而且", だけ: "只；仅", しか: "只（接否定）", ほど: "程度；越～越",
  くらい: "大约", ぐらい: "大约", って: "（引用）；说是", な: "（感叹／禁止）", わ: "（语气）", ぞ: "（强调语气）", かな: "吗（自问）",
  ば_: "", つつ: "一边；虽然", ずつ: "各；每", ばかり: "光；刚刚", こそ: "正是", さえ: "甚至", でも: "即使；但是", ちゃう: "～完（口语）",
  らしい: "好像", みたい: "好像", ぬ: "不（文语）", ず: "不", まい: "不会；不要", べし: "应该", ごとし: "如同", き: "（过去，文语）",
  けり: "（过去，文语）", なり: "是（文语）", たり: "又～又～", ものの: "虽然", とも: "即使；都", ても: "即使", ては: "如果～就",
  だろ: "吧", でしょ: "吧（推测）",
};
const jaZh = { ...PARTICLES, ...readJson("mt-ja-zh.json"), ...readOver("zh-over.txt") };

function ipaFor(word: string, acronym: boolean): string | null {
  if (acronym) return spellAcronymIpa(word);
  const parts = word.split(/[\s]+/).filter(Boolean);
  const out: string[] = [];
  for (const p of parts) {
    const segs = p.split("-").filter(Boolean);
    const segIpa = segs.map((s) => (cmu.has(s) ? arpabetToIpa(cmu.get(s)!) : /^[a-z]$/.test(s) ? spellAcronymIpa(s) : null));
    if (segIpa.some((x) => !x)) return null;
    out.push(segIpa.map((x) => x!.replace(/^\/|\/$/g, "")).join(" "));
  }
  return out.length ? `/${out.join(" ")}/` : null;
}

// ── English ──
type EnEntry = { ipa: string; zh: string; ja: string };
const en: Record<string, EnEntry> = {};
const missing: string[] = [];
const enMaterials = getShadowingMaterialsByLanguage("en");
const enTerms = new Map<string, boolean>(); // term → acronym?
for (const m of enMaterials) {
  for (const s of m.sentences) for (const t of tokenizeEnglish(s.text)) {
    enTerms.set(t.clean, (enTerms.get(t.clean) ?? false) || t.acronym);
    if (t.clean.includes("-")) t.clean.split("-").filter(Boolean).forEach((p) => enTerms.has(p) || enTerms.set(p, false));
  }
  for (const v of m.vocabulary ?? []) enTerms.set(v.term.toLowerCase(), false);
}
const ACRONYMS = new Set(["api", "ci", "cpu", "sso", "slo", "url", "utc", "waf", "id", "ids", "pm", "ai", "ui", "kpi", "roi"]);
for (const [term, acr] of enTerms) {
  const acronym = acr || ACRONYMS.has(term);
  const base = annotateTerm(term);
  const zh = (zhEnOver[term] ?? base.cn ?? enZh[term] ?? "").trim();
  const ja = (enJa[term] ?? "").trim();
  const ipa = ipaFor(term === "ids" ? "id" : term, acronym) ?? (term === "ids" ? null : null);
  const finalIpa = term === "ids" ? "/ˌaɪ ˈdiːz/" : ipaOver[term] ?? ipa ?? "";
  if (!zh || !ja || !finalIpa) missing.push(`${term} zh=${zh} ja=${ja} ipa=${finalIpa}`);
  en[term] = { ipa: finalIpa, zh, ja };
}

// ── Japanese ──
type JaEntry = { r: string; zh: string; b?: string };
const ja: Record<string, JaEntry> = {};
const kuromoji = require("kuromoji");
const kataToHira = (s: string) => s.replace(/[\u30a1-\u30f6]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
kuromoji.builder({ dicPath: path.join(here, "../../../node_modules/kuromoji/dict") }).build((err: unknown, tk: any) => {
  if (err) throw err;
  for (const m of getShadowingMaterialsByLanguage("ja")) for (const s of m.sentences) for (const t of tk.tokenize(s.text)) {
    const surface: string = t.surface_form;
    if (t.pos === "記号" || /^[\s\d０-９、。「」『』！？（）・…,.!?:：ー〜~/%％—-]+$/.test(surface)) continue;
    const baseForm = t.basic_form && t.basic_form !== "*" ? t.basic_form : surface;
    const reading = kataToHira(t.reading && t.reading !== "*" ? t.reading : surface);
    const functional = t.pos === "助詞" || t.pos === "助動詞";
    const zh = (jaZh[baseForm] ?? jaZh[surface] ?? "").trim() || (functional ? "（语法成分）" : "");
    if (!zh) missing.push(`ja ${surface}/${baseForm}`);
    if (!ja[surface]) ja[surface] = { r: reading, zh, ...(baseForm !== surface ? { b: baseForm } : {}) };
  }
  // Single characters left over by greedy longest-match segmentation at runtime.
  const EXTRA: Record<string, JaEntry> = { え: { r: "え", zh: "诶（感叹）" }, け: { r: "け", zh: "（语气／接尾）" }, 知: { r: "ち", zh: "知识；智慧" } };
  for (const [k, v] of Object.entries(EXTRA)) if (!ja[k]) ja[k] = v;
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "en.json"), JSON.stringify(en));
  fs.writeFileSync(path.join(outDir, "ja.json"), JSON.stringify(ja));
  console.log(`en ${Object.keys(en).length}, ja ${Object.keys(ja).length}, missing ${missing.length}`);
  if (missing.length) console.log(missing.join("\n"));
});
