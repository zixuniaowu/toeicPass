"use client";

import { useState, useCallback, useEffect, useRef, type ChangeEvent } from "react";
import type { Locale } from "../../types";
import type { UiLang } from "../../types";
import { SHADOWING_MATERIALS, type ShadowingMaterial } from "../../data/shadowing-materials";
import { JAPANESE_SHADOWING_MATERIALS } from "../../data/japanese-shadowing-materials";
import { getDailyNews, getDailyNewsJa, type NewsMaterial } from "../../data/news-data";
import { Card, CardContent } from "../ui/Card";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { SelectionPronunciation } from "../ui/SelectionPronunciation";
import { AnnotatedSentence } from "./AnnotatedSentence";
import { RecordingPanel } from "./RecordingPanel";
import { useSpeechSynthesis } from "../../hooks/useSpeechSynthesis";
import { useSpeechRecognition } from "../../hooks/useSpeechRecognition";
import { useWordAnnotation } from "../../hooks/useWordAnnotation";
import { useYoutubeMaterials } from "../../hooks/useYoutubeMaterials";
import {
  parseYoutubeVideoId,
  parseYoutubeScript,
  parseYoutubeTranscriptText,
  buildVttFromCues,
  normalizeImportedSentences,
  buildScriptTextFromSentences,
  buildYoutubeEmbedUrl,
  withSubtitleFallbackHint,
  titleFromSubtitleFile,
  formatSeconds,
  getDifficultyVariant,
  getDifficultyLabel,
  getCategoryLabel,
  clampSentenceIndex,
  isPersistedVideoMaterial,
  parseTedSnapshotMaterials,
  type TrainingLanguage,
} from "../../lib/shadowing-utils";
import styles from "./ShadowingView.module.css";

type ViewMode = "materials" | "practice" | "news" | "youtube";

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


