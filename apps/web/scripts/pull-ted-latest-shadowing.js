const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const CHANNEL_URL = process.argv[2] || "https://www.youtube.com/@TED/videos";
const LIMIT = Number(process.argv[3] || 10);
const DOWNLOAD_VIDEO = !process.argv.includes("--subs-only");
const MAX_SENTENCES_PER_VIDEO = 60;
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
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36";

const APP_ROOT = path.resolve(__dirname, "..");
const DOWNLOAD_ROOT = path.join(APP_ROOT, "public", "assets", "youtube", "ted-latest");
const OUTPUT_JSON_PATH = path.join(APP_ROOT, "data", "ted-latest-shadowing.json");

function run(command, args, options = {}) {
  try {
    return execFileSync(command, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 1024 * 1024 * 128,
      ...options,
    });
  } catch (error) {
    const stdout = error && error.stdout ? String(error.stdout) : "";
    const stderr = error && error.stderr ? String(error.stderr) : "";
    const tail = [stdout, stderr].filter(Boolean).join("\n").slice(-4000);
    throw new Error(`Command failed: ${command} ${args.join(" ")}\n${tail}`);
  }
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function parseTimeToSeconds(raw) {
  const normalized = String(raw || "").trim().replace(",", ".");
  const parts = normalized.split(":").map((v) => Number(v));
  if ((parts.length !== 2 && parts.length !== 3) || parts.some((v) => !Number.isFinite(v) || v < 0)) {
    return null;
  }
  if (parts.length === 2) {
    const [m, s] = parts;
    return m * 60 + s;
  }
  const [h, m, s] = parts;
  return h * 3600 + m * 60 + s;
}

function normalizeCaptionText(raw) {
  return String(raw || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function shouldDropSegment(text) {
  if (!text) return true;
  if (/^\[[^\]]+\]$/.test(text)) return true;
  if (/^\([^)]*\)$/.test(text)) return true;
  if (/^♪+$/.test(text)) return true;
  return false;
}

