"use client";

import { useState, useCallback, useEffect, useRef, type ChangeEvent } from "react";
import type { Locale } from "../../types";
import { SHADOWING_MATERIALS, type ShadowingMaterial } from "../../data/shadowing-materials";
import { JAPANESE_SHADOWING_MATERIALS } from "../../data/japanese-shadowing-materials";
import { annotateWords, type WordAnnotation } from "../../data/word-dictionary";
import { getJapaneseReading, type JapaneseReadingToken } from "../../lib/japanese-reading";
import { translateText } from "../../lib/translate";
import tedLatestShadowing from "../../data/ted-latest-shadowing.json";
import jaYoutubeShadowing from "../../data/japanese-youtube-shadowing.json";
import { Card, CardContent } from "../ui/Card";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { SelectionPronunciation } from "../ui/SelectionPronunciation";
import styles from "./ShadowingView.module.css";

type ViewMode = "materials" | "practice" | "news" | "youtube";
type TrainingLanguage = "en" | "ja";

type CompareWord = {
  word: string;
  status: "correct" | "wrong" | "missing";
};

type YoutubeImportResponse = {
  success: boolean;
  error?: string;
  videoId?: string;
  title?: string;
  sourceLanguage?: string;
  importMode?: string;
  sentences?: Array<{
    id: number;
    text: string;
    translation?: string;
    startSec?: number;
    endSec?: number;
  }>;
};

const YOUTUBE_MATERIALS_STORAGE_KEY_LEGACY = "toeicpass.youtube-materials.v1";
const YOUTUBE_MATERIALS_STORAGE_KEY_EN = "toeicpass.youtube-materials.en.v1";
const YOUTUBE_MATERIALS_STORAGE_KEY_JA = "toeicpass.youtube-materials.ja.v1";
const YOUTUBE_PROGRESS_STORAGE_KEY = "toeicpass.youtube-material-progress.v1";
const TED_SNAPSHOT_SYNC_KEY = "toeicpass.ted-latest.generated-at.v1";
const JA_SNAPSHOT_SYNC_KEY = "toeicpass.ja-youtube.generated-at.v1";

type MaterialProgressRecord = {
  currentIndex: number;
  completedSentenceIds: number[];
  updatedAt: number;
};

type TedLatestSnapshot = {
  generatedAt?: string;
  itemCount?: number;
  items?: ShadowingMaterial[];
};

// Normalize text for comparison: lowercase, remove punctuation
function normalizeEnglish(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9'\s-]/g, "")
    .split(/\s+/)
    .filter(Boolean);
}

