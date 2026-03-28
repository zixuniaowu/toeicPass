import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type CaptionTrack = {
  baseUrl?: string;
  languageCode?: string;
  kind?: string;
  name?: { simpleText?: string };
};

type CaptionSegment = {
  startSec: number;
  endSec: number;
  text: string;
};

type SentenceItem = {
  id: number;
  text: string;
  translation: string;
  startSec: number;
  endSec: number;
};

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36";
const MAX_SENTENCES = 60;
const MAX_SUBTITLE_TEXT_LENGTH = 2_000_000;
const PAUSE_CUT_SECONDS = 1.1;
const HARD_MAX_WORDS_PER_SENTENCE = 42;
const HARD_MAX_CHARS_PER_SENTENCE = 240;
const SOFT_MAX_WORDS_PER_SENTENCE = 30;
const SPLIT_CONNECTOR_WORDS = new Set([
  "and",
  "but",
  "so",
  "because",
  "which",
  "that",
  "when",
  "while",
  "if",
  "then",
  "though",
  "although",
]);
const CONTINUATION_LAST_WORDS = new Set([
  "and",
  "or",
  "but",
  "so",
  "because",
  "that",
  "who",
  "which",
  "when",
  "where",
  "what",
  "to",
  "of",
  "in",
  "on",
  "at",
  "for",
  "with",
  "from",
  "by",
  "as",
  "if",
  "than",
  "then",
  "while",
  "though",
  "although",
]);

type ImportRequestBody = {
  url?: string;
  videoId?: string;
  title?: string;
  sourceLanguage?: string;
  subtitleText?: string;
};

function parseYoutubeVideoId(rawUrl: string): string | null {
  const input = String(rawUrl ?? "").trim();
  if (!input) {
    return null;
  }
  if (/^[a-zA-Z0-9_-]{11}$/.test(input)) {
    return input;
  }
  try {
    const url = new URL(input);
    if (url.hostname.includes("youtu.be")) {
      const id = url.pathname.replace("/", "").trim();
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }
    const v = url.searchParams.get("v");
    if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) {
      return v;
    }
    const embed = url.pathname.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
    if (embed?.[1]) {
      return embed[1];
    }
  } catch {
    return null;
  }
  return null;
}

function extractBalancedJson(source: string, marker: string): Record<string, unknown> | null {
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) {
    return null;
  }
  const jsonStart = source.indexOf("{", markerIndex);
  if (jsonStart < 0) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = jsonStart; index < source.length; index += 1) {
    const ch = source[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === "\"") {
        inString = false;
      }
      continue;
    }
    if (ch === "\"") {
      inString = true;
      continue;
    }
    if (ch === "{") {
      depth += 1;
      continue;
    }
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        const rawJson = source.slice(jsonStart, index + 1);
        try {
          return JSON.parse(rawJson) as Record<string, unknown>;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function normalizeCaptionText(raw: string): string {
  return String(raw ?? "")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/<[^>]*>/g, "")
    .trim();
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function shouldDropSegment(text: string): boolean {
  if (!text) {
    return true;
  }
  if (/^\[[^\]]+\]$/.test(text)) {
    return true;
  }
  if (/^\([^)]*\)$/.test(text)) {
    return true;
  }
  if (/^♪+$/.test(text)) {
    return true;
  }
  return false;
}

function parseJson3Segments(payload: unknown): CaptionSegment[] {
  const events = Array.isArray((payload as { events?: unknown[] })?.events)
    ? ((payload as { events: unknown[] }).events)
    : [];
  const segments: CaptionSegment[] = [];

  events.forEach((event) => {
    const startMs = Number((event as { tStartMs?: number })?.tStartMs ?? 0);
    const durationMs = Number((event as { dDurationMs?: number })?.dDurationMs ?? 0);
    const segs = Array.isArray((event as { segs?: unknown[] })?.segs)
      ? ((event as { segs: Array<{ utf8?: string }> }).segs)
      : [];
    const text = normalizeCaptionText(
      segs
        .map((item) => String(item?.utf8 ?? ""))
        .join(""),
    );
    if (shouldDropSegment(text)) {
      return;
    }
    const startSec = Math.max(0, startMs / 1000);
    const endSec = Math.max(startSec + 0.4, (startMs + Math.max(durationMs, 400)) / 1000);
    const previous = segments[segments.length - 1];
    if (previous && previous.text === text && Math.abs(previous.startSec - startSec) < 0.2) {
      return;
    }
    segments.push({ startSec, endSec, text });
  });
  return segments;
}

