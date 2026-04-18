const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const positionalArgs = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const CHANNEL_URL = positionalArgs[0] || "https://www.youtube.com/@EasyJapanese/videos";
const LIMIT = Number(positionalArgs[1] || 10);
const DOWNLOAD_VIDEO = !process.argv.includes("--subs-only");
const MAX_SENTENCES_PER_VIDEO = 60;
const PAUSE_CUT_SECONDS = 0.6;
const HARD_MAX_CHARS_PER_SENTENCE = 45;
const IDEAL_MAX_CHARS = 35;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36";

const APP_ROOT = path.resolve(__dirname, "..");
const DOWNLOAD_ROOT = path.join(APP_ROOT, "public", "assets", "youtube", "ja-latest");
const OUTPUT_JSON_PATH = path.join(APP_ROOT, "data", "japanese-youtube-shadowing.json");

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
    // Remove inline furigana annotations like 収録（しゅうろく）or 収録(しゅうろく)
    .replace(/([一-龯々ヶ]+)[（(]([ぁ-んァ-ヶー]+)[）)]/g, "$1")
    // Remove inline fillers common in podcast dialogue
    .replace(/(?:^|(?<=[。、！？!?\s]))(?:うん|ああ|あー|えー|えーと|えっと|まあ|んー|ふーん|へぇ|おー|はいはい|そうそう)(?=[。、！？!?\s]|$)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Filler words common in Japanese podcast dialogue */
const FILLER_RE = /^(うん|ああ|あー|えー|えーと|えっと|まあ|んー|ふーん|へぇ|おー|はいはい|そうそう|ねえ)$/;

/** Conversational boundary markers for splitting long unpunctuated text */
const CONV_SPLIT_RE = /(?:ね|よ|よね|けど|けれど|けれども|から|ので|のに|って|がね|んだ|んで|んですけど|ましたね|ますね|ですね|ですよ|ですけど|ました|ます|です|だよ|だね|だけど|なんだ|なんです|わけで|ことで|かね|のかな|かな|だな)$/;

/** Patterns that commonly START a new utterance or thought */
const RESTART_RE = /^(はい|それで|それが|それは|でも|だから|もう|今日|今年|この|あの|あと|じゃ|じゃあ|やっぱ|やっぱり|まぁ|まあ|実は|何か|確か|ところで|例えば|つまり|要するに|ちなみに)/;

/** Short standalone reactions/back-channel that mark speaker turns */
const REACTION_RE = /^(はい|ね|うん|そうだね|そうですね|確かに|確かにね|なるほど|本当|本当に|そっか|そっかそっか|いいね)$/;

function shouldDropSegment(text) {
  if (!text) return true;
  if (/^\[[^\]]+\]$/.test(text)) return true;
  if (/^\([^)]*\)$/.test(text)) return true;
  if (/^（[^）]*）$/.test(text)) return true;
  if (/^♪+$/.test(text)) return true;
  if (FILLER_RE.test(text)) return true;
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

/**
 * Stitch VTT segments into natural Japanese sentences.
 * Japanese doesn't use spaces between words, so we split on sentence-ending punctuation.
 */