function normalizeJapanese(text: string): string[] {
  return Array.from(
    String(text ?? "")
      .normalize("NFKC")
      .replace(/[、。！？!?,，．「」『』（）()［］\[\]{}【】…・〜～―—\-_：;；"'`｀\s]/g, "")
      .trim(),
  ).filter(Boolean);
}

function normalizeByLanguage(text: string, language: TrainingLanguage): string[] {
  return language === "ja" ? normalizeJapanese(text) : normalizeEnglish(text);
}

function containsKanji(text: string): boolean {
  return /[一-龯々]/u.test(String(text ?? ""));
}

function annotateJapaneseWords(sentence: string): WordAnnotation[] {
  const raw = String(sentence ?? "").trim();
  if (!raw) {
    return [];
  }
  const tokens = raw.match(/[ぁ-んァ-ヶ一-龯々ー]+|[A-Za-z0-9']+/g);
  const words = (tokens && tokens.length > 0 ? tokens : [raw]).filter(Boolean);
  return words.map((word) => ({ word, clean: word, cn: null, ipa: null }));
}

// Compare user's speech to original using word alignment
function compareWords(
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
      // Look ahead in spoken words to see if this word comes later
      let found = false;
      for (let look = si + 1; look < Math.min(si + 3, spokenWords.length); look++) {
        if (origWords[oi] === spokenWords[look]) {
          // Mark skipped spoken words as wrong
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
  // Remaining spoken words that don't match
  for (; si < spokenWords.length; si++) {
    result.push({ word: spokenWords[si], status: "wrong" });
  }

  const accuracy = origWords.length > 0 ? Math.round((matchCount / origWords.length) * 100) : 0;
  return { words: result, accuracy };
}

function parseYoutubeVideoId(rawUrl: string): string | null {
  const input = rawUrl.trim();
  if (!input) {
    return null;
  }
  const directId = input.match(/^[a-zA-Z0-9_-]{11}$/);
  if (directId) {
    return directId[0];
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

function parseTimestampToSeconds(raw: string): number | null {
  const parts = raw
    .trim()
    .split(":")
    .map((v) => Number(v));
  if (parts.length < 2 || parts.some((v) => !Number.isFinite(v) || v < 0)) {
    return null;
  }
  if (parts.length === 2) {
    return Math.round(parts[0] * 60 + parts[1]);
  }
  return Math.round(parts[0] * 3600 + parts[1] * 60 + parts[2]);
}

function parseYoutubeScript(raw: string): {
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

type TranscriptCue = {
  startSec: number;
  endSec: number;
  text: string;
};

function parseLooseTimestamp(raw: string): number | null {
  const normalized = String(raw ?? "").trim().replace(",", ".");
  const parts = normalized.split(":").map((part) => Number(part));
  if ((parts.length !== 2 && parts.length !== 3) || parts.some((value) => !Number.isFinite(value) || value < 0)) {
    return null;
  }
  if (parts.length === 2) {
    const [m, s] = parts;
    return m * 60 + s;
  }
  const [h, m, s] = parts;
  return h * 3600 + m * 60 + s;
}

function normalizeTranscriptLine(raw: string): string {
  return String(raw ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitPlainSentences(rawText: string): string[] {
  const compact = normalizeTranscriptLine(rawText);
  if (!compact) {
    return [];
  }
  const rough = compact.split(/(?<=[.!?])\s+/);
  const result = rough
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 1);
  if (result.length > 0) {
    return result;
  }
  return compact.split(/,\s+/).map((sentence) => sentence.trim()).filter((sentence) => sentence.length > 1);
}

function parseYoutubeTranscriptText(raw: string): { cues: TranscriptCue[]; errors: string[] } {
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
    const timed = line.match(/^\[?\s*((?:\d{1,2}:)?\d{1,2}:\d{2}(?:[.,]\d{1,3})?)\s*\]?\s*(.*)$/u);
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
      if (text) {
        rawCues.push({ startSec: pendingStartSec, text });
      }
      pendingStartSec = null;
      return;
    }

    plainLines.push(normalizeTranscriptLine(line));
  });

  if (rawCues.length === 0) {
    const plainSentences = splitPlainSentences(plainLines.join(" "));
    if (plainSentences.length === 0) {
      return { cues: [], errors: errors.length > 0 ? errors : ["未识别到可用的 transcript 内容。"] };
    }
    const cues = plainSentences.map((text, index) => {
      const startSec = index * 4;
      return {
        startSec,
        endSec: startSec + 4,
        text,
      };
    });
    return { cues, errors };
  }

  const deduped = rawCues.filter((cue, index) => {
    if (index === 0) {
      return true;
    }
    const previous = rawCues[index - 1];
    return !(cue.text === previous.text && Math.abs(cue.startSec - previous.startSec) < 0.2);
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

function formatVttTimestamp(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = Math.floor(safe % 60);
  const milliseconds = Math.floor((safe - Math.floor(safe)) * 1000);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(milliseconds).padStart(3, "0")}`;
}

function buildVttFromCues(cues: TranscriptCue[]): string {
  const lines: string[] = ["WEBVTT", ""];
  cues.forEach((cue, index) => {
    lines.push(String(index + 1));
    lines.push(`${formatVttTimestamp(cue.startSec)} --> ${formatVttTimestamp(cue.endSec)}`);
    lines.push(cue.text);
    lines.push("");
  });
  return lines.join("\n");
}

function normalizeImportedSentences(
  rawSentences: YoutubeImportResponse["sentences"],
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

function buildScriptTextFromSentences(sentences: ShadowingMaterial["sentences"]): string {
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

function withSubtitleFallbackHint(rawMessage: string, isJa = false): string {
  const fallbackDefault = isJa ? "自動インポートに失敗しました。" : "自动导入失败。";
  const message = String(rawMessage || fallbackDefault).trim();
  if (/srt|vtt|字幕文件/i.test(message)) {
    return message;
  }
  const hint = isJa
    ? `${message} 下の SRT/VTT 字幕ファイルインポートもご利用いただけます。`
    : `${message} 你可以改用下方 SRT/VTT 字幕文件导入。`;
  return hint;
}

function titleFromSubtitleFile(fileName: string, isJa = false): string {
  const title = String(fileName ?? "")
    .replace(/\.(srt|vtt)$/i, "")
    .trim();
  return title || (isJa ? "字幕ファイルシャドーイング" : "字幕文件跟读");
}

function parseTedSnapshotMaterials(): { generatedAt: string; materials: ShadowingMaterial[] } {
  const snapshot = tedLatestShadowing as TedLatestSnapshot;
  const generatedAt = String(snapshot?.generatedAt ?? "").trim();
  const items = Array.isArray(snapshot?.items) ? snapshot.items : [];
  const materials = items
    .map((item) => normalizeMaterialForStorage(item))
    .filter((item) => item.sentences.length > 0);
  return { generatedAt, materials };
}

function parseJaYoutubeSnapshotMaterials(): { materials: ShadowingMaterial[] } {
  const snapshot = jaYoutubeShadowing as TedLatestSnapshot;
  const items = Array.isArray(snapshot?.items) ? snapshot.items : [];
  const materials = items
    .map((item) => normalizeMaterialForStorage(item))
    .filter((item) => item.sentences.length > 0);
  return { materials };
}

function buildYoutubeEmbedUrl(videoId: string, startSec: number, endSec?: number): string {
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

function normalizeMaterialForStorage(material: ShadowingMaterial): ShadowingMaterial {
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

function clampSentenceIndex(index: number, sentenceTotal: number): number {
  if (!Number.isFinite(index) || sentenceTotal <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(sentenceTotal - 1, Math.floor(index)));
}

function isPersistedVideoMaterial(material: ShadowingMaterial): boolean {
  return material.id.startsWith("youtube-") || material.id.startsWith("subtitle-");
}

function loadYoutubeMaterialsFromStorage(lang: TrainingLanguage): ShadowingMaterial[] {
  if (typeof window === "undefined") {
    return [];
  }
  const key = lang === "ja" ? YOUTUBE_MATERIALS_STORAGE_KEY_JA : YOUTUBE_MATERIALS_STORAGE_KEY_EN;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    const list = Array.isArray(parsed) ? parsed : [];
    return list
      .map((item) => normalizeMaterialForStorage(item as ShadowingMaterial))
      .filter((item) => item.sentences.length > 0);
  } catch {
    return [];
  }
}

function saveYoutubeMaterialsToStorage(materials: ShadowingMaterial[], lang: TrainingLanguage): void {
  if (typeof window === "undefined") {
    return;
  }
  const key = lang === "ja" ? YOUTUBE_MATERIALS_STORAGE_KEY_JA : YOUTUBE_MATERIALS_STORAGE_KEY_EN;
  const payload = materials
    .map((item) => normalizeMaterialForStorage(item))
    .slice(0, 30);
  window.localStorage.setItem(key, JSON.stringify(payload));
}

function loadYoutubeProgressFromStorage(): Record<string, MaterialProgressRecord> {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(YOUTUBE_PROGRESS_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    const result: Record<string, MaterialProgressRecord> = {};
    Object.entries(parsed).forEach(([materialId, value]) => {
      if (!materialId || !value || typeof value !== "object" || Array.isArray(value)) {
        return;
      }
      const currentIndex = Number((value as { currentIndex?: unknown }).currentIndex);
      const completedRaw = (value as { completedSentenceIds?: unknown }).completedSentenceIds;
      const updatedAt = Number((value as { updatedAt?: unknown }).updatedAt);
      const completedSentenceIds = Array.isArray(completedRaw)
        ? completedRaw
          .map((item) => Number(item))
          .filter((item) => Number.isInteger(item) && item >= 0)
        : [];

      result[materialId] = {
        currentIndex: Number.isFinite(currentIndex) && currentIndex >= 0 ? Math.floor(currentIndex) : 0,
        completedSentenceIds: Array.from(new Set(completedSentenceIds)),
        updatedAt: Number.isFinite(updatedAt) ? updatedAt : Date.now(),
      };
    });
    return result;
  } catch {
    return {};
  }
}

function saveYoutubeProgressToStorage(progressMap: Record<string, MaterialProgressRecord>): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(YOUTUBE_PROGRESS_STORAGE_KEY, JSON.stringify(progressMap));
}

function mergeSnapshotMaterials(
  snapshotMaterials: ShadowingMaterial[],
  storedMaterials: ShadowingMaterial[],
): ShadowingMaterial[] {
  const merged = [...snapshotMaterials, ...storedMaterials.map((item) => normalizeMaterialForStorage(item))];
  const deduped: ShadowingMaterial[] = [];
  const seen = new Set<string>();
  merged.forEach((item) => {
    const key = item.youtubeVideoId ? `video:${item.youtubeVideoId}` : `id:${item.id}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    deduped.push(item);
  });
  return deduped.slice(0, 60);
}

export function ShadowingView({ locale }: { locale: Locale }) {
  const isJa = locale === "ja";
  const l = (zh: string, ja: string) => (isJa ? ja : zh);

  const [trainingLanguage, setTrainingLanguage] = useState<TrainingLanguage>("en");
  const [viewMode, setViewMode] = useState<ViewMode>("materials");
  const [originMode, setOriginMode] = useState<ViewMode>("materials");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [activeMaterial, setActiveMaterial] = useState<ShadowingMaterial | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [alwaysShowTranslation, setAlwaysShowTranslation] = useState(false);
  const [completedSet, setCompletedSet] = useState<Set<number>>(new Set());
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechRate, setSpeechRate] = useState(0.85);
  const [newsArticles, setNewsArticles] = useState<NewsMaterial[]>([]);
  const [isLoadingNews, setIsLoadingNews] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Speech recognition state
  const [isRecording, setIsRecording] = useState(false);
  const [recognizedText, setRecognizedText] = useState("");
  const [compareResult, setCompareResult] = useState<{ words: CompareWord[]; accuracy: number } | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const [micPermission, setMicPermission] = useState<"unknown" | "granted" | "denied" | "prompt">("unknown");

  // Word annotation toggles
  const [showWordTranslation, setShowWordTranslation] = useState(false);
  const [showIPA, setShowIPA] = useState(false);
  const [showReading, setShowReading] = useState(false);
  const selectionScopeRef = useRef<HTMLDivElement | null>(null);
  const [youtubeUrlInput, setYoutubeUrlInput] = useState("");
  const [youtubeTitleInput, setYoutubeTitleInput] = useState("");
  const [youtubeScriptInput, setYoutubeScriptInput] = useState("");
  const [youtubeTranscriptInput, setYoutubeTranscriptInput] = useState("");
  const [youtubeError, setYoutubeError] = useState("");
  const [youtubeImporting, setYoutubeImporting] = useState(false);
  const [subtitleFileImporting, setSubtitleFileImporting] = useState(false);
  const [transcriptImporting, setTranscriptImporting] = useState(false);
  const [savedYoutubeMaterials, setSavedYoutubeMaterials] = useState<ShadowingMaterial[]>([]);
  const [materialProgressMap, setMaterialProgressMap] = useState<Record<string, MaterialProgressRecord>>({});
  const [videoStartSec, setVideoStartSec] = useState(0);
  const [videoEmbedNonce, setVideoEmbedNonce] = useState(0);
  const [jpWordGlossMap, setJpWordGlossMap] = useState<Record<string, string>>({});
  const translatingJpWordGlossRef = useRef<Set<string>>(new Set());
  const [jpWordReadingMap, setJpWordReadingMap] = useState<Record<string, string>>({});
  const translatingJpWordReadingRef = useRef<Set<string>>(new Set());
  const [jpSentenceTokensMap, setJpSentenceTokensMap] = useState<Record<string, JapaneseReadingToken[]>>({});
  const fetchingSentenceTokensRef = useRef<Set<string>>(new Set());
  const [jaSentenceMap, setJaSentenceMap] = useState<Record<string, string>>({});
  const translatingSentenceSetRef = useRef<Set<string>>(new Set());
  const [jaWordGlossMap, setJaWordGlossMap] = useState<Record<string, string>>({});
  const translatingWordGlossRef = useRef<Set<string>>(new Set());
  const isJapaneseTraining = trainingLanguage === "ja";
  const trainingLanguageRef = useRef(trainingLanguage);
  trainingLanguageRef.current = trainingLanguage;
  const makeSentenceTranslationKey = useCallback(
    (materialId: string, sentenceId: number, text: string) => `${materialId}::${sentenceId}::${text}`,
    [],
  );

  const ensureJaSentenceTranslation = useCallback(
    (material: ShadowingMaterial, sentence: { id: number; text: string; translation?: string }) => {
      if (locale !== "ja" || trainingLanguage !== "en") {
        return;
      }
      const key = makeSentenceTranslationKey(material.id, sentence.id, sentence.text);
      if (jaSentenceMap[key] || translatingSentenceSetRef.current.has(key)) {
        return;
      }
      translatingSentenceSetRef.current.add(key);
      void translateText(sentence.text, "ja", "en")
        .then(async (translated) => {
          let resolved = String(translated ?? "").trim();
          if (!resolved || resolved.toLowerCase() === sentence.text.trim().toLowerCase()) {
            const zhSource = String(sentence.translation ?? "").trim();
            if (zhSource) {
              const translatedFromZh = await translateText(zhSource, "ja", "zh-CN");
              const fromZh = String(translatedFromZh ?? "").trim();
              resolved = fromZh && fromZh !== zhSource ? fromZh : "";
            } else {
              resolved = "";
            }
          }
          if (resolved) {
            setJaSentenceMap((prev) => ({ ...prev, [key]: resolved }));
          }
        })
        .finally(() => {
          translatingSentenceSetRef.current.delete(key);
        });
    },
    [jaSentenceMap, locale, makeSentenceTranslationKey, trainingLanguage],
  );

  const getSentenceTranslation = useCallback(
    (material: ShadowingMaterial, sentence: { id: number; text: string; translation?: string }) => {
      if (trainingLanguage === "ja") {
        return sentence.translation ?? "";
      }
      if (locale !== "ja") {
        return sentence.translation ?? "";
      }
      const key = makeSentenceTranslationKey(material.id, sentence.id, sentence.text);
      return jaSentenceMap[key] ?? sentence.translation ?? "";
    },
    [jaSentenceMap, locale, makeSentenceTranslationKey, trainingLanguage],
  );

  const makeWordGlossKey = useCallback((word: WordAnnotation) => {
    return String(word.clean || word.word || "").toLowerCase().trim();
  }, []);

  const ensureJaWordGloss = useCallback(
    (word: WordAnnotation) => {
      if (locale !== "ja" || trainingLanguage !== "en") {
        return;
      }
      const key = makeWordGlossKey(word);
      if (!key || jaWordGlossMap[key] || translatingWordGlossRef.current.has(key)) {
        return;
      }
      translatingWordGlossRef.current.add(key);
      void translateText(key, "ja", "en")
        .then(async (translated) => {
          let resolved = String(translated ?? "").trim();
          if (!resolved || resolved.toLowerCase() === key.toLowerCase()) {
            const zhSource = String(word.cn ?? "").trim();
            if (zhSource) {
              const translatedFromZh = await translateText(zhSource, "ja", "zh-CN");
              const fromZh = String(translatedFromZh ?? "").trim();
              resolved = fromZh && fromZh !== zhSource ? fromZh : "";
            } else {
              resolved = "";
            }
          }
          if (resolved) {
            setJaWordGlossMap((prev) => ({ ...prev, [key]: resolved }));
          }
        })
        .finally(() => {
          translatingWordGlossRef.current.delete(key);
        });
    },
    [jaWordGlossMap, locale, makeWordGlossKey, trainingLanguage],
  );

  const ensureJapaneseWordGloss = useCallback(
    (word: WordAnnotation) => {
      if (trainingLanguage !== "ja") {
        return;
      }
      const key = makeWordGlossKey(word);
      if (!key || jpWordGlossMap[key] || translatingJpWordGlossRef.current.has(key)) {
        return;
      }
      translatingJpWordGlossRef.current.add(key);
      void translateText(key, "zh-CN", "ja")
        .then((translated) => {
          const resolved = String(translated ?? "").trim();
          if (resolved && resolved !== key) {
            setJpWordGlossMap((prev) => ({ ...prev, [key]: resolved }));
          }
        })
        .finally(() => {
          translatingJpWordGlossRef.current.delete(key);
        });
    },
    [jpWordGlossMap, makeWordGlossKey, trainingLanguage],
  );

  const ensureJapaneseWordReading = useCallback(
    (word: WordAnnotation) => {
      if (trainingLanguage !== "ja") {
        return;
      }
      if (!containsKanji(word.word)) {
        return;
      }
      const key = makeWordGlossKey(word);
      if (!key || jpWordReadingMap[key] || translatingJpWordReadingRef.current.has(key)) {
        return;
      }
      translatingJpWordReadingRef.current.add(key);
      void getJapaneseReading(key)
        .then((result) => {
          const reading = String(result.readingText ?? "").trim();
          if (reading && reading !== key) {
            setJpWordReadingMap((prev) => ({ ...prev, [key]: reading }));
          }
        })
        .finally(() => {
          translatingJpWordReadingRef.current.delete(key);
        });
    },
    [jpWordReadingMap, makeWordGlossKey, trainingLanguage],
  );

  const ensureSentenceTokens = useCallback(
    (sentenceText: string) => {
      if (trainingLanguage !== "ja") return;
      const key = sentenceText.trim();
      if (!key || jpSentenceTokensMap[key] || fetchingSentenceTokensRef.current.has(key)) return;
      fetchingSentenceTokensRef.current.add(key);
      void getJapaneseReading(key)
        .then((result) => {
          if (result.tokens && result.tokens.length > 0) {
            setJpSentenceTokensMap((prev) => ({ ...prev, [key]: result.tokens }));
          }
        })
        .finally(() => {
          fetchingSentenceTokensRef.current.delete(key);
        });
    },
    [jpSentenceTokensMap, trainingLanguage],
  );

  const getSentenceTokens = useCallback(
    (sentenceText: string): JapaneseReadingToken[] | null => {
      if (trainingLanguage !== "ja") return null;
      return jpSentenceTokensMap[sentenceText.trim()] ?? null;
    },
    [jpSentenceTokensMap, trainingLanguage],
  );

  const getWordGloss = useCallback(
    (word: WordAnnotation): string | null => {
      if (trainingLanguage === "ja") {
        const key = makeWordGlossKey(word);
        if (!key) {
          return null;
        }
        return jpWordGlossMap[key] ?? null;
      }
      if (locale !== "ja") {
        return word.cn ?? null;
      }
      const key = makeWordGlossKey(word);
      if (!key) {
        return word.cn ?? null;
      }
      return jaWordGlossMap[key] ?? word.cn ?? null;
    },
    [jaWordGlossMap, jpWordGlossMap, locale, makeWordGlossKey, trainingLanguage],
  );

  const getJapaneseWordReading = useCallback(
    (word: WordAnnotation): string | null => {
      if (trainingLanguage !== "ja") {
        return null;
      }
      const key = makeWordGlossKey(word);
      if (!key) {
        return null;
      }
      return jpWordReadingMap[key] ?? null;
    },
    [jpWordReadingMap, makeWordGlossKey, trainingLanguage],
  );

  const getAnnotatedWords = useCallback(
    (text: string) => {
      if (trainingLanguage === "ja") {
        return annotateJapaneseWords(text);
      }
      return annotateWords(text);
    },
    [trainingLanguage],
  );

  // Cancel speech and recognition on unmount or material change
  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
      recognitionRef.current?.abort();
    };
  }, [activeMaterial]);

  useEffect(() => {
    // One-time migration: split old combined key into EN/JA keys
    if (typeof window !== "undefined") {
      const legacy = window.localStorage.getItem(YOUTUBE_MATERIALS_STORAGE_KEY_LEGACY);
      if (legacy) {
        try {
          const parsed: ShadowingMaterial[] = JSON.parse(legacy);
          const enItems = parsed.filter((m) => !m.id?.startsWith("jp-"));
          const jaItems = parsed.filter((m) => m.id?.startsWith("jp-"));
          if (!window.localStorage.getItem(YOUTUBE_MATERIALS_STORAGE_KEY_EN) && enItems.length > 0) {
            window.localStorage.setItem(YOUTUBE_MATERIALS_STORAGE_KEY_EN, JSON.stringify(enItems));
          }
          if (!window.localStorage.getItem(YOUTUBE_MATERIALS_STORAGE_KEY_JA) && jaItems.length > 0) {
            window.localStorage.setItem(YOUTUBE_MATERIALS_STORAGE_KEY_JA, JSON.stringify(jaItems));
          }
        } catch { /* ignore corrupt data */ }
        window.localStorage.removeItem(YOUTUBE_MATERIALS_STORAGE_KEY_LEGACY);
      }
    }
    const storedMaterials = loadYoutubeMaterialsFromStorage(trainingLanguage);
    // Clean up cross-language contamination (from earlier combined storage)
    let nextMaterials = trainingLanguage === "en"
      ? storedMaterials.filter((m) => !m.id?.startsWith("jp-"))
      : storedMaterials;
    if (nextMaterials.length !== storedMaterials.length) {
      saveYoutubeMaterialsToStorage(nextMaterials, trainingLanguage);
    }
    if (trainingLanguage === "en") {
      const tedSnapshot = parseTedSnapshotMaterials();
      if (typeof window !== "undefined" && tedSnapshot.materials.length > 0 && tedSnapshot.generatedAt) {
        const syncedAt = String(window.localStorage.getItem(TED_SNAPSHOT_SYNC_KEY) ?? "").trim();
        if (syncedAt !== tedSnapshot.generatedAt) {
          nextMaterials = mergeSnapshotMaterials(tedSnapshot.materials, storedMaterials);
          saveYoutubeMaterialsToStorage(nextMaterials, "en");
          window.localStorage.setItem(TED_SNAPSHOT_SYNC_KEY, tedSnapshot.generatedAt);
        }
      }
    } else {
      const jaSnapshot = parseJaYoutubeSnapshotMaterials();
      if (typeof window !== "undefined" && jaSnapshot.materials.length > 0) {
        const syncedAt = String(window.localStorage.getItem(JA_SNAPSHOT_SYNC_KEY) ?? "").trim();
        const jaGeneratedAt = String((jaYoutubeShadowing as TedLatestSnapshot)?.generatedAt ?? "").trim();
        if (jaGeneratedAt && syncedAt !== jaGeneratedAt) {
          nextMaterials = mergeSnapshotMaterials(jaSnapshot.materials, storedMaterials);
          saveYoutubeMaterialsToStorage(nextMaterials, "ja");
          window.localStorage.setItem(JA_SNAPSHOT_SYNC_KEY, jaGeneratedAt);
        }
      }
    }
    setSavedYoutubeMaterials(nextMaterials);
    setMaterialProgressMap(loadYoutubeProgressFromStorage());
  }, [trainingLanguage]);

  const speak = useCallback((text: string) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = trainingLanguage === "ja" ? "ja-JP" : "en-US";
    utterance.rate = speechRate;
    utterance.pitch = 1;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [speechRate, trainingLanguage]);

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
  }, []);

  const clearRecognition = useCallback(() => {
    setRecognizedText("");
    setCompareResult(null);
    recognitionRef.current?.abort();
    setIsRecording(false);
  }, []);

  useEffect(() => {
    stopSpeaking();
    clearRecognition();
    setActiveMaterial(null);
    setViewMode("materials");
    setCategoryFilter("all");
    setShowIPA(false);
    setShowReading(false);
    setShowWordTranslation(false);
    setAlwaysShowTranslation(false);
  }, [clearRecognition, stopSpeaking, trainingLanguage]);

  const requestMicPermission = useCallback(async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setMicPermission("granted");
      return true;
    } catch {
      setMicPermission("denied");
      return false;
    }
  }, []);

  const dismissMicBanner = useCallback(() => {
    setMicPermission("unknown");
  }, []);

  const startRecording = useCallback((originalText: string) => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      setRecognizedText(l("浏览器不支持语音识别，请使用 Chrome 浏览器", "ブラウザが音声認識に未対応です。Chrome を使用してください。"));
      return;
    }

    // Stop TTS if playing
    stopSpeaking();

    // Pre-check microphone permission
    requestMicPermission().then((granted) => {
      if (!granted) return;

      const recognition = new SpeechRecognitionAPI();
      recognition.lang = trainingLanguage === "ja" ? "ja-JP" : "en-US";
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsRecording(true);
        setRecognizedText("");
        setCompareResult(null);
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let transcript = "";
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setRecognizedText(transcript);

        // If final result, do comparison
        if (event.results[event.results.length - 1].isFinal) {
          const result = compareWords(originalText, transcript, trainingLanguage);
          setCompareResult(result);
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        setIsRecording(false);
        if (event.error === "no-speech") {
          setRecognizedText(l("未检测到语音，请再试一次", "音声が検出されませんでした。もう一度試してください。"));
        } else if (event.error === "not-allowed") {
          setMicPermission("denied");
        } else {
          setRecognizedText(`${l("识别出错", "認識エラー")}: ${event.error}`);
        }
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    });
  }, [l, requestMicPermission, stopSpeaking, trainingLanguage]);

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const persistMaterialProgress = useCallback(
    (materialId: string, current: number, completedSetValue: Set<number>) => {
      setMaterialProgressMap((prev) => {
        const nextRecord: MaterialProgressRecord = {
          currentIndex: Math.max(0, Math.floor(current)),
          completedSentenceIds: Array.from(completedSetValue)
            .filter((id) => Number.isInteger(id) && id >= 0)
            .sort((a, b) => a - b),
          updatedAt: Date.now(),
        };
        const nextMap: Record<string, MaterialProgressRecord> = {
          ...prev,
          [materialId]: nextRecord,
        };
        saveYoutubeProgressToStorage(nextMap);
        return nextMap;
      });
    },
    [],
  );

  const clearMaterialProgress = useCallback((materialId: string) => {
    setMaterialProgressMap((prev) => {
      if (!(materialId in prev)) {
        return prev;
      }
      const nextMap = { ...prev };
      delete nextMap[materialId];
      saveYoutubeProgressToStorage(nextMap);
      return nextMap;
    });
  }, []);

  const handleStart = useCallback((material: ShadowingMaterial, options?: { resumeFromLast?: boolean }) => {
    const sentenceTotal = material.sentences.length;
    const storedProgress = options?.resumeFromLast ? materialProgressMap[material.id] : undefined;
    const initialIndex = storedProgress
      ? clampSentenceIndex(storedProgress.currentIndex, sentenceTotal)
      : 0;
    const initialCompleted = storedProgress
      ? new Set(
        storedProgress.completedSentenceIds.filter(
          (id) => Number.isInteger(id) && id >= 0 && id < sentenceTotal,
        ),
      )
      : new Set<number>();
    const firstSentenceStart = material.sentences[initialIndex]?.startSec ?? 0;
    setActiveMaterial(material);
    setCurrentIndex(initialIndex);
    setAlwaysShowTranslation(false);
    setCompletedSet(initialCompleted);
    setVideoStartSec(firstSentenceStart);
    setVideoEmbedNonce((prev) => prev + 1);
    setOriginMode(viewMode);
    clearRecognition();
    setViewMode("practice");
  }, [clearRecognition, materialProgressMap, viewMode]);

  const upsertYoutubeMaterial = useCallback((material: ShadowingMaterial) => {
    const normalized = normalizeMaterialForStorage(material);
    setSavedYoutubeMaterials((prev) => {
      const deduped = prev.filter((item) => {
        if (item.id === normalized.id) {
          return false;
        }
        if (item.youtubeVideoId && normalized.youtubeVideoId && item.youtubeVideoId === normalized.youtubeVideoId) {
          return false;
        }
        if (!item.youtubeVideoId && !normalized.youtubeVideoId && item.title === normalized.title && item.source === normalized.source) {
          return false;
        }
        return true;
      });
      const next = [normalized, ...deduped].slice(0, 30);
      saveYoutubeMaterialsToStorage(next, trainingLanguageRef.current);
      return next;
    });
  }, []);

  const deleteYoutubeMaterial = useCallback((materialId: string) => {
    setSavedYoutubeMaterials((prev) => {
      const next = prev.filter((item) => item.id !== materialId);
      saveYoutubeMaterialsToStorage(next, trainingLanguageRef.current);
      return next;
    });
    clearMaterialProgress(materialId);
  }, [clearMaterialProgress]);

  const resetYoutubeMaterialProgress = useCallback((materialId: string) => {
    clearMaterialProgress(materialId);
  }, [clearMaterialProgress]);

  const handleStartSavedMaterial = useCallback((material: ShadowingMaterial) => {
    handleStart(material, { resumeFromLast: true });
  }, [handleStart]);

  const handleImportTedLatestBatch = useCallback(() => {
    const { materials } = parseTedSnapshotMaterials();
    if (materials.length === 0) {
      setYoutubeError(l("未找到 TED 批量材料。请先运行 npm run -w apps/web import:ted-latest", "TED 一括素材が見つかりません。先に npm run -w apps/web import:ted-latest を実行してください。"));
      return;
    }
    setYoutubeError("");
    setSavedYoutubeMaterials((prev) => {
      const merged = [...materials, ...prev.map((item) => normalizeMaterialForStorage(item))];
      const deduped: ShadowingMaterial[] = [];
      const seen = new Set<string>();
      merged.forEach((item) => {
        const key = item.youtubeVideoId ? `video:${item.youtubeVideoId}` : `id:${item.id}`;
        if (seen.has(key)) {
          return;
        }
        seen.add(key);
        deduped.push(item);
      });
      const next = deduped.slice(0, 60);
      saveYoutubeMaterialsToStorage(next, "en");
      return next;
    });
  }, []);

  const handleImportJaYoutubeBatch = useCallback(() => {
    const { materials } = parseJaYoutubeSnapshotMaterials();
    if (materials.length === 0) {
      setYoutubeError(l("未找到日语批量材料。", "日本語の一括素材が見つかりません。"));
      return;
    }
    setYoutubeError("");
    setSavedYoutubeMaterials((prev) => {
      const merged = [...materials, ...prev.map((item) => normalizeMaterialForStorage(item))];
      const deduped: ShadowingMaterial[] = [];
      const seen = new Set<string>();
      merged.forEach((item) => {
        const key = item.youtubeVideoId ? `video:${item.youtubeVideoId}` : `id:${item.id}`;
        if (seen.has(key)) {
          return;
        }
        seen.add(key);
        deduped.push(item);
      });
      const next = deduped.slice(0, 60);
      saveYoutubeMaterialsToStorage(next, "ja");
      return next;
    });
  }, []);

  useEffect(() => {
    if (!activeMaterial || !isPersistedVideoMaterial(activeMaterial)) {
      return;
    }
    const sentenceTotal = activeMaterial.sentences.length;
    if (sentenceTotal <= 0) {
      return;
    }
    const safeIndex = clampSentenceIndex(currentIndex, sentenceTotal);
    const safeCompleted = new Set(
      Array.from(completedSet).filter(
        (id) => Number.isInteger(id) && id >= 0 && id < sentenceTotal,
      ),
    );
    persistMaterialProgress(activeMaterial.id, safeIndex, safeCompleted);
  }, [activeMaterial, completedSet, currentIndex, persistMaterialProgress]);

  useEffect(() => {
    if (locale !== "ja" || trainingLanguage !== "en" || !activeMaterial) {
      return;
    }
    const around = [
      activeMaterial.sentences[currentIndex - 1],
      activeMaterial.sentences[currentIndex],
      activeMaterial.sentences[currentIndex + 1],
    ].filter((item): item is ShadowingMaterial["sentences"][number] => Boolean(item?.text));
    around.forEach((sentence) => ensureJaSentenceTranslation(activeMaterial, sentence));
  }, [activeMaterial, currentIndex, ensureJaSentenceTranslation, locale, trainingLanguage]);

  useEffect(() => {
    if (locale !== "ja" || trainingLanguage !== "en" || !activeMaterial || !alwaysShowTranslation) {
      return;
    }
    activeMaterial.sentences.slice(0, 80).forEach((sentence) => {
      ensureJaSentenceTranslation(activeMaterial, sentence);
    });
  }, [activeMaterial, alwaysShowTranslation, ensureJaSentenceTranslation, locale, trainingLanguage]);

  useEffect(() => {
    if (!activeMaterial || !showWordTranslation) {
      return;
    }
    const currentSentence = activeMaterial.sentences[currentIndex];
    if (!currentSentence?.text) {
      return;
    }
    const words = getAnnotatedWords(currentSentence.text).slice(0, 24);
    if (trainingLanguage === "ja") {
      words.forEach((word) => ensureJapaneseWordGloss(word));
      return;
    }
    if (locale === "ja") {
      words.forEach((word) => ensureJaWordGloss(word));
    }
  }, [
    activeMaterial,
    currentIndex,
    ensureJaWordGloss,
    ensureJapaneseWordGloss,
    getAnnotatedWords,
    locale,
    showWordTranslation,
    trainingLanguage,
  ]);

  useEffect(() => {
    if (trainingLanguage !== "ja" || !activeMaterial || !showReading) {
      return;
    }
    const currentSentence = activeMaterial.sentences[currentIndex];
    if (!currentSentence?.text) {
      return;
    }
    // Fetch sentence-level tokens for per-kanji furigana
    ensureSentenceTokens(currentSentence.text);
    // Fallback: also fetch per-word readings
    getAnnotatedWords(currentSentence.text)
      .slice(0, 24)
      .forEach((word) => ensureJapaneseWordReading(word));
  }, [
    activeMaterial,
    currentIndex,
    ensureJapaneseWordReading,
    ensureSentenceTokens,
    getAnnotatedWords,
    showReading,
    trainingLanguage,
  ]);

  useEffect(() => {
    if (locale !== "ja" || trainingLanguage !== "en" || !activeMaterial) {
      return;
    }
    const timer = window.setTimeout(() => {
      const currentSentence = activeMaterial.sentences[currentIndex];
      if (!currentSentence?.text) {
        return;
      }
      ensureJaSentenceTranslation(activeMaterial, currentSentence);
      if (showWordTranslation) {
        getAnnotatedWords(currentSentence.text)
          .slice(0, 24)
          .forEach((word) => ensureJaWordGloss(word));
      }
    }, 1200);
    return () => {
      window.clearTimeout(timer);
    };
  }, [
    activeMaterial,
    currentIndex,
    ensureJaSentenceTranslation,
    ensureJaWordGloss,
    getAnnotatedWords,
    locale,
    showWordTranslation,
    trainingLanguage,
  ]);

  const handleNext = useCallback(() => {
    if (!activeMaterial) return;
    stopSpeaking();
    clearRecognition();
    setCompletedSet((prev) => new Set(prev).add(currentIndex));
    if (currentIndex < activeMaterial.sentences.length - 1) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      const nextStart = activeMaterial.sentences[nextIndex]?.startSec;
      if (typeof nextStart === "number") {
        setVideoStartSec(nextStart);
        setVideoEmbedNonce((prev) => prev + 1);
      }
    }
  }, [activeMaterial, currentIndex, stopSpeaking, clearRecognition]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      stopSpeaking();
      clearRecognition();
      const prevIndex = currentIndex - 1;
      setCurrentIndex(prevIndex);
      const prevStart = activeMaterial?.sentences[prevIndex]?.startSec;
      if (typeof prevStart === "number") {
        setVideoStartSec(prevStart);
        setVideoEmbedNonce((prev) => prev + 1);
      }
    }
  }, [activeMaterial, currentIndex, stopSpeaking, clearRecognition]);

  const handleBack = useCallback(() => {
    stopSpeaking();
    clearRecognition();
    setActiveMaterial(null);
    setCurrentIndex(0);
    setAlwaysShowTranslation(false);
    setCompletedSet(new Set());
    setYoutubeError("");
    setViewMode(originMode);
  }, [stopSpeaking, clearRecognition, originMode]);

  const handleStartYoutube = useCallback(() => {
    setYoutubeError("");
    const videoId = parseYoutubeVideoId(youtubeUrlInput);
    if (!videoId) {
      setYoutubeError(l("请输入有效的 YouTube 链接或视频 ID。", "有効な YouTube リンクまたは動画 ID を入力してください。"));
      return;
    }
    const { sentences, errors } = parseYoutubeScript(youtubeScriptInput);
    if (errors.length > 0) {
      setYoutubeError(errors[0]);
      return;
    }
    if (sentences.length === 0) {
      setYoutubeError(l("请至少输入一行句子脚本。", "少なくとも 1 行のスクリプトを入力してください。"));
      return;
    }

    const title = youtubeTitleInput.trim() || l("YouTube 跟读", "YouTube シャドーイング");
    const customMaterial: ShadowingMaterial = {
      id: `youtube-${videoId}-${Date.now()}`,
      title,
      titleCn: title,
      source: "YouTube (manual script)",
      category: "speech",
      difficulty: 2,
      youtubeVideoId: videoId,
      sentences,
    };
    upsertYoutubeMaterial(customMaterial);
    handleStart(customMaterial);
  }, [handleStart, upsertYoutubeMaterial, youtubeScriptInput, youtubeTitleInput, youtubeUrlInput]);

  const handleAutoImportYoutube = useCallback(async () => {
    setYoutubeError("");
    const input = youtubeUrlInput.trim();
    if (!input) {
      setYoutubeError(l("请先输入 YouTube 链接或视频 ID。", "先に YouTube リンクまたは動画 ID を入力してください。"));
      return;
    }

    setYoutubeImporting(true);
    try {
      const response = await fetch("/api/youtube-subtitles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: input }),
      });
      const payload = (await response.json()) as YoutubeImportResponse;
      if (!response.ok || !payload.success) {
        setYoutubeError(withSubtitleFallbackHint(payload.error || l("自动导入失败。", "自動インポートに失敗しました。"), isJa));
        return;
      }
      const videoId = payload.videoId ? String(payload.videoId) : parseYoutubeVideoId(input);
      const normalizedSentences = normalizeImportedSentences(payload.sentences);
      if (!videoId || normalizedSentences.length === 0) {
        setYoutubeError(l("未获取到可用字幕。请换一个有英文字幕的视频，或改用 SRT/VTT 字幕文件导入。", "利用可能な字幕が取得できませんでした。英語字幕付き動画に変更するか、SRT/VTT ファイルを使ってください。"));
        return;
      }

      const title = youtubeTitleInput.trim() || String(payload.title ?? "").trim() || l("YouTube 跟读", "YouTube シャドーイング");
      const autoMaterial: ShadowingMaterial = {
        id: `youtube-${videoId}-${Date.now()}`,
        title,
        titleCn: title,
        source: `YouTube (${payload.sourceLanguage ?? "subtitle"})`,
        category: "speech",
        difficulty: 2,
        youtubeVideoId: videoId,
        sentences: normalizedSentences,
      };

      upsertYoutubeMaterial(autoMaterial);
      setYoutubeScriptInput(buildScriptTextFromSentences(normalizedSentences));
      handleStart(autoMaterial);
    } catch (error) {
      setYoutubeError(withSubtitleFallbackHint(error instanceof Error ? error.message : l("自动导入失败。", "自動インポートに失敗しました。"), isJa));
    } finally {
      setYoutubeImporting(false);
    }
  }, [handleStart, l, upsertYoutubeMaterial, youtubeTitleInput, youtubeUrlInput]);

  const handleSubtitleFileImport = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    setYoutubeError("");
    if (!/\.(srt|vtt)$/i.test(file.name)) {
      setYoutubeError(l("仅支持 .srt 或 .vtt 字幕文件。", ".srt または .vtt 字幕ファイルのみ対応しています。"));
      return;
    }
    if (file.size > 2_000_000) {
      setYoutubeError(l("字幕文件过大，请控制在 2MB 内。", "字幕ファイルが大きすぎます。2MB 以内にしてください。"));
      return;
    }

    setSubtitleFileImporting(true);
    try {
      const subtitleText = await file.text();
      if (!subtitleText.trim()) {
        setYoutubeError(l("字幕文件为空，请换一个文件。", "字幕ファイルが空です。別のファイルを使用してください。"));
        return;
      }

      const maybeVideoId = parseYoutubeVideoId(youtubeUrlInput);
      const fallbackTitle = youtubeTitleInput.trim() || titleFromSubtitleFile(file.name, isJa);
      const response = await fetch("/api/youtube-subtitles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: youtubeUrlInput.trim(),
          videoId: maybeVideoId ?? undefined,
          title: fallbackTitle,
          subtitleText,
        }),
      });
      const payload = (await response.json()) as YoutubeImportResponse;
      if (!response.ok || !payload.success) {
        setYoutubeError(payload.error || l("字幕文件导入失败。", "字幕ファイルのインポートに失敗しました。"));
        return;
      }

      const normalizedSentences = normalizeImportedSentences(payload.sentences);
      if (normalizedSentences.length === 0) {
        setYoutubeError(l("字幕文件里没有可用句子。", "字幕ファイルに利用可能な文がありません。"));
        return;
      }

      const videoId = payload.videoId ? String(payload.videoId) : maybeVideoId;
      const title = youtubeTitleInput.trim() || String(payload.title ?? "").trim() || fallbackTitle;
      const importedMaterial: ShadowingMaterial = {
        id: videoId ? `youtube-${videoId}-${Date.now()}` : `subtitle-${Date.now()}`,
        title,
        titleCn: title,
        source: `Subtitle file (${file.name})`,
        category: "speech",
        difficulty: 2,
        ...(videoId ? { youtubeVideoId: videoId } : {}),
        sentences: normalizedSentences,
      };

      upsertYoutubeMaterial(importedMaterial);
      setYoutubeScriptInput(buildScriptTextFromSentences(normalizedSentences));
      handleStart(importedMaterial);
    } catch (error) {
      setYoutubeError(error instanceof Error ? error.message : l("字幕文件导入失败。", "字幕ファイルのインポートに失敗しました。"));
    } finally {
      setSubtitleFileImporting(false);
    }
  }, [handleStart, l, upsertYoutubeMaterial, youtubeTitleInput, youtubeUrlInput]);

  const handleTranscriptImport = useCallback(async () => {
    setYoutubeError("");
    const transcriptText = youtubeTranscriptInput.trim();
    if (!transcriptText) {
      setYoutubeError(l("请先粘贴 transcript 内容。", "先に transcript テキストを貼り付けてください。"));
      return;
    }

    const { cues, errors } = parseYoutubeTranscriptText(transcriptText);
    if (errors.length > 0) {
      setYoutubeError(errors[0]);
      return;
    }
    if (cues.length === 0) {
      setYoutubeError(l("未识别到可用句子。请检查 transcript 格式。", "利用可能な文を認識できませんでした。transcript 形式を確認してください。"));
      return;
    }

    setTranscriptImporting(true);
    try {
      const subtitleText = buildVttFromCues(cues);
      const maybeVideoId = parseYoutubeVideoId(youtubeUrlInput);
      const fallbackTitle = youtubeTitleInput.trim() || l("YouTube Transcript 跟读", "YouTube Transcript シャドーイング");
      const response = await fetch("/api/youtube-subtitles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: youtubeUrlInput.trim(),
          videoId: maybeVideoId ?? undefined,
          title: fallbackTitle,
          subtitleText,
        }),
      });
      const payload = (await response.json()) as YoutubeImportResponse;
      if (!response.ok || !payload.success) {
        setYoutubeError(payload.error || l("Transcript 导入失败。", "Transcript のインポートに失敗しました。"));
        return;
      }

      const normalizedSentences = normalizeImportedSentences(payload.sentences);
      if (normalizedSentences.length === 0) {
        setYoutubeError(l("Transcript 可解析，但未生成可练习句子。", "Transcript は解析できましたが、練習用の文を生成できませんでした。"));
        return;
      }

      const videoId = payload.videoId ? String(payload.videoId) : maybeVideoId;
      const title = youtubeTitleInput.trim() || String(payload.title ?? "").trim() || fallbackTitle;
      const importedMaterial: ShadowingMaterial = {
        id: videoId ? `youtube-${videoId}-${Date.now()}` : `subtitle-${Date.now()}`,
        title,
        titleCn: title,
        source: videoId ? "YouTube Transcript (pasted)" : "Transcript (pasted)",
        category: "speech",
        difficulty: 2,
        ...(videoId ? { youtubeVideoId: videoId } : {}),
        sentences: normalizedSentences,
      };

      upsertYoutubeMaterial(importedMaterial);
      setYoutubeScriptInput(buildScriptTextFromSentences(normalizedSentences));
      handleStart(importedMaterial);
    } catch (error) {
      setYoutubeError(error instanceof Error ? error.message : l("Transcript 导入失败。", "Transcript のインポートに失敗しました。"));
    } finally {
      setTranscriptImporting(false);
    }
  }, [handleStart, l, upsertYoutubeMaterial, youtubeTitleInput, youtubeTranscriptInput, youtubeUrlInput]);

  const jumpToSentenceVideo = useCallback((index: number) => {
    if (!activeMaterial?.youtubeVideoId) {
      return;
    }
    const target = activeMaterial.sentences[index];
    if (!target) {
      return;
    }
    if (typeof target.startSec === "number") {
      setVideoStartSec(target.startSec);
      setVideoEmbedNonce((prev) => prev + 1);
    }
  }, [activeMaterial]);

  const loadNews = useCallback(async () => {
    setIsLoadingNews(true);
    try {
      const lang = trainingLanguage === "ja" ? "ja" : "en";
      const res = await fetch(`/api/news?lang=${lang}`);
      const data = await res.json();
      if (data.articles && data.articles.length > 0) {
        const news: NewsMaterial[] = data.articles.map((a: { id: string; title: string; description: string; source: string; date: string; sentences: Array<{ id: number; text: string }> }) => ({
          id: a.id,
          title: a.title,
          titleCn: a.description.substring(0, 60) + "...",
          source: a.source,
          date: a.date,
          difficulty: 2,
          sentences: a.sentences.map((s) => ({
            id: s.id,
            text: s.text,
            translation: "",
          })),
        }));
        setNewsArticles(news);
      } else {
        // Fallback to static news if API fails
        setNewsArticles(trainingLanguage === "ja" ? getDailyNewsJa() : getDailyNews());
      }
    } catch {
      // Fallback to static news on error
      setNewsArticles(trainingLanguage === "ja" ? getDailyNewsJa() : getDailyNews());
    }
    setIsLoadingNews(false);
  }, [trainingLanguage]);

  const handleStartNews = useCallback((article: NewsMaterial) => {
    const material: ShadowingMaterial = {
      id: article.id,
      title: article.title,
      titleCn: article.titleCn,
      source: article.source,
      category: "speech",
      difficulty: article.difficulty as 1 | 2 | 3,
      sentences: article.sentences,
    };
    handleStart(material);
  }, [handleStart]);

  const categories = [
    { key: "all", label: l("全部", "すべて") },
    { key: "speech", label: isJapaneseTraining ? l("商务", "ビジネス") : l("演讲", "スピーチ") },
    { key: "drama", label: isJapaneseTraining ? l("日常", "日常会話") : l("美剧", "ドラマ") },
    { key: "ted", label: isJapaneseTraining ? l("演讲", "スピーチ") : "TED" },
  ];

  const baseMaterials = isJapaneseTraining ? JAPANESE_SHADOWING_MATERIALS : SHADOWING_MATERIALS;
  const filteredMaterials = categoryFilter === "all"
    ? baseMaterials
    : baseMaterials.filter((m) => m.category === categoryFilter);
  const tedSnapshot = parseTedSnapshotMaterials();
  const tedSnapshotGeneratedAt = tedSnapshot.generatedAt
    ? new Date(tedSnapshot.generatedAt).toLocaleString()
    : "";
  const showExtraTabs = true;

  // --- Material Selection Screen ---
  if ((viewMode === "materials" || (showExtraTabs && (viewMode === "news" || viewMode === "youtube"))) && !activeMaterial) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h2>{isJapaneseTraining ? l("日语口语强化", "日本語スピーキング強化") : l("英语口语强化", "英語スピーキング強化")}</h2>
          <p className={styles.subtitle}>
            {isJapaneseTraining
              ? l("逐句跟读练习日语口语，点击「🎙 开始跟读」录音并自动纠错", "文ごとに日本語スピーキングを練習できます。「🎙 シャドーイング開始」で録音し自動チェックします。")
              : l("逐句跟读练习英语发音和语感，点击「🎙 开始跟读」录音并自动纠错", "文ごとに英語スピーキングを練習できます。「🎙 シャドーイング開始」で録音し自動チェックします。")}
          </p>
        </div>

        <div className={styles.categoryFilter}>
          <button
            className={`${styles.categoryBtn} ${trainingLanguage === "en" ? styles.categoryBtnActive : ""}`}
            onClick={() => { setTrainingLanguage("en"); setNewsArticles([]); }}
          >
            {l("英语口语强化", "英語スピーキング強化")}
          </button>
          <button
            className={`${styles.categoryBtn} ${trainingLanguage === "ja" ? styles.categoryBtnActive : ""}`}
            onClick={() => { setTrainingLanguage("ja"); setNewsArticles([]); }}
          >
            {l("日语口语强化", "日本語スピーキング強化")}
          </button>
        </div>

        {/* Tab switcher */}
        <div className={styles.tabBar}>
          <button
            className={`${styles.tab} ${viewMode === "materials" ? styles.tabActive : ""}`}
            onClick={() => setViewMode("materials")}
          >
            {l("经典材料", "定番素材")} ({baseMaterials.length})
          </button>
          {showExtraTabs && (
            <button
              className={`${styles.tab} ${viewMode === "news" ? styles.tabActive : ""}`}
              onClick={() => { setViewMode("news"); if (newsArticles.length === 0) void loadNews(); }}
            >
              {l("每日新闻", "デイリーニュース")}
            </button>
          )}
          {showExtraTabs && (
            <button
              className={`${styles.tab} ${viewMode === "youtube" ? styles.tabActive : ""}`}
              onClick={() => setViewMode("youtube")}
            >
              {l("YouTube 跟读", "YouTube シャドーイング")}
            </button>
          )}
        </div>

        {viewMode === "materials" && (
          <>
            {/* Category filter */}
            <div className={styles.categoryFilter}>
              {categories.map((cat) => (
                <button
                  key={cat.key}
                  className={`${styles.categoryBtn} ${categoryFilter === cat.key ? styles.categoryBtnActive : ""}`}
                  onClick={() => setCategoryFilter(cat.key)}
                >
                  {cat.label}
                  {cat.key === "all"
                    ? ` (${baseMaterials.length})`
                    : ` (${baseMaterials.filter((m) => m.category === cat.key).length})`
                  }
                </button>
              ))}
            </div>
            <div className={styles.materialGrid}>
              {filteredMaterials.map((material) => (
              <Card key={material.id} className={styles.materialCard}>
                <div className={styles.materialHeader}>
                  <h3>{material.title}</h3>
                  <span className={styles.titleCn}>{isJa ? material.title : material.titleCn}</span>
                </div>
                <p className={styles.source}>{material.source}</p>
                <div className={styles.materialMeta}>
                  <Badge variant={getDifficultyVariant(material.difficulty)}>
                    {getDifficultyLabel(material.difficulty, locale)}
                  </Badge>
                  <Badge variant="info">{getCategoryLabel(material.category, locale)}</Badge>
                  <span className={styles.sentenceCount}>{material.sentences.length} {l("句", "文")}</span>
                </div>
                <Button onClick={() => handleStart(material)} className={styles.startBtn}>
                  {l("开始跟读", "練習開始")}
                </Button>
              </Card>
            ))}
            </div>
          </>
        )}

        {viewMode === "news" && (
          <div>
            <div className={styles.newsHeader}>
              <Button variant="secondary" onClick={loadNews} disabled={isLoadingNews}>
                {isLoadingNews ? l("加载中...", "読み込み中...") : l("刷新新闻", "ニュース更新")}
              </Button>
            </div>
            {newsArticles.length === 0 && !isLoadingNews && (
              <p className={styles.emptyNews}>{l("点击「刷新新闻」获取今日英语新闻", "「ニュース更新」を押して今日の英語ニュースを取得")}</p>
            )}
            <div className={styles.materialGrid}>
              {newsArticles.map((article) => (
                <Card key={article.id} className={styles.materialCard}>
                  <div className={styles.materialHeader}>
                    <h3>{article.title}</h3>
                    <span className={styles.titleCn}>{isJa ? article.title : article.titleCn}</span>
                  </div>
                  <p className={styles.source}>{article.source} · {article.date}</p>
                  <div className={styles.materialMeta}>
                    <Badge variant={getDifficultyVariant(article.difficulty)}>
                      {getDifficultyLabel(article.difficulty, locale)}
                    </Badge>
                    <Badge variant="info">{l("新闻", "ニュース")}</Badge>
                    <span className={styles.sentenceCount}>{article.sentences.length} {l("句", "文")}</span>
                  </div>
                  <Button onClick={() => handleStartNews(article)} className={styles.startBtn}>
                    {l("开始跟读", "練習開始")}
                  </Button>
                </Card>
              ))}
            </div>
          </div>
        )}

        {viewMode === "youtube" && (
          <Card className={styles.youtubeFormCard}>
            <CardContent>
              <div className={styles.youtubeFormGrid}>
                <label className={styles.youtubeLabel}>
                  <span>{l("YouTube 链接 / 视频 ID", "YouTube リンク / 動画 ID")}</span>
                  <input
                    className={styles.youtubeInput}
                    type="text"
                    placeholder={l("例如：https://www.youtube.com/watch?v=xxxxxxxxxxx", "例：https://www.youtube.com/watch?v=xxxxxxxxxxx")}
                    value={youtubeUrlInput}
                    onChange={(e) => setYoutubeUrlInput(e.target.value)}
                  />
                </label>

                {youtubeError && <p className={styles.youtubeError}>{youtubeError}</p>}

                <div className={styles.youtubeActions}>
                  <Button
                    onClick={handleAutoImportYoutube}
                    disabled={youtubeImporting}
                  >
                    {youtubeImporting ? l("自动导入中...", "自動インポート中...") : l("一键抓字幕并自动导入", "字幕を取得して自動インポート")}
                  </Button>
                  {isJapaneseTraining ? (
                    <Button
                      variant="secondary"
                      onClick={handleImportJaYoutubeBatch}
                      disabled={youtubeImporting}
                    >
                      {l("一键导入日语跟读素材 ×10", "日本語素材10件を一括導入")}
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      onClick={handleImportTedLatestBatch}
                      disabled={youtubeImporting || tedSnapshot.materials.length === 0}
                    >
                      {l("一键导入 TED 最新10", "TED 最新10件を一括導入")}
                    </Button>
                  )}
                </div>

                <div className={styles.youtubeHint}>
                  {isJapaneseTraining ? (
                    <>
                      <p>{l(
                        "最省事：直接点「一键导入日语跟读素材 ×10」，包含日常会话、商务、旅行等场景。",
                        "最短手順：「日本語素材10件を一括導入」を押してください。日常会話・ビジネス・旅行などの場面が含まれます。"
                      )}</p>
                      <p>{l(
                        "也可以粘贴任意日语 YouTube 视频链接，自动抓取字幕。推荐频道：Yosuke Teaches Japanese、NHK World Japan、日本語の森",
                        "YouTube 動画リンクを貼り付けて字幕を取得することもできます。おすすめ：Yosuke Teaches Japanese、NHK World Japan、日本語の森"
                      )}</p>
                    </>
                  ) : (
                    <>
                      <p>{l("最省事：直接点「一键导入 TED 最新10」。", "最短手順：「TED 最新10件を一括導入」を押してください。")}</p>
                      {tedSnapshotGeneratedAt && <p>{l("TED 批量包生成时间", "TED バッチ生成時刻")}：{tedSnapshotGeneratedAt}</p>}
                    </>
                  )}
                </div>

                <div className={styles.savedMaterialsBlock}>
                  <h4>{l("我的视频材料", "マイ動画素材")}</h4>
                  {savedYoutubeMaterials.length === 0 ? (
                    <p className={styles.savedEmpty}>{l("还没有保存的材料。导入一个视频后会自动保存。", "保存済み素材はまだありません。動画を導入すると自動保存されます。")}</p>
                  ) : (
                    <div className={styles.savedMaterialList}>
                      {savedYoutubeMaterials.map((material) => (
                        <div key={material.id} className={styles.savedMaterialItem}>
                          {material.youtubeVideoId ? (
                            <div 
                              className={styles.videoThumbnailWrap} 
                              onClick={() => handleStartSavedMaterial(material)}
                              style={{ cursor: 'pointer' }}
                            >
                              <img src={`https://img.youtube.com/vi/${material.youtubeVideoId}/mqdefault.jpg`} alt={material.title} />
                              <div className={styles.thumbnailOverlay}>
                                <div className={styles.playIcon}>
                                  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div 
                              className={styles.videoThumbnailWrap} 
                              onClick={() => handleStartSavedMaterial(material)}
                              style={{ cursor: 'pointer', background: 'linear-gradient(135deg, var(--color-primary-light), var(--color-primary))' }}
                            >
                              <div className={styles.thumbnailOverlay} style={{ opacity: 1 }}>
                                <div className={styles.playIcon}>
                                  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                                </div>
                              </div>
                            </div>
                          )}
                          <div className={styles.savedMaterialContent}>
                            <div className={styles.savedMaterialInfo}>
                              <strong title={material.title}>{material.title}</strong>
                              <span>
                                {(() => {
                                  const sentenceTotal = material.sentences.length;
                                  const progress = materialProgressMap[material.id];
                                  if (!progress) {
                                    return isJa
                                      ? `未開始 · ${sentenceTotal} 文 · ${material.source}`
                                      : `未开始 · ${sentenceTotal} 句 · ${material.source}`;
                                  }
                                  const current = clampSentenceIndex(progress.currentIndex, sentenceTotal) + 1;
                                  const completedCount = new Set(
                                    progress.completedSentenceIds.filter(
                                      (id) => Number.isInteger(id) && id >= 0 && id < sentenceTotal,
                                    ),
                                  ).size;
                                  return isJa
                                    ? `${current}/${sentenceTotal} 文 · 完了 ${completedCount} 文 · ${material.source}`
                                    : `第 ${current}/${sentenceTotal} 句 · 已完成 ${completedCount} 句 · ${material.source}`;
                                })()}
                              </span>
                            </div>
                            <div className={styles.savedMaterialActions}>
                              <Button
                                variant="secondary"
                                onClick={() => handleStartSavedMaterial(material)}
                                size="sm"
                              >
                                {materialProgressMap[material.id] ? l("继续练习", "続きから練習") : l("开始练习", "練習開始")}
                              </Button>
                              <Button
                                variant="link"
                                onClick={() => deleteYoutubeMaterial(material.id)}
                                size="sm"
                              >
                                {l("删除", "削除")}
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // --- Active Practice Screen ---
  if (!activeMaterial) return null;

  const sentence = activeMaterial.sentences[currentIndex];
  const translatedSentence = getSentenceTranslation(activeMaterial, sentence);
  const progress = completedSet.size;
  const total = activeMaterial.sentences.length;
  const showPronunciationHint = trainingLanguage === "en" ? showIPA : showReading;

  // Helper: render sentence with per-kanji ruby furigana or word annotations
  const renderAnnotatedSentence = (text: string) => {
    const tokens = showReading ? getSentenceTokens(text) : null;
    // If we have sentence-level tokens and showReading, use ruby for per-kanji furigana
    if (trainingLanguage === "ja" && showReading && tokens && tokens.length > 0) {
      return (
        <div className={styles.annotatedSentence}>
          <p className={styles.sentenceText} style={{ lineHeight: "2.2" }}>
            {tokens.map((token, i) =>
              token.hasKanji && token.reading ? (
                <ruby key={i} style={{ rubyPosition: "over" }}>
                  {token.surface}
                  <rt style={{ fontSize: "0.55em", color: "#888" }}>{token.reading}</rt>
                </ruby>
              ) : (
                <span key={i}>{token.surface}</span>
              ),
            )}
          </p>
          {showWordTranslation && (
            <div className={styles.annotatedSentence} style={{ marginTop: "0.5rem" }}>
              {getAnnotatedWords(text).map((w, i) => {
                const gloss = getWordGloss(w);
                if (!gloss) return null;
                return (
                  <span key={i} className={styles.annotatedWord}>
                    <span className={styles.wordMain}>{w.word}</span>
                    <span className={styles.wordCN}>{gloss}</span>
                  </span>
                );
              })}
            </div>
          )}
        </div>
      );
    }
    // Fallback: existing word-level approach
    return (
      <div className={styles.annotatedSentence}>
        {getAnnotatedWords(text).map((w, i) => {
          const gloss = getWordGloss(w);
          const reading = getJapaneseWordReading(w);
          const canShowGloss = showWordTranslation && Boolean(gloss);
          return (
            <span key={i} className={styles.annotatedWord}>
              <span className={styles.wordMain}>{w.word}</span>
              {trainingLanguage === "en" && showIPA && w.ipa && <span className={styles.wordIPA}>{w.ipa}</span>}
              {trainingLanguage === "ja" && showReading && containsKanji(w.word) && reading && (
                <span className={styles.wordIPA}>{reading}</span>
              )}
              {canShowGloss && <span className={styles.wordCN}>{gloss}</span>}
            </span>
          );
        })}
      </div>
    );
  };
  const isYoutubeMaterial = Boolean(activeMaterial.youtubeVideoId);
  const sentenceRangeText =
    typeof sentence.startSec === "number" && typeof sentence.endSec === "number"
      ? `${formatSeconds(sentence.startSec)} - ${formatSeconds(sentence.endSec)}`
      : typeof sentence.startSec === "number"
        ? `${formatSeconds(sentence.startSec)}`
        : null;
  const youtubeEmbedUrl =
    activeMaterial.youtubeVideoId
      ? buildYoutubeEmbedUrl(
          activeMaterial.youtubeVideoId,
          videoStartSec,
          sentence.startSec === videoStartSec ? sentence.endSec : undefined,
        )
      : "";
  const youtubeWatchUrl = activeMaterial.youtubeVideoId
    ? `https://www.youtube.com/watch?v=${activeMaterial.youtubeVideoId}`
    : "";

  // Helper to navigate to a specific sentence index
  const goToSentence = (index: number) => {
    if (index < 0 || index >= total) return;
    stopSpeaking();
    clearRecognition();
    setCurrentIndex(index);
    const startSec = activeMaterial.sentences[index]?.startSec;
    if (typeof startSec === "number") {
      setVideoStartSec(startSec);
      setVideoEmbedNonce((prev) => prev + 1);
    }
  };

  return (
    <div className={styles.container}>
      {/* ── VoiceTube‑style cinematic layout for YouTube materials ── */}
      {isYoutubeMaterial ? (
        <>
          {/* Dark cinematic header area */}
          <div className={styles.cinemaZone}>
            <div className={styles.cinemaInner}>
              {/* Left: Video player */}
              <div className={styles.cinemaVideo}>
                <div className={styles.videoFrameWrap}>
                  <iframe
                    key={`${activeMaterial.youtubeVideoId}-${videoEmbedNonce}`}
                    className={styles.videoFrame}
                    src={youtubeEmbedUrl}
                    title={activeMaterial.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                </div>

                {/* Custom controls bar below video */}
                <div className={styles.cinemaControls}>
                  <div className={styles.cinemaControlsLeft}>
                    <label className={styles.cinemaToggle}>
                      <input
                        type="checkbox"
                        checked={alwaysShowTranslation}
                        onChange={(e) => setAlwaysShowTranslation(e.target.checked)}
                      />
                      <span>{l("双语", "対訳")}</span>
                    </label>
                    {trainingLanguage === "ja" ? (
                      <label className={styles.cinemaToggle}>
                        <input
                          type="checkbox"
                          checked={showReading}
                          onChange={(e) => setShowReading(e.target.checked)}
                        />
                        <span>{l("假名", "ふりがな")}</span>
                      </label>
                    ) : (
                      <label className={styles.cinemaToggle}>
                        <input
                          type="checkbox"
                          checked={showIPA}
                          onChange={(e) => setShowIPA(e.target.checked)}
                        />
                        <span>{l("音标", "IPA")}</span>
                      </label>
                    )}
                    <label className={styles.cinemaToggle}>
                      <input
                        type="checkbox"
                        checked={showWordTranslation}
                        onChange={(e) => setShowWordTranslation(e.target.checked)}
                      />
                      <span>{l("释义", "語釈")}</span>
                    </label>
                    <button
                      className={styles.cinemaSpeed}
                      onClick={() => setSpeechRate(r => r === 0.6 ? 0.85 : r === 0.85 ? 1.0 : 0.6)}
                      title={l("点击切换TTS语速", "クリックしてTTS速度を切替")}
                    >
                      {speechRate}x
                    </button>
                  </div>
                  <div className={styles.cinemaControlsCenter}>
                    <button
                      className={styles.cinemaPrevNext}
                      onClick={handlePrev}
                      disabled={currentIndex === 0}
                      title={l("上一句", "前の文")}
                    >
                      ⏮
                    </button>
                    <button
                      className={styles.cinemaPlayBtn}
                      onClick={() => isSpeaking ? stopSpeaking() : speak(sentence.text)}
                      title={isSpeaking ? l("停止", "停止") : l("播放当前句TTS", "現在の文を再生")}
                    >
                      {isSpeaking ? "⏸" : "▶"}
                    </button>
                    <button
                      className={styles.cinemaPrevNext}
                      onClick={handleNext}
                      disabled={currentIndex >= total - 1}
                      title={l("下一句", "次の文")}
                    >
                      ⏭
                    </button>
                  </div>
                  <div className={styles.cinemaControlsRight}>
                    {youtubeWatchUrl && (
                      <a href={youtubeWatchUrl} target="_blank" rel="noreferrer" className={styles.cinemaLink}>
                        YouTube ↗
                      </a>
                    )}
                    <button className={styles.cinemaBackBtn} onClick={handleBack}>{l("返回", "戻る")}</button>
                  </div>
                </div>
              </div>

              {/* Right: Scrollable transcript pane */}
              <div className={styles.transcriptPane}>
                <div className={styles.transcriptHeader}>
                  <span className={styles.transcriptTitle}>{l("字幕列表", "字幕リスト")}</span>
                  <span className={styles.transcriptProgress}>{currentIndex + 1}/{total}</span>
                </div>
                <div className={styles.transcriptList}>
                  {activeMaterial.sentences.map((s, idx) => (
                    <div
                      key={s.id}
                      className={`${styles.transcriptItem} ${idx === currentIndex ? styles.transcriptItemActive : ""} ${completedSet.has(idx) ? styles.transcriptItemDone : ""}`}
                      onClick={() => goToSentence(idx)}
                    >
                      <div className={styles.transcriptItemIcons}>
                        <button
                          className={styles.transcriptPlayBtn}
                          onClick={(e) => { e.stopPropagation(); goToSentence(idx); }}
                          title={l("播放", "再生")}
                        >
                          ▶
                        </button>
                        <button
                          className={styles.transcriptRecordBtn}
                          onClick={(e) => { e.stopPropagation(); goToSentence(idx); setTimeout(() => startRecording(s.text), 100); }}
                          title={l("跟读", "シャドーイング")}
                        >
                          🎙
                        </button>
                      </div>
                      <div className={styles.transcriptItemText}>
                        <p className={styles.transcriptEn}>{s.text}</p>
                        {(() => {
                          if (!(alwaysShowTranslation || idx === currentIndex)) {
                            return null;
                          }
                          const transcriptTranslation = getSentenceTranslation(activeMaterial, s);
                          if (!transcriptTranslation && locale !== "ja") {
                            return null;
                          }
                          return (
                            <p className={styles.transcriptCn}>
                              {transcriptTranslation || l("翻译中...", "翻訳中...")}
                            </p>
                          );
                        })()}
                      </div>
                      {typeof s.startSec === "number" && (
                        <span className={styles.transcriptTime}>{formatSeconds(s.startSec)}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Below cinema: active sentence practice area */}
          <div className={styles.practiceBelow}>
            {/* Progress bar */}
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{ width: `${(progress / total) * 100}%` }}
              />
            </div>

            {/* Meta tags */}
            <div className={styles.practiceMetaRow}>
              <Badge variant={getDifficultyVariant(activeMaterial.difficulty)}>
                {getDifficultyLabel(activeMaterial.difficulty, locale)}
              </Badge>
              <span className={styles.practiceMetaTitle}>{activeMaterial.title}</span>
              <span className={styles.practiceMetaSub}>{isJa ? `完了 ${progress}/${total} 文` : `已完成 ${progress}/${total} 句`}</span>
            </div>



            {/* Active sentence detail */}
            <Card className={styles.sentenceCard}>
              <CardContent>
                <div className={styles.sentenceTop}>
                  <div className={styles.sentenceNumber}>#{sentence.id}</div>
                  {sentenceRangeText && (
                    <span className={styles.sentenceTimeTag}>{sentenceRangeText}</span>
                  )}
                  <button
                    className={`${styles.speakBtn} ${isSpeaking ? styles.speakBtnActive : ""}`}
                    onClick={() => isSpeaking ? stopSpeaking() : speak(sentence.text)}
                    title={l("朗读", "読み上げ")}
                  >
                    {isSpeaking ? `⏹ ${l("停止", "停止")}` : `🔊 ${l("朗读", "読み上げ")}`}
                  </button>
                </div>

                {/* Sentence text */}
                <div className={styles.selectionScope} ref={selectionScopeRef}>
                  {!showWordTranslation && !showPronunciationHint ? (
                    <p className={styles.sentenceText}>{sentence.text}</p>
                  ) : (
                    renderAnnotatedSentence(sentence.text)
                  )}
                  <SelectionPronunciation scopeRef={selectionScopeRef} locale={locale} learningLanguage={trainingLanguage} />
                </div>

                {/* Recording section */}
                <div className={styles.recordSection}>
                  {micPermission === "denied" && (
                    <div className={styles.micBanner}>
                      <div className={styles.micBannerIcon}>🎙</div>
                      <div className={styles.micBannerContent}>
                        <strong>{l("需要麦克风权限", "マイクの許可が必要です")}</strong>
                        <p>{l(
                          "请点击浏览器地址栏左侧的🔒图标，将麦克风设为「允许」后刷新页面",
                          "ブラウザのアドレスバー左の🔒アイコンをタップし、マイクを「許可」に変更してページを再読み込みしてください"
                        )}</p>
                      </div>
                      <button className={styles.micBannerClose} onClick={dismissMicBanner} aria-label="Close">✕</button>
                    </div>
                  )}
                  <div className={styles.recordActions}>
                    {!isRecording ? (
                      <button
                        className={styles.recordBtn}
                        onClick={() => startRecording(sentence.text)}
                        disabled={isSpeaking}
                      >
                        {`🎙 ${l("开始跟读", "シャドーイング開始")}`}
                      </button>
                    ) : (
                      <button
                        className={`${styles.recordBtn} ${styles.recordBtnActive}`}
                        onClick={stopRecording}
                      >
                        {`⏹ ${l("停止录音", "録音停止")}`}
                      </button>
                    )}
                    {isRecording && (
                      <span className={styles.recordingIndicator}>{l("录音中...", "録音中...")}</span>
                    )}
                  </div>

                  {recognizedText && !compareResult && (
                    <div className={styles.recognizedText}>
                      <span className={styles.recognizedLabel}>{l("识别中：", "認識中：")}</span>
                      {recognizedText}
                    </div>
                  )}

                  {compareResult && (
                    <div className={styles.compareResult}>
                    <div className={styles.accuracyBar}>
                        <span className={styles.accuracyLabel}>{l("准确率", "正確率")}：{compareResult.accuracy}%</span>
                        <div className={styles.accuracyTrack}>
                          <div
                            className={styles.accuracyFill}
                            style={{
                              width: `${compareResult.accuracy}%`,
                              background: compareResult.accuracy >= 80 ? "var(--color-success, #10b981)" : compareResult.accuracy >= 50 ? "var(--color-warning, #f59e0b)" : "#dc2626",
                            }}
                          />
                        </div>
                        {compareResult.accuracy >= 80 && <span className={styles.accuracyEmoji}>excellent!</span>}
                        {compareResult.accuracy >= 50 && compareResult.accuracy < 80 && <span className={styles.accuracyEmoji}>good, keep going</span>}
                        {compareResult.accuracy < 50 && <span className={styles.accuracyEmoji}>try again</span>}
                      </div>
                      <div className={styles.wordComparison}>
                        {compareResult.words.map((w, i) => (
                          <span
                            key={i}
                            className={w.status === "correct" ? styles.wordCorrect : w.status === "wrong" ? styles.wordWrong : styles.wordMissing}
                            title={w.status === "correct" ? l("正确", "正解") : w.status === "wrong" ? l("多余/错误", "余分/誤り") : l("漏读", "読み落とし")}
                          >
                            {w.word}
                          </span>
                        ))}
                      </div>
                      <div className={styles.compareHint}>
                        <span className={styles.wordCorrect}>{l("绿色=正确", "緑=正解")}</span>
                        <span className={styles.wordWrong}>{l("红色=错误", "赤=誤り")}</span>
                        <span className={styles.wordMissing}>{l("灰色=漏读", "灰=読み落とし")}</span>
                      </div>
                      <button className={styles.retryBtn} onClick={() => startRecording(sentence.text)}>
                        {`🎙 ${l("再读一次", "もう一度読む")}`}
                      </button>
                    </div>
                  )}
                </div>

                {translatedSentence && alwaysShowTranslation && (
                  <p className={styles.translation}>{translatedSentence}</p>
                )}
                {translatedSentence && !alwaysShowTranslation && (
                  <details className={styles.translationDetails}>
                    <summary>{l("点击查看翻译", "訳を表示")}</summary>
                    <p className={styles.translation}>{translatedSentence}</p>
                  </details>
                )}
                {!translatedSentence && (
                  <p className={styles.noTranslation}>{l("实时新闻暂无翻译，可使用「逐词释义」辅助理解", "ニュース文に翻訳がありません。「語釈」表示を使って理解してください。")}</p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        /* ── Standard (non-YouTube) practice layout ── */
        <>
          <div className={styles.sessionHeader}>
            <Button variant="secondary" onClick={handleBack}>{l("返回列表", "一覧へ戻る")}</Button>
            <div className={styles.sessionTitle}>
              <h2>{isJa ? activeMaterial.title : activeMaterial.titleCn}</h2>
              <span className={styles.progressLabel}>{isJa ? `${currentIndex + 1} / ${total} 文 · 完了 ${progress}` : `第 ${currentIndex + 1} / ${total} 句 · 已完成 ${progress}`}</span>
            </div>
          </div>

          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{ width: `${(progress / total) * 100}%` }} />
          </div>

          <div className={styles.controlsBar}>
            <div className={styles.toggleGroup}>
              <label className={styles.toggleLabel}>
                <input type="checkbox" checked={alwaysShowTranslation} onChange={(e) => setAlwaysShowTranslation(e.target.checked)} />
                {l("显示翻译", "訳を表示")}
              </label>
              <label className={styles.toggleLabel}>
                <input type="checkbox" checked={showWordTranslation} onChange={(e) => setShowWordTranslation(e.target.checked)} />
                {isJapaneseTraining ? l("词义提示", "語釈") : l("逐词释义", "語釈")}
              </label>
              {trainingLanguage === "en" && (
                <label className={styles.toggleLabel}>
                  <input type="checkbox" checked={showIPA} onChange={(e) => setShowIPA(e.target.checked)} />
                  {l("显示音标", "IPA 表示")}
                </label>
              )}
              {trainingLanguage === "ja" && (
                <label className={styles.toggleLabel}>
                  <input type="checkbox" checked={showReading} onChange={(e) => setShowReading(e.target.checked)} />
                  {l("显示假名读法", "ふりがな表示")}
                </label>
              )}
            </div>
            <div className={styles.speedControl}>
              <span>{l("语速：", "速度：")}</span>
              <button className={`${styles.speedBtn} ${speechRate === 0.6 ? styles.speedActive : ""}`} onClick={() => setSpeechRate(0.6)}>{l("慢", "遅い")}</button>
              <button className={`${styles.speedBtn} ${speechRate === 0.85 ? styles.speedActive : ""}`} onClick={() => setSpeechRate(0.85)}>{l("中", "標準")}</button>
              <button className={`${styles.speedBtn} ${speechRate === 1.0 ? styles.speedActive : ""}`} onClick={() => setSpeechRate(1.0)}>{l("快", "速い")}</button>
            </div>
          </div>

          <Card className={styles.sentenceCard}>
            <CardContent>
              <div className={styles.sentenceTop}>
                <div className={styles.sentenceNumber}>#{sentence.id}</div>
                <button
                  className={`${styles.speakBtn} ${isSpeaking ? styles.speakBtnActive : ""}`}
                  onClick={() => isSpeaking ? stopSpeaking() : speak(sentence.text)}
                >
                  {isSpeaking ? `⏹ ${l("停止", "停止")}` : `🔊 ${l("朗读", "読み上げ")}`}
                </button>
              </div>

              <div className={styles.selectionScope} ref={selectionScopeRef}>
                {!showWordTranslation && !showPronunciationHint ? (
                  <p className={styles.sentenceText}>{sentence.text}</p>
                ) : (
                  renderAnnotatedSentence(sentence.text)
                )}
                <SelectionPronunciation scopeRef={selectionScopeRef} locale={locale} learningLanguage={trainingLanguage} />
              </div>

              <div className={styles.recordSection}>
                {micPermission === "denied" && (
                  <div className={styles.micBanner}>
                    <div className={styles.micBannerIcon}>🎙</div>
                    <div className={styles.micBannerContent}>
                      <strong>{l("需要麦克风权限", "マイクの許可が必要です")}</strong>
                      <p>{l(
                        "请点击浏览器地址栏左侧的🔒图标，将麦克风设为「允许」后刷新页面",
                        "ブラウザのアドレスバー左の🔒アイコンをタップし、マイクを「許可」に変更してページを再読み込みしてください"
                      )}</p>
                    </div>
                    <button className={styles.micBannerClose} onClick={dismissMicBanner} aria-label="Close">✕</button>
                  </div>
                )}
                <div className={styles.recordActions}>
                  {!isRecording ? (
                    <button className={styles.recordBtn} onClick={() => startRecording(sentence.text)} disabled={isSpeaking}>{`🎙 ${l("开始跟读", "シャドーイング開始")}`}</button>
                  ) : (
                    <button className={`${styles.recordBtn} ${styles.recordBtnActive}`} onClick={stopRecording}>{`⏹ ${l("停止录音", "録音停止")}`}</button>
                  )}
                  {isRecording && <span className={styles.recordingIndicator}>{l("录音中...", "録音中...")}</span>}
                </div>
                {recognizedText && !compareResult && (
                  <div className={styles.recognizedText}>
                    <span className={styles.recognizedLabel}>{l("识别中：", "認識中：")}</span>{recognizedText}
                  </div>
                )}
                {compareResult && (
                  <div className={styles.compareResult}>
                    <div className={styles.accuracyBar}>
                      <span className={styles.accuracyLabel}>{l("准确率", "正確率")}：{compareResult.accuracy}%</span>
                      <div className={styles.accuracyTrack}>
                        <div className={styles.accuracyFill} style={{ width: `${compareResult.accuracy}%`, background: compareResult.accuracy >= 80 ? "var(--color-success, #10b981)" : compareResult.accuracy >= 50 ? "var(--color-warning, #f59e0b)" : "#dc2626" }} />
                      </div>
                      {compareResult.accuracy >= 80 && <span className={styles.accuracyEmoji}>excellent!</span>}
                      {compareResult.accuracy >= 50 && compareResult.accuracy < 80 && <span className={styles.accuracyEmoji}>good, keep going</span>}
                      {compareResult.accuracy < 50 && <span className={styles.accuracyEmoji}>try again</span>}
                    </div>
                    <div className={styles.wordComparison}>
                      {compareResult.words.map((w, i) => (
                        <span key={i} className={w.status === "correct" ? styles.wordCorrect : w.status === "wrong" ? styles.wordWrong : styles.wordMissing}>{w.word}</span>
                      ))}
                    </div>
                    <div className={styles.compareHint}>
                      <span className={styles.wordCorrect}>{l("绿色=正确", "緑=正解")}</span>
                      <span className={styles.wordWrong}>{l("红色=错误", "赤=誤り")}</span>
                      <span className={styles.wordMissing}>{l("灰色=漏读", "灰=読み落とし")}</span>
                    </div>
                    <button className={styles.retryBtn} onClick={() => startRecording(sentence.text)}>{`🎙 ${l("再读一次", "もう一度読む")}`}</button>
                  </div>
                )}
              </div>

              {translatedSentence && alwaysShowTranslation && <p className={styles.translation}>{translatedSentence}</p>}
              {translatedSentence && !alwaysShowTranslation && (
                <details className={styles.translationDetails}><summary>{l("点击查看翻译", "訳を表示")}</summary><p className={styles.translation}>{translatedSentence}</p></details>
              )}
              {!translatedSentence && <p className={styles.noTranslation}>{l("实时新闻暂无翻译，可使用「逐词释义」辅助理解", "ニュース文に翻訳がありません。「語釈」表示を使って理解してください。")}</p>}
            </CardContent>
          </Card>

          <div className={styles.navigation}>
            <Button variant="secondary" onClick={handlePrev} disabled={currentIndex === 0}>{l("上一句", "前の文")}</Button>
            <Button variant="secondary" onClick={() => speak(sentence.text)} disabled={isSpeaking}>{`🔊 ${l("再听一遍", "もう一度聞く")}`}</Button>
            {currentIndex < total - 1 ? (
              <Button onClick={handleNext}>{l("下一句", "次の文")}</Button>
            ) : (
              <Button onClick={handleBack}>{l("练习完成！", "練習完了！")}</Button>
            )}
          </div>

          <div className={styles.tips}>
            <h4>{l("跟读方法", "シャドーイング手順")}</h4>
            <ol>
              <li>{l("第一步 听 → 点击「🔊 朗读」听标准发音", "Step 1 聞く → 「🔊 読み上げ」で基準音声を聞く")}</li>
              <li>{l("第二步 读 → 点击「🎙 开始跟读」对着麦克风读出来", "Step 2 話す → 「🎙 シャドーイング開始」でマイクに向かって読む")}</li>
              <li>{l("第三步 比 → 查看对比结果，绿色=正确，红色=错误，灰色=漏读", "Step 3 比較 → 緑=正解、赤=誤り、灰=読み落としを確認")}</li>
              <li>
                {trainingLanguage === "en"
                  ? l("第四步 查 → 可直接划词，查看音标/释义并朗读单词", "Step 4 確認 → 選択した語の IPA / 語釈 / 再生を確認")
                  : l("第四步 查 → 开启词义提示，先理解关键短语再继续跟读", "Step 4 確認 → 語釈表示を使ってキーフレーズを確認して続ける")}
              </li>
              <li>{l("第五步 练 → 反复练习直到准确率达到 80% 以上", "Step 5 反復 → 正確率 80% 以上まで繰り返す")}</li>
            </ol>
          </div>
        </>
      )}
    </div>
  );
}

// --- News data ---
type NewsMaterial = {
  id: string;
  title: string;
  titleCn: string;
  source: string;
  date: string;
  difficulty: number;
  sentences: Array<{ id: number; text: string; translation: string }>;
};

function getDailyNews(): NewsMaterial[] {
  return [
    {
      id: "news-tech-ai",
      title: "AI Technology Transforms Global Workforce",
      titleCn: "AI技术改变全球劳动力市场",
      source: "Tech News Daily",
      date: new Date().toLocaleDateString(),
      difficulty: 2,
      sentences: [
        { id: 1, text: "Artificial intelligence is rapidly transforming the way companies operate across every industry.", translation: "人工智能正在迅速改变各行业公司的运营方式。" },
        { id: 2, text: "Many businesses are investing heavily in AI tools to improve efficiency and reduce costs.", translation: "许多企业正在大力投资AI工具以提高效率和降低成本。" },
        { id: 3, text: "Workers are being encouraged to develop new skills to adapt to the changing job market.", translation: "工人们被鼓励培养新技能以适应不断变化的就业市场。" },
        { id: 4, text: "Experts predict that AI will create more jobs than it eliminates in the long run.", translation: "专家预测，从长远来看，AI创造的就业机会将多于其消除的。" },
        { id: 5, text: "The demand for data scientists and machine learning engineers has increased significantly.", translation: "对数据科学家和机器学习工程师的需求显著增加。" },
        { id: 6, text: "Companies that fail to adopt AI technology risk falling behind their competitors.", translation: "未能采用AI技术的公司面临落后于竞争对手的风险。" },
        { id: 7, text: "Governments around the world are developing regulations to ensure AI is used responsibly.", translation: "世界各国政府正在制定法规以确保AI的负责任使用。" },
        { id: 8, text: "The healthcare industry has seen remarkable improvements thanks to AI-powered diagnostics.", translation: "由于AI驱动的诊断技术，医疗行业取得了显著的改进。" },
        { id: 9, text: "Education systems are integrating AI to provide personalized learning experiences for students.", translation: "教育系统正在整合AI，为学生提供个性化的学习体验。" },
        { id: 10, text: "The future of work will require a balance between human creativity and artificial intelligence.", translation: "未来的工作将需要在人类创造力和人工智能之间取得平衡。" },
      ],
    },
    {
      id: "news-climate",
      title: "Global Climate Summit Reaches Historic Agreement",
      titleCn: "全球气候峰会达成历史性协议",
      source: "World News",
      date: new Date().toLocaleDateString(),
      difficulty: 2,
      sentences: [
        { id: 1, text: "World leaders have reached a landmark agreement to reduce carbon emissions by fifty percent by 2035.", translation: "世界各国领导人达成了一项里程碑式的协议，到2035年将碳排放减少百分之五十。" },
        { id: 2, text: "The agreement includes commitments from both developed and developing nations.", translation: "该协议包括发达国家和发展中国家的承诺。" },
        { id: 3, text: "Renewable energy investments are expected to double over the next decade.", translation: "可再生能源投资预计在未来十年内翻倍。" },
        { id: 4, text: "Environmental groups have praised the agreement but say more action is needed.", translation: "环保团体赞扬了该协议，但表示需要更多行动。" },
        { id: 5, text: "Scientists warn that time is running out to prevent the worst effects of climate change.", translation: "科学家警告说，防止气候变化最严重影响的时间已所剩无几。" },
        { id: 6, text: "Electric vehicle adoption has accelerated as more countries ban fossil fuel cars.", translation: "随着更多国家禁止化石燃料汽车，电动汽车的采用正在加速。" },
        { id: 7, text: "The transition to clean energy is creating millions of new green jobs worldwide.", translation: "向清洁能源的转型正在全球创造数百万个新的绿色就业机会。" },
        { id: 8, text: "Rising sea levels continue to threaten coastal communities around the globe.", translation: "不断上升的海平面继续威胁着全球沿海社区。" },
        { id: 9, text: "Public awareness of environmental issues has grown dramatically in recent years.", translation: "近年来，公众对环境问题的意识大幅提高。" },
        { id: 10, text: "Businesses are increasingly adopting sustainable practices to meet consumer demand.", translation: "企业正越来越多地采用可持续做法来满足消费者需求。" },
      ],
    },
    {
      id: "news-economy",
      title: "Global Economy Shows Signs of Recovery",
      titleCn: "全球经济显示复苏迹象",
      source: "Financial Times",
      date: new Date().toLocaleDateString(),
      difficulty: 3,
      sentences: [
        { id: 1, text: "The global economy is showing strong signs of recovery after years of uncertainty.", translation: "经过多年的不确定性后，全球经济正显示出强劲的复苏迹象。" },
        { id: 2, text: "Consumer spending has increased across major economies, boosting retail sales.", translation: "主要经济体的消费者支出增加，推动了零售销售。" },
        { id: 3, text: "Central banks are carefully considering whether to adjust interest rates.", translation: "各国央行正在仔细考虑是否调整利率。" },
        { id: 4, text: "The unemployment rate has dropped to its lowest level in over a decade.", translation: "失业率已降至十多年来的最低水平。" },
        { id: 5, text: "Supply chain disruptions that plagued manufacturers are finally easing.", translation: "困扰制造商的供应链中断问题终于得到缓解。" },
        { id: 6, text: "International trade volumes have returned to pre-pandemic levels.", translation: "国际贸易量已恢复到疫情前的水平。" },
        { id: 7, text: "Inflation remains a concern for policymakers despite recent improvements.", translation: "尽管近期有所改善，通货膨胀仍是政策制定者关注的问题。" },
        { id: 8, text: "Small businesses are reporting increased optimism about future growth prospects.", translation: "小企业对未来增长前景的乐观情绪有所增加。" },
        { id: 9, text: "The housing market continues to be a key indicator of economic health.", translation: "房地产市场继续是经济健康状况的关键指标。" },
        { id: 10, text: "Economists forecast steady growth for the remainder of the fiscal year.", translation: "经济学家预测本财年剩余时间将保持稳定增长。" },
      ],
    },
    {
      id: "news-health",
      title: "New Breakthrough in Medical Research",
      titleCn: "医学研究新突破",
      source: "Health Science Weekly",
      date: new Date().toLocaleDateString(),
      difficulty: 2,
      sentences: [
        { id: 1, text: "Researchers have announced a major breakthrough in cancer treatment using immunotherapy.", translation: "研究人员宣布了使用免疫疗法治疗癌症的重大突破。" },
        { id: 2, text: "Clinical trials show that the new treatment is effective for a wide range of cancers.", translation: "临床试验表明，新疗法对多种癌症有效。" },
        { id: 3, text: "The development of this treatment has been decades in the making.", translation: "这种治疗方法的开发已历经数十年。" },
        { id: 4, text: "Patients who participated in the trial reported fewer side effects than traditional chemotherapy.", translation: "参加试验的患者报告的副作用比传统化疗少。" },
        { id: 5, text: "The World Health Organization has called this a significant step forward in global health.", translation: "世界卫生组织称这是全球健康领域的重大进步。" },
        { id: 6, text: "Pharmaceutical companies are racing to bring the treatment to market as soon as possible.", translation: "制药公司正竞相尽快将该疗法推向市场。" },
        { id: 7, text: "Mental health awareness has also increased, with more resources being allocated to support services.", translation: "心理健康意识也有所提高，更多资源被分配到支持服务中。" },
        { id: 8, text: "Telemedicine has become a permanent part of healthcare delivery in many countries.", translation: "远程医疗已成为许多国家医疗服务的永久组成部分。" },
        { id: 9, text: "Regular exercise and a balanced diet remain the foundation of good health.", translation: "规律运动和均衡饮食仍然是良好健康的基础。" },
        { id: 10, text: "Access to affordable healthcare remains a critical challenge in developing nations.", translation: "在发展中国家，获得负担得起的医疗保健仍然是一个关键挑战。" },
      ],
    },
    {
      id: "news-space",
      title: "New Space Mission to Mars Announced",
      titleCn: "新火星探测任务宣布",
      source: "Space & Science",
      date: new Date().toLocaleDateString(),
      difficulty: 2,
      sentences: [
        { id: 1, text: "NASA has announced plans for a new manned mission to Mars scheduled for 2030.", translation: "NASA宣布了计划于2030年进行新的载人火星任务。" },
        { id: 2, text: "The mission will be the first to attempt landing humans on another planet.", translation: "该任务将是首次尝试将人类降落在另一个星球上。" },
        { id: 3, text: "International cooperation will be essential for the success of this ambitious project.", translation: "国际合作对于这个雄心勃勃的项目的成功至关重要。" },
        { id: 4, text: "Advanced life support systems are being developed to sustain astronauts during the long journey.", translation: "先进的生命维持系统正在开发中，以维持宇航员在漫长旅途中的生存。" },
        { id: 5, text: "Private space companies are playing an increasingly important role in space exploration.", translation: "私人太空公司在太空探索中扮演着越来越重要的角色。" },
        { id: 6, text: "The journey to Mars is expected to take approximately seven months.", translation: "前往火星的旅程预计需要大约七个月。" },
        { id: 7, text: "Scientists hope to discover signs of past or present life on the red planet.", translation: "科学家们希望在这颗红色星球上发现过去或现在生命的迹象。" },
        { id: 8, text: "Space tourism is becoming a reality as costs continue to decrease.", translation: "随着成本持续下降，太空旅游正在成为现实。" },
        { id: 9, text: "The technology developed for space missions often leads to innovations on Earth.", translation: "为太空任务开发的技术通常会带来地球上的创新。" },
        { id: 10, text: "Funding for space research has received broad bipartisan support.", translation: "太空研究的资金获得了广泛的两党支持。" },
      ],
    },
  ];
}

function formatSeconds(value: number): string {
  const total = Math.max(0, Math.floor(value));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function getDailyNewsJa(): NewsMaterial[] {
  return [
    {
      id: "news-ja-tech",
      title: "AI技術が日本の職場を変革",
      titleCn: "AI技术变革日本职场",
      source: "NHK ニュース",
      date: new Date().toLocaleDateString(),
      difficulty: 2,
      sentences: [
        { id: 1, text: "人工知能の急速な発展により、日本の多くの企業が業務の自動化を進めています。", translation: "随着人工智能的快速发展，日本许多企业正在推进业务自动化。" },
        { id: 2, text: "特にカスタマーサービスや製造業での導入が加速しています。", translation: "特别是客户服务和制造业的导入正在加速。" },
        { id: 3, text: "政府はAI人材の育成に力を入れる方針を示しました。", translation: "政府表示将致力于培养AI人才。" },
        { id: 4, text: "一方で、雇用への影響を懸念する声も上がっています。", translation: "另一方面，也有人担忧对就业的影响。" },
        { id: 5, text: "専門家は、AIと共存するためのスキルアップが重要だと指摘しています。", translation: "专家指出，提升与AI共存的技能非常重要。" },
        { id: 6, text: "教育現場でもプログラミング教育の充実が求められています。", translation: "教育领域也要求充实编程教育。" },
        { id: 7, text: "AI技術の倫理的な利用についても議論が活発化しています。", translation: "关于AI技术的伦理使用，讨论也日趋活跃。" },
        { id: 8, text: "医療分野では、AI診断の精度が大幅に向上しました。", translation: "在医疗领域，AI诊断的精度大幅提升。" },
        { id: 9, text: "今後もAI技術の進化に合わせた社会制度の整備が必要です。", translation: "今后也需要配合AI技术进化来完善社会制度。" },
        { id: 10, text: "産業界と学術界の連携がますます重要になっています。", translation: "产学合作变得越来越重要。" },
      ],
    },
    {
      id: "news-ja-society",
      title: "高齢化社会と地域コミュニティの再構築",
      titleCn: "老龄化社会与地域社区的重建",
      source: "NHK 社会",
      date: new Date().toLocaleDateString(),
      difficulty: 2,
      sentences: [
        { id: 1, text: "日本の高齢化率が過去最高を更新し、社会全体での対応が急務となっています。", translation: "日本老龄化率创历史新高，全社会的应对已迫在眉睫。" },
        { id: 2, text: "地方では空き家問題が深刻化し、コミュニティの維持が課題です。", translation: "地方空房问题日益严重，维系社区成为课题。" },
        { id: 3, text: "自治体は移住促進策やテレワーク支援を進めています。", translation: "地方政府正在推进促进移居和远程办公支持政策。" },
        { id: 4, text: "高齢者の社会参加を促すボランティア活動が広がっています。", translation: "促进高龄者参与社会的志愿者活动正在扩大。" },
        { id: 5, text: "介護ロボットの導入により、介護現場の負担軽減が期待されています。", translation: "引入护理机器人有望减轻护理现场的负担。" },
        { id: 6, text: "子育て世代への支援も同時に強化する必要があります。", translation: "同时也需要加强对育儿一代的支援。" },
        { id: 7, text: "多世代交流の場を設ける取り組みが注目されています。", translation: "设立多代交流场所的举措备受关注。" },
        { id: 8, text: "デジタル技術を活用した見守りサービスが普及し始めています。", translation: "利用数字技术的守望服务开始普及。" },
        { id: 9, text: "健康寿命の延伸が国の重要な政策課題となっています。", translation: "延长健康寿命已成为国家重要政策课题。" },
        { id: 10, text: "地域の絆を取り戻すための新しい仕組みづくりが求められています。", translation: "人们正在寻求重建地域纽带的新机制。" },
      ],
    },
    {
      id: "news-ja-culture",
      title: "日本の伝統文化とグローバル発信",
      titleCn: "日本传统文化的全球传播",
      source: "NHK 文化",
      date: new Date().toLocaleDateString(),
      difficulty: 1,
      sentences: [
        { id: 1, text: "日本のアニメや漫画は世界中で高い人気を誇っています。", translation: "日本动漫和漫画在全世界都享有很高人气。" },
        { id: 2, text: "和食がユネスコ無形文化遺産に登録されてから、海外での関心がさらに高まりました。", translation: "和食被列入联合国教科文组织非物质文化遗产后，海外的关注进一步提高。" },
        { id: 3, text: "茶道や生け花など、伝統的な文化体験を求める外国人観光客が増えています。", translation: "越来越多的外国游客寻求茶道和花道等传统文化体验。" },
        { id: 4, text: "日本語学習者の数は年々増加しており、その動機の多くはポップカルチャーです。", translation: "日语学习者人数逐年增加，其动机多为流行文化。" },
        { id: 5, text: "伝統工芸の後継者不足が深刻な問題となっています。", translation: "传统工艺后继者不足已成为严重问题。" },
        { id: 6, text: "若い世代が伝統文化をSNSで発信する動きも活発です。", translation: "年轻一代通过社交媒体传播传统文化的活动也很活跃。" },
        { id: 7, text: "地方の祭りや行事を国際的にPRする自治体が増えています。", translation: "越来越多的地方政府在国际上宣传当地的节日和活动。" },
        { id: 8, text: "文化庁はクールジャパン戦略として海外展開を支援しています。", translation: "文化厅作为酷日本战略支持海外拓展。" },
        { id: 9, text: "日本のおもてなし精神は海外からも高く評価されています。", translation: "日本的待客之道在海外也获得高度评价。" },
        { id: 10, text: "伝統と革新の融合が新しい日本文化を生み出しています。", translation: "传统与革新的融合正在创造新的日本文化。" },
      ],
    },
    {
      id: "news-ja-business",
      title: "日本企業のグローバル展開最新動向",
      titleCn: "日本企业全球化最新动向",
      source: "NHK ビジネス",
      date: new Date().toLocaleDateString(),
      difficulty: 3,
      sentences: [
        { id: 1, text: "円安の影響で日本の輸出企業の業績が好調です。", translation: "受日元贬值影响，日本出口企业业绩良好。" },
        { id: 2, text: "半導体産業への大規模投資が国家戦略として進められています。", translation: "对半导体产业的大规模投资正作为国家战略推进。" },
        { id: 3, text: "スタートアップ企業の育成に向けた支援制度が拡充されています。", translation: "培育初创企业的支援制度正在扩充。" },
        { id: 4, text: "リモートワークの定着により、オフィス需要に変化が見られます。", translation: "随着远程办公的普及，办公需求出现变化。" },
        { id: 5, text: "サステナビリティ経営が企業価値を左右する時代になりました。", translation: "可持续经营已成为左右企业价值的时代。" },
        { id: 6, text: "人手不足を背景に、外国人労働者の受け入れが拡大しています。", translation: "以劳动力短缺为背景，接受外国劳动者正在扩大。" },
        { id: 7, text: "デジタルトランスフォーメーションが中小企業にも浸透し始めています。", translation: "数字化转型也开始渗透到中小企业。" },
        { id: 8, text: "物流業界では二〇二四年問題への対応が急がれています。", translation: "物流行业正在紧急应对2024年问题。" },
        { id: 9, text: "ESG投資の拡大により、環境に配慮した経営が求められています。", translation: "随着ESG投资的扩大，企业被要求注重环境的经营。" },
        { id: 10, text: "国際的な競争力を強化するため、産学官の連携が不可欠です。", translation: "为强化国际竞争力，产学官合作不可或缺。" },
      ],
    },
  ];
}

function getDifficultyVariant(d: number): "success" | "warning" | "error" {
  return d === 1 ? "success" : d === 2 ? "warning" : "error";
}

function getDifficultyLabel(d: number, locale: Locale): string {
  if (locale === "ja") {
    return d === 1 ? "初級" : d === 2 ? "中級" : "上級";
  }
  return d === 1 ? "初级" : d === 2 ? "中级" : "高级";
}

function getCategoryLabel(c: string, locale: Locale): string {
  const m: Record<string, string> = locale === "ja"
    ? { speech: "スピーチ", drama: "ドラマ", ted: "TED" }
    : { speech: "演讲", drama: "美剧", ted: "TED" };
  return m[c] || c;
}
