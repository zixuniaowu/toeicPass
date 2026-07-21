import type { ShadowingMaterial } from "@toeicpass/shadowing-content";
import type { UiLang } from "@toeicpass/app-core";
import type { ShadowingComparisonFeedback } from "@toeicpass/app-core/shadowing-feedback";

import { useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import * as Linking from "expo-linking";
import {
  getShadowingTitle,
  getShadowingTranslation,
} from "../content-helpers";
import { styles } from "../ui";
import { AnnotatedSentence } from "../shadowing/annotated-sentence";

type Translate = (key: string) => string;

export function ShadowingScreen(props: {
  t: Translate;
  uiLang: UiLang;
  materials: ShadowingMaterial[];
  activeMaterial: ShadowingMaterial | null;
  activeSentenceText: string | null;
  activeSentenceTranslations: ShadowingMaterial["sentences"][number]["translations"] | null;
  shadowingIndex: number;
  shadowingCompletedCount: number;
  showShadowingTranslation: boolean;
  isShadowingSpeaking: boolean;
  isShadowingRecording: boolean;
  isShadowingPlayingRecording: boolean;
  shadowingRecordingUri: string | null;
  shadowingComparison: ShadowingComparisonFeedback | null;
  shadowingAudioStatus: string;
  recordingPlaybackSupported: boolean;
  onStartShadowing: (materialId: string) => void;
  onBackShadowingList: () => void;
  onToggleTranslation: () => void;
  onPrevSentence: () => void;
  onPlaySentence: () => void;
  onNextSentence: (sentenceCount: number) => void;
  onToggleRecording: () => void;
  onPlayRecording: () => void;
  onClearRecording: () => void;
  onGoHome?: () => void;
}) {
  const {
    t,
    uiLang,
    materials,
    activeMaterial,
    activeSentenceText,
    activeSentenceTranslations,
    shadowingIndex,
    shadowingCompletedCount,
    showShadowingTranslation,
    isShadowingSpeaking,
    isShadowingRecording,
    isShadowingPlayingRecording,
    shadowingRecordingUri,
    shadowingComparison,
    shadowingAudioStatus,
    recordingPlaybackSupported,
    onStartShadowing,
    onBackShadowingList,
    onToggleTranslation,
    onPrevSentence,
    onPlaySentence,
    onNextSentence,
    onToggleRecording,
    onPlayRecording,
    onClearRecording,
  onGoHome,
  } = props;
  const [showIpa, setShowIpa] = useState(false);

  return (
    <>
      {!activeMaterial ? (
          <MaterialListView
            t={t}
            uiLang={uiLang}
            materials={materials}
            onStart={onStartShadowing}
            onGoHome={onGoHome}
          />
      ) : (
          <>
          <View style={styles.inlineActions}>
            <Pressable style={styles.secondaryButton} onPress={onBackShadowingList}>
              <Text style={styles.secondaryButtonText}>{t("mobile.shadowingBackList")}</Text>
            </Pressable>
            <Pressable
              style={[styles.secondaryButton, showShadowingTranslation ? styles.tabButtonActive : null]}
              onPress={onToggleTranslation}
            >
              <Text
                style={[
                  styles.secondaryButtonText,
                  showShadowingTranslation ? styles.tabButtonTextActive : null,
                ]}
              >
                {t("mobile.shadowingShowTranslation")}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.secondaryButton, showIpa ? styles.tabButtonActive : null]}
              onPress={() => setShowIpa((v) => !v)}
            >
              <Text
                style={[
                  styles.secondaryButtonText,
                  showIpa ? styles.tabButtonTextActive : null,
                ]}
              >
                {t("mobile.shadowingShowIpa")}
              </Text>
            </Pressable>
            {activeMaterial?.youtubeVideoId ? (
              <Pressable
                style={[styles.secondaryButton, { borderColor: "#dc2626", borderWidth: 1 }]}
                onPress={() => Linking.openURL(`https://youtube.com/watch?v=${activeMaterial.youtubeVideoId}`)}
              >
                <Text style={[styles.secondaryButtonText, { color: "#dc2626" }]}>
                  {t("mobile.youtubeOpen")}
                </Text>
              </Pressable>
            ) : null}
          </View>
          {activeMaterial?.youtubeVideoId ? (
            <View style={{ height: 220, marginHorizontal: 16, marginBottom: 8, borderRadius: 12, overflow: "hidden" }}>
              <WebView
                key={`${activeMaterial.youtubeVideoId}-${shadowingIndex}`}
                source={{
                  uri: `https://www.youtube.com/embed/${activeMaterial.youtubeVideoId}?start=${activeMaterial.sentences[shadowingIndex]?.startSec ?? 0}&end=${activeMaterial.sentences[shadowingIndex]?.endSec ?? 0}&enablejsapi=1&rel=0&playsinline=1&autoplay=1`,
                }}
                style={{ flex: 1 }}
                allowsInlineMediaPlayback
                javaScriptEnabled
                domStorageEnabled
              />
            </View>
          ) : null}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{getShadowingTitle(activeMaterial, uiLang)}</Text>
            <Text style={styles.cardMeta}>
              {activeMaterial.source} · {shadowingIndex + 1}/{activeMaterial.sentences.length}
            </Text>
            {activeSentenceText ? (
              <>
                <AnnotatedSentence
                  text={activeSentenceText}
                  comparison={shadowingComparison}
                  showIpa={showIpa}
                  t={t}
                  translation={activeSentenceTranslations ? getShadowingTranslation(activeSentenceTranslations, uiLang) : null}
                  showTranslation={showShadowingTranslation}
                />
              </>
            ) : null}
            <View style={styles.inlineActions}>
              <Pressable
                style={styles.secondaryButton}
                onPress={onPrevSentence}
                disabled={shadowingIndex === 0}
              >
                <Text style={styles.secondaryButtonText}>{t("mobile.shadowingPrev")}</Text>
              </Pressable>
              {activeSentenceText ? (
                <Pressable style={styles.primaryButton} onPress={onPlaySentence}>
                  <Text style={styles.primaryButtonText}>
                    {isShadowingSpeaking ? t("mobile.shadowingStop") : t("mobile.shadowingListen")}
                  </Text>
                </Pressable>
              ) : null}
              <Pressable
                style={styles.secondaryButton}
                onPress={() => onNextSentence(activeMaterial.sentences.length)}
                disabled={shadowingIndex >= activeMaterial.sentences.length - 1}
              >
                <Text style={styles.secondaryButtonText}>{t("mobile.shadowingNext")}</Text>
              </Pressable>
            </View>
            <View style={styles.inlineActions}>
              <Pressable style={styles.primaryButton} onPress={onToggleRecording}>
                <Text style={styles.primaryButtonText}>
                  {isShadowingRecording ? t("mobile.shadowingRecording") : t("mobile.shadowingRecord")}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.secondaryButton, !recordingPlaybackSupported ? styles.buttonDisabled : null]}
                onPress={onPlayRecording}
                disabled={!shadowingRecordingUri || !recordingPlaybackSupported}
              >
                <Text style={[styles.secondaryButtonText, !recordingPlaybackSupported ? styles.buttonTextDisabled : null]}>
                  {isShadowingPlayingRecording
                    ? t("mobile.shadowingStopPlayback")
                    : t("mobile.shadowingPlayRecording")}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.secondaryButton, !recordingPlaybackSupported ? styles.buttonDisabled : null]}
                onPress={onClearRecording}
                disabled={(!shadowingRecordingUri && !isShadowingRecording) || !recordingPlaybackSupported}
              >
                <Text style={[styles.secondaryButtonText, !recordingPlaybackSupported ? styles.buttonTextDisabled : null]}>
                  {t("mobile.shadowingClearRecording")}
                </Text>
              </Pressable>
            </View>
            <Text style={styles.cardBody}>
              {shadowingAudioStatus || (
                recordingPlaybackSupported
                  ? t("mobile.shadowingRecordHint")
                  : t("mobile.shadowingPlaybackUnsupported")
              )}
            </Text>
            <Text style={styles.cardBody}>
              {t("mobile.shadowingProgress")}: {shadowingCompletedCount} / {activeMaterial.sentences.length}
            </Text>
          </View>
        </>
      )}
    </>
  );
}