function stitchSegmentsToSentences(segments) {
  const sentences = [];
  let bufferText = "";
  let bufferStartSec = 0;
  let bufferEndSec = 0;

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

  const appendText = (existing, incoming) => {
    const text = normalizeCaptionText(incoming);
    if (!text) return existing;
    if (!existing) return text;
    if (text === existing || existing.includes(text)) return existing;
    if (text.startsWith(existing)) {
      const suffix = text.slice(existing.length).trim();
      return suffix ? existing + suffix : existing;
    }
    if (existing.endsWith(text)) return existing;
    // For Japanese, just concatenate (no space needed between Japanese characters)
    const needsSpace = /[a-zA-Z0-9]$/.test(existing) && /^[a-zA-Z0-9]/.test(text);
    return needsSpace ? `${existing} ${text}` : `${existing}${text}`;
  };

  segments.forEach((segment, index) => {
    const incomingText = normalizeCaptionText(segment.text);

    // Pre-append cut: flush buffer when a speaker turn or new utterance is detected
    if (bufferText) {
      const bufferEndsWithMarker = CONV_SPLIT_RE.test(bufferText);
      // If the entire buffer IS a standalone reaction, isolate it before non-reaction content
      if (REACTION_RE.test(bufferText) && !REACTION_RE.test(incomingText)) {
        flush();
      }
      // Incoming is a standalone reaction (はい, そうだね, etc.) → flush first
      else if (bufferText.length >= 4 && REACTION_RE.test(incomingText)) {
        if (bufferEndsWithMarker || bufferText.length >= 12) {
          flush();
        }
      }
      // Incoming starts a new thought (それで, でも, この, etc.) → flush first
      else if (bufferText.length >= 8 && bufferEndsWithMarker && RESTART_RE.test(incomingText)) {
        flush();
      }
    }

    if (!bufferText) {
      bufferStartSec = segment.startSec;
    }
    bufferEndSec = segment.endSec;
    bufferText = appendText(bufferText, segment.text);

    const next = segments[index + 1];
    const gapSec = next ? Math.max(0, next.startSec - segment.endSec) : 0;
    const endsWithStrongPunc = /[。！？!?]$/.test(segment.text);
    const endsWithWeakPunc = /[、,;；：:]$/.test(segment.text);
    const endsWithConversationalMarker = CONV_SPLIT_RE.test(bufferText);
    const isHardTooLong = bufferText.length >= HARD_MAX_CHARS_PER_SENTENCE;
    const isIdealTooLong = bufferText.length >= IDEAL_MAX_CHARS && endsWithConversationalMarker;
    const isSoftTooLong = bufferText.length >= 15 && endsWithConversationalMarker && gapSec >= 0.15;
    const isMarkerWithGap = endsWithConversationalMarker && bufferText.length >= 8 && gapSec >= 0.25;
    const shouldCut =
      endsWithStrongPunc ||
      (gapSec >= PAUSE_CUT_SECONDS && bufferText.length >= 6 && (endsWithWeakPunc || gapSec >= 0.8)) ||
      isSoftTooLong ||
      isMarkerWithGap ||
      isIdealTooLong ||
      isHardTooLong;
    if (shouldCut) {
      flush();
    }
  });

  if (bufferText) {
    flush();
  }

  // Post-process: merge very short fragments with neighbors
  const merged = [];
  sentences.forEach((item) => {
    const previous = merged[merged.length - 1];
    if (!previous) {
      merged.push({ ...item });
      return;
    }
    // Merge if current is very short and previous doesn't end with strong punctuation
    if (item.text.length < 6 && !/[。！？!?]$/.test(previous.text)) {
      previous.text = normalizeCaptionText(previous.text + item.text);
      previous.endSec = Math.max(previous.endSec, item.endSec);
      return;
    }
    // Merge if previous is very short
    if (previous.text.length < 6) {
      previous.text = normalizeCaptionText(previous.text + item.text);
      previous.endSec = Math.max(previous.endSec, item.endSec);
      return;
    }
    merged.push({ ...item });
  });

  // Split overly long sentences on Japanese punctuation
  const splitLong = [];
  merged.forEach((item) => {
    if (item.text.length <= HARD_MAX_CHARS_PER_SENTENCE) {
      splitLong.push(item);
      return;
    }
    const parts = item.text.split(/(?<=[。！？!?])/).filter((p) => p.trim());
    if (parts.length <= 1) {
      // Try splitting on 、
      const commaParts = item.text.split(/(?<=[、])/).filter((p) => p.trim());
      if (commaParts.length > 1) {
        const duration = Math.max(0.4, item.endSec - item.startSec);
        let cursor = item.startSec;
        commaParts.forEach((part, idx) => {
          const ratio = part.length / item.text.length;
          const partDur = idx === commaParts.length - 1 ? item.endSec - cursor : duration * ratio;
          splitLong.push({
            ...item,
            text: normalizeCaptionText(part),
            startSec: cursor,
            endSec: Math.max(cursor + 0.2, cursor + partDur),
          });
          cursor += partDur;
        });
        return;
      }
      // Try splitting on conversational markers
      const markerParts = item.text.split(/(?<=ね|よね|けど|から|です|ました|ます|んだ)(?=.{8,})/).filter((p) => p.trim());
      if (markerParts.length > 1) {
        const duration = Math.max(0.4, item.endSec - item.startSec);
        let cursor = item.startSec;
        markerParts.forEach((part, idx) => {
          const ratio = part.length / item.text.length;
          const partDur = idx === markerParts.length - 1 ? item.endSec - cursor : duration * ratio;
          splitLong.push({
            ...item,
            text: normalizeCaptionText(part),
            startSec: cursor,
            endSec: Math.max(cursor + 0.2, cursor + partDur),
          });
          cursor += partDur;
        });
        return;
      }
      // Last resort: hard split at HARD_MAX
      if (item.text.length > HARD_MAX_CHARS_PER_SENTENCE) {
        const mid = Math.floor(item.text.length / 2);
        const midSec = item.startSec + (item.endSec - item.startSec) / 2;
        splitLong.push({ ...item, text: normalizeCaptionText(item.text.slice(0, mid)), endSec: midSec });
        splitLong.push({ ...item, text: normalizeCaptionText(item.text.slice(mid)), startSec: midSec });
        return;
      }
      splitLong.push(item);
      return;
    }
    const duration = Math.max(0.4, item.endSec - item.startSec);
    let cursor = item.startSec;
    parts.forEach((part, idx) => {
      const ratio = part.length / item.text.length;
      const partDur = idx === parts.length - 1 ? item.endSec - cursor : duration * ratio;
      splitLong.push({
        ...item,
        text: normalizeCaptionText(part),
        startSec: cursor,
        endSec: Math.max(cursor + 0.2, cursor + partDur),
      });
      cursor += partDur;
    });
  });

  // Second merge pass: fix fragments created by splitting
  const reMerged = [];
  splitLong.forEach((item) => {
    const previous = reMerged[reMerged.length - 1];
    if (!previous) {
      reMerged.push({ ...item });
      return;
    }
    if (item.text.length < 8 && previous.text.length + item.text.length <= HARD_MAX_CHARS_PER_SENTENCE) {
      previous.text = normalizeCaptionText(previous.text + item.text);
      previous.endSec = Math.max(previous.endSec, item.endSec);
      return;
    }
    if (previous.text.length < 8 && previous.text.length + item.text.length <= HARD_MAX_CHARS_PER_SENTENCE) {
      previous.text = normalizeCaptionText(previous.text + item.text);
      previous.endSec = Math.max(previous.endSec, item.endSec);
      return;
    }
    reMerged.push({ ...item });
  });

  // Remove pure noise, clean up and re-index
  return reMerged
    .filter((item) => {
      const text = normalizeCaptionText(item.text);
      if (!text || text.length < 2) return false;
      if (/^\[.*\]$/.test(text)) return false;
      if (/^（.*）$/.test(text)) return false;
      return true;
    })
    .map((item, index) => ({
      ...item,
      id: index + 1,
      text: normalizeCaptionText(item.text),
    }))
    .slice(0, MAX_SENTENCES_PER_VIDEO);
}

