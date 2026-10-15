/**
 * Pure helpers shared by the lookup dictionary builder and the runtime lookup.
 * IPA convention: American English, Cambridge-US style (iː uː ɑː ɔː ɝː ɚ oʊ), primary stress ˈ,
 * secondary ˌ, no spaces inside a word. Acronyms are spelled letter by letter: /ˌeɪ piː ˈaɪ/.
 */

const VOWELS: Record<string, [string, string]> = {
  // [stressed, unstressed]
  AA: ["ɑː", "ɑ"], AE: ["æ", "æ"], AH: ["ʌ", "ə"], AO: ["ɔː", "ɔ"], AW: ["aʊ", "aʊ"], AY: ["aɪ", "aɪ"],
  EH: ["e", "e"], ER: ["ɝː", "ɚ"], EY: ["eɪ", "eɪ"], IH: ["ɪ", "ɪ"], IY: ["iː", "i"], OW: ["oʊ", "oʊ"],
  OY: ["ɔɪ", "ɔɪ"], UH: ["ʊ", "ʊ"], UW: ["uː", "u"],
};
const CONSONANTS: Record<string, string> = {
  B: "b", CH: "tʃ", D: "d", DH: "ð", F: "f", G: "ɡ", HH: "h", JH: "dʒ", K: "k", L: "l", M: "m", N: "n",
  NG: "ŋ", P: "p", R: "r", S: "s", SH: "ʃ", T: "t", TH: "θ", V: "v", W: "w", Y: "j", Z: "z", ZH: "ʒ",
};
const LEGAL_ONSETS = new Set([
  "P R", "B R", "T R", "D R", "K R", "G R", "F R", "TH R", "SH R",
  "P L", "B L", "K L", "G L", "F L", "S L",
  "S P", "S T", "S K", "S M", "S N", "S W", "S F",
  "T W", "D W", "K W", "G W", "TH W", "S W",
  "S P R", "S T R", "S K R", "S K W", "S P L",
  "P Y", "B Y", "K Y", "G Y", "F Y", "V Y", "M Y", "N Y", "HH Y", "S K Y", "SP Y",
]);

function onsetSize(cluster: string[]): number {
  for (let n = Math.min(3, cluster.length); n > 1; n -= 1) {
    if (LEGAL_ONSETS.has(cluster.slice(cluster.length - n).join(" "))) return n;
  }
  return cluster.length > 0 ? 1 : 0;
}

/** Convert one CMUdict pronunciation ("L EY1 T AH0 N S IY0") to IPA without slashes ("ˈleɪtənsi"). */
export function arpabetToIpa(arpabet: string): string {
  const phones = arpabet.trim().split(/\s+/).filter(Boolean);
  const vowelCount = phones.filter((p) => /\d$/.test(p)).length;
  const out: string[] = [];
  let pending: string[] = []; // consonants since last vowel
  const flushConsonants = (beforeStress: string | null) => {
    if (beforeStress && out.length > 0) {
      const n = onsetSize(pending);
      const coda = pending.slice(0, pending.length - n);
      const onset = pending.slice(pending.length - n);
      out.push(...coda.map((c) => CONSONANTS[c] ?? ""), beforeStress, ...onset.map((c) => CONSONANTS[c] ?? ""));
    } else {
      if (beforeStress) out.push(beforeStress);
      out.push(...pending.map((c) => CONSONANTS[c] ?? ""));
    }
    pending = [];
  };
  for (const p of phones) {
    const m = p.match(/^([A-Z]+)(\d)?$/);
    if (!m) continue;
    const [, base, stress] = m;
    if (stress === undefined) {
      pending.push(base);
      continue;
    }
    const mark = vowelCount > 1 ? (stress === "1" ? "ˈ" : stress === "2" ? "ˌ" : null) : null;
    flushConsonants(mark);
    const pair = VOWELS[base];
    out.push(pair ? (stress === "0" ? pair[1] : pair[0]) : "");
  }
  flushConsonants(null);
  return out.join("");
}

const LETTER_IPA: Record<string, string> = {
  a: "eɪ", b: "biː", c: "siː", d: "diː", e: "iː", f: "ef", g: "dʒiː", h: "eɪtʃ", i: "aɪ", j: "dʒeɪ",
  k: "keɪ", l: "el", m: "em", n: "en", o: "oʊ", p: "piː", q: "kjuː", r: "ɑːr", s: "es", t: "tiː",
  u: "juː", v: "viː", w: "ˈdʌbəljuː", x: "eks", y: "waɪ", z: "ziː",
};

/** Letter-by-letter IPA for acronyms, e.g. "API" → "/ˌeɪ piː ˈaɪ/". */
export function spellAcronymIpa(word: string): string {
  const letters = word.toLowerCase().replace(/[^a-z]/g, "").split("");
  if (letters.length === 0) return "";
  if (letters.length === 1) return `/${LETTER_IPA[letters[0]].replace(/^ˈ/, "")}/`;
  const parts = letters.map((l, i) => {
    const raw = LETTER_IPA[l].replace(/^ˈ/, "");
    if (i === letters.length - 1) return `ˈ${raw}`;
    if (i === 0) return `ˌ${raw}`;
    return raw;
  });
  return `/${parts.join(" ")}/`;
}

export type EnToken = { raw: string; clean: string; acronym: boolean };

/** Split English text into lookup tokens (keeps hyphenated compounds; flags ALL-CAPS acronyms). */
export function tokenizeEnglish(text: string): EnToken[] {
  const matches = String(text ?? "").replace(/[\u2018\u2019\u2032]/g, "'").match(/[A-Za-z][A-Za-z'-]*/g) ?? [];
  return matches
    .map((raw) => {
      const trimmed = raw.replace(/^[-']+|[-']+$/g, "");
      return { raw: trimmed, clean: trimmed.toLowerCase(), acronym: /^[A-Z]{2,5}s?$/.test(trimmed) };
    })
    .filter((t) => t.clean.length > 0);
}
