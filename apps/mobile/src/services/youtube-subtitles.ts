const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36";
const MAX_SENTENCES = 60;
const PAUSE_CUT_SECONDS = 1.1;
const HARD_MAX_WORDS = 42;
const HARD_MAX_CHARS = 240;
const SOFT_MAX_WORDS = 30;
const SPLIT_CONNECTORS = new Set([
  "and", "but", "so", "because", "which", "that", "when", "while",
  "if", "then", "though", "although",
]);
const CONTINUATION_LAST = new Set([
  "and", "or", "but", "so", "because", "that", "who", "which",
  "when", "where", "what", "to", "of", "in", "on", "at", "for",
  "with", "from", "by", "as", "if", "than", "then", "while", "though", "although",
]);

export type CaptionSegment = { startSec: number; endSec: number; text: string };
export type SentenceItem = { id: number; text: string; translation: string; startSec: number; endSec: number };
export type YoutubeImportResult = {
  success: true;
  videoId: string;
  title: string;
  sourceLanguage: string;
  sentences: SentenceItem[];
} | { success: false; error: string };

function parseVideoId(input: string): string | null {
  const s = String(input ?? "").trim();
  if (!s) return null;
  if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s;
  try {
    const url = new URL(s);
    if (url.hostname.includes("youtu.be")) {
      const id = url.pathname.replace("/", "").trim();
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }
    const v = url.searchParams.get("v");
    if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;
    const embed = url.pathname.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
    if (embed?.[1]) return embed[1];
  } catch {}
  return null;
}

function extractBalancedJson(source: string, marker: string): Record<string, unknown> | null {
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) return null;
  const jsonStart = source.indexOf("{", markerIndex);
  if (jsonStart < 0) return null;
  let depth = 0, inString = false, escaped = false;
  for (let i = jsonStart; i < source.length; i++) {
    const ch = source[i];
    if (inString) {
      if (escaped) { escaped = false; } else if (ch === "\\") { escaped = true; } else if (ch === '"') { inString = false; }
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === "{") { depth++; continue; }
    if (ch === "}") {
      depth--;
      if (depth === 0) {
        try { return JSON.parse(source.slice(jsonStart, i + 1)) as Record<string, unknown>; } catch { return null; }
      }
    }
  }
  return null;
}

function normalizeText(raw: string): string {
  return String(raw ?? "")
    .replace(/\n+/g, " ").replace(/\s+/g, " ")
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/<[^>]*>/g, "").trim();
}

function shouldDrop(text: string): boolean {
  if (!text) return true;
  if (/^\[[^\]]+\]$/.test(text) || /^\([^)]*\)$/.test(text) || /^♪+$/.test(text)) return true;
  return false;
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function parseJson3Segments(payload: unknown): CaptionSegment[] {
  const events = Array.isArray((payload as { events?: unknown[] })?.events)
    ? (payload as { events: unknown[] }).events : [];
  const segments: CaptionSegment[] = [];
  events.forEach((event) => {
    const startMs = Number((event as { tStartMs?: number })?.tStartMs ?? 0);
    const durationMs = Number((event as { dDurationMs?: number })?.dDurationMs ?? 0);
    const segs = Array.isArray((event as { segs?: unknown[] })?.segs)
      ? (event as { segs: Array<{ utf8?: string }> }).segs : [];
    const text = normalizeText(segs.map((s) => String(s?.utf8 ?? "")).join(""));
    if (shouldDrop(text)) return;
    const startSec = Math.max(0, startMs / 1000);
    const endSec = Math.max(startSec + 0.4, (startMs + Math.max(durationMs, 400)) / 1000);
    const prev = segments[segments.length - 1];
    if (prev && prev.text === text && Math.abs(prev.startSec - startSec) < 0.2) return;
    segments.push({ startSec, endSec, text });
  });
  return segments;
}