async function translateSentenceToZh(text) {
  const endpoint =
    "https://translate.googleapis.com/translate_a/single?client=gtx&sl=ja&tl=zh-CN&dt=t&q=" +
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

async function translateSentenceToEn(text) {
  const endpoint =
    "https://translate.googleapis.com/translate_a/single?client=gtx&sl=ja&tl=en&dt=t&q=" +
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
  const cacheZh = new Map();
  const cacheEn = new Map();
  const translated = [];
  for (const sentence of sentences) {
    const key = sentence.text;
    if (!cacheZh.has(key)) {
      try {
        const translation = await translateSentenceToZh(key);
        cacheZh.set(key, translation);
      } catch {
        cacheZh.set(key, "");
      }
    }
    if (!cacheEn.has(key)) {
      try {
        const translationEn = await translateSentenceToEn(key);
        cacheEn.set(key, translationEn);
      } catch {
        cacheEn.set(key, "");
      }
    }
    translated.push({
      ...sentence,
      translation: cacheZh.get(key) || "",
      translationEn: cacheEn.get(key) || "",
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
    return lower.includes(".ja");
  });
  if (candidates.length === 0) {
    // Fallback: try any .vtt file for this video (auto-generated Japanese often has no lang tag)
    const fallback = files.filter((file) => {
      const lower = file.toLowerCase();
      return lower.startsWith(videoId.toLowerCase()) && lower.endsWith(".vtt");
    });
    return fallback[0] || null;
  }

  const score = (file) => {
    const lower = file.toLowerCase();
    if (lower.includes(".ja.vtt")) return 1;
    if (lower.includes(".ja-orig.vtt")) return 2;
    if (lower.includes(".ja-jp.vtt")) return 3;
    if (lower.includes(".ja-")) return 4;
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
    "ja.*,ja",
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
        error: "No Japanese subtitle file found after download.",
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
      id: `youtube-ja-${video.id}-seed`,
      title: video.title || `Japanese ${video.id}`,
      titleCn: video.title || `日本語 ${video.id}`,
      source: "Japanese YouTube Latest",
      category: "speech",
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
