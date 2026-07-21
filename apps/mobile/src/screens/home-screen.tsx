import { Pressable, ScrollView, Text, View } from "react-native";
import * as Linking from "expo-linking";

type Props = {
  t: (key: string) => string;
  uiLang: string;
  targetLang: string;
  onOpenShadowing: () => void;
  onOpenYoutube: () => void;
  onOpenVocab: () => void;
  onUiLangChange: (lang: "zh" | "ja" | "en") => void;
  onTargetLangChange: (lang: "en" | "ja") => void;
};

const UI_LANG_OPTIONS = [
  { key: "zh", label: "中文" },
  { key: "ja", label: "日本語" },
] as const;

export function HomeScreen({
  t,
  uiLang,
  targetLang,
  onOpenShadowing,
  onOpenYoutube,
  onOpenVocab,
  onUiLangChange,
  onTargetLangChange,
}: Props) {
  const handleOpenPrivacy = () => {
    Linking.openURL("https://toeicpass.app/privacy");
  };

  return (
    <ScrollView style={homeStyles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={homeStyles.headerSection}>
        <Text style={homeStyles.appTitle}>toeicPass</Text>
        <Text style={homeStyles.appSubtitle}>跟读 · 词汇 · 视频</Text>
      </View>

      {/* Language Toggle */}
      <View style={homeStyles.langSection}>
        <Text style={homeStyles.langLabel}>{t("mobile.langUi")}</Text>
        <View style={homeStyles.chipRow}>
          {UI_LANG_OPTIONS.map((opt) => (
            <Pressable
              key={opt.key}
              style={[
                homeStyles.chip,
                uiLang === opt.key ? homeStyles.chipActive : null,
              ]}
              onPress={() => onUiLangChange(opt.key)}
            >
              <Text
                style={[
                  homeStyles.chipText,
                  uiLang === opt.key ? homeStyles.chipTextActive : null,
                ]}
              >
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={[homeStyles.langLabel, { marginTop: 10 }]}>{t("mobile.langTarget")}</Text>
        <View style={homeStyles.chipRow}>
          <Pressable
            style={[homeStyles.chip, targetLang === "en" ? homeStyles.chipActive : null]}
            onPress={() => onTargetLangChange("en")}
          >
            <Text style={[homeStyles.chipText, targetLang === "en" ? homeStyles.chipTextActive : null]}>
              English
            </Text>
          </Pressable>
          <Pressable
            style={[homeStyles.chip, targetLang === "ja" ? homeStyles.chipActive : null]}
            onPress={() => onTargetLangChange("ja")}
          >
            <Text style={[homeStyles.chipText, targetLang === "ja" ? homeStyles.chipTextActive : null]}>
              日本語
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Feature Cards */}
      <View style={homeStyles.cardGrid}>
        <Pressable
          style={homeStyles.card}
          onPress={onOpenShadowing}
          android_ripple={{ color: "#e8ddd0", borderless: false }}
        >
          <View style={[homeStyles.cardAccent, { backgroundColor: "#c84f2d" }]} />
          <View style={homeStyles.cardBody}>
            <View style={[homeStyles.iconCircle, { backgroundColor: "#fef2f0" }]}>
              <View style={homeStyles.iconLines}>
                <View style={[homeStyles.iconLine, { width: 20, backgroundColor: "#c84f2d" }]} />
                <View style={[homeStyles.iconLine, { width: 14, backgroundColor: "#c84f2d" }]} />
                <View style={[homeStyles.iconLine, { width: 10, backgroundColor: "#c84f2d" }]} />
              </View>
            </View>
            <View style={homeStyles.cardTextCol}>
              <Text style={homeStyles.cardTitle}>{t("mobile.shadowingTitle")}</Text>
              <Text style={homeStyles.cardDesc}>{t("mobile.shadowingFeatureDesc")}</Text>
            </View>
          </View>
        </Pressable>

        {/* YouTube Card */}
        <Pressable
          style={homeStyles.card}
          onPress={onOpenYoutube}
          android_ripple={{ color: "#fef2f0", borderless: false }}
        >
          <View style={[homeStyles.cardAccent, { backgroundColor: "#dc2626" }]} />
          <View style={homeStyles.cardBody}>
            <View style={[homeStyles.iconCircle, { backgroundColor: "#fef2f0" }]}>
              <View style={homeStyles.iconLines}>
                <View style={{ width: 18, height: 14, borderRadius: 3, borderWidth: 2, borderColor: "#dc2626", alignItems: "center", justifyContent: "center" }}>
                  <View style={{ width: 0, height: 0, borderLeftWidth: 6, borderTopWidth: 4, borderBottomWidth: 4, borderLeftColor: "#dc2626", borderTopColor: "transparent", borderBottomColor: "transparent" }} />
                </View>
              </View>
            </View>
            <View style={homeStyles.cardTextCol}>
              <Text style={homeStyles.cardTitle}>{t("mobile.youtubeShadowing")}</Text>
              <Text style={homeStyles.cardDesc}>{t("mobile.youtubeShadowingDesc")}</Text>
            </View>
          </View>
        </Pressable>

        {/* Vocab Card */}
        <Pressable
          style={homeStyles.card}
          onPress={onOpenVocab}
          android_ripple={{ color: "#e0f2fe", borderless: false }}
        >
          <View style={[homeStyles.cardAccent, { backgroundColor: "#0284c7" }]} />
          <View style={homeStyles.cardBody}>
            <View style={[homeStyles.iconCircle, { backgroundColor: "#e0f2fe" }]}>
              <View style={homeStyles.iconLines}>
                <View style={{ width: 16, height: 2, borderRadius: 1, backgroundColor: "#0284c7", marginBottom: 3 }} />
                <View style={{ width: 22, height: 2, borderRadius: 1, backgroundColor: "#0284c7", marginBottom: 3 }} />
                <View style={{ width: 12, height: 2, borderRadius: 1, backgroundColor: "#0284c7" }} />
              </View>
            </View>
            <View style={homeStyles.cardTextCol}>
              <Text style={homeStyles.cardTitle}>{t("mobile.vocab")}</Text>
              <Text style={homeStyles.cardDesc}>{t("mobile.vocabFeatureDesc")}</Text>
            </View>
          </View>
        </Pressable>
      </View>

      {/* Ad Banner Placeholder */}
      <View style={homeStyles.adBanner}>
        <Text style={homeStyles.adText}>{t("mobile.adTitle")}</Text>
      </View>

      {/* Footer */}
      <View style={homeStyles.footer}>
        <Pressable onPress={handleOpenPrivacy}>
          <Text style={homeStyles.footerText}>Privacy Policy</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const homeStyles = {
  container: {
    flex: 1,
    backgroundColor: "#f4efe6",
  },
  headerSection: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 6,
  },
  appTitle: {
    fontSize: 32,
    fontWeight: "800" as const,
    color: "#10212b",
    letterSpacing: -0.5,
  },
  appSubtitle: {
    marginTop: 4,
    fontSize: 15,
    color: "#7a8b94",
  },
  langSection: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    backgroundColor: "#ffffff",
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    borderRadius: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  langLabel: {
    fontSize: 12,
    fontWeight: "600" as const,
    color: "#7a8b94",
    marginBottom: 6,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  chipRow: {
    flexDirection: "row" as const,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#f4efe6",
  },
  chipActive: {
    backgroundColor: "#10212b",
  },
  chipText: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: "#7a8b94",
  },
  chipTextActive: {
    color: "#ffffff",
  },
  cardGrid: {
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 12,
  },
  card: {
    flexDirection: "row" as const,
    backgroundColor: "#ffffff",
    borderRadius: 20,
    overflow: "hidden" as const,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  cardAccent: {
    width: 4,
    alignSelf: "stretch" as const,
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
  },
  cardBody: {
    flex: 1,
    paddingVertical: 20,
    paddingHorizontal: 18,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 16,
  },
  cardTextCol: {
    flex: 1,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  iconLines: {
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  iconLine: {
    height: 3,
    borderRadius: 2,
    marginBottom: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: "#10212b",
  },
  cardDesc: {
    fontSize: 13,
    color: "#9aa8b2",
    marginTop: 2,
  },
  adBanner: {
    marginHorizontal: 16,
    marginTop: 20,
    paddingVertical: 20,
    borderRadius: 12,
    backgroundColor: "#e2e8f0",
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  adText: {
    fontSize: 12,
    color: "#94a3b8",
    textTransform: "uppercase" as const,
    letterSpacing: 1,
  },
  footer: {
    paddingVertical: 24,
    alignItems: "center" as const,
  },
  footerText: {
    fontSize: 12,
    color: "#94a3b8",
  },
} as const;