function splitSubSentences(segment: CaptionSegment): CaptionSegment[] {
  const text = normalizeText(segment.text);
  if (!text) return [];
  const parts = (text.match(/[^.!?]+[.!?]["')\]]*|[^.!?]+$/g) ?? [])
    .map((p) => normalizeText(p)).filter(Boolean);
  if (parts.length <= 1) return [{ ...segment, text }];
  const dur = Math.max(0.4, segment.endSec - segment.startSec);
  return parts.map((p, i) => ({
    startSec: segment.startSec + (dur * i) / parts.length,
    endSec: i === parts.length - 1 ? segment.endSec : Math.max(segment.startSec + dur * (i + 1) / parts.length, segment.startSec + dur * i / parts.length + 0.2),
    text: p,
  }));
}

function appendText(existing: string, incoming: string): string {
  const inc = normalizeText(incoming);
  if (!inc) return existing;
  if (!existing) return inc;
  if (inc === existing || existing.includes(` ${inc}`)) return existing;
  if (inc.startsWith(existing)) { const s = inc.slice(existing.length).trim(); return s ? `${existing} ${s}`.trim() : existing; }
  if (existing.endsWith(inc)) return existing;
  const lw = existing.split(/\s+/).filter(Boolean), rw = inc.split(/\s+/).filter(Boolean);
  for (let sz = Math.min(12, lw.length, rw.length); sz >= 2; sz--) {
    const lt = lw.slice(lw.length - sz).join(" "), rh = rw.slice(0, sz).join(" ");
    if (lt === rh) { const s = rw.slice(sz).join(" ").trim(); return s ? `${existing} ${s}`.trim() : existing; }
  }
  return `${existing} ${inc}`.trim();
}

function shouldMerge(current: string, next: string): boolean {
  if (!current || !next) return false;
  const strongEnd = /[.!?]["')\]]?$/.test(current);
  const weakEnd = /[,;:]["')\]]?$/.test(current);
  const nextLower = /^[a-z]/.test(next);
  const wc = wordCount(current);
  const lastWord = (current.toLowerCase().match(/([a-z']+)["')\]]?$/) ?? [])[1] ?? "";
  if (!strongEnd && wc <= 4) return true;
  if (!strongEnd && CONTINUATION_LAST.has(lastWord) && wc <= 16) return true;
  if (!strongEnd && nextLower && wc <= 10) return true;
  if (weakEnd && nextLower && wc <= 14) return true;
  return false;
}

function sanitizeText(raw: string): string {
  let t = normalizeText(raw);
  t = t.replace(/^(?:\[[^\]]+\]\s*)+/g, "").replace(/^(?:\([^)]*\)\s*)+/g, "").replace(/^>>\s*/g, "");
  t = t.replace(/\b(uh|um)\b/gi, "");
  for (let i = 0; i < 4; i++) {
    t = t.replace(/\b([a-z']+(?:\s+[a-z']+){1,4})\s+\1\b/gi, "$1");
    t = t.replace(/\b([a-z']+)\s+the\s+\1\b/gi, "$1");
    t = t.replace(/\b([a-z']+)\s+\1\b/gi, "$1");
    t = t.replace(/\b([a-z']+),\s+\1\b/gi, "$1");
  }
  t = t.replace(/\s+([,.;:!?])/g, "$1").replace(/,{2,}/g, ",").replace(/^[,.;:!?]+\s*/g, "");
  t = t.replace(/\s+/g, " ").trim();
  if (/^[a-z]/.test(t)) t = t.charAt(0).toUpperCase() + t.slice(1);
  return t;
}

function splitLong(item: SentenceItem): SentenceItem[] {
  const text = sanitizeText(item.text);
  if (!text) return [];
  const wc = wordCount(text);
  if (wc <= SOFT_MAX_WORDS) return [{ ...item, text }];
  let chunks = text.split(/(?<=[.!?])\s+/).map((c) => sanitizeText(c)).filter(Boolean);
  if (chunks.length === 1) {
    chunks = text.split(/,\s+(?=(?:and|but|so|because|which|that|when|while|if|then|though|although)\b)/i)
      .map((c) => sanitizeText(c)).filter(Boolean);
  }
  if (chunks.length <= 1 && wc > 40) {
    const commas = Array.from(text.matchAll(/,\s+/g));
    if (commas.length > 0) {
      const mid = Math.floor(text.length / 2);
      const best = commas.reduce((a, b) => Math.abs((a.index ?? 0) - mid) < Math.abs((b.index ?? 0) - mid) ? a : b);
      const si = best.index ?? 0;
      const l = sanitizeText(text.slice(0, si)), r = sanitizeText(text.slice(si + 1));
      if (wordCount(l) >= 8 && wordCount(r) >= 8) chunks = [l, r];
    }
  }
  if (chunks.length <= 1 && wc > 34) {
    const tokens = text.split(/\s+/).filter(Boolean);
    const candidates = tokens.map((tok, i) => ({ tok: tok.toLowerCase().replace(/[^a-z']/g, ""), i }))
      .filter(({ tok, i }) => i >= 10 && i <= tokens.length - 10 && SPLIT_CONNECTORS.has(tok));
    if (candidates.length > 0) {
      const mid = Math.floor(tokens.length / 2);
      const best = candidates.reduce((a, b) => Math.abs(a.i - mid) < Math.abs(b.i - mid) ? a : b);
      const l = sanitizeText(tokens.slice(0, best.i).join(" ")), r = sanitizeText(tokens.slice(best.i).join(" "));
      if (wordCount(l) >= 8 && wordCount(r) >= 8) chunks = [l, r];
    }
  }
  if (chunks.length <= 1) return [{ ...item, text }];
  const compact: string[] = [];
  chunks.forEach((c) => { if (wordCount(c) < 4 && compact.length > 0) compact[compact.length - 1] = sanitizeText(`${compact[compact.length - 1]} ${c}`); else compact.push(c); });
  const dur = Math.max(0.8, item.endSec - item.startSec);
  const totalWords = Math.max(1, compact.reduce((s, c) => s + Math.max(1, wordCount(c)), 0));
  let cursor = item.startSec;
  return compact.map((c, i) => {
    const cw = Math.max(1, wordCount(c));
    const td = i === compact.length - 1 ? Math.max(0.3, item.endSec - cursor) : Math.max(0.3, (dur * cw) / totalWords);
    const s = cursor, e = i === compact.length - 1 ? item.endSec : Math.min(item.endSec, cursor + td);
    cursor = e;
    return { ...item, text: c, startSec: s, endSec: Math.max(s + 0.2, e) };
  });
}

function stitchSentences(rawSegments: CaptionSegment[]): SentenceItem[] {
  const segments = rawSegments.flatMap((s) => splitSubSentences(s));
  const sentences: SentenceItem[] = [];
  let buf = "", bufStart = 0, bufEnd = 0;
  const flush = () => {
    const n = normalizeText(buf);
    if (n.length < 2) { buf = ""; return; }
    sentences.push({ id: sentences.length + 1, text: n, translation: "", startSec: bufStart, endSec: Math.max(bufStart + 0.8, bufEnd) });
    buf = "";
  };
  segments.forEach((seg, i) => {
    if (!buf) bufStart = seg.startSec;
    bufEnd = seg.endSec;
    buf = appendText(buf, seg.text);
    const next = segments[i + 1];
    const gap = next ? Math.max(0, next.startSec - seg.endSec) : 0;
    const strongEnd = /[.!?]["')\]]?$/.test(seg.text);
    const weakEnd = /[,;:]["')\]]?$/.test(seg.text);
    const nextUpper = next ? /^[A-Z]/.test(normalizeText(next.text)) : false;
    const wc = wordCount(buf);
    const tooLong = wc >= HARD_MAX_WORDS || buf.length >= HARD_MAX_CHARS;
    if (strongEnd || (gap >= PAUSE_CUT_SECONDS && wc >= 6 && (weakEnd || nextUpper)) || (tooLong && (weakEnd || gap >= PAUSE_CUT_SECONDS))) flush();
  });
  if (buf) flush();
  const merged: SentenceItem[] = [];
  sentences.forEach((s) => {
    const prev = merged[merged.length - 1];
    if (!prev) { merged.push({ ...s }); return; }
    if (shouldMerge(prev.text, s.text)) {
      prev.text = normalizeText(`${prev.text} ${s.text}`);
      prev.endSec = Math.max(prev.endSec, s.endSec);
      return;
    }
    merged.push({ ...s });
  });
  const fixed = merged.map((s, i) => ({ ...s, id: i + 1 }));
  const refined = fixed.flatMap((item) => splitLong(item));
  const postMerge: SentenceItem[] = [];
  refined.forEach((item) => {
    const t = sanitizeText(item.text);
    if (!t) return;
    const cur: SentenceItem = { ...item, text: t };
    const prev = postMerge[postMerge.length - 1];
    if (!prev) { postMerge.push(cur); return; }
    const isSubClause =
      (/^(That|Which|Who|Whom|Whose)\b/i.test(cur.text) && !/^That\s+(is|was|were|are|feels|means|would|will|could|can|has|have|had|this|these|those|they|we|you|i)\b/i.test(cur.text) && wordCount(cur.text) <= 36 && wordCount(prev.text) <= 120) ||
      (/^(When|While|If|Because|Though|Although)\b/i.test(cur.text) && wordCount(cur.text) <= 36 && wordCount(prev.text) <= 120);
    if (isSubClause) {
      prev.text = sanitizeText(`${prev.text.replace(/[.!?]["')\]]?$/g, "").trim()} ${cur.text.charAt(0).toLowerCase()}${cur.text.slice(1)}`);
      prev.endSec = Math.max(prev.endSec, cur.endSec);
      return;
    }
    postMerge.push(cur);
  });
  return postMerge.map((s, i) => {
    const ep = /[.!?]["')\]]?$/.test(s.text);
    return { ...s, id: i + 1, text: !ep && wordCount(s.text) >= 8 ? `${s.text}.` : s.text };
  }).slice(0, MAX_SENTENCES);
}

function pickBestTrack(tracks: Array<{ baseUrl?: string; languageCode?: string; kind?: string }>) {
  if (!tracks.length) return null;
  const en = tracks.filter((t) => String(t.languageCode ?? "").startsWith("en"));
  if (en.length > 0) return en.find((t) => String(t.kind ?? "").toLowerCase() !== "asr") ?? en[0];
  return tracks.find((t) => String(t.kind ?? "").toLowerCase() !== "asr") ?? tracks[0];
}

async function translateSentence(text: string): Promise<string> {
  try {
    const res = await fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=zh-CN&dt=t&q=${encodeURIComponent(text)}`,
      { headers: { "User-Agent": USER_AGENT } },
    );
    if (!res.ok) return "";
    const data = (await res.json()) as unknown;
    const chunks = Array.isArray((data as unknown[])[0]) ? (data as unknown[])[0] as unknown[] : [];
    return chunks.map((c) => String((c as unknown[])[0] ?? "")).join("").trim();
  } catch {
    return "";
  }
}

export async function fetchYoutubeSubtitles(url: string): Promise<YoutubeImportResult> {
  try {
    const videoId = parseVideoId(url);
    if (!videoId) return { success: false, error: "Invalid YouTube URL or ID." };

    const watchUrl = `https://www.youtube.com/watch?v=${videoId}&hl=en`;
    const watchRes = await fetch(watchUrl, {
      headers: { "User-Agent": USER_AGENT, "Accept-Language": "en-US,en;q=0.9" },
    });
    if (!watchRes.ok) return { success: false, error: "Failed to load YouTube page." };
    const html = await watchRes.text();

    const player = extractBalancedJson(html, "ytInitialPlayerResponse");
    if (!player) return { success: false, error: "Could not parse YouTube player data." };

    const captionTracks = (((player.captions ?? {}) as {
      playerCaptionsTracklistRenderer?: { captionTracks?: Array<{ baseUrl?: string; languageCode?: string; kind?: string }> };
    }).playerCaptionsTracklistRenderer?.captionTracks ?? []);
    const track = pickBestTrack(captionTracks);
    if (!track?.baseUrl) return { success: false, error: "This video has no accessible subtitles." };

    const transcriptUrl = new URL(track.baseUrl);
    transcriptUrl.searchParams.set("fmt", "json3");
    const transcriptRes = await fetch(transcriptUrl.toString(), {
      headers: { "User-Agent": USER_AGENT },
    });
    if (!transcriptRes.ok) return { success: false, error: "Failed to download subtitle track." };
    const transcriptRaw = await transcriptRes.text();

    let segments: CaptionSegment[] = [];
    if (transcriptRaw.trim().startsWith("{")) {
      try { segments = parseJson3Segments(JSON.parse(transcriptRaw)); } catch { segments = []; }
    }
    if (segments.length === 0) {
      const fallbackRes = await fetch(track.baseUrl, { headers: { "User-Agent": USER_AGENT } });
      if (fallbackRes.ok) {
        const fallbackRaw = await fallbackRes.text();
        if (fallbackRaw.trim().startsWith("<")) {
          const xmlSegments: CaptionSegment[] = [];
          const regex = /<text\b([^>]*)>([\s\S]*?)<\/text>/g;
          let m: RegExpExecArray | null;
          while ((m = regex.exec(fallbackRaw)) !== null) {
            const attrs = m[1] ?? "", body = (m[2] ?? "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
            const start = Number(attrs.match(/\bstart="([^"]+)"/)?.[1] ?? 0);
            const dur = Number(attrs.match(/\bdur="([^"]+)"/)?.[1] ?? 0.8);
            const text = normalizeText(body);
            if (!shouldDrop(text)) xmlSegments.push({ startSec: Math.max(0, start), endSec: Math.max(start + 0.4, start + Math.max(dur, 0.4)), text });
          }
          segments.push(...xmlSegments);
        }
      }
    }
    if (segments.length === 0) return { success: false, error: "Subtitle track is empty or unsupported." };

    const stitched = stitchSentences(segments);
    const sentences: SentenceItem[] = [];
    for (const s of stitched) {
      sentences.push({ ...s, translation: await translateSentence(s.text) });
    }

    const title = String(((player.videoDetails ?? {}) as { title?: unknown }).title ?? "").trim() || `YouTube ${videoId}`;

    return {
      success: true, videoId, title, sourceLanguage: track.languageCode ?? "unknown", sentences,
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
