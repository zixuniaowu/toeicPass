import { createT, type UiLang } from "@toeicpass/app-i18n";
import { getShadowingMaterialsByLanguage, type ShadowingMaterial } from "@toeicpass/shadowing-content";
import Constants from "expo-constants";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  MobileSafeAreaProvider,
  MobileScreenShell,
  MobileStatusBar,
  MobileScrollPane,
} from "./src/platform/mobile-safe-shell";
import { HomeScreen } from "./src/screens/home-screen";
import { ShadowingScreen } from "./src/screens/shadowing-screen";
import { VocabScreen } from "./src/screens/vocab-screen";
import { YouTubeScreen } from "./src/screens/youtube-screen";
import { useShadowingTraining } from "./src/shadowing/use-shadowing-training";
import {
  loadCachedShadowingMaterials,
  resolveShadowingApiBase,
  syncShadowingMaterials,
} from "./src/services/content-sync";
import { fetchYoutubeSubtitles } from "./src/services/youtube-subtitles";

type ActiveScreen = "home" | "shadowing" | "vocab" | "youtube";

/**
 * APP_LANG comes from the build flavor (see app.config.js): "en" and "ja"
 * produce two store-separated apps with the target language locked. "both"
 * (development builds) keeps the in-app language toggle.
 */
const APP_LANG = (Constants.expoConfig?.extra as { appLang?: string } | undefined)?.appLang;
const LOCKED_TARGET_LANG: "en" | "ja" | null =
  APP_LANG === "ja" || APP_LANG === "en" ? APP_LANG : null;

const APP_TITLE =
  (Constants.expoConfig?.name as string | undefined) ?? "toeicPass";

