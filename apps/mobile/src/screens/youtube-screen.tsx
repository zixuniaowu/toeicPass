import type { ShadowingMaterial } from "@toeicpass/shadowing-content";
import type { UiLang } from "@toeicpass/app-core";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useState } from "react";
import { getShadowingTitle } from "../content-helpers";

type Props = {
  t: (key: string) => string;
  uiLang: UiLang;
  materials: ShadowingMaterial[];
  onStartYoutubeShadowing: (materialId: string) => void;
  onGoHome: () => void;
  onImportYoutubeUrl: (url: string) => Promise<string | null>;
  importingUrl: boolean;
};

export function YouTubeScreen(props: Props) {
  const { t, uiLang, materials, onStartYoutubeShadowing, onGoHome, onImportYoutubeUrl, importingUrl } = props;
  const [urlInput, setUrlInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleImport = async () => {
    if (!urlInput.trim()) return;
    setError(null);
    const err = await onImportYoutubeUrl(urlInput.trim());
    if (err) setError(err);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable onPress={onGoHome} style={styles.backButton}>
            <Text style={styles.backText}>{t("mobile.back")}</Text>
          </Pressable>
          <Text style={styles.headerTitle}>{t("mobile.youtubeShadowing")}</Text>
          <View style={{ width: 50 }} />
        </View>
        <Text style={styles.headerDesc}>{t("mobile.youtubeShadowingDesc")}</Text>
      </View>

      {/* Import bar */}
      <View style={styles.importBar}>
        <TextInput
          style={styles.urlInput}
          placeholder="粘贴 YouTube URL..."
          placeholderTextColor="#9aa8b2"
          value={urlInput}
          onChangeText={setUrlInput}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!importingUrl}
        />
        <Pressable
          style={[styles.importBtn, importingUrl && styles.importBtnDisabled]}
          onPress={handleImport}
          disabled={importingUrl}
        >
          <Text style={styles.importBtnText}>{importingUrl ? "导入中..." : "导入"}</Text>
        </Pressable>
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}

      {materials.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>暂无 YouTube 素材，输入 URL 导入</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        >
          {materials.map((material) => (
            <Pressable
              key={material.id}
              style={styles.card}
              onPress={() => onStartYoutubeShadowing(material.id)}
              android_ripple={{ color: "#fef2f0", borderless: false }}
            >
              <View style={[styles.cardAccent, { backgroundColor: "#dc2626" }]} />
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {getShadowingTitle(material, uiLang)}
                </Text>
                <View style={styles.metaRow}>
                  <Text style={styles.cardSource}>{material.source}</Text>
                  <View style={styles.youtubePill}>
                    <Text style={styles.youtubePillText}>YouTube</Text>
                  </View>
                  <Text style={styles.sentenceCount}>
                    {material.sentences.length} 句
                  </Text>
                </View>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = {
  container: {
    flex: 1,
    backgroundColor: "#f4efe6",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  headerRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800" as const,
    color: "#dc2626",
  },
  headerDesc: {
    marginTop: 4,
    fontSize: 13,
    color: "#7a8b94",
  },
  backButton: {
    paddingVertical: 4,
    paddingRight: 12,
  },
  backText: {
    fontSize: 15,
    color: "#dc2626",
    fontWeight: "600" as const,
  },
  importBar: {
    flexDirection: "row" as const,
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 8,
  },
  urlInput: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: "#10212b",
    borderWidth: 1,
    borderColor: "#e2dcd3",
  },
  importBtn: {
    backgroundColor: "#dc2626",
    borderRadius: 12,
    paddingHorizontal: 20,
    justifyContent: "center" as const,
  },
  importBtnDisabled: {
    opacity: 0.6,
  },
  importBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700" as const,
  },
  errorText: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    fontSize: 12,
    color: "#dc2626",
  },
  emptyWrap: {
    flex: 1,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  emptyText: {
    color: "#9aa8b2",
    fontSize: 15,
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 10,
  },
  card: {
    flexDirection: "row" as const,
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
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  cardBody: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700" as const,
    color: "#10212b",
    lineHeight: 21,
  },
  metaRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 8,
    marginTop: 4,
  },
  cardSource: {
    fontSize: 12,
    color: "#9aa8b2",
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
  sentenceCount: {
    fontSize: 12,
    fontWeight: "600" as const,
    color: "#7a8b94",
  },
} as const;
