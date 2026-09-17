import type { ShadowingComparisonFeedback } from "@toeicpass/app-core/shadowing-feedback";
import { useMemo, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  Text,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import * as Speech from "expo-speech";
import { annotateSentence, type AnnotatedWord } from "./word-annotator";

type Props = {
  text: string;
  comparison?: ShadowingComparisonFeedback | null;
  showIpa: boolean;
  t: (key: string) => string;
  translation?: string | null;
  showTranslation?: boolean;
  /** Furigana segments for Japanese sentences (surface + hiragana reading). */
  annotations?: Array<{ surface: string; reading: string }> | null;
  speechLanguage?: string;
};

type PopoverState = {
  word: string;
  ipa: string | null;
  cn: string | null;
  x: number;
  y: number;
};

export function AnnotatedSentence({ text, comparison, showIpa, t, translation, showTranslation, annotations, speechLanguage }: Props) {
  const annotatedWords = useMemo(() => annotateSentence(text), [text]);
  const [popover, setPopover] = useState<PopoverState | null>(null);
  const wordRefs = useRef<Record<string, View | null>>({});

  const comparisonMap = useMemo<Record<string, "correct" | "wrong" | "missing"> | null>(() => {
    if (!comparison) return null;
    const map: Record<string, "correct" | "wrong" | "missing"> = {};
    for (const w of comparison.words) {
      map[w.word.toLowerCase()] = w.status;
    }
    return map;
  }, [comparison]);

  const hasFurigana = Boolean(showIpa && annotations && annotations.length > 0);

  return (
    <View style={annotatedSentenceStyles.container}>
      {hasFurigana ? (
        <View style={annotatedSentenceStyles.wordsRow}>
          {(annotations ?? []).map((segment, i) => {
            const needsReading = segment.reading !== segment.surface;
            return (
              <Pressable
                key={`furigana-${i}`}
                style={annotatedSentenceStyles.wordWrapper}
                onLongPress={() => {
                  setPopover({
                    word: segment.surface,
                    ipa: needsReading ? segment.reading : null,
                    cn: null,
                    x: 0,
                    y: 0,
                  });
                }}
                delayLongPress={400}
              >
                {needsReading ? (
                  <Text style={annotatedSentenceStyles.furigana}>{segment.reading}</Text>
                ) : null}
                <Text style={annotatedSentenceStyles.word}>{segment.surface}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <View style={annotatedSentenceStyles.wordsRow}>
          {annotatedWords.map((aw, i) => (
            <WordView
              key={`${aw.text}-${i}`}
              word={aw}
              status={comparisonMap?.[aw.clean] ?? null}
              showIpa={showIpa}
              onLongPress={(x, y) => {
                if (aw.annotation) {
                  setPopover({
                    word: aw.text,
                    ipa: aw.annotation.ipa,
                    cn: aw.annotation.cn,
                    x,
                    y,
                  });
                }
              }}
            />
          ))}
        </View>
      )}
      {showTranslation && translation ? (
        <Text style={{ fontSize: 15, color: "#475569", marginTop: 8, marginBottom: 4, lineHeight: 22 }}>
          {translation}
        </Text>
      ) : null}
      {comparison ? (
        <>
          <ComparisonRow comparison={comparison} />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <View style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: "#0f766e" }} />
              <Text style={{ fontSize: 12, color: "#475569" }}>{t("mobile.shadowingLegendCorrect")}</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <View style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: "#b91c1c" }} />
              <Text style={{ fontSize: 12, color: "#475569" }}>{t("mobile.shadowingLegendWrong")}</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <View style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: "#94a3b8" }} />
              <Text style={{ fontSize: 12, color: "#475569" }}>{t("mobile.shadowingLegendMissing")}</Text>
            </View>
          </View>
          <Text style={{ fontSize: 12, color: "#7a8b94", marginTop: 6, lineHeight: 18 }}>
            {t("mobile.shadowingLegendGuide")}
          </Text>
        </>
      ) : null}

      <Modal visible={!!popover} transparent animationType="none" onRequestClose={() => setPopover(null)}>
        <TouchableWithoutFeedback onPress={() => setPopover(null)}>
          <View style={annotatedSentenceStyles.popoverOverlay}>
            {popover ? (
              <View
                style={[
                  annotatedSentenceStyles.popover,
                  popover.y < 200 ? { top: popover.y + 10 } : { top: popover.y - 120 },
                  { left: Math.max(8, Math.min(popover.x - 60, 300)) },
                ]}
              >
                <View style={annotatedSentenceStyles.popoverHeader}>
                  <Text style={annotatedSentenceStyles.popoverWord}>{popover.word}</Text>
                  <Pressable
                    style={annotatedSentenceStyles.playButton}
                    onPress={() => {
                      Speech.speak(popover.word, { language: speechLanguage ?? "en", rate: 0.8 });
                    }}
                  >
                    <Text style={annotatedSentenceStyles.playButtonText}>&#9654;</Text>
                  </Pressable>
                </View>
                {popover.ipa ? (
                  <Text style={annotatedSentenceStyles.popoverIpa}>{popover.ipa}</Text>
                ) : null}
                {popover.cn ? (
                  <Text style={annotatedSentenceStyles.popoverCn}>{popover.cn}</Text>
                ) : null}
                {!popover.ipa && !popover.cn ? (
                  <Text style={annotatedSentenceStyles.popoverNone}>{t("mobile.wordAnnotationNone")}</Text>
                ) : null}
              </View>
            ) : null}
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

function ComparisonRow({ comparison }: { comparison: ShadowingComparisonFeedback }) {
  return (
    <View style={{ marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#e2e8f0" }}>
      <Text style={{ fontSize: 12, color: "#7a8b94", marginBottom: 6, fontWeight: "600" }}>
        你的朗读:
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5 }}>
        {comparison.words.map((w, i) => (
          <View
            key={`cmp-${i}`}
            style={{
              backgroundColor: w.status === "correct" ? "#ccfbf1" : w.status === "wrong" ? "#fee2e2" : "#e2e8f0",
              borderRadius: 999,
              paddingHorizontal: 8,
              paddingVertical: 4,
            }}
          >
            <Text
              style={{
                color: w.status === "correct" ? "#0f766e" : w.status === "wrong" ? "#b91c1c" : "#475569",
                fontWeight: "700",
                fontSize: 14,
              }}
            >
              {w.word}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function WordView(props: {
  word: AnnotatedWord;
  status: "correct" | "wrong" | "missing" | null;
  showIpa: boolean;
  onLongPress: (x: number, y: number) => void;
}) {
  const { word, status, showIpa, onLongPress } = props;
  const wordRef = useRef<View>(null);

  let wordStyle = annotatedSentenceStyles.word;
  let ipaColor = annotatedSentenceStyles.ipa;
  if (status === "correct") {
    wordStyle = { ...wordStyle, ...annotatedSentenceStyles.wordCorrect };
  } else if (status === "wrong") {
    wordStyle = { ...wordStyle, ...annotatedSentenceStyles.wordWrong };
  } else if (status === "missing") {
    wordStyle = { ...wordStyle, ...annotatedSentenceStyles.wordMissing };
  }

  return (
    <Pressable
      ref={wordRef}
      style={annotatedSentenceStyles.wordWrapper}
      onLongPress={() => {
        wordRef.current?.measureInWindow((x, y) => {
          onLongPress(x, y);
        });
      }}
      delayLongPress={400}
    >
      <Text style={wordStyle}>{word.text}</Text>
      {showIpa && word.annotation?.ipa ? (
        <Text style={ipaColor}>{word.annotation.ipa}</Text>
      ) : null}
    </Pressable>
  );
}

const annotatedSentenceStyles = {
  container: {
    marginBottom: 8,
  },
  wordsRow: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: 4,
  },
  wordWrapper: {
    marginRight: 2,
    marginBottom: 4,
    alignItems: "center" as const,
  },
  word: {
    fontSize: 20,
    lineHeight: 30,
    color: "#10212b",
    fontWeight: "700" as const,
  },
  ipa: {
    fontSize: 12,
    color: "#7a8b94",
    lineHeight: 16,
  },
  furigana: {
    fontSize: 12,
    color: "#7a8b94",
    lineHeight: 15,
    textAlign: "center" as const,
  },
  wordCorrect: {
    color: "#0f766e",
    backgroundColor: "#ccfbf1",
    borderRadius: 4,
    paddingHorizontal: 2,
  },
  wordWrong: {
    color: "#b91c1c",
    backgroundColor: "#fee2e2",
    borderRadius: 4,
    paddingHorizontal: 2,
  },
  wordMissing: {
    color: "#94a3b8",
    backgroundColor: "#f1f5f9",
    borderRadius: 4,
    paddingHorizontal: 2,
  },
  popoverOverlay: {
    flex: 1,
  },
  popover: {
    position: "absolute" as const,
    backgroundColor: "#10212b",
    borderRadius: 12,
    padding: 14,
    minWidth: 140,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 999,
  },
  popoverHeader: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
  },
  popoverWord: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700" as const,
  },
  playButton: {
    backgroundColor: "#c84f2d",
    borderRadius: 999,
    width: 32,
    height: 32,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    marginLeft: 12,
  },
  playButtonText: {
    color: "#ffffff",
    fontSize: 14,
  },
  popoverIpa: {
    color: "#cbd5e1",
    fontSize: 14,
    marginTop: 4,
    fontFamily: "monospace",
  },
  popoverCn: {
    color: "#fbbf24",
    fontSize: 15,
    marginTop: 6,
  },
  popoverNone: {
    color: "#94a3b8",
    fontSize: 13,
    marginTop: 4,
    fontStyle: "italic",
  },
} as const;
