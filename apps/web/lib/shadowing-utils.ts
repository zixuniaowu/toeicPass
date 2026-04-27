/**
 * Pure utility functions for shadowing practice.
 * No React dependencies — safe to import in server/client contexts.
 */
import type { ShadowingMaterial } from "../data/shadowing-materials";
import type { Locale } from "../types";
import tedLatestShadowing from "../data/ted-latest-shadowing.json";
import jaYoutubeShadowing from "../data/japanese-youtube-shadowing.json";

// ── Types ────────────────────────────────────────────────────────────────────

export type TrainingLanguage = "en" | "ja";

export type CompareWord = {
  word: string;
  status: "correct" | "wrong" | "missing";
};

export type TranscriptCue = {
  startSec: number;
  endSec: number;
  text: string;
};

type TedLatestSnapshot = {
  generatedAt?: string;
  itemCount?: number;
  items?: ShadowingMaterial[];
};

// ── Text normalisation ────────────────────────────────────────────────────────

export function normalizeEnglish(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9'\s-]/g, "")
    .split(/\s+/)
    .filter(Boolean);
}

// Convert katakana (ァ-ヶ) to hiragana equivalents so speech-recognition output
// (which often returns hiragana for katakana words, e.g. "こんびに" for "コンビニ")
// matches the original text in comparisons.
function katakanaToHiragana(text: string): string {
  return text.replace(/[\u30A1-\u30F6]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0x60),
  );
}

