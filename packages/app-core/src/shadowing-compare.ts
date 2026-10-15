/**
 * Tolerant shadowing comparison for English and Japanese.
 *
 * English: normalization (quotes, hyphens, contractions, abbreviations,
 * ordinals, numbers, times, currency) → homophone keys → weighted Levenshtein
 * word alignment (insertions/deletions/substitutions) with fuzzy and
 * Double Metaphone "close" matches → percentage score + per-word feedback.
 *
 * Japanese: both sides are reduced to a phonetic hiragana key (long vowels,
 * particle は/わ・を/お・へ/え, small kana, numbers) → mora-level Levenshtein
 * alignment mapped back to the target segments.
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const doubleMetaphone: (word: string) => [string, string] = require("double-metaphone");

export type TrainingLanguage = "en" | "ja";

export type CompareStatus = "correct" | "close" | "wrong" | "missing" | "extra";

export type FeedbackTip =
  | "contraction"
  | "ending-s"
  | "ending-ed"
  | "function-word"
  | "th-sound"
  | "l-r"
  | "v-b"
  | "number"
  | "long-vowel"
  | "small-tsu"
  | "voicing"
  | "extra"
  | "missing"
  | "mispronounced";

export type CompareWord = {
  /** Word shown to the learner (target surface, or the heard word for extras). */
  word: string;
  status: CompareStatus;
  /** What the recognizer heard for this word (if anything). */
  heard?: string;
  /** Expected (normalized) form. */
  expected?: string;
  tip?: FeedbackTip;
};

export type CompareResult = { words: CompareWord[]; accuracy: number };

/**
 * A single phonetic token used for Japanese comparison.
 * `surface` is the original kanji/kana token shown to the learner.
 * `reading` is the hiragana/katakana form used for matching against STT output.
 */
export type PhoneticSegment = {
  surface: string;
  reading: string;
};

// ───────────────────────────── English ─────────────────────────────

const UNITS: Record<string, number> = {
  zero: 0, oh: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};
const SCALES: Record<string, number> = { hundred: 100, thousand: 1000, million: 1e6, billion: 1e9 };
const ORDINALS: Record<string, number> = {
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8,
  ninth: 9, tenth: 10, eleventh: 11, twelfth: 12, thirteenth: 13, fourteenth: 14,
  fifteenth: 15, sixteenth: 16, seventeenth: 17, eighteenth: 18, nineteenth: 19,
  twentieth: 20, thirtieth: 30, fortieth: 40, fiftieth: 50, hundredth: 100,
};

const CONTRACTIONS: Record<string, string> = {
  "won't": "will not", "can't": "can not", "cannot": "can not", "shan't": "shall not",
  "ain't": "is not", "let's": "let us", "y'all": "you all", "o'clock": "oclock",
  "it's": "it is", "that's": "that is", "what's": "what is", "there's": "there is",
  "here's": "here is", "he's": "he is", "she's": "she is", "who's": "who is",
  "where's": "where is", "how's": "how is", "when's": "when is", "why's": "why is",
  "gonna": "going to", "wanna": "want to", "gotta": "got to",
};

const ABBREVIATIONS: Record<string, string> = {
  "mr": "mister", "mrs": "missus", "ms": "miz", "dr": "doctor", "st": "street",
  "ave": "avenue", "jr": "junior", "sr": "senior", "vs": "versus", "etc": "etcetera",
  "dept": "department", "approx": "approximately", "inc": "incorporated",
  "corp": "corporation", "ltd": "limited", "co": "company", "no": "no",
  "e-mail": "email", "ok": "okay", "o.k": "okay", "a.m": "am", "p.m": "pm",
  "u.s": "us", "u.k": "uk", "asap": "asap", "fyi": "fyi",
};