export default function App() {
  const [uiLang, setUiLang] = useState<UiLang>("zh");
  const [targetLang, setTargetLang] = useState<"en" | "ja">(LOCKED_TARGET_LANG ?? "en");
  const [activeScreen, setActiveScreen] = useState<ActiveScreen>("home");
  const [importedMaterials, setImportedMaterials] = useState<ShadowingMaterial[]>([]);
  const [serverMaterials, setServerMaterials] = useState<ShadowingMaterial[] | null>(null);
  const [syncingContent, setSyncingContent] = useState(false);

  const t = useMemo(() => createT(uiLang), [uiLang]);

  // Bundled package content is the offline/first-run fallback; server
  // materials (with AsyncStorage cache) take precedence once synced.
  const bundledMaterials = useMemo(
    () => getShadowingMaterialsByLanguage(targetLang),
    [targetLang],
  );

  const allMaterials = useMemo(
    () => [...importedMaterials, ...(serverMaterials ?? bundledMaterials)],
    [importedMaterials, serverMaterials, bundledMaterials],
  );

  useEffect(() => {
    let cancelled = false;
    // Stale-while-revalidate: paint cached content immediately, then refresh
    // from the server. Failures keep whatever we already have.
    (async () => {
      setSyncingContent(true);
      const cached = await loadCachedShadowingMaterials(targetLang);
      if (!cancelled && cached) {
        setServerMaterials(cached);
      }
      const synced = await syncShadowingMaterials(targetLang, resolveShadowingApiBase());
      if (!cancelled && synced) {
        setServerMaterials(synced.materials);
      }
      if (!cancelled) {
        setSyncingContent(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [targetLang]);

  const handleOpenShadowing = useCallback(() => {
    setActiveScreen("shadowing");
  }, []);

  const handleOpenVocab = useCallback(() => {
    setActiveScreen("vocab");
  }, []);

  const handleOpenYoutube = useCallback(() => {
    setActiveScreen("youtube");
  }, []);

  const handleGoHome = useCallback(() => {
    setActiveScreen("home");
  }, []);

  const handleChangeUiLang = useCallback((lang: UiLang) => {
    setUiLang(lang);
  }, []);

  const shadowing = useShadowingTraining({
    materials: allMaterials,
    targetLang,
    t,
  });

  const handleStartYoutubeShadowing = useCallback((materialId: string) => {
    shadowing.handleStartShadowing(materialId);
    setActiveScreen("shadowing");
  }, [shadowing]);

  const [importingUrl, setImportingUrl] = useState(false);

  const handleImportYoutubeUrl = useCallback(async (url: string) => {
    setImportingUrl(true);
    try {
      const result = await fetchYoutubeSubtitles(url);
      if (!result.success) {
        return result.error;
      }
      const material: ShadowingMaterial = {
        id: `yt-import-${result.videoId}-${Date.now()}`,
        title: result.title,
        translations: { zh: result.title },
        source: `YouTube (${result.sourceLanguage})`,
        category: "speech",
        difficulty: 2,
        youtubeVideoId: result.videoId,
        sentences: result.sentences.map((s) => ({
          id: s.id,
          text: s.text,
          translations: { zh: s.translation },
          startSec: s.startSec,
          endSec: s.endSec,
        })),
      };
      setImportedMaterials((prev) => [material, ...prev]);
      shadowing.handleStartShadowing(material.id);
      setActiveScreen("shadowing");
      return null;
    } catch {
      return "Import failed";
    } finally {
      setImportingUrl(false);
    }
  }, [shadowing]);

  const handleChangeTargetLang = useCallback((lang: "en" | "ja") => {
    if (LOCKED_TARGET_LANG) {
      return;
    }
    setServerMaterials(null);
    setTargetLang(lang);
    shadowing.resetForTargetLang(lang);
  }, [shadowing]);

  return (
    <MobileSafeAreaProvider>
      <MobileScreenShell>
        <MobileStatusBar />
        <MobileScrollPane>
          {activeScreen === "home" ? (
            <HomeScreen
              t={t}
              uiLang={uiLang}
              targetLang={targetLang}
              appTitle={APP_TITLE}
              lockTargetLang={Boolean(LOCKED_TARGET_LANG)}
              syncingContent={syncingContent}
              onOpenShadowing={handleOpenShadowing}
              onOpenYoutube={handleOpenYoutube}
              onOpenVocab={handleOpenVocab}
              onUiLangChange={handleChangeUiLang}
              onTargetLangChange={handleChangeTargetLang}
            />
          ) : activeScreen === "youtube" ? (
            <YouTubeScreen
              t={t}
              uiLang={uiLang}
              materials={allMaterials.filter(m => m.youtubeVideoId)}
              onStartYoutubeShadowing={handleStartYoutubeShadowing}
              onGoHome={handleGoHome}
              onImportYoutubeUrl={handleImportYoutubeUrl}
              importingUrl={importingUrl}
            />
          ) : activeScreen === "vocab" ? (
            <VocabScreen t={t} onBack={handleGoHome} />
          ) : (
            <ShadowingScreen
              t={t}
              uiLang={uiLang}
              materials={allMaterials}
              activeMaterial={shadowing.activeMaterial}
              activeSentenceText={shadowing.activeSentence?.text ?? null}
              activeSentenceTranslations={shadowing.activeSentence?.translations ?? null}
              activeSentenceAnnotations={shadowing.activeSentence?.annotations ?? null}
              shadowingIndex={shadowing.shadowingSession.practice.sentenceIndex}
              shadowingCompletedCount={shadowing.shadowingSession.practice.completedSentenceIndices.length}
              showShadowingTranslation={shadowing.shadowingSession.practice.showTranslation}
              isShadowingSpeaking={shadowing.shadowingSession.runtime.isSpeaking}
              isShadowingRecording={shadowing.shadowingSession.runtime.isRecording}
              isShadowingPlayingRecording={shadowing.shadowingSession.runtime.isPlayingRecording}
              shadowingRecordingUri={shadowing.shadowingSession.feedback.recordingUri}
              recordingPlaybackSupported={shadowing.recordingPlaybackSupported}
              shadowingComparison={shadowing.shadowingSession.feedback.comparison}
              shadowingAudioStatus={shadowing.shadowingSession.feedback.audioStatus}
              recordings={shadowing.recordings}
              recordingPersistSupported={shadowing.recordingPersistSupported}
              isRecordOnlyRecording={shadowing.isRecordOnlyRecording}
              onStartShadowing={shadowing.handleStartShadowing}
              onBackShadowingList={shadowing.handleBackToList}
              onGoHome={handleGoHome}
              onToggleTranslation={shadowing.handleToggleTranslation}
              onPrevSentence={shadowing.handlePreviousSentence}
              onPlaySentence={() => {
                if (shadowing.activeSentence) {
                  void shadowing.handlePlaySentence(shadowing.activeSentence.text);
                }
              }}
              onNextSentence={shadowing.handleNextSentence}
              onToggleRecording={() => void shadowing.handleToggleRecording()}
              onToggleRecordOnly={() => void shadowing.handleToggleRecordOnly()}
              onPlayRecording={() => void shadowing.handlePlayRecording()}
              onClearRecording={() => void shadowing.clearRecording()}
              onPlayRecordingFile={(uri) => void shadowing.playSavedRecording(uri)}
              onDeleteRecordingFile={(id) => void shadowing.deleteSavedRecording(id)}
            />
          )}
        </MobileScrollPane>
      </MobileScreenShell>
    </MobileSafeAreaProvider>
  );
}