function parseXmlSegments(xml: string): CaptionSegment[] {
  const segments: CaptionSegment[] = [];
  const regex = /<text\b([^>]*)>([\s\S]*?)<\/text>/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(xml)) !== null) {
    const attrs = match[1] ?? "";
    const body = decodeXmlEntities(match[2] ?? "");
    const startMatch = attrs.match(/\bstart="([^"]+)"/);
    const durMatch = attrs.match(/\bdur="([^"]+)"/);
    const start = Number(startMatch?.[1] ?? 0);
    const dur = Number(durMatch?.[1] ?? 0.8);
    const text = normalizeCaptionText(body);
    if (shouldDropSegment(text)) {
      continue;
    }
    const startSec = Math.max(0, start);
    const endSec = Math.max(startSec + 0.4, startSec + Math.max(dur, 0.4));
    segments.push({ startSec, endSec, text });
  }
  return segments;
}

function parseSubtitleTimestamp(raw: string): number | null {
  const normalized = String(raw ?? "").trim().replace(",", ".");
  if (!normalized) {
    return null;
  }

  const parts = normalized.split(":");
  if (parts.length !== 2 && parts.length !== 3) {
    return null;
  }

  const values = parts.map((part) => Number(part));
  if (values.some((value) => !Number.isFinite(value) || value < 0)) {
    return null;
  }

  if (parts.length === 2) {
    const [m, s] = values;
    return m * 60 + s;
  }

  const [h, m, s] = values;
  return h * 3600 + m * 60 + s;
}

function parseSrtOrVttSegments(raw: string): CaptionSegment[] {
  const normalizedText = String(raw ?? "")
    .replace(/\uFEFF/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/^WEBVTT[^\n]*\n+/i, "");

  const blocks = normalizedText
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  const segments: CaptionSegment[] = [];

  blocks.forEach((block) => {
    const lines = block
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length === 0) {
      return;
    }

    const timeLineIndex = lines.findIndex((line) => line.includes("-->"));
    if (timeLineIndex < 0) {
      return;
    }

    const timing = lines[timeLineIndex];
    const split = timing.split(/\s*-->\s*/);
    if (split.length < 2) {
      return;
    }

    const startRaw = split[0]?.trim() ?? "";
    const endRaw = split[1]?.trim().split(/\s+/)[0] ?? "";
    const startSec = parseSubtitleTimestamp(startRaw);
    const endSecParsed = parseSubtitleTimestamp(endRaw);
    if (startSec === null || endSecParsed === null) {
      return;
    }
    const endSec = Math.max(startSec + 0.4, endSecParsed);

    const text = normalizeCaptionText(lines.slice(timeLineIndex + 1).join(" "));
    if (shouldDropSegment(text)) {
      return;
    }

    const previous = segments[segments.length - 1];
    if (previous && previous.text === text && Math.abs(previous.startSec - startSec) < 0.2) {
      return;
    }
    segments.push({ startSec, endSec, text });
  });

  return segments;
}