function parseVttFile(vttRaw) {
  const lines = String(vttRaw || "")
    .replace(/\uFEFF/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n");

  const segments = [];
  let i = 0;
  while (i < lines.length) {
    const line = String(lines[i] || "").trim();
    if (!line || line.startsWith("WEBVTT") || line.startsWith("NOTE") || line.startsWith("STYLE")) {
      i += 1;
      continue;
    }

    if (line.includes("-->")) {
      const [startRaw, endRawWithExtra] = line.split("-->");
      const startSec = parseTimeToSeconds(startRaw);
      const endToken = String(endRawWithExtra || "").trim().split(/\s+/)[0] || "";
      const endSecParsed = parseTimeToSeconds(endToken);
      i += 1;

      const textLines = [];
      while (i < lines.length && String(lines[i] || "").trim() !== "") {
        textLines.push(String(lines[i] || "").trim());
        i += 1;
      }

      if (startSec === null || endSecParsed === null) {
        i += 1;
        continue;
      }
      const normalizedLines = textLines
        .map((row) => normalizeCaptionText(row))
        .filter(Boolean);
      // Keep the full cue text instead of only the last display line.
      // YouTube auto-captions frequently wrap one subtitle cue across 2 lines.
      let text = normalizeCaptionText(normalizedLines.join(" "));
      if (shouldDropSegment(text)) {
        i += 1;
        continue;
      }
      const previous = segments[segments.length - 1];
      if (previous) {
        if (text === previous.text) {
          i += 1;
          continue;
        }
        if (text.startsWith(previous.text)) {
          const trimmed = text.slice(previous.text.length).trim();
          if (!trimmed) {
            i += 1;
            continue;
          }
          text = trimmed;
        } else if (previous.text.startsWith(text)) {
          i += 1;
          continue;
        }
      }
      const endSec = Math.max(startSec + 0.4, endSecParsed);
      if (previous && previous.text === text && Math.abs(previous.startSec - startSec) < 0.2) {
        i += 1;
        continue;
      }
      segments.push({ startSec, endSec, text });
    }
    i += 1;
  }
  return segments;
}

function sentenceWordCount(text) {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function stitchSegmentsToSentences(segments) {
  const sentences = [];
  let bufferText = "";
  let bufferStartSec = 0;
  let bufferEndSec = 0;

  const splitSegmentIntoSubSentences = (segment) => {
    const normalized = normalizeCaptionText(segment.text);
    if (!normalized) return [];
    const parts = (normalized.match(/[^.!?]+[.!?]["')\]]*|[^.!?]+$/g) || [])
      .map((part) => normalizeCaptionText(part))
      .filter(Boolean);
    if (parts.length <= 1) {
      return [{ ...segment, text: normalized }];
    }
    const duration = Math.max(0.4, segment.endSec - segment.startSec);
    return parts.map((part, index) => {
      const startSec = segment.startSec + (duration * index) / parts.length;
      const endSec = index === parts.length - 1
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

  const appendSegmentText = (existing, incomingRaw) => {
    const incoming = normalizeCaptionText(incomingRaw);
    if (!incoming) return existing;
    if (!existing) return incoming;
    if (incoming === existing || existing.includes(` ${incoming}`) || existing === incoming) return existing;
    if (incoming.startsWith(existing)) {
      const suffix = incoming.slice(existing.length).trim();
      return suffix ? `${existing} ${suffix}`.trim() : existing;
    }
    if (existing.endsWith(incoming)) return existing;

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

  const shouldMergeWithNext = (currentTextRaw, nextTextRaw) => {
    const currentText = normalizeCaptionText(currentTextRaw);
    const nextText = normalizeCaptionText(nextTextRaw);
    if (!currentText || !nextText) return false;
    const endsWithStrongPunc = /[.!?]["')\]]?$/.test(currentText);
    const endsWithWeakPunc = /[,;:]["')\]]?$/.test(currentText);
    const nextStartsLower = /^[a-z]/.test(nextText);
    const words = sentenceWordCount(currentText);
    const lastWordMatch = currentText.toLowerCase().match(/([a-z']+)["')\]]?$/);
    const lastWord = lastWordMatch ? lastWordMatch[1] : "";

    if (!endsWithStrongPunc && words <= 4) return true;
    if (!endsWithStrongPunc && CONTINUATION_LAST_WORDS.has(lastWord) && words <= 16) return true;
    if (!endsWithStrongPunc && nextStartsLower && words <= 10) return true;
    if (endsWithWeakPunc && nextStartsLower && words <= 14) return true;
    return false;
  };

  const mergeBrokenSentences = (items) => {
    const merged = [];
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

  const sanitizeSentenceText = (raw) => {
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

  const splitLongSentence = (item) => {
    const text = sanitizeSentenceText(item.text);
    if (!text) return [];
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
          const currentIndex = current.index || 0;
          const closestIndex = closest.index || 0;
          return Math.abs(currentIndex - midpoint) < Math.abs(closestIndex - midpoint)
            ? current
            : closest;
        });
        const splitIndex = best.index || 0;
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
        const rightToken = (tokenized[rightIndex] || "").toLowerCase().replace(/[^a-z',.;:!?]/g, "");
        const leftToken = (tokenized[leftIndex] || "").toLowerCase().replace(/[^a-z',.;:!?]/g, "");
        if (SPLIT_CONNECTOR_WORDS.has(rightToken) || /[,.;:!?]$/.test(tokenized[rightIndex] || "")) {
          splitIndex = rightIndex;
          foundBoundary = true;
          break;
        }
        if (SPLIT_CONNECTOR_WORDS.has(leftToken) || /[,.;:!?]$/.test(tokenized[leftIndex] || "")) {
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

    const compactChunks = [];
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
      const targetDur = index === compactChunks.length - 1
        ? Math.max(0.3, item.endSec - cursor)
        : Math.max(0.3, (duration * chunkWords) / totalWords);
      const startSec = cursor;
      const endSec = index === compactChunks.length - 1
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

  const qualityRefineSentences = (items) => {
    const expanded = items.flatMap((item) => splitLongSentence(item));
    const merged = [];
    expanded.forEach((item) => {
      const normalizedText = sanitizeSentenceText(item.text);
      if (!normalizedText) return;
      const current = { ...item, text: normalizedText };
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

    const forceSplitIfNeeded = (item) => {
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
        const rightToken = (tokenized[rightIndex] || "").toLowerCase().replace(/[^a-z',.;:!?]/g, "");
        const leftToken = (tokenized[leftIndex] || "").toLowerCase().replace(/[^a-z',.;:!?]/g, "");
        if (SPLIT_CONNECTOR_WORDS.has(rightToken) || /[,.;:!?]$/.test(tokenized[rightIndex] || "")) {
          splitIndex = rightIndex;
          foundBoundary = true;
          break;
        }
        if (SPLIT_CONNECTOR_WORDS.has(leftToken) || /[,.;:!?]$/.test(tokenized[leftIndex] || "")) {
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
    const postMerged = [];
    finalItems.forEach((item) => {
      const currentText = sanitizeSentenceText(item.text);
      if (!currentText) {
        return;
      }
      const current = { ...item, text: currentText };
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
        const finalizedText = !endsWithPunc && sentenceWordCount(item.text) >= 8
          ? `${item.text}.`
          : item.text;
        return {
          ...item,
          id: index + 1,
          text: finalizedText,
        };
      })
      .slice(0, MAX_SENTENCES_PER_VIDEO);
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

async function translateSentenceToZh(text) {
  const endpoint =
    "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=zh-CN&dt=t&q=" +
    encodeURIComponent(text);
  const response = await fetch(endpoint, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!response.ok) {
    return "";
  }
  const payload = await response.json();
  const chunks = Array.isArray(payload?.[0]) ? payload[0] : [];
  return chunks
    .map((chunk) => String(chunk?.[0] || ""))
    .join("")
    .trim();
}

async function translateSentences(sentences) {
  const cache = new Map();
  const translated = [];
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
      translation: cache.get(key) || "",
    });
  }
  return translated;
}

function pickBestSubtitleFile(videoDir, videoId) {
  const files = fs.readdirSync(videoDir);
  const candidates = files.filter((file) => {
    const lower = file.toLowerCase();
    if (!lower.startsWith(videoId.toLowerCase())) return false;
    if (!lower.endsWith(".vtt")) return false;
    return lower.includes(".en");
  });
  if (candidates.length === 0) {
    return null;
  }

  const score = (file) => {
    const lower = file.toLowerCase();
    if (lower.includes(".en.vtt")) return 1;
    if (lower.includes(".en-orig.vtt")) return 2;
    if (lower.includes(".en-us.vtt")) return 3;
    if (lower.includes(".en-")) return 4;
    return 5;
  };

  return candidates.sort((a, b) => score(a) - score(b))[0];
}

function hasSubtitleCandidate(videoDir, videoId) {
  const file = pickBestSubtitleFile(videoDir, videoId);
  return Boolean(file);
}

function downloadSubtitles(url, outputTemplate) {
  run("python", [
    "-m",
    "yt_dlp",
    "--skip-download",
    "--write-auto-sub",
    "--write-sub",
    "--sub-format",
    "vtt",
    "--sub-langs",
    "en.*,en",
    "--output",
    outputTemplate,
    url,
  ]);
}

function downloadVideo(url, outputTemplate) {
  run("python", [
    "-m",
    "yt_dlp",
    "--format",
    "b[ext=mp4][height<=480]/b[height<=480]/best",
    "--output",
    outputTemplate,
    url,
  ]);
}

function listLatestVideos(channelUrl, limit) {
  const raw = run("python", [
    "-m",
    "yt_dlp",
    "--flat-playlist",
    "--playlist-end",
    String(limit),
    "--dump-single-json",
    channelUrl,
  ]);
  const payload = JSON.parse(raw);
  const entries = Array.isArray(payload.entries) ? payload.entries : [];
  return entries
    .slice(0, limit)
    .map((entry) => ({
      id: String(entry.id || "").trim(),
      title: String(entry.title || "").trim(),
      url: String(entry.url || "").trim() || `https://www.youtube.com/watch?v=${String(entry.id || "").trim()}`,
    }))
    .filter((item) => item.id && item.url);
}

async function main() {
  ensureDir(DOWNLOAD_ROOT);
  const videos = listLatestVideos(CHANNEL_URL, LIMIT);
  if (videos.length === 0) {
    throw new Error("No videos found from channel feed.");
  }

  const materials = [];
  const failures = [];

  for (const [index, video] of videos.entries()) {
    const videoDir = path.join(DOWNLOAD_ROOT, video.id);
    ensureDir(videoDir);
    const outTemplate = path.join(videoDir, "%(id)s.%(ext)s").replace(/\\/g, "/");
    const watchUrl = video.url.startsWith("http") ? video.url : `https://www.youtube.com/watch?v=${video.id}`;

    console.log(`[${index + 1}/${videos.length}] ${video.id} ${video.title}`);

    try {
      downloadSubtitles(watchUrl, outTemplate);
    } catch (error) {
      if (hasSubtitleCandidate(videoDir, video.id)) {
        console.warn(`subtitle command failed but file exists: ${video.id}`);
      } else {
        failures.push({
          videoId: video.id,
          title: video.title,
          stage: "subtitle-download",
          error: error instanceof Error ? error.message : String(error),
        });
        continue;
      }
    }

    if (DOWNLOAD_VIDEO) {
      try {
        downloadVideo(watchUrl, outTemplate);
      } catch (error) {
        failures.push({
          videoId: video.id,
          title: video.title,
          stage: "video-download",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const subtitleFile = pickBestSubtitleFile(videoDir, video.id);
    if (!subtitleFile) {
      failures.push({
        videoId: video.id,
        title: video.title,
        stage: "subtitle-select",
        error: "No English subtitle file found after download.",
      });
      continue;
    }

    const subtitlePath = path.join(videoDir, subtitleFile);
    const subtitleText = fs.readFileSync(subtitlePath, "utf8");
    const segments = parseVttFile(subtitleText);
    if (segments.length === 0) {
      failures.push({
        videoId: video.id,
        title: video.title,
        stage: "subtitle-parse",
        error: "Subtitle file parsed to zero segments.",
      });
      continue;
    }

    const stitched = stitchSegmentsToSentences(segments);
    const sentences = await translateSentences(stitched);
    if (sentences.length === 0) {
      failures.push({
        videoId: video.id,
        title: video.title,
        stage: "sentence-build",
        error: "No practice sentences generated.",
      });
      continue;
    }

    materials.push({
      id: `youtube-${video.id}-seed`,
      title: video.title || `TED ${video.id}`,
      titleCn: video.title || `TED ${video.id}`,
      source: "TED YouTube Latest",
      category: "ted",
      difficulty: 2,
      youtubeVideoId: video.id,
      sentences,
    });
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    channelUrl: CHANNEL_URL,
    limit: LIMIT,
    downloadVideo: DOWNLOAD_VIDEO,
    outputRoot: path.relative(APP_ROOT, DOWNLOAD_ROOT).replace(/\\/g, "/"),
    itemCount: materials.length,
    failureCount: failures.length,
    items: materials,
    failures,
  };

  fs.writeFileSync(OUTPUT_JSON_PATH, JSON.stringify(payload, null, 2), "utf8");
  console.log(`Saved: ${OUTPUT_JSON_PATH}`);
  console.log(`Generated materials: ${materials.length}`);
  console.log(`Failures: ${failures.length}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