function MaterialListView(props: {
  t: Translate;
  uiLang: UiLang;
  materials: ShadowingMaterial[];
  onStart: (materialId: string) => void;
  onGoHome?: () => void;
}) {
  const { t, uiLang, materials, onStart, onGoHome } = props;

  return (
    <View style={materialStyles.container}>
        <View style={materialStyles.headerSection}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={{ width: 8, height: 28, borderRadius: 4, backgroundColor: "#c84f2d" }} />
              <Text style={materialStyles.headerTitle}>{t("mobile.shadowingTitle")}</Text>
            </View>
            {onGoHome ? (
              <Pressable style={{ paddingVertical: 4, paddingHorizontal: 12 }} onPress={onGoHome}>
                <Text style={{ fontSize: 14, color: "#c84f2d", fontWeight: "600" }}>← 主页</Text>
              </Pressable>
            ) : null}
          </View>
          <Text style={materialStyles.headerSubtitle}>{t("mobile.shadowingDesc")}</Text>
        </View>
      {materials.length === 0 ? (
        <Text style={materialStyles.emptyText}>{t("mobile.shadowingEmpty")}</Text>
      ) : (
        <ScrollView
          contentContainerStyle={materialStyles.list}
          showsVerticalScrollIndicator={false}
        >
          {materials.map((material) => (
            <Pressable
              key={material.id}
              style={materialStyles.card}
              onPress={() => onStart(material.id)}
              android_ripple={{ color: "#e8ddd0", borderless: false }}
            >
              <View style={materialStyles.cardAccent} />
              <View style={materialStyles.cardBody}>
                <Text style={materialStyles.cardTitle} numberOfLines={1}>
                  {getShadowingTitle(material, uiLang)}
                </Text>
                <View style={materialStyles.cardMetaRow}>
                  <Text style={materialStyles.cardSource}>{material.source}</Text>
                  {material.youtubeVideoId ? (
                    <View style={materialStyles.youtubePill}>
                      <Text style={materialStyles.youtubePillText}>{t("mobile.youtubeBadge")}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
              <View style={materialStyles.countPill}>
                <Text style={materialStyles.countPillText}>
                  {material.sentences.length}{t("mobile.shadowingSentences")}
                </Text>
              </View>
            </Pressable>
          ))}
          {/* Ad banner placeholder */}
          <View style={materialStyles.adBanner}>
            <Text style={materialStyles.adBannerText}>{t("mobile.adTitle")}</Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const materialStyles = {
  container: {
    flex: 1,
    backgroundColor: "#f4efe6",
  },
  headerSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800" as const,
    color: "#10212b",
  },
  headerSubtitle: {
    marginTop: 4,
    fontSize: 14,
    color: "#7a8b94",
    lineHeight: 20,
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 10,
  },
  emptyText: {
    padding: 20,
    color: "#7a8b94",
    textAlign: "center" as const,
    fontSize: 15,
  },
  card: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    overflow: "hidden" as const,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  cardAccent: {
    width: 4,
    alignSelf: "stretch" as const,
    backgroundColor: "#c84f2d",
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  cardBody: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: "#10212b",
  },
  cardSource: {
    marginTop: 2,
    fontSize: 12,
    color: "#9aa8b2",
  },
  countPill: {
    marginRight: 14,
    backgroundColor: "#f4efe6",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  countPillText: {
    fontSize: 12,
    fontWeight: "700" as const,
    color: "#c84f2d",
  },
  cardMetaRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 8,
  },
  youtubePill: {
    backgroundColor: "#fef2f0",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  youtubePillText: {
    fontSize: 10,
    fontWeight: "700" as const,
    color: "#dc2626",
  },
  adBanner: {
    marginTop: 8,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: "#e2e8f0",
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  adBannerText: {
    fontSize: 12,
    color: "#94a3b8",
    textTransform: "uppercase" as const,
    letterSpacing: 1,
  },
} as const;