/** Homophone groups: every member maps to the same comparison key. */
const HOMOPHONE_GROUPS: string[][] = [
  ["to", "too", "two", "2"], ["for", "four", "fore", "4"], ["one", "won", "1"],
  ["eight", "ate", "8"], ["their", "there"], ["hear", "here"], ["know", "no"],
  ["right", "write", "rite"], ["buy", "by", "bye"], ["weather", "whether"],
  ["week", "weak"], ["see", "sea"], ["meet", "meat"], ["would", "wood"],
  ["peace", "piece"], ["mail", "male"], ["sale", "sail"], ["fare", "fair"],
  ["hire", "higher"], ["hour", "our"], ["new", "knew"], ["wait", "weight"],
  ["steal", "steel"], ["principal", "principle"], ["break", "brake"],
  ["sent", "cent", "scent"], ["site", "sight", "cite"], ["role", "roll"],
  ["seen", "scene"], ["plain", "plane"], ["through", "threw"], ["whole", "hole"],
  ["board", "bored"], ["suite", "sweet"], ["pair", "pear"], ["flour", "flower"],
  ["its", "it's"], ["your", "you're"], ["lets", "let's"], ["ok", "okay"],
];
const HOMOPHONE_KEY: Record<string, string> = {};
for (const group of HOMOPHONE_GROUPS) for (const w of group) HOMOPHONE_KEY[w] = group[0];

const FILLERS = new Set(["uh", "um", "er", "erm", "ah", "eh", "hmm", "mm", "uhm", "huh"]);
const FUNCTION_WORDS = new Set([
  "a", "an", "the", "of", "to", "and", "in", "on", "at", "for", "is", "are", "was",
  "be", "it", "that", "this", "with", "as", "or", "but", "will", "would", "have", "has", "do",
]);

type Token = { norm: string; src: number };

function cleanApostrophes(text: string): string {
  return text.normalize("NFKC").replace(/[\u2018\u2019\u201B\u2032\u0060\u00B4]/g, "'").replace(/[\u201C\u201D\u201E]/g, '"');
}


/** Pre-token text rewrites: currency, percent, times, ordinals in digit form. */
function rewriteSpecials(text: string): string {
  return text
    .replace(/\$\s?(\d[\d,]*(?:\.\d+)?)\s*(k|m|million|billion|thousand)?/gi, (_m, num: string, scale?: string) => {
      const s = scale ? ` ${({ k: "thousand", m: "million" } as Record<string, string>)[scale.toLowerCase()] ?? scale}` : "";
      return ` ${num}${s} dollars `;
    })
    .replace(/(\d)\s?%/g, "$1 percent")
    .replace(/\b(\d{1,2}):00\b/g, "$1 oclock")
    .replace(/\b(\d{1,2}):(\d{2})\b/g, (_m, h: string, mm: string) => ` ${h} ${mm.startsWith("0") ? `oh ${mm[1]}` : mm} `)
    .replace(/\b(\d+)(st|nd|rd|th)\b/gi, "$1th")
    .replace(/(\d),(\d{3})/g, "$1$2")
    .replace(/\b([ap])\.\s?m\.?/gi, "$1m")
    .replace(/&/g, " and ");
}

/** Convert a run of number words to a digit token; returns [value, consumed]. */
function parseNumberWords(words: string[], start: number): [string, number] | null {
  let total = 0;
  let current = 0;
  let consumed = 0;
  let any = false;
  let ordinal = false;
  for (let i = start; i < words.length; i++) {
    const w = words[i];
    const lastTwo = current % 100;
    if (w in UNITS && w !== "oh") {
      // "twenty five" ok; "ten five" / "five six" are separate numbers
      if (any && !(lastTwo === 0 || (lastTwo >= 20 && lastTwo % 10 === 0 && UNITS[w] < 10))) break;
      current += UNITS[w]; any = true; consumed++; continue;
    }
    if (w in TENS) {
      if (any && lastTwo !== 0) break;
      current += TENS[w]; any = true; consumed++; continue;
    }
    if (w in ORDINALS) {
      const v = ORDINALS[w];
      if (any && v < 100 && !(lastTwo === 0 || (lastTwo >= 20 && lastTwo % 10 === 0 && v < 10))) break;
      if (v === 100) current = (current || 1) * 100; else current += v;
      any = true; consumed++; ordinal = true; break;
    }
    if (w in SCALES && any) {
      const scale = SCALES[w];
      if (scale === 100) current *= 100; else { total += current * scale; current = 0; }
      consumed++; continue;
    }
    if (w === "and" && any && i + 1 < words.length && (words[i + 1] in UNITS || words[i + 1] in TENS)) {
      consumed++; continue;
    }
    break;
  }
  if (!any) return null;
  const value = total + current;
  return [ordinal ? `${value}th` : String(value), consumed];
}