export function ShadowingView({ locale, uiLang = locale }: { locale: Locale; uiLang?: UiLang }) {
  const isJa = uiLang === "ja";
  const isEn = uiLang === "en";
  const l = (zh: string, ja: string, en?: string) => {
    if (isEn) return en ?? ja;
    return isJa ? ja : zh;
  };


  // ── Language selection ──────────────────────────────────────────────────
  const [trainingLanguage, setTrainingLanguage] = useState<TrainingLanguage>("en");
  const isJapaneseTraining = trainingLanguage === "ja";

  // ── View / navigation state ─────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<ViewMode>("materials");
  const [originMode, setOriginMode] = useState<ViewMode>("materials");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [activeMaterial, setActiveMaterial] = useState<ShadowingMaterial | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [completedSet, setCompletedSet] = useState<Set<number>>(new Set());
  const [alwaysShowTranslation, setAlwaysShowTranslation] = useState(false);

  // ── Annotation toggles ──────────────────────────────────────────────────
  const [showWordTranslation, setShowWordTranslation] = useState(false);
  const [showIPA, setShowIPA] = useState(false);
  const [showReading, setShowReading] = useState(false);
  const selectionScopeRef = useRef<HTMLDivElement | null>(null);

  // ── Video playback ──────────────────────────────────────────────────────
  const [videoStartSec, setVideoStartSec] = useState(0);
  const [videoEmbedNonce, setVideoEmbedNonce] = useState(0);

  // ── News ────────────────────────────────────────────────────────────────
  const [newsArticles, setNewsArticles] = useState<NewsMaterial[]>([]);
  const [isLoadingNews, setIsLoadingNews] = useState(false);

  // ── YouTube form ────────────────────────────────────────────────────────
  const [youtubeUrlInput, setYoutubeUrlInput] = useState("");
  const [youtubeTitleInput, setYoutubeTitleInput] = useState("");
  const [youtubeScriptInput, setYoutubeScriptInput] = useState("");
  const [youtubeTranscriptInput, setYoutubeTranscriptInput] = useState("");
  const [youtubeError, setYoutubeError] = useState("");
  const [youtubeImporting, setYoutubeImporting] = useState(false);
  const [subtitleFileImporting, setSubtitleFileImporting] = useState(false);
  const [transcriptImporting, setTranscriptImporting] = useState(false);

  // ── Domain hooks ────────────────────────────────────────────────────────
  const tts = useSpeechSynthesis(trainingLanguage);
  const wordAnnotation = useWordAnnotation(trainingLanguage, uiLang);
  const youtubeMaterials = useYoutubeMaterials(trainingLanguage);
  const recognition = useSpeechRecognition(trainingLanguage, tts.stopSpeaking, l);

  // ── Reset state when training language changes ──────────────────────────
  useEffect(() => {
    tts.stopSpeaking();
    recognition.clearRecognition();
    setActiveMaterial(null);
    setViewMode("materials");
    setCategoryFilter("all");
    setShowIPA(false);
    // Auto-enable furigana for Japanese — learners need readings to recognise kanji
    setShowReading(trainingLanguage === "ja");
    setShowWordTranslation(false);
    setAlwaysShowTranslation(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trainingLanguage]);

  // ── Persist progress when sentence index or completed set changes ───────
  useEffect(() => {
    if (!activeMaterial || !isPersistedVideoMaterial(activeMaterial)) return;
    const sentenceTotal = activeMaterial.sentences.length;
    if (sentenceTotal <= 0) return;
    const safeIndex = clampSentenceIndex(currentIndex, sentenceTotal);
    const safeCompleted = new Set(
      Array.from(completedSet).filter(
        (id) => Number.isInteger(id) && id >= 0 && id < sentenceTotal,
      ),
    );
    youtubeMaterials.persistProgress(activeMaterial.id, safeIndex, safeCompleted);
  }, [activeMaterial, completedSet, currentIndex, youtubeMaterials]);

  // ── Pre-fetch translations around current sentence ──────────────────────
  useEffect(() => {
    if (uiLang !== "ja" || trainingLanguage !== "en" || !activeMaterial) return;
    const around = [
      activeMaterial.sentences[currentIndex - 1],
      activeMaterial.sentences[currentIndex],
      activeMaterial.sentences[currentIndex + 1],
    ].filter((item): item is ShadowingMaterial["sentences"][number] => Boolean(item?.text));
    around.forEach((sentence) => wordAnnotation.ensureJaSentenceTranslation(activeMaterial, sentence));
  }, [activeMaterial, currentIndex, wordAnnotation, uiLang, trainingLanguage]);

  useEffect(() => {
    if (uiLang !== "ja" || trainingLanguage !== "en" || !activeMaterial || !alwaysShowTranslation) return;
    activeMaterial.sentences.slice(0, 80).forEach((sentence) => {
      wordAnnotation.ensureJaSentenceTranslation(activeMaterial, sentence);
    });
  }, [activeMaterial, alwaysShowTranslation, wordAnnotation, uiLang, trainingLanguage]);

  useEffect(() => {
    if (!activeMaterial || !showWordTranslation) return;
    const currentSentence = activeMaterial.sentences[currentIndex];
    if (!currentSentence?.text) return;
    const words = wordAnnotation.getAnnotatedWords(currentSentence.text).slice(0, 24);
    if (trainingLanguage === "ja") {
      words.forEach((word) => wordAnnotation.ensureJapaneseWordGloss(word));
      return;
    }
    if (uiLang === "ja") {
      words.forEach((word) => wordAnnotation.ensureJaWordGloss(word));
    }
  }, [activeMaterial, currentIndex, wordAnnotation, uiLang, showWordTranslation, trainingLanguage]);

  useEffect(() => {
    if (trainingLanguage !== "ja" || !activeMaterial) return;
    const currentSentence = activeMaterial.sentences[currentIndex];
    if (!currentSentence?.text) return;
    // Always pre-fetch tokens for Japanese so phonetic (hiragana) comparison text is
    // available for speech-recognition accuracy — even when furigana display is off.
    wordAnnotation.ensureSentenceTokens(currentSentence.text);
    if (showReading) {
      wordAnnotation.getAnnotatedWords(currentSentence.text)
        .slice(0, 24)
        .forEach((word) => wordAnnotation.ensureJapaneseWordReading(word));
    }
  }, [activeMaterial, currentIndex, wordAnnotation, showReading, trainingLanguage]);

  useEffect(() => {
    if (uiLang !== "ja" || trainingLanguage !== "en" || !activeMaterial) return;
    const timer = window.setTimeout(() => {
      const currentSentence = activeMaterial.sentences[currentIndex];
      if (!currentSentence?.text) return;
      wordAnnotation.ensureJaSentenceTranslation(activeMaterial, currentSentence);
      if (showWordTranslation) {
        wordAnnotation.getAnnotatedWords(currentSentence.text)
          .slice(0, 24)
          .forEach((word) => wordAnnotation.ensureJaWordGloss(word));
      }
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [activeMaterial, currentIndex, wordAnnotation, uiLang, showWordTranslation, trainingLanguage]);

  // ── Navigation callbacks ─────────────────────────────────────────────────
  const handleStart = useCallback((material: ShadowingMaterial, options?: { resumeFromLast?: boolean }) => {
    const sentenceTotal = material.sentences.length;
    const storedProgress = options?.resumeFromLast ? youtubeMaterials.materialProgressMap[material.id] : undefined;
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
    // For Japanese training, show translation by default so learners know what they're saying
    setAlwaysShowTranslation(trainingLanguage === "ja");
    setCompletedSet(initialCompleted);
    setVideoStartSec(firstSentenceStart);
    setVideoEmbedNonce((prev) => prev + 1);
    setOriginMode(viewMode);
    recognition.clearRecognition();
    setViewMode("practice");
  }, [recognition, youtubeMaterials.materialProgressMap, viewMode]);

  const handleNext = useCallback(() => {
    if (!activeMaterial) return;
    tts.stopSpeaking();
    recognition.clearRecognition();
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
  }, [activeMaterial, currentIndex, tts, recognition]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      tts.stopSpeaking();
      recognition.clearRecognition();
      const prevIndex = currentIndex - 1;
      setCurrentIndex(prevIndex);
      const prevStart = activeMaterial?.sentences[prevIndex]?.startSec;
      if (typeof prevStart === "number") {
        setVideoStartSec(prevStart);
        setVideoEmbedNonce((prev) => prev + 1);
      }
    }
  }, [activeMaterial, currentIndex, tts, recognition]);

  const handleBack = useCallback(() => {
    tts.stopSpeaking();
    recognition.clearRecognition();
    setActiveMaterial(null);
    setCurrentIndex(0);
    setAlwaysShowTranslation(false);
    setCompletedSet(new Set());
    setYoutubeError("");
    setViewMode(originMode);
  }, [tts, recognition, originMode]);

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
    youtubeMaterials.upsertMaterial(customMaterial);
    handleStart(customMaterial);
  }, [handleStart, youtubeMaterials, youtubeScriptInput, youtubeTitleInput, youtubeUrlInput]);

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

      youtubeMaterials.upsertMaterial(autoMaterial);
      setYoutubeScriptInput(buildScriptTextFromSentences(normalizedSentences));
      handleStart(autoMaterial);
    } catch (error) {
      setYoutubeError(withSubtitleFallbackHint(error instanceof Error ? error.message : l("自动导入失败。", "自動インポートに失敗しました。"), isJa));
    } finally {
      setYoutubeImporting(false);
    }
  }, [handleStart, l, youtubeMaterials, youtubeTitleInput, youtubeUrlInput]);

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

      youtubeMaterials.upsertMaterial(importedMaterial);
      setYoutubeScriptInput(buildScriptTextFromSentences(normalizedSentences));
      handleStart(importedMaterial);
    } catch (error) {
      setYoutubeError(error instanceof Error ? error.message : l("字幕文件导入失败。", "字幕ファイルのインポートに失敗しました。"));
    } finally {
      setSubtitleFileImporting(false);
    }
  }, [handleStart, l, youtubeMaterials, youtubeTitleInput, youtubeUrlInput]);

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

      youtubeMaterials.upsertMaterial(importedMaterial);
      setYoutubeScriptInput(buildScriptTextFromSentences(normalizedSentences));
      handleStart(importedMaterial);
    } catch (error) {
      setYoutubeError(error instanceof Error ? error.message : l("Transcript 导入失败。", "Transcript のインポートに失敗しました。"));
    } finally {
      setTranscriptImporting(false);
    }
  }, [handleStart, l, youtubeMaterials, youtubeTitleInput, youtubeTranscriptInput, youtubeUrlInput]);

  const handleImportJaYoutubeBatch = useCallback(() => {
    youtubeMaterials.importJaYoutubeBatch();
  }, [youtubeMaterials]);

  const handleImportTedLatestBatch = useCallback(() => {
    youtubeMaterials.importTedLatestBatch();
  }, [youtubeMaterials]);

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
                  {youtubeMaterials.savedMaterials.length === 0 ? (
                    <p className={styles.savedEmpty}>{l("还没有保存的材料。导入一个视频后会自动保存。", "保存済み素材はまだありません。動画を導入すると自動保存されます。")}</p>
                  ) : (
                    <div className={styles.savedMaterialList}>
                      {youtubeMaterials.savedMaterials.map((material) => (
                        <div key={material.id} className={styles.savedMaterialItem}>
                          {material.youtubeVideoId ? (
                            <div 
                              className={styles.videoThumbnailWrap} 
                              onClick={() => handleStart(material, { resumeFromLast: true })}
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
                              onClick={() => handleStart(material, { resumeFromLast: true })}
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
                                  const progress = youtubeMaterials.materialProgressMap[material.id];
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
                                onClick={() => handleStart(material, { resumeFromLast: true })}
                                size="sm"
                              >
                                {youtubeMaterials.materialProgressMap[material.id] ? l("继续练习", "続きから練習") : l("开始练习", "練習開始")}
                              </Button>
                              <Button
                                variant="link"
                                onClick={() => youtubeMaterials.deleteMaterial(material.id)}
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
  const translatedSentence = wordAnnotation.getSentenceTranslation(activeMaterial, sentence);
  const secondaryTranslation = wordAnnotation.getSecondaryTranslation(sentence);
  // For Japanese training, build a hiragana-only phonetic form of the sentence so that
  // speech-recognition output (which is always hiragana) can be accurately compared.
  const sentencePhoneticText = trainingLanguage === "ja"
    ? wordAnnotation.getSentencePhoneticText(sentence.text)
    : sentence.text;
  const progress = completedSet.size;
  const total = activeMaterial.sentences.length;
  const showPronunciationHint = trainingLanguage === "en" ? showIPA : showReading;

  // Helper: render sentence with per-kanji ruby furigana or word annotations
  const renderAnnotatedSentence = (text: string) => (
    <AnnotatedSentence
      text={text}
      trainingLanguage={trainingLanguage}
      showReading={showReading}
      showIPA={showIPA}
      showWordTranslation={showWordTranslation}
      words={wordAnnotation.getAnnotatedWords(text)}
      sentenceTokens={showReading ? wordAnnotation.getSentenceTokens(text) : null}
      getWordGloss={wordAnnotation.getWordGloss}
      getJapaneseWordReading={wordAnnotation.getJapaneseWordReading}
    />
  );
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
    tts.stopSpeaking();
    recognition.clearRecognition();
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
            {/* Back button header */}
            <div className={styles.cinemaHeader}>
              <button className={styles.cinemaHeaderBack} onClick={handleBack}>← {l("返回", "戻る")}</button>
              <span className={styles.cinemaHeaderTitle}>{activeMaterial.title}</span>
              <span className={styles.cinemaHeaderProgress}>{currentIndex + 1}/{total}</span>
            </div>
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
                      onClick={() => tts.setSpeechRate(tts.speechRate === 0.6 ? 0.85 : tts.speechRate === 0.85 ? 1.0 : 0.6)}
                      title={l("点击切换TTS语速", "クリックしてTTS速度を切替")}
                    >
                      {tts.speechRate}x
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
                      onClick={() => tts.isSpeaking ? tts.stopSpeaking() : tts.speak(sentence.text)}
                      title={tts.isSpeaking ? l("停止", "停止") : l("播放当前句TTS", "現在の文を再生")}
                    >
                      {tts.isSpeaking ? "⏸" : "▶"}
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
                          onClick={(e) => { e.stopPropagation(); goToSentence(idx); const phonetic = wordAnnotation.getSentencePhoneticText(s.text); setTimeout(() => recognition.startRecording(s.text, phonetic), 100); }}
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
                          const transcriptTranslation = wordAnnotation.getSentenceTranslation(activeMaterial, s);
                          if (!transcriptTranslation && uiLang !== "ja") {
                            return null;
                          }
                          const transcriptSecondary = wordAnnotation.getSecondaryTranslation(s);
                          return (
                            <>
                              <p className={styles.transcriptCn}>
                                {transcriptTranslation || l("翻译中...", "翻訳中...")}
                              </p>
                              {transcriptSecondary && (
                                <p className={styles.transcriptCnSecondary}>{transcriptSecondary}</p>
                              )}
                            </>
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
                    className={`${styles.speakBtn} ${tts.isSpeaking ? styles.speakBtnActive : ""}`}
                    onClick={() => tts.isSpeaking ? tts.stopSpeaking() : tts.speak(sentence.text)}
                    title={l("朗读", "読み上げ")}
                  >
                    {tts.isSpeaking ? `⏹ ${l("停止", "停止")}` : `🔊 ${l("朗读", "読み上げ")}`}
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
                <RecordingPanel
                  micPermission={recognition.micPermission}
                  isRecording={recognition.isRecording}
                  isSpeaking={tts.isSpeaking}
                  recognizedText={recognition.recognizedText}
                  compareResult={recognition.compareResult}
                  sentenceText={sentence.text}
                  sentencePhoneticText={sentencePhoneticText}
                  trainingLanguage={trainingLanguage}
                  onStartRecording={recognition.startRecording}
                  onStopRecording={recognition.stopRecording}
                  onDismissMicBanner={recognition.dismissMicBanner}
                  l={l}
                />

                {translatedSentence && alwaysShowTranslation && (
                  <p className={styles.translation}>{translatedSentence}</p>
                )}
                {secondaryTranslation && alwaysShowTranslation && (
                  <p className={styles.translationSecondary}>{secondaryTranslation}</p>
                )}
                {translatedSentence && !alwaysShowTranslation && (
                  <details className={styles.translationDetails}>
                    <summary>{l("点击查看翻译", "訳を表示")}</summary>
                    <p className={styles.translation}>{translatedSentence}</p>
                    {secondaryTranslation && <p className={styles.translationSecondary}>{secondaryTranslation}</p>}
                  </details>
                )}
                {!translatedSentence && trainingLanguage === "en" && (
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
              <button className={`${styles.speedBtn} ${tts.speechRate === 0.6 ? styles.speedActive : ""}`} onClick={() => tts.setSpeechRate(0.6)}>{l("慢", "遅い")}</button>
              <button className={`${styles.speedBtn} ${tts.speechRate === 0.85 ? styles.speedActive : ""}`} onClick={() => tts.setSpeechRate(0.85)}>{l("中", "標準")}</button>
              <button className={`${styles.speedBtn} ${tts.speechRate === 1.0 ? styles.speedActive : ""}`} onClick={() => tts.setSpeechRate(1.0)}>{l("快", "速い")}</button>
            </div>
          </div>

          <Card className={styles.sentenceCard}>
            <CardContent>
              <div className={styles.sentenceTop}>
                <div className={styles.sentenceNumber}>#{sentence.id}</div>
                <button
                  className={`${styles.speakBtn} ${tts.isSpeaking ? styles.speakBtnActive : ""}`}
                  onClick={() => tts.isSpeaking ? tts.stopSpeaking() : tts.speak(sentence.text)}
                >
                  {tts.isSpeaking ? `⏹ ${l("停止", "停止")}` : `🔊 ${l("朗读", "読み上げ")}`}
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

              {/* For Japanese, show translation BEFORE the recording panel so learners
                  know what they're about to say. For English, translation is shown after. */}
              {trainingLanguage === "ja" && translatedSentence && (
                <p className={styles.translation}>{translatedSentence}</p>
              )}

              <div className={styles.recordSection}>
                <RecordingPanel
                  micPermission={recognition.micPermission}
                  isRecording={recognition.isRecording}
                  isSpeaking={tts.isSpeaking}
                  recognizedText={recognition.recognizedText}
                  compareResult={recognition.compareResult}
                  sentenceText={sentence.text}
                  sentencePhoneticText={sentencePhoneticText}
                  trainingLanguage={trainingLanguage}
                  onStartRecording={recognition.startRecording}
                  onStopRecording={recognition.stopRecording}
                  onDismissMicBanner={recognition.dismissMicBanner}
                  l={l}
                />
              </div>

              {/* English: show translation after recording panel */}
              {trainingLanguage === "en" && translatedSentence && alwaysShowTranslation && <p className={styles.translation}>{translatedSentence}</p>}
              {trainingLanguage === "en" && secondaryTranslation && alwaysShowTranslation && <p className={styles.translationSecondary}>{secondaryTranslation}</p>}
              {trainingLanguage === "en" && translatedSentence && !alwaysShowTranslation && (
                <details className={styles.translationDetails}><summary>{l("点击查看翻译", "訳を表示")}</summary><p className={styles.translation}>{translatedSentence}</p>{secondaryTranslation && <p className={styles.translationSecondary}>{secondaryTranslation}</p>}</details>
              )}
              {trainingLanguage === "en" && !translatedSentence && <p className={styles.noTranslation}>{l("实时新闻暂无翻译，可使用「逐词释义」辅助理解", "ニュース文に翻訳がありません。「語釈」表示を使って理解してください。")}</p>}
            </CardContent>
          </Card>

          <div className={styles.navigation}>
            <Button variant="secondary" onClick={handlePrev} disabled={currentIndex === 0}>{l("上一句", "前の文")}</Button>
            <Button variant="secondary" onClick={() => tts.speak(sentence.text)} disabled={tts.isSpeaking}>{`🔊 ${l("再听一遍", "もう一度聞く")}`}</Button>
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