export function normalizeJapanese(text: string): string[] {
  return Array.from(
    katakanaToHiragana(
      String(text ?? "")
        .normalize("NFKC")
    )
      .replace(/[、。！？!?,，．「」『』（）()［］\[\]{}【】…・〜～―—\-_：;；"'`｀\s]/g, "")
      .trim(),
  ).filter(Boolean);
}

export function normalizeByLanguage(text: string, language: TrainingLanguage): string[] {
  return language === "ja" ? normalizeJapanese(text) : normalizeEnglish(text);
}

export function containsKanji(text: string): boolean {
  return /[一-龯々]/u.test(String(text ?? ""));
}

// ── Speech comparison ─────────────────────────────────────────────────────────

export function compareWords(
  original: string,
  spoken: string,
  language: TrainingLanguage,
): { words: CompareWord[]; accuracy: number } {
  const origWords = normalizeByLanguage(original, language);
  const spokenWords = normalizeByLanguage(spoken, language);
  const result: CompareWord[] = [];
  let matchCount = 0;
  let si = 0;

  for (let oi = 0; oi < origWords.length; oi++) {
    if (si < spokenWords.length && origWords[oi] === spokenWords[si]) {
      result.push({ word: origWords[oi], status: "correct" });
      matchCount++;
      si++;
    } else {
      let found = false;
      for (let look = si + 1; look < Math.min(si + 3, spokenWords.length); look++) {
        if (origWords[oi] === spokenWords[look]) {
          for (let k = si; k < look; k++) {
            result.push({ word: spokenWords[k], status: "wrong" });
          }
          result.push({ word: origWords[oi], status: "correct" });
          matchCount++;
          si = look + 1;
          found = true;
          break;
        }
      }
      if (!found) {
        result.push({ word: origWords[oi], status: "missing" });
      }
    }
  }
  for (; si < spokenWords.length; si++) {
    result.push({ word: spokenWords[si], status: "wrong" });
  }

  const accuracy = origWords.length > 0 ? Math.round((matchCount / origWords.length) * 100) : 0;
  return { words: result, accuracy };
}

// ── YouTube URL parsing ───────────────────────────────────────────────────────

export function parseYoutubeVideoId(rawUrl: string): string | null {
  const input = rawUrl.trim();
  if (!input) return null;

  const directId = input.match(/^[a-zA-Z0-9_-]{11}$/);
  if (directId) return directId[0];

  try {
    const url = new URL(input);
    if (url.hostname.includes("youtu.be")) {
      const id = url.pathname.replace("/", "").trim();
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }
    const v = url.searchParams.get("v");
    if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;
    const embed = url.pathname.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
    if (embed?.[1]) return embed[1];
  } catch {
    return null;
  }
  return null;
}

// ── Timestamp helpers ─────────────────────────────────────────────────────────

export function parseTimestampToSeconds(raw: string): number | null {
  const parts = raw
    .trim()
    .split(":")
    .map((v) => Number(v));
  if (parts.length < 2 || parts.some((v) => !Number.isFinite(v) || v < 0)) return null;
  if (parts.length === 2) return Math.round(parts[0] * 60 + parts[1]);
  return Math.round(parts[0] * 3600 + parts[1] * 60 + parts[2]);
}

export function parseLooseTimestamp(raw: string): number | null {
  const normalized = String(raw ?? "").trim().replace(",", ".");
  const parts = normalized.split(":").map((part) => Number(part));
  if (
    (parts.length !== 2 && parts.length !== 3) ||
    parts.some((value) => !Number.isFinite(value) || value < 0)
  ) return null;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] * 3600 + parts[1] * 60 + parts[2];
}

export function formatSeconds(value: number): string {
  const total = Math.max(0, Math.floor(value));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function formatVttTimestamp(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = Math.floor(safe % 60);
  const milliseconds = Math.floor((safe - Math.floor(safe)) * 1000);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(milliseconds).padStart(3, "0")}`;
}

// ── Script / transcript parsing ───────────────────────────────────────────────

export function parseYoutubeScript(raw: string): {
  sentences: ShadowingMaterial["sentences"];
  errors: string[];
} {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const errors: string[] = [];
  const sentences: ShadowingMaterial["sentences"] = [];

  lines.forEach((line, index) => {
    let startSec: number | undefined;
    let endSec: number | undefined;
    let body = line;

    const timed = line.match(
      /^\[?(\d{1,2}:\d{2}(?::\d{2})?)\s*-\s*(\d{1,2}:\d{2}(?::\d{2})?)\]?\s*(.+)$/u,
    );
    if (timed) {
      const start = parseTimestampToSeconds(timed[1]);
      const end = parseTimestampToSeconds(timed[2]);
      if (start === null || end === null || end <= start) {
        errors.push(`第 ${index + 1} 行时间轴格式错误：${line}`);
        return;
      }
      startSec = start;
      endSec = end;
      body = timed[3].trim();
    }

    const [textPart, translationPart = ""] = body.split("|");
    const text = textPart?.trim() ?? "";
    const translation = translationPart.trim();
    if (!text) {
      errors.push(`第 ${index + 1} 行缺少英文句子：${line}`);
      return;
    }
    sentences.push({
      id: index + 1,
      text,
      translation,
      ...(typeof startSec === "number" ? { startSec } : {}),
      ...(typeof endSec === "number" ? { endSec } : {}),
    });
  });

  return { sentences, errors };
}

function normalizeTranscriptLine(raw: string): string {
  return String(raw ?? "").replace(/\s+/g, " ").trim();
}

function splitPlainSentences(rawText: string): string[] {
  const compact = normalizeTranscriptLine(rawText);
  if (!compact) return [];
  const rough = compact.split(/(?<=[.!?])\s+/);
  const result = rough.map((s) => s.trim()).filter((s) => s.length > 1);
  if (result.length > 0) return result;
  return compact.split(/,\s+/).map((s) => s.trim()).filter((s) => s.length > 1);
}

export function parseYoutubeTranscriptText(raw: string): {
  cues: TranscriptCue[];
  errors: string[];
} {
  const lines = String(raw ?? "")
    .replace(/\uFEFF/g, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const errors: string[] = [];
  const rawCues: Array<{ startSec: number; text: string }> = [];
  const plainLines: string[] = [];
  let pendingStartSec: number | null = null;

  lines.forEach((line) => {
    const timed = line.match(
      /^\[?\s*((?:\d{1,2}:)?\d{1,2}:\d{2}(?:[.,]\d{1,3})?)\s*\]?\s*(.*)$/u,
    );
    if (timed) {
      const startSec = parseLooseTimestamp(timed[1]);
      if (startSec === null) {
        errors.push(`无法解析时间戳：${line}`);
        return;
      }
      const tail = normalizeTranscriptLine(timed[2]);
      if (tail) {
        rawCues.push({ startSec, text: tail });
        pendingStartSec = null;
      } else {
        pendingStartSec = startSec;
      }
      return;
    }
    if (pendingStartSec !== null) {
      const text = normalizeTranscriptLine(line);
      if (text) rawCues.push({ startSec: pendingStartSec, text });
      pendingStartSec = null;
      return;
    }
    plainLines.push(normalizeTranscriptLine(line));
  });

  if (rawCues.length === 0) {
    const plainSentences = splitPlainSentences(plainLines.join(" "));
    if (plainSentences.length === 0) {
      return {
        cues: [],
        errors: errors.length > 0 ? errors : ["未识别到可用的 transcript 内容。"],
      };
    }
    const cues = plainSentences.map((text, index) => {
      const startSec = index * 4;
      return { startSec, endSec: startSec + 4, text };
    });
    return { cues, errors };
  }

  const deduped = rawCues.filter((cue, index) => {
    if (index === 0) return true;
    const previous = rawCues[index - 1];
    return !(
      cue.text === previous.text && Math.abs(cue.startSec - previous.startSec) < 0.2
    );
  });

  const cues: TranscriptCue[] = deduped.map((cue, index) => {
    const nextStart = deduped[index + 1]?.startSec;
    const endSec =
      typeof nextStart === "number" && nextStart > cue.startSec
        ? nextStart
        : cue.startSec + 4;
    return {
      startSec: cue.startSec,
      endSec: Math.max(cue.startSec + 0.5, endSec),
      text: cue.text,
    };
  });
  return { cues, errors };
}

export function buildVttFromCues(cues: TranscriptCue[]): string {
  const lines: string[] = ["WEBVTT", ""];
  cues.forEach((cue, index) => {
    lines.push(String(index + 1));
    lines.push(`${formatVttTimestamp(cue.startSec)} --> ${formatVttTimestamp(cue.endSec)}`);
    lines.push(cue.text);
    lines.push("");
  });
  return lines.join("\n");
}

// ── Material helpers ──────────────────────────────────────────────────────────

export function normalizeMaterialForStorage(material: ShadowingMaterial): ShadowingMaterial {
  return {
    id: String(material.id),
    title: String(material.title),
    titleCn: String(material.titleCn),
    source: String(material.source),
    category: "speech",
    difficulty: material.difficulty === 1 || material.difficulty === 3 ? material.difficulty : 2,
    ...(material.youtubeVideoId ? { youtubeVideoId: String(material.youtubeVideoId) } : {}),
    sentences: material.sentences.map((sentence, index) => ({
      id: index + 1,
      text: String(sentence.text ?? "").trim(),
      translation: String(sentence.translation ?? "").trim(),
      ...(typeof sentence.startSec === "number" ? { startSec: sentence.startSec } : {}),
      ...(typeof sentence.endSec === "number" ? { endSec: sentence.endSec } : {}),
    })),
  };
}

export function normalizeImportedSentences(
  rawSentences: Array<{
    id?: number;
    text?: string;
    translation?: string;
    startSec?: number;
    endSec?: number;
  }> | undefined,
): ShadowingMaterial["sentences"] {
  const list = Array.isArray(rawSentences) ? rawSentences : [];
  return list
    .map((sentence, index) => ({
      id: index + 1,
      text: String(sentence.text ?? "").trim(),
      translation: String(sentence.translation ?? "").trim(),
      ...(typeof sentence.startSec === "number" ? { startSec: sentence.startSec } : {}),
      ...(typeof sentence.endSec === "number" ? { endSec: sentence.endSec } : {}),
    }))
    .filter((sentence) => sentence.text.length > 0);
}

export function buildScriptTextFromSentences(sentences: ShadowingMaterial["sentences"]): string {
  return sentences
    .map((sentence) => {
      const timePrefix =
        typeof sentence.startSec === "number" && typeof sentence.endSec === "number"
          ? `[${formatSeconds(sentence.startSec)}-${formatSeconds(sentence.endSec)}] `
          : "";
      const translationSuffix = sentence.translation ? ` | ${sentence.translation}` : "";
      return `${timePrefix}${sentence.text}${translationSuffix}`;
    })
    .join("\n");
}

export function clampSentenceIndex(index: number, sentenceTotal: number): number {
  if (!Number.isFinite(index) || sentenceTotal <= 0) return 0;
  return Math.max(0, Math.min(sentenceTotal - 1, Math.floor(index)));
}

export function isPersistedVideoMaterial(material: ShadowingMaterial): boolean {
  return material.id.startsWith("youtube-") || material.id.startsWith("subtitle-");
}

export function parseTedSnapshotMaterials(): {
  generatedAt: string;
  materials: ShadowingMaterial[];
} {
  const snapshot = tedLatestShadowing as TedLatestSnapshot;
  const generatedAt = String(snapshot?.generatedAt ?? "").trim();
  const items = Array.isArray(snapshot?.items) ? snapshot.items : [];
  const materials = items
    .map((item) => normalizeMaterialForStorage(item))
    .filter((item) => item.sentences.length > 0);
  return { generatedAt, materials };
}

export function parseJaYoutubeSnapshotMaterials(): { materials: ShadowingMaterial[] } {
  const snapshot = jaYoutubeShadowing as TedLatestSnapshot;
  const items = Array.isArray(snapshot?.items) ? snapshot.items : [];
  const materials = items
    .map((item) => normalizeMaterialForStorage(item))
    .filter((item) => item.sentences.length > 0);
  return { materials };
}

export function buildYoutubeEmbedUrl(
  videoId: string,
  startSec: number,
  endSec?: number,
): string {
  const params = new URLSearchParams({
    rel: "0",
    modestbranding: "1",
    playsinline: "1",
    autoplay: "1",
    start: String(Math.max(0, Math.floor(startSec))),
  });
  if (typeof endSec === "number" && endSec > startSec) {
    params.set("end", String(Math.floor(endSec)));
  }
  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
}

export function withSubtitleFallbackHint(rawMessage: string, isJa = false): string {
  const fallbackDefault = isJa ? "自動インポートに失敗しました。" : "自动导入失败。";
  const message = String(rawMessage || fallbackDefault).trim();
  if (/srt|vtt|字幕文件/i.test(message)) return message;
  const hint = isJa
    ? `${message} 下の SRT/VTT 字幕ファイルインポートもご利用いただけます。`
    : `${message} 你可以改用下方 SRT/VTT 字幕文件导入。`;
  return hint;
}

export function titleFromSubtitleFile(fileName: string, isJa = false): string {
  const title = String(fileName ?? "")
    .replace(/\.(srt|vtt)$/i, "")
    .trim();
  return title || (isJa ? "字幕ファイルシャドーイング" : "字幕文件跟读");
}

// ── Badge / label helpers ─────────────────────────────────────────────────────

export function getDifficultyVariant(d: number): "success" | "warning" | "error" {
  return d === 1 ? "success" : d === 2 ? "warning" : "error";
}

export function getDifficultyLabel(d: number, locale: Locale): string {
  if (locale === "ja") return d === 1 ? "初級" : d === 2 ? "中級" : "上級";
  return d === 1 ? "初级" : d === 2 ? "中级" : "高级";
}

export function getCategoryLabel(c: string, locale: Locale): string {
  const m: Record<string, string> =
    locale === "ja"
      ? { speech: "スピーチ", drama: "ドラマ", ted: "TED" }
      : { speech: "演讲", drama: "美剧", ted: "TED" };
  return m[c] || c;
}