function stitchSegmentsToSentences(segments: CaptionSegment[]): SentenceItem[] {
  const sentences: SentenceItem[] = [];
  let bufferText = "";
  let bufferStartSec = 0;
  let bufferEndSec = 0;

  const splitSegmentIntoSubSentences = (segment: CaptionSegment): CaptionSegment[] => {
    const normalized = normalizeCaptionText(segment.text);
    if (!normalized) {
      return [];
    }
    const parts = (normalized.match(/[^.!?]+[.!?]["')\]]*|[^.!?]+$/g) ?? [])
      .map((part) => normalizeCaptionText(part))
      .filter(Boolean);
    if (parts.length <= 1) {
      return [{ ...segment, text: normalized }];
    }
    const duration = Math.max(0.4, segment.endSec - segment.startSec);
    return parts.map((part, index) => {
      const startSec = segment.startSec + (duration * index) / parts.length;
      const endSec =
        index === parts.length - 1
          ? segment.endSec
          : segment.startSec + (duration * (index + 1)) / parts.length;
      return {
        startSec,
        endSec: Math.max(startSec + 0.2, endSec),
        text: part,
      };
    });
  };

  const expandedSegments = segments.flatMap((segment) => splitSegmentIntoSubSentences(segment));

  const flush = () => {
    const normalized = normalizeCaptionText(bufferText);
    if (normalized.length < 2) {
      bufferText = "";
      return;
    }
    sentences.push({
      id: sentences.length + 1,
      text: normalized,
      translation: "",
      startSec: bufferStartSec,
      endSec: Math.max(bufferStartSec + 0.8, bufferEndSec),
    });
    bufferText = "";
  };

  const appendSegmentText = (existing: string, incomingRaw: string): string => {
    const incoming = normalizeCaptionText(incomingRaw);
    if (!incoming) {
      return existing;
    }
    if (!existing) {
      return incoming;
    }
    if (incoming === existing || existing.includes(` ${incoming}`) || existing === incoming) {
      return existing;
    }
    if (incoming.startsWith(existing)) {
      const suffix = incoming.slice(existing.length).trim();
      return suffix ? `${existing} ${suffix}`.trim() : existing;
    }
    if (existing.endsWith(incoming)) {
      return existing;
    }

    const leftWords = existing.split(/\s+/).filter(Boolean);
    const rightWords = incoming.split(/\s+/).filter(Boolean);
    const maxOverlap = Math.min(12, leftWords.length, rightWords.length);
    for (let size = maxOverlap; size >= 2; size -= 1) {
      const leftTail = leftWords.slice(leftWords.length - size).join(" ");
      const rightHead = rightWords.slice(0, size).join(" ");
      if (leftTail === rightHead) {
        const suffix = rightWords.slice(size).join(" ").trim();
        return suffix ? `${existing} ${suffix}`.trim() : existing;
      }
    }
    return `${existing} ${incoming}`.trim();
  };

  const shouldMergeWithNext = (currentTextRaw: string, nextTextRaw: string): boolean => {
    const currentText = normalizeCaptionText(currentTextRaw);
    const nextText = normalizeCaptionText(nextTextRaw);
    if (!currentText || !nextText) {
      return false;
    }
    const endsWithStrongPunc = /[.!?]["')\]]?$/.test(currentText);
    const endsWithWeakPunc = /[,;:]["')\]]?$/.test(currentText);
    const nextStartsLower = /^[a-z]/.test(nextText);
    const words = sentenceWordCount(currentText);
    const lastWordMatch = currentText.toLowerCase().match(/([a-z']+)["')\]]?$/);
    const lastWord = lastWordMatch?.[1] ?? "";

    if (!endsWithStrongPunc && words <= 4) {
      return true;
    }
    if (!endsWithStrongPunc && CONTINUATION_LAST_WORDS.has(lastWord) && words <= 16) {
      return true;
    }
    if (!endsWithStrongPunc && nextStartsLower && words <= 10) {
      return true;
    }
    if (endsWithWeakPunc && nextStartsLower && words <= 14) {
      return true;
    }
    return false;
  };

  const mergeBrokenSentences = (items: SentenceItem[]): SentenceItem[] => {
    const merged: SentenceItem[] = [];
    items.forEach((item) => {
      const previous = merged[merged.length - 1];
      if (!previous) {
        merged.push({ ...item });
        return;
      }
      if (shouldMergeWithNext(previous.text, item.text)) {
        previous.text = normalizeCaptionText(`${previous.text} ${item.text}`);
        previous.endSec = Math.max(previous.endSec, item.endSec);
        return;
      }
      merged.push({ ...item });
    });
    return merged.map((item, index) => ({
      ...item,
      id: index + 1,
    }));
  };

  const sanitizeSentenceText = (raw: string): string => {
    let text = normalizeCaptionText(raw);
    text = text.replace(/^(?:\[[^\]]+\]\s*)+/g, "");
    text = text.replace(/^(?:\([^)]*\)\s*)+/g, "");
    text = text.replace(/^>>\s*/g, "");
    text = text.replace(/\b(uh|um)\b/gi, "");
    for (let i = 0; i < 4; i += 1) {
      text = text.replace(/\b([a-z']+(?:\s+[a-z']+){1,4})\s+\1\b/gi, "$1");
      text = text.replace(/\b([a-z']+)\s+the\s+\1\b/gi, "$1");
      text = text.replace(/\b([a-z']+)\s+\1\b/gi, "$1");
      text = text.replace(/\b([a-z']+),\s+\1\b/gi, "$1");
    }
    text = text.replace(/\s+([,.;:!?])/g, "$1");
    text = text.replace(/,{2,}/g, ",");
    text = text.replace(/^[,.;:!?]+\s*/g, "");
    text = text.replace(/\s+/g, " ").trim();
    if (/^[a-z]/.test(text)) {
      text = `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
    }
    return text;
  };

  const splitLongSentence = (item: SentenceItem): SentenceItem[] => {
    const text = sanitizeSentenceText(item.text);
    if (!text) {
      return [];
    }
    const words = sentenceWordCount(text);
    if (words <= SOFT_MAX_WORDS_PER_SENTENCE) {
      return [{ ...item, text }];
    }

    let chunks = text
      .split(/(?<=[.!?])\s+/)
      .map((chunk) => sanitizeSentenceText(chunk))
      .filter(Boolean);

    if (chunks.length === 1) {
      chunks = text
        .split(/,\s+(?=(?:and|but|so|because|which|that|when|while|if|then|though|although)\b)/i)
        .map((chunk) => sanitizeSentenceText(chunk))
        .filter(Boolean);
    }

    if (chunks.length <= 1 && words > 40) {
      const commaMatches = Array.from(text.matchAll(/,\s+/g));
      if (commaMatches.length > 0) {
        const midpoint = Math.floor(text.length / 2);
        const best = commaMatches.reduce((closest, current) => {
          const currentIndex = current.index ?? 0;
          const closestIndex = closest.index ?? 0;
          return Math.abs(currentIndex - midpoint) < Math.abs(closestIndex - midpoint)
            ? current
            : closest;
        });
        const splitIndex = (best.index ?? 0);
        const left = sanitizeSentenceText(text.slice(0, splitIndex));
        const right = sanitizeSentenceText(text.slice(splitIndex + 1));
        if (sentenceWordCount(left) >= 8 && sentenceWordCount(right) >= 8) {
          chunks = [left, right];
        }
      }
    }

    if (chunks.length <= 1 && words > 34) {
      const tokenized = text.split(/\s+/).filter(Boolean);
      const splitCandidates = tokenized
        .map((token, index) => ({ token: token.toLowerCase().replace(/[^a-z']/g, ""), index }))
        .filter(({ token, index }) =>
          index >= 10 &&
          index <= tokenized.length - 10 &&
          SPLIT_CONNECTOR_WORDS.has(token),
        );
      if (splitCandidates.length > 0) {
        const midpoint = Math.floor(tokenized.length / 2);
        const best = splitCandidates.reduce((closest, current) => {
          return Math.abs(current.index - midpoint) < Math.abs(closest.index - midpoint)
            ? current
            : closest;
        });
        const left = sanitizeSentenceText(tokenized.slice(0, best.index).join(" "));
        const right = sanitizeSentenceText(tokenized.slice(best.index).join(" "));
        if (sentenceWordCount(left) >= 8 && sentenceWordCount(right) >= 8) {
          chunks = [left, right];
        }
      }
    }

    if (chunks.length <= 1 && words > 40) {
      const tokenized = text.split(/\s+/).filter(Boolean);
      let splitIndex = Math.floor(tokenized.length / 2);
      const window = 8;
      let foundBoundary = false;
      for (let offset = 0; offset <= window; offset += 1) {
        const rightIndex = splitIndex + offset;
        const leftIndex = splitIndex - offset;
        const rightToken = tokenized[rightIndex]?.toLowerCase().replace(/[^a-z',.;:!?]/g, "") ?? "";
        const leftToken = tokenized[leftIndex]?.toLowerCase().replace(/[^a-z',.;:!?]/g, "") ?? "";
        if (SPLIT_CONNECTOR_WORDS.has(rightToken) || /[,.;:!?]$/.test(tokenized[rightIndex] ?? "")) {
          splitIndex = rightIndex;
          foundBoundary = true;
          break;
        }
        if (SPLIT_CONNECTOR_WORDS.has(leftToken) || /[,.;:!?]$/.test(tokenized[leftIndex] ?? "")) {
          splitIndex = leftIndex;
          foundBoundary = true;
          break;
        }
      }
      if (!foundBoundary) {
        return [{ ...item, text }];
      }
      const left = sanitizeSentenceText(tokenized.slice(0, splitIndex).join(" "));
      const right = sanitizeSentenceText(tokenized.slice(splitIndex).join(" "));
      if (sentenceWordCount(left) >= 8 && sentenceWordCount(right) >= 8) {
        chunks = [left, right];
      }
    }

    if (chunks.length <= 1) {
      return [{ ...item, text }];
    }

    const compactChunks: string[] = [];
    chunks.forEach((chunk) => {
      const wc = sentenceWordCount(chunk);
      if (wc < 4 && compactChunks.length > 0) {
        compactChunks[compactChunks.length - 1] = sanitizeSentenceText(`${compactChunks[compactChunks.length - 1]} ${chunk}`);
      } else {
        compactChunks.push(chunk);
      }
    });

    const duration = Math.max(0.8, item.endSec - item.startSec);
    const totalWords = Math.max(
      1,
      compactChunks.reduce((sum, chunk) => sum + Math.max(1, sentenceWordCount(chunk)), 0),
    );
    let cursor = item.startSec;

    return compactChunks.map((chunk, index) => {
      const chunkWords = Math.max(1, sentenceWordCount(chunk));
      const targetDur =
        index === compactChunks.length - 1
          ? Math.max(0.3, item.endSec - cursor)
          : Math.max(0.3, (duration * chunkWords) / totalWords);
      const startSec = cursor;
      const endSec =
        index === compactChunks.length - 1
          ? item.endSec
          : Math.min(item.endSec, cursor + targetDur);
      cursor = endSec;
      return {
        ...item,
        text: chunk,
        startSec,
        endSec: Math.max(startSec + 0.2, endSec),
      };
    });
  };

  const qualityRefineSentences = (items: SentenceItem[]): SentenceItem[] => {
    const expanded = items.flatMap((item) => splitLongSentence(item));
    const merged: SentenceItem[] = [];
    expanded.forEach((item) => {
      const normalizedText = sanitizeSentenceText(item.text);
      if (!normalizedText) {
        return;
      }
      const current: SentenceItem = { ...item, text: normalizedText };
      const previous = merged[merged.length - 1];
      if (!previous) {
        merged.push(current);
        return;
      }
      if (/^(And not|But also)\b/i.test(current.text) && sentenceWordCount(previous.text) <= 18) {
        const previousWithoutTailPunc = previous.text.replace(/[.!?]["')\]]?$/g, "").trim();
        const loweredCurrent = `${current.text.charAt(0).toLowerCase()}${current.text.slice(1)}`;
        previous.text = sanitizeSentenceText(`${previousWithoutTailPunc} ${loweredCurrent}`);
        previous.endSec = Math.max(previous.endSec, current.endSec);
        return;
      }
      const shouldMergeSubordinateClause =
        (/^(That|Which|Who|Whom|Whose)\b/i.test(current.text) &&
          !/^That\s+(is|was|were|are|feels|means|would|will|could|can|has|have|had|this|these|those|they|we|you|i)\b/i.test(current.text) &&
          sentenceWordCount(current.text) <= 28 &&
          sentenceWordCount(previous.text) <= 40) ||
        (/^(When|While|If|Because|Though|Although)\b/i.test(current.text) &&
          sentenceWordCount(current.text) <= 24 &&
          sentenceWordCount(previous.text) <= 30);
      if (shouldMergeSubordinateClause) {
        const previousWithoutTailPunc = previous.text.replace(/[.!?]["')\]]?$/g, "").trim();
        const loweredCurrent = `${current.text.charAt(0).toLowerCase()}${current.text.slice(1)}`;
        previous.text = sanitizeSentenceText(`${previousWithoutTailPunc} ${loweredCurrent}`);
        previous.endSec = Math.max(previous.endSec, current.endSec);
        return;
      }
      if (
        /^(And|But|So|Because|Which|That|When|While|If|Then|Though|Although)\b/i.test(current.text) &&
        !/[.!?]["')\]]?$/.test(current.text) &&
        sentenceWordCount(current.text) <= 24 &&
        sentenceWordCount(previous.text) <= 30
      ) {
        const previousWithoutTailPunc = previous.text.replace(/[.!?]["')\]]?$/g, "").trim();
        const loweredCurrent = `${current.text.charAt(0).toLowerCase()}${current.text.slice(1)}`;
        previous.text = sanitizeSentenceText(`${previousWithoutTailPunc} ${loweredCurrent}`);
        previous.endSec = Math.max(previous.endSec, current.endSec);
        return;
      }
      if (previous.text.toLowerCase() === current.text.toLowerCase()) {
        return;
      }
      if (shouldMergeWithNext(previous.text, current.text)) {
        previous.text = sanitizeSentenceText(`${previous.text} ${current.text}`);
        previous.endSec = Math.max(previous.endSec, current.endSec);
        return;
      }
      merged.push(current);
    });

    const forceSplitIfNeeded = (item: SentenceItem): SentenceItem[] => {
      if (sentenceWordCount(item.text) <= 42) {
        return [item];
      }
      const tokenized = item.text.split(/\s+/).filter(Boolean);
      let splitIndex = Math.floor(tokenized.length / 2);
      const window = 10;
      let foundBoundary = false;
      for (let offset = 0; offset <= window; offset += 1) {
        const rightIndex = splitIndex + offset;
        const leftIndex = splitIndex - offset;
        const rightToken = (tokenized[rightIndex] ?? "").toLowerCase().replace(/[^a-z',.;:!?]/g, "");
        const leftToken = (tokenized[leftIndex] ?? "").toLowerCase().replace(/[^a-z',.;:!?]/g, "");
        if (SPLIT_CONNECTOR_WORDS.has(rightToken) || /[,.;:!?]$/.test(tokenized[rightIndex] ?? "")) {
          splitIndex = rightIndex;
          foundBoundary = true;
          break;
        }
        if (SPLIT_CONNECTOR_WORDS.has(leftToken) || /[,.;:!?]$/.test(tokenized[leftIndex] ?? "")) {
          splitIndex = leftIndex;
          foundBoundary = true;
          break;
        }
      }
      if (!foundBoundary || splitIndex <= 8 || splitIndex >= tokenized.length - 8) {
        return [item];
      }
      const left = sanitizeSentenceText(tokenized.slice(0, splitIndex).join(" "));
      const right = sanitizeSentenceText(tokenized.slice(splitIndex).join(" "));
      if (sentenceWordCount(left) < 8 || sentenceWordCount(right) < 8) {
        return [item];
      }
      const middle = (item.startSec + item.endSec) / 2;
      return [
        { ...item, text: left, endSec: Math.max(item.startSec + 0.2, middle) },
        { ...item, text: right, startSec: Math.max(item.startSec + 0.2, middle) },
      ];
    };

    const finalItems = merged.flatMap((item) => forceSplitIfNeeded(item));
    const postMerged: SentenceItem[] = [];
    finalItems.forEach((item) => {
      const currentText = sanitizeSentenceText(item.text);
      if (!currentText) {
        return;
      }
      const current: SentenceItem = { ...item, text: currentText };
      const previous = postMerged[postMerged.length - 1];
      if (!previous) {
        postMerged.push(current);
        return;
      }
      const shouldMergeSubordinateClause =
        (/^(That|Which|Who|Whom|Whose)\b/i.test(current.text) &&
          !/^That\s+(is|was|were|are|feels|means|would|will|could|can|has|have|had|this|these|those|they|we|you|i)\b/i.test(current.text) &&
          sentenceWordCount(current.text) <= 36 &&
          sentenceWordCount(previous.text) <= 120) ||
        (/^(When|While|If|Because|Though|Although)\b/i.test(current.text) &&
          sentenceWordCount(current.text) <= 36 &&
          sentenceWordCount(previous.text) <= 120) ||
        (/^(Engaging|Of|Over|Probably|Is like)\b/i.test(current.text) &&
          sentenceWordCount(current.text) <= 24 &&
          sentenceWordCount(previous.text) <= 120);
      if (shouldMergeSubordinateClause) {
        const previousWithoutTailPunc = previous.text.replace(/[.!?]["')\]]?$/g, "").trim();
        const loweredCurrent = `${current.text.charAt(0).toLowerCase()}${current.text.slice(1)}`;
        previous.text = sanitizeSentenceText(`${previousWithoutTailPunc} ${loweredCurrent}`);
        previous.endSec = Math.max(previous.endSec, current.endSec);
        return;
      }
      postMerged.push(current);
    });

    return postMerged
      .map((item, index) => {
        const endsWithPunc = /[.!?]["')\]]?$/.test(item.text);
        const finalizedText =
          !endsWithPunc && sentenceWordCount(item.text) >= 8
            ? `${item.text}.`
            : item.text;
        return {
          ...item,
          id: index + 1,
          text: finalizedText,
        };
      })
      .slice(0, MAX_SENTENCES);
  };

  expandedSegments.forEach((segment, index) => {
    if (!bufferText) {
      bufferStartSec = segment.startSec;
    }
    bufferEndSec = segment.endSec;
    bufferText = appendSegmentText(bufferText, segment.text);

    const next = expandedSegments[index + 1];
    const gapSec = next ? Math.max(0, next.startSec - segment.endSec) : 0;
    const endsWithStrongPunc = /[.!?]["')\]]?$/.test(segment.text);
    const endsWithWeakPunc = /[,;:]["')\]]?$/.test(segment.text);
    const nextStartsUpper = next ? /^[A-Z]/.test(normalizeCaptionText(next.text)) : false;
    const words = sentenceWordCount(bufferText);
    const isHardTooLong = words >= HARD_MAX_WORDS_PER_SENTENCE || bufferText.length >= HARD_MAX_CHARS_PER_SENTENCE;
    const shouldCut =
      endsWithStrongPunc ||
      (gapSec >= PAUSE_CUT_SECONDS && words >= 6 && (endsWithWeakPunc || nextStartsUpper)) ||
      (isHardTooLong && (endsWithWeakPunc || gapSec >= PAUSE_CUT_SECONDS));
    if (shouldCut) {
      flush();
    }
  });

  if (bufferText) {
    flush();
  }

  const merged = mergeBrokenSentences(sentences);
  const refined = qualityRefineSentences(merged);
  return refined;
}

function sentenceWordCount(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

async function translateSentenceToZh(text: string): Promise<string> {
  const endpoint =
    "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=zh-CN&dt=t&q=" +
    encodeURIComponent(text);
  const response = await fetch(endpoint, {
    cache: "no-store",
    headers: {
      "User-Agent": USER_AGENT,
    },
  });
  if (!response.ok) {
    return "";
  }
  const payload = (await response.json()) as unknown;
  const chunks = Array.isArray((payload as unknown[])[0]) ? ((payload as unknown[])[0] as unknown[]) : [];
  return chunks
    .map((item) => String((item as unknown[])[0] ?? ""))
    .join("")
    .trim();
}

async function translateSentences(sentences: SentenceItem[]): Promise<SentenceItem[]> {
  const cache = new Map<string, string>();
  const translated: SentenceItem[] = [];
  for (const sentence of sentences) {
    const key = sentence.text;
    if (!cache.has(key)) {
      try {
        const translation = await translateSentenceToZh(key);
        cache.set(key, translation);
      } catch {
        cache.set(key, "");
      }
    }
    translated.push({
      ...sentence,
      translation: cache.get(key) ?? "",
    });
  }
  return translated;
}

function pickBestTrack(tracks: CaptionTrack[]): CaptionTrack | null {
  if (tracks.length === 0) {
    return null;
  }
  const englishTracks = tracks.filter((track) => String(track.languageCode ?? "").startsWith("en"));
  if (englishTracks.length > 0) {
    const nonAsr = englishTracks.find((track) => String(track.kind ?? "").toLowerCase() !== "asr");
    return nonAsr ?? englishTracks[0];
  }
  const fallbackNonAsr = tracks.find((track) => String(track.kind ?? "").toLowerCase() !== "asr");
  return fallbackNonAsr ?? tracks[0];
}

function extractTitleFromPlayer(player: Record<string, unknown>): string {
  const videoDetails = (player.videoDetails ?? {}) as { title?: unknown };
  return String(videoDetails.title ?? "").trim();
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ImportRequestBody;
    const subtitleText = String(body?.subtitleText ?? "").trim();

    if (subtitleText) {
      if (subtitleText.length > MAX_SUBTITLE_TEXT_LENGTH) {
        return NextResponse.json(
          { success: false, error: "Subtitle file is too large. Please keep it under 2MB." },
          { status: 413 },
        );
      }

      const segments = parseSrtOrVttSegments(subtitleText);
      if (segments.length === 0) {
        return NextResponse.json(
          { success: false, error: "Could not parse subtitle content. Please upload a valid .srt or .vtt file." },
          { status: 400 },
        );
      }

      const stitched = stitchSegmentsToSentences(segments);
      const sentences = await translateSentences(stitched);
      const fallbackVideoId = parseYoutubeVideoId(String(body?.videoId ?? body?.url ?? ""));
      const fallbackTitle = String(body?.title ?? "").trim() || `Imported subtitles (${segments.length} segments)`;

      return NextResponse.json({
        success: true,
        videoId: fallbackVideoId,
        title: fallbackTitle,
        sourceLanguage: String(body?.sourceLanguage ?? "unknown"),
        importMode: "subtitle-text",
        sentences,
      });
    }

    const videoId = parseYoutubeVideoId(String(body?.url ?? ""));
    if (!videoId) {
      return NextResponse.json({ success: false, error: "Invalid YouTube URL or ID." }, { status: 400 });
    }

    const watchUrl = `https://www.youtube.com/watch?v=${videoId}&hl=en`;
    const watchResponse = await fetch(watchUrl, {
      cache: "no-store",
      headers: {
        "User-Agent": USER_AGENT,
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    if (!watchResponse.ok) {
      return NextResponse.json({ success: false, error: "Failed to load YouTube page." }, { status: 502 });
    }
    const html = await watchResponse.text();
    const player = extractBalancedJson(html, "ytInitialPlayerResponse");
    if (!player) {
      return NextResponse.json({ success: false, error: "Could not parse YouTube player metadata." }, { status: 502 });
    }

    const captionTracks = (((player.captions ?? {}) as {
      playerCaptionsTracklistRenderer?: { captionTracks?: CaptionTrack[] };
    }).playerCaptionsTracklistRenderer?.captionTracks ?? []) as CaptionTrack[];
    const selectedTrack = pickBestTrack(captionTracks);
    if (!selectedTrack?.baseUrl) {
      return NextResponse.json(
        { success: false, error: "This video has no accessible subtitles." },
        { status: 404 },
      );
    }

    const transcriptUrl = new URL(selectedTrack.baseUrl);
    transcriptUrl.searchParams.set("fmt", "json3");
    const transcriptResponse = await fetch(transcriptUrl.toString(), {
      cache: "no-store",
      headers: {
        "User-Agent": USER_AGENT,
      },
    });
    if (!transcriptResponse.ok) {
      return NextResponse.json({ success: false, error: "Failed to download subtitle track." }, { status: 502 });
    }
    const transcriptRaw = await transcriptResponse.text();
    let segments: CaptionSegment[] = [];
    if (transcriptRaw.trim().startsWith("{")) {
      try {
        const transcriptPayload = JSON.parse(transcriptRaw) as unknown;
        segments = parseJson3Segments(transcriptPayload);
      } catch {
        segments = [];
      }
    }
    if (segments.length === 0) {
      const fallbackResponse = await fetch(selectedTrack.baseUrl, {
        cache: "no-store",
        headers: {
          "User-Agent": USER_AGENT,
        },
      });
      if (fallbackResponse.ok) {
        const fallbackRaw = await fallbackResponse.text();
        if (fallbackRaw.trim().startsWith("<")) {
          segments = parseXmlSegments(fallbackRaw);
        }
      }
    }
    if (segments.length === 0) {
      return NextResponse.json({ success: false, error: "Subtitle track is empty or unsupported." }, { status: 404 });
    }

    const stitched = stitchSegmentsToSentences(segments);
    const sentences = await translateSentences(stitched);
    const title = extractTitleFromPlayer(player) || `YouTube ${videoId}`;

    return NextResponse.json({
      success: true,
      videoId,
      title,
      sourceLanguage: selectedTrack.languageCode ?? "unknown",
      importMode: "youtube-auto",
      sentences,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