/** Normalize English text into comparison tokens (with source word indices). */
function tokenizeEnglish(text: string, dropFillers: boolean): { tokens: Token[]; surfaces: string[] } {
  const surfaces = cleanApostrophes(String(text ?? "")).split(/\s+/).filter(Boolean);
  const tokens: Token[] = [];
  surfaces.forEach((surface, src) => {
    let s = rewriteSpecials(surface).toLowerCase();
    // abbreviations with trailing period ("Mr.", "Dr.")
    s = s.replace(/[!?;:,"()[\]{}<>…]+/g, " ");
    for (const piece of s.split(/\s+/).filter(Boolean)) {
      let p = piece.replace(/^[.'\-]+|[.'\-]+$/g, "");
      if (!p) continue;
      if (p in ABBREVIATIONS) p = ABBREVIATIONS[p];
      else if (p.replace(/\./g, "") in ABBREVIATIONS && p.includes(".")) p = ABBREVIATIONS[p.replace(/\./g, "")];
      if (p in CONTRACTIONS) p = CONTRACTIONS[p];
      else p = p
        .replace(/n't$/, " not")
        .replace(/'re$/, " are")
        .replace(/'ve$/, " have")
        .replace(/'ll$/, " will")
        .replace(/'d$/, " would")
        .replace(/^i'm$/, "i am")
        .replace(/'s$/, "s")
        .replace(/s'$/, "s");
      // hyphenated compounds and dotted forms become a single joined token
      p = p.replace(/\.(?=\d)/g, "point").replace(/[.]/g, "");
      for (let part of p.split(/\s+/).filter(Boolean)) {
        part = part.replace(/'/g, "");
        if (part.includes("-")) part = part.replace(/-/g, "");
        if (!part) continue;
        if (dropFillers && FILLERS.has(part)) continue;
        tokens.push({ norm: part, src });
      }
    }
  });
  // second pass: number words → digits
  const out: Token[] = [];
  const words = tokens.map((t) => t.norm);
  for (let i = 0; i < tokens.length; ) {
    const parsed = parseNumberWords(words, i);
    if (parsed && !(parsed[1] === 1 && (words[i] === "one" || words[i] === "second") && !isNumericContext(words, i))) {
      out.push({ norm: parsed[0], src: tokens[i].src });
      i += parsed[1];
    } else {
      out.push(tokens[i]);
      i++;
    }
  }
  // ordinal digits "1th"/"21th" normalized already; "point" decimals ok
  return { tokens: out, surfaces };
}

function isNumericContext(words: string[], i: number): boolean {
  // "one" / "second" are often non-numeric ("one of", "a second"); treat as number
  // only when followed/preceded by another number-ish token.
  const next = words[i + 1];
  const prev = words[i - 1];
  return Boolean((next && (next in SCALES || /^\d/.test(next))) || (prev && /^\d/.test(prev)));
}

/** Public: normalized English tokens (kept for backward compatibility). */
export function normalizeEnglish(text: string): string[] {
  return tokenizeEnglish(text, false).tokens.map((t) => t.norm);
}

function keyOf(norm: string): string {
  return HOMOPHONE_KEY[norm] ?? norm;
}

/** Merge adjacent tokens on one side when their concatenation matches a token on the other side. */
function mergeCompounds(a: Token[], bSet: Set<string>): Token[] {
  const out: Token[] = [];
  for (let i = 0; i < a.length; i++) {
    if (i + 1 < a.length && !bSet.has(a[i].norm) && bSet.has(a[i].norm + a[i + 1].norm)) {
      out.push({ norm: a[i].norm + a[i + 1].norm, src: a[i].src });
      i++;
    } else out.push(a[i]);
  }
  return out;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

export function similarity(a: string, b: string): number {
  const max = Math.max(a.length, b.length);
  return max === 0 ? 1 : 1 - levenshtein(a, b) / max;
}

function phoneticMatch(a: string, b: string): boolean {
  if (/\d/.test(a) || /\d/.test(b)) return false;
  const [a1, a2] = doubleMetaphone(a);
  const [b1, b2] = doubleMetaphone(b);
  if (!a1 || !b1) return false;
  return a1 === b1 || a1 === b2 || a2 === b1 || (a2 !== "" && a2 === b2);
}

type MatchKind = "exact" | "close" | "none";

function matchKind(expected: string, heard: string): MatchKind {
  if (keyOf(expected) === keyOf(heard)) return "exact";
  if (/^\d/.test(expected) || /^\d/.test(heard)) return "none";
  const sim = similarity(expected, heard);
  if (sim >= 0.8 && Math.min(expected.length, heard.length) >= 3) return "close";
  if (phoneticMatch(expected, heard)) return "close";
  if (sim >= 0.67 && Math.min(expected.length, heard.length) >= 5) return "close";
  return "none";
}

type Op = { kind: "match" | "close" | "sub" | "del" | "ins"; t?: number; s?: number };

/** Weighted Levenshtein alignment over word sequences. */
function alignTokens(target: string[], spoken: string[], kind: (a: string, b: string, i: number) => MatchKind): Op[] {
  const m = target.length, n = spoken.length;
  const COST = { exact: 0, close: 0.4, none: 1 } as const;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  const bt: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  const kinds: MatchKind[][] = Array.from({ length: m }, (_, i) => spoken.map((s) => kind(target[i], s, i)));
  for (let i = 1; i <= m; i++) { dp[i][0] = i; bt[i][0] = 1; }
  for (let j = 1; j <= n; j++) { dp[0][j] = j * 0.9; bt[0][j] = 2; }
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const diag = dp[i - 1][j - 1] + COST[kinds[i - 1][j - 1]];
      const del = dp[i - 1][j] + 1;
      const ins = dp[i][j - 1] + 0.9;
      if (diag <= del && diag <= ins) { dp[i][j] = diag; bt[i][j] = 0; }
      else if (del <= ins) { dp[i][j] = del; bt[i][j] = 1; }
      else { dp[i][j] = ins; bt[i][j] = 2; }
    }
  }
  const ops: Op[] = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    const b = i > 0 && j > 0 ? bt[i][j] : i > 0 ? 1 : 2;
    if (b === 0) {
      const k = kinds[i - 1][j - 1];
      ops.push({ kind: k === "exact" ? "match" : k === "close" ? "close" : "sub", t: i - 1, s: j - 1 });
      i--; j--;
    } else if (b === 1) { ops.push({ kind: "del", t: i - 1 }); i--; }
    else { ops.push({ kind: "ins", s: j - 1 }); j--; }
  }
  return ops.reverse();
}

function englishTip(surface: string, expected: string, heard: string | undefined, status: CompareStatus): FeedbackTip | undefined {
  if (status === "correct") return undefined;
  if (status === "extra") return "extra";
  if (/'/.test(cleanApostrophes(surface))) return "contraction";
  if (/^\d/.test(expected)) return "number";
  if (heard) {
    if ((expected.endsWith("s") && heard === expected.slice(0, -1)) || (heard.endsWith("s") && expected === heard.slice(0, -1))) return "ending-s";
    if ((expected.endsWith("ed") || expected.endsWith("d")) && (heard === expected.replace(/e?d$/, ""))) return "ending-ed";
    if (/th/.test(expected) && !/th/.test(heard)) return "th-sound";
    if (expected.replace(/l/g, "r") === heard.replace(/l/g, "r") && expected !== heard) return "l-r";
    if (expected.replace(/v/g, "b") === heard.replace(/v/g, "b") && expected !== heard) return "v-b";
  }
  if (FUNCTION_WORDS.has(expected) && status === "missing") return "function-word";
  if (status === "missing") return "missing";
  return "mispronounced";
}

const STATUS_RANK: Record<CompareStatus, number> = { correct: 0, close: 1, wrong: 2, missing: 3, extra: 4 };

function compareEnglish(original: string, spoken: string): CompareResult {
  const t = tokenizeEnglish(original, false);
  const s = tokenizeEnglish(spoken, true);
  if (t.tokens.length === 0) return { words: [], accuracy: 0 };
  const tSet = new Set(t.tokens.map((x) => x.norm));
  const sMerged = mergeCompounds(s.tokens, tSet);
  const sSet = new Set(sMerged.map((x) => x.norm));
  const tMerged = mergeCompounds(t.tokens, sSet);
  const tNorm = tMerged.map((x) => x.norm);
  const sNorm = sMerged.map((x) => x.norm);
  const ops = alignTokens(tNorm, sNorm, matchKind);

  // Aggregate per target source word; extras become standalone entries.
  type Agg = { status: CompareStatus; heard: string[]; expected: string[] };
  const per = new Map<number, Agg>();
  const extrasBefore = new Map<number, string[]>(); // keyed by next target src index
  let matched = 0, close = 0, inserted = 0;
  let lastSrc = -1;
  const tokenStatus = (k: Op["kind"]): CompareStatus => (k === "match" ? "correct" : k === "close" ? "close" : k === "sub" ? "wrong" : "missing");
  for (const op of ops) {
    if (op.kind === "ins") {
      inserted++;
      const key = lastSrc;
      const list = extrasBefore.get(key) ?? [];
      list.push(sNorm[op.s!]);
      extrasBefore.set(key, list);
      continue;
    }
    const tok = tMerged[op.t!];
    lastSrc = tok.src;
    if (op.kind === "match") matched++;
    if (op.kind === "close") close++;
    const agg = per.get(tok.src) ?? { status: "correct" as CompareStatus, heard: [], expected: [] };
    const st = tokenStatus(op.kind);
    if (STATUS_RANK[st] > STATUS_RANK[agg.status]) agg.status = st;
    agg.expected.push(tok.norm);
    if (op.s !== undefined) agg.heard.push(sNorm[op.s]);
    per.set(tok.src, agg);
  }

  const words: CompareWord[] = [];
  const pushExtras = (key: number) => {
    for (const e of extrasBefore.get(key) ?? []) words.push({ word: e, status: "extra", heard: e, tip: "extra" });
  };
  pushExtras(-1);
  t.surfaces.forEach((surface, src) => {
    const agg = per.get(src);
    if (!agg) { pushExtras(src); return; }
    // A word partially matched (e.g. "it's" → "it" ok, "is" missing) counts as close.
    let status = agg.status;
    if (status === "missing" && agg.heard.length > 0) status = "close";
    const expected = agg.expected.join(" ");
    const heard = agg.heard.length ? agg.heard.join(" ") : undefined;
    const display = surface.replace(/^[^\p{L}\p{N}$]+|[^\p{L}\p{N}%']+$/gu, "") || surface;
    words.push({ word: display, status, heard, expected, tip: englishTip(surface, expected, heard, status) });
    pushExtras(src);
  });

  const n = tNorm.length;
  const extraPenalty = Math.max(0, inserted - 0) * 0.5;
  const accuracy = Math.max(0, Math.min(100, Math.round((100 * (matched + 0.6 * close)) / (n + extraPenalty))));
  return { words, accuracy };
}

// ───────────────────────────── Japanese ─────────────────────────────

const SMALL_TO_LARGE: Record<string, string> = { "ぁ": "あ", "ぃ": "い", "ぅ": "う", "ぇ": "え", "ぉ": "お", "ゎ": "わ" };
const COMBINING_SMALL = new Set(["ゃ", "ゅ", "ょ", "ぁ", "ぃ", "ぅ", "ぇ", "ぉ", "ゎ"]);
const VOWEL_OF: Record<string, string> = {};
(() => {
  const rows: Record<string, string> = {
    あ: "あかさたなはまやらわがざだばぱゃ", い: "いきしちにひみりぎじぢびぴ",
    う: "うくすつぬふむゆるぐずづぶぷゅ", え: "えけせてねへめれげぜでべぺ",
    お: "おこそとのほもよろをごぞどぼぽょ",
  };
  for (const [v, chars] of Object.entries(rows)) for (const c of chars) VOWEL_OF[c] = v;
})();

function katakanaToHiragana(text: string): string {
  return text.replace(/[\u30A1-\u30F6]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
}

const JA_DIGITS = ["", "いち", "に", "さん", "よん", "ご", "ろく", "なな", "はち", "きゅう"];

/** Convert an integer to a hiragana reading (handles common sound changes). */
export function numberToKana(value: number): string {
  if (!Number.isFinite(value) || value < 0) return String(value);
  if (value === 0) return "ぜろ";
  const parts: string[] = [];
  const oku = Math.floor(value / 1e8);
  const man = Math.floor((value % 1e8) / 1e4);
  const rest = value % 1e4;
  if (oku) parts.push(under10000(oku) + "おく");
  if (man) parts.push(under10000(man) + "まん");
  if (rest) parts.push(under10000(rest));
  return parts.join("");
}

function under10000(n: number): string {
  let out = "";
  const th = Math.floor(n / 1000), h = Math.floor((n % 1000) / 100), t = Math.floor((n % 100) / 10), u = n % 10;
  if (th) out += th === 1 ? "せん" : th === 3 ? "さんぜん" : th === 8 ? "はっせん" : JA_DIGITS[th] + "せん";
  if (h) out += h === 1 ? "ひゃく" : h === 3 ? "さんびゃく" : h === 6 ? "ろっぴゃく" : h === 8 ? "はっぴゃく" : JA_DIGITS[h] + "ひゃく";
  if (t) out += (t === 1 ? "" : JA_DIGITS[t]) + "じゅう";
  if (u) out += JA_DIGITS[u];
  return out;
}

/** Hiragana reading with digits spelled out (no phonetic folding). */
export function toJapaneseReadingText(text: string): string {
  return katakanaToHiragana(String(text ?? "").normalize("NFKC")).replace(/\d+/g, (d) => numberToKana(Number(d)));
}

/**
 * Phonetic key used for matching: hiragana, digits read out, punctuation removed,
 * long vowels folded (ー / おう / えい), は→わ, を→お, へ→え, ぢ→じ, づ→ず,
 * small vowels enlarged.
 */
export function japanesePhoneticKey(text: string): string {
  const base = toJapaneseReadingText(text).replace(/[、。！？!?,，．.「」『』（）()[\]{}【】…・〜～―—\-_：:;；"'`｀\s]/g, "");
  let out = "";
  for (const ch of base) {
    if (ch === "ー") {
      const prev = out[out.length - 1];
      out += (prev && VOWEL_OF[prev]) || "";
      continue;
    }
    out += ch;
  }
  out = out
    .replace(/は/g, "わ").replace(/を/g, "お").replace(/へ/g, "え")
    .replace(/ぢ/g, "じ").replace(/づ/g, "ず")
    .replace(/[ぁぃぅぇぉゎ]/g, (c) => SMALL_TO_LARGE[c] ?? c);
  // fold long vowels written with う after o-row (とう → とお); えい is handled in
  // alignment (context-dependent, e.g. 駅へ行く must not fold へ+い).
  let folded = "";
  for (let i = 0; i < out.length; i++) {
    const ch = out[i];
    const prev = folded[folded.length - 1];
    if (ch === "う" && prev && VOWEL_OF[prev] === "お") { folded += "お"; continue; }
    folded += ch;
  }
  return folded;
}

/** Split a hiragana key into morae (combining small ゃゅょ with the previous kana). */
export function toMorae(key: string): string[] {
  const morae: string[] = [];
  for (const ch of key) {
    if ((ch === "ゃ" || ch === "ゅ" || ch === "ょ") && morae.length > 0) morae[morae.length - 1] += ch;
    else morae.push(ch);
  }
  return morae;
}

/** Backward compatible: array of normalized Japanese characters. */
export function normalizeJapanese(text: string): string[] {
  return Array.from(japanesePhoneticKey(text));
}

export function normalizeByLanguage(text: string, language: TrainingLanguage): string[] {
  return language === "ja" ? normalizeJapanese(text) : normalizeEnglish(text);
}

function moraKind(a: string, b: string): MatchKind {
  if (a === b) return "exact";
  // voicing / small-tsu / vowel-length confusions are "close"
  const strip = (m: string) => m.normalize("NFD").replace(/[\u3099\u309A]/g, "");
  if (strip(a) === strip(b)) return "close";
  if ((a === "っ" && b === VOWEL_OF[b]) || (b === "っ")) return "none";
  return "none";
}

function japaneseTip(expected: string, heard: string | undefined, status: CompareStatus): FeedbackTip | undefined {
  if (status === "correct") return undefined;
  if (status === "extra") return "extra";
  if (status === "missing") return "missing";
  if (heard !== undefined) {
    if (expected.includes("っ") !== heard.includes("っ")) return "small-tsu";
    const strip = (m: string) => m.normalize("NFD").replace(/[\u3099\u309A]/g, "");
    if (strip(expected) === strip(heard)) return "voicing";
    if (Math.abs(expected.length - heard.length) === 1 && levenshtein(expected, heard) === 1) {
      const longer = expected.length > heard.length ? expected : heard;
      const shorter = longer === expected ? heard : expected;
      let k = 0;
      while (k < shorter.length && shorter[k] === longer[k]) k++;
      const diff = longer[k];
      if (diff === "っ") return "small-tsu";
      if ("あいうえおー".includes(diff)) return "long-vowel";
    }
  }
  return "mispronounced";
}

/**
 * Compare a recognized Japanese utterance against reading segments.
 * `spokenReading` should be the hiragana reading of the ASR output (see the
 * /ja/reading endpoint); kanji left in it simply won't match.
 */
export function compareJapaneseSegments(segments: PhoneticSegment[], spokenReading: string): CompareResult {
  const meaningful = segments
    .map((seg) => ({ seg, morae: toMorae(japanesePhoneticKey(seg.reading || seg.surface)) }))
    .filter((x) => x.morae.length > 0);
  if (meaningful.length === 0) return { words: [], accuracy: 0 };
  const target: string[] = [];
  const owner: number[] = [];
  meaningful.forEach((x, idx) => x.morae.forEach((m) => { target.push(m); owner.push(idx); }));
  const spoken = toMorae(japanesePhoneticKey(spokenReading));
  // Within a segment, a long "e" may be written えい or ええ/ー: treat い≡え after an e-row mora.
  const longE = target.map((m, i) => i > 0 && owner[i - 1] === owner[i] && VOWEL_OF[target[i - 1].slice(-1)] === "え" && (m === "い" || m === "え"));
  const ops = alignTokens(target, spoken, (a, b, i) => (longE[i] && (b === "い" || b === "え") ? "exact" : moraKind(a, b)));

  const segMatched = new Array(meaningful.length).fill(0);
  const segClose = new Array(meaningful.length).fill(0);
  const segHeard: string[] = new Array(meaningful.length).fill("");
  const segSub = new Array(meaningful.length).fill(0);
  const extrasAfter = new Map<number, string>();
  let lastSeg = -1, matched = 0, close = 0, inserted = 0;
  for (const op of ops) {
    if (op.kind === "ins") {
      inserted++;
      extrasAfter.set(lastSeg, (extrasAfter.get(lastSeg) ?? "") + spoken[op.s!]);
      continue;
    }
    const seg = owner[op.t!];
    lastSeg = seg;
    if (op.s !== undefined) segHeard[seg] += spoken[op.s];
    if (op.kind === "match") { segMatched[seg]++; matched++; }
    else if (op.kind === "close") { segClose[seg]++; close++; }
    else if (op.kind === "sub") segSub[seg]++;
  }

  const words: CompareWord[] = [];
  const pushExtra = (k: number) => {
    const e = extrasAfter.get(k);
    if (e && e.length >= 1) words.push({ word: e, status: "extra", heard: e, tip: "extra" });
  };
  pushExtra(-1);
  meaningful.forEach((x, idx) => {
    const total = x.morae.length;
    const ratio = (segMatched[idx] + 0.6 * segClose[idx]) / total;
    let status: CompareStatus;
    if (segMatched[idx] === total) status = "correct";
    else if (ratio >= 0.5) status = "close";
    else if (segHeard[idx].length === 0) status = "missing";
    else status = "wrong";
    const expected = x.morae.join("");
    const heard = segHeard[idx] || undefined;
    words.push({ word: x.seg.surface, status, heard, expected, tip: japaneseTip(expected, heard, status) });
    pushExtra(idx);
  });
  const accuracy = Math.max(0, Math.min(100, Math.round((100 * (matched + 0.6 * close)) / (target.length + 0.5 * inserted))));
  return { words, accuracy };
}

function compareJapaneseText(original: string, spokenReading: string): CompareResult {
  // No segmentation available: treat each character group (kana run / other run) as a segment.
  const segs = String(original ?? "")
    .split(/([、。！？!?,，．\s]+)/)
    .filter((s) => s && !/^[、。！？!?,，．\s]+$/.test(s))
    .map((s) => ({ surface: s, reading: s }));
  return compareJapaneseSegments(segs, spokenReading);
}

export function compareWords(original: string, spoken: string, language: TrainingLanguage): CompareResult {
  return language === "ja" ? compareJapaneseText(original, spoken) : compareEnglish(original, spoken);
}

/** Pick the best-scoring candidate transcript (e.g. from maxAlternatives). */
export function compareBest(
  original: string,
  candidates: string[],
  language: TrainingLanguage,
  segments?: PhoneticSegment[],
): CompareResult & { transcript: string } {
  let best: (CompareResult & { transcript: string }) | null = null;
  for (const c of candidates.filter((x) => x && x.trim())) {
    const r = language === "ja" && segments && segments.length ? compareJapaneseSegments(segments, c) : compareWords(original, c, language);
    if (!best || r.accuracy > best.accuracy) best = { ...r, transcript: c };
  }
  return best ?? { words: [], accuracy: 0, transcript: "" };
}

// ───────────────────────────── Tips (localized) ─────────────────────────────

const TIP_TEXT: Record<FeedbackTip, { zh: string; ja: string }> = {
  contraction: { zh: "缩写词：注意连读，如 it's /ɪts/、I'll /aɪl/，不要读成两个分开的词也要读清楚尾音。", ja: "短縮形：it's /ɪts/・I'll /aɪl/ のようにつなげて、語尾まではっきり発音しましょう。" },
  "ending-s": { zh: "词尾 -s 容易被吞掉：复数、第三人称单数要把 /s/ /z/ 读出来。", ja: "語尾の -s が落ちやすい：複数形・三単現の /s/ /z/ を聞こえるように。" },
  "ending-ed": { zh: "过去式 -ed：/t/ /d/ /ɪd/ 尾音要轻读但不能省略。", ja: "過去形の -ed：/t/ /d/ /ɪd/ は軽くても省略しないように。" },
  "function-word": { zh: "虚词（a/the/to/of 等）在连读中很弱，但仍需要发出弱读音。", ja: "機能語（a/the/to/of など）は弱く読みますが、消さずに弱形で発音しましょう。" },
  "th-sound": { zh: "th 音：舌尖轻放在上下齿之间，/θ/ 送气、/ð/ 振动声带。", ja: "th の音：舌先を上下の歯の間に軽く出し、/θ/ は息、/ð/ は声を出します。" },
  "l-r": { zh: "L/R：L 舌尖抵上齿龈，R 舌头后缩不碰上颚。", ja: "L と R：L は舌先を歯茎に付け、R は舌を奥に引いてどこにも付けません。" },
  "v-b": { zh: "V/B：V 上齿轻咬下唇摩擦，B 双唇爆破。", ja: "V と B：V は上の歯で下唇に触れて摩擦、B は両唇を閉じて破裂させます。" },
  number: { zh: "数字：注意 -teen 与 -ty 的重音（fifTEEN vs FIFty），读完整。", ja: "数字：-teen と -ty の強勢（fifTEEN / FIFty）に注意して最後まで読みましょう。" },
  "long-vowel": { zh: "长音：注意「おう」「えい」「ー」要拉长一拍。", ja: "長音：「おう」「えい」「ー」は1拍分しっかり伸ばしましょう。" },
  "small-tsu": { zh: "促音「っ」：停顿一拍再发下一个音。", ja: "促音「っ」：1拍分ためてから次の音を出しましょう。" },
  voicing: { zh: "清浊音：注意か/が、た/だ 等是否振动声带。", ja: "清音と濁音：か/が・た/だ などの区別をはっきりと。" },
  extra: { zh: "多读了原文没有的内容。", ja: "原文にない語が入っています。" },
  missing: { zh: "漏读了这个词，放慢一点把每个词都读出来。", ja: "この語が抜けています。少しゆっくり、一語ずつ読みましょう。" },
  mispronounced: { zh: "发音与原文不同，点击单词听标准发音再跟读。", ja: "発音が原文と異なります。単語をタップしてお手本を聞き、もう一度。" },
};

export function feedbackTipText(tip: FeedbackTip, uiLang: "zh" | "ja" | "en"): string {
  const entry = TIP_TEXT[tip];
  return uiLang === "ja" ? entry.ja : entry.zh;
}
