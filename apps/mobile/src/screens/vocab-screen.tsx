import dict from "../shadowing/word-dict.json";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import * as Speech from "expo-speech";
import { loadProgress, saveProgress, getGradeCounts, gradeCard as applyGrade, type CardProgress } from "../services/vocab-storage";

const wordEntries = Object.entries(dict as Record<string, { cn: string; ipa: string }>);

type Tab = "study" | "browse" | "stats";

type Props = {
  t: (key: string) => string;
  onBack: () => void;
};

export function VocabScreen({ t, onBack }: Props) {
  const [tab, setTab] = useState<Tab>("study");
  const [progress, setProgress] = useState<Record<string, CardProgress>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadProgress().then((p) => { setProgress(p); setLoaded(true); });
  }, []);

  const save = useCallback((p: Record<string, CardProgress>) => {
    setProgress(p);
    saveProgress(p);
  }, []);

  if (!loaded) return <View style={s.container}><Text style={{ textAlign: "center", marginTop: 60, color: "#9aa8b2" }}>加载中...</Text></View>;

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Pressable onPress={onBack} style={s.backButton}>
          <Text style={s.backText}>← {t("mobile.back")}</Text>
        </Pressable>
        <Text style={s.headerTitle}>{t("mobile.vocab")}</Text>
        <View style={{ width: 50 }} />
      </View>

      <TabBar tab={tab} onTabChange={setTab} t={t} />

      {tab === "study" ? (
        <StudyTab progress={progress} onSave={save} wordEntries={wordEntries} t={t} onBack={onBack} />
      ) : tab === "browse" ? (
        <BrowseTab progress={progress} t={t} />
      ) : (
        <StatsTab progress={progress} t={t} />
      )}
    </View>
  );
}

function TabBar({ tab, onTabChange, t }: { tab: Tab; onTabChange: (v: Tab) => void; t: Props["t"] }) {
  const tabs: { key: Tab; label: string }[] = [
    { key: "study", label: "学习" },
    { key: "browse", label: "浏览" },
    { key: "stats", label: "统计" },
  ];
  return (
    <View style={tabBarStyles.row}>
      {tabs.map((item) => (
        <Pressable
          key={item.key}
          style={[tabBarStyles.tab, tab === item.key && tabBarStyles.tabActive]}
          onPress={() => onTabChange(item.key)}
        >
          <Text style={[tabBarStyles.tabText, tab === item.key && tabBarStyles.tabTextActive]}>
            {item.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

// ──────── Study Tab ────────

const BATCH_SIZE = 30;

function dueCards(progress: Record<string, CardProgress>, now: number): string[] {
  const result: string[] = [];
  for (const [word, p] of Object.entries(progress)) {
    if (p.lastGrade != null && p.dueAt <= now) result.push(word);
  }
  return result;
}

function newCards(progress: Record<string, CardProgress>): string[] {
  return wordEntries.filter(([w]) => !progress[w]?.lastGrade).map(([w]) => w);
}

type StudyCard = { word: string; cn: string; ipa: string };

function StudyTab({ progress, onSave, wordEntries, t, onBack }: {
  progress: Record<string, CardProgress>;
  onSave: (p: Record<string, CardProgress>) => void;
  wordEntries: [string, { cn: string; ipa: string }][];
  t: Props["t"];
  onBack: () => void;
}) {
  const now = Date.now();
  const [revealed, setRevealed] = useState(false);
  const [sessionIndex, setSessionIndex] = useState(0);
  const [sessionCards, setSessionCards] = useState<StudyCard[]>([]);
  const [done, setDone] = useState(false);
  const [sessionGrades, setSessionGrades] = useState<{ word: string; grade: 1 | 3 | 5 }[]>([]);

  useEffect(() => {
    buildSession(progress, now);
  }, []);

  const buildSession = (p: Record<string, CardProgress>, n: number) => {
    const due = dueCards(p, n);
    const news = newCards(p);
    const picked: string[] = [];
    const duePool = due.slice(0, BATCH_SIZE);
    const newCount = Math.max(0, BATCH_SIZE - duePool.length);
    const newPool = news.slice(0, newCount);
    picked.push(...duePool, ...newPool);
    const entryMap = Object.fromEntries(wordEntries);
    const cards = picked.map((w) => ({ word: w, ...entryMap[w] })).filter((c) => c.cn);
    setSessionCards(cards);
    setSessionIndex(0);
    setDone(false);
    setRevealed(false);
    setSessionGrades([]);
  };

  const active = sessionCards[sessionIndex];

  const handleGrade = (grade: 1 | 3 | 5) => {
    if (!active) return;
    const updated = applyGrade(progress, active.word, grade, now);
    onSave(updated);
    setSessionGrades((prev) => [...prev, { word: active.word, grade }]);
    setRevealed(false);
    if (sessionIndex + 1 >= sessionCards.length) {
      setDone(true);
    } else {
      setSessionIndex((i) => i + 1);
    }
  };

  const handleRestart = () => buildSession(progress, now);

  if (done) {
    const known = sessionGrades.filter((g) => g.grade >= 3).length;
    return (
      <View style={studyStyles.doneWrap}>
        <View style={[studyStyles.doneCircle, { backgroundColor: "#e0f2fe" }]}>
          <Text style={{ fontSize: 28, color: "#0284c7" }}>✓</Text>
        </View>
        <Text style={studyStyles.doneTitle}>本组完成</Text>
        <Text style={studyStyles.doneDesc}>
          完成 {sessionGrades.length} 张 · 掌握 {known} 张
        </Text>
        <Pressable style={studyStyles.restartBtn} onPress={handleRestart}>
          <Text style={studyStyles.restartBtnText}>继续学习</Text>
        </Pressable>
        <Pressable style={studyStyles.backBtn} onPress={onBack}>
          <Text style={studyStyles.backBtnText}>返回主页</Text>
        </Pressable>
      </View>
    );
  }

  if (!active) {
    return (
      <View style={studyStyles.doneWrap}>
        <Text style={{ color: "#7a8b94", fontSize: 15 }}>没有待学习的单词</Text>
        <Pressable style={studyStyles.restartBtn} onPress={handleRestart}>
          <Text style={studyStyles.restartBtnText}>开始学习新词</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={studyStyles.container}>
      {/* Progress bar */}
      <View style={studyStyles.progressBar}>
        <View style={[studyStyles.progressFill, { width: `${((sessionIndex) / sessionCards.length) * 100}%` }]} />
        <Text style={studyStyles.progressText}>{sessionIndex + 1}/{sessionCards.length}</Text>
      </View>

      {/* Flashcard */}
      <Pressable style={studyStyles.cardArea} onPress={() => !revealed && setRevealed(true)}>
        <View style={studyStyles.card}>
          <Text style={studyStyles.wordText}>{active.word}</Text>
          {revealed ? (
            <>
              {active.ipa ? <Text style={studyStyles.ipaText}>{active.ipa}</Text> : null}
              <View style={studyStyles.divider} />
              <Text style={studyStyles.cnText}>{active.cn}</Text>
              <Pressable
                style={studyStyles.speakBtn}
                onPress={() => Speech.speak(active.word, { language: "en", rate: 0.8 })}
              >
                <Text style={studyStyles.speakBtnText}>🔊 发音</Text>
              </Pressable>
            </>
          ) : (
            <Text style={studyStyles.tapHint}>点击显示释义</Text>
          )}
        </View>
      </Pressable>

      {revealed ? (
        <View style={studyStyles.gradeRow}>
          <Pressable style={[studyStyles.gradeBtn, { backgroundColor: "#fee2e2" }]} onPress={() => handleGrade(1)}>
            <Text style={studyStyles.gradeLabel}>不认识</Text>
            <Text style={studyStyles.gradeSub}>再练练</Text>
          </Pressable>
          <Pressable style={[studyStyles.gradeBtn, { backgroundColor: "#fef9c3" }]} onPress={() => handleGrade(3)}>
            <Text style={studyStyles.gradeLabel}>有点印象</Text>
            <Text style={studyStyles.gradeSub}>模糊</Text>
          </Pressable>
          <Pressable style={[studyStyles.gradeBtn, { backgroundColor: "#ccfbf1" }]} onPress={() => handleGrade(5)}>
            <Text style={studyStyles.gradeLabel}>完全掌握</Text>
            <Text style={studyStyles.gradeSub}>记住了</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

// ──────── Browse Tab ────────

function BrowseTab({ progress, t }: { progress: Record<string, CardProgress>; t: Props["t"] }) {
  const now = Date.now();
  const rows = useMemo(() => {
    return wordEntries.map(([word, data]) => {
      const p = progress[word];
      const status = !p?.lastGrade ? "new" as const
        : p.intervalDays >= 14 && (p.lastGrade ?? 0) >= 4 ? "mastered" as const
        : p.dueAt <= now ? "due" as const
        : "learning" as const;
      return { word, cn: data.cn, ipa: data.ipa, status, ef: p?.easeFactor, interval: p?.intervalDays };
    });
  }, [progress]);

  return (
    <ScrollView style={browseStyles.list} contentContainerStyle={{ paddingBottom: 24 }}>
      {rows.map((r) => (
        <View key={r.word} style={browseStyles.row}>
          <View style={{ flex: 1 }}>
            <Text style={browseStyles.word}>{r.word}</Text>
            <Text style={browseStyles.cn}>{r.cn}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <StatusBadge status={r.status} />
            {r.ef ? <Text style={browseStyles.ef}>EF {r.ef.toFixed(1)}</Text> : null}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

function StatusBadge({ status }: { status: "new" | "due" | "learning" | "mastered" }) {
  const config = {
    new: { bg: "#e2e8f0", text: "#64748b", label: "新词" },
    due: { bg: "#fee2e2", text: "#dc2626", label: "待复习" },
    learning: { bg: "#fef9c3", text: "#a16207", label: "学习中" },
    mastered: { bg: "#ccfbf1", text: "#059669", label: "已掌握" },
  }[status];
  return <Text style={{ fontSize: 10, fontWeight: "700", color: config.text, backgroundColor: config.bg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, overflow: "hidden" }}>{config.label}</Text>;
}

// ──────── Stats Tab ────────

function StatsTab({ progress, t }: { progress: Record<string, CardProgress>; t: Props["t"] }) {
  const now = Date.now();
  const counts = getGradeCounts(progress, now);
  const total = wordEntries.length;
  const reviewed = Object.keys(progress).length;
  const newWords = total - reviewed;

  const bar = (label: string, count: number, color: string) => (
    <View style={statsStyles.barRow}>
      <Text style={statsStyles.barLabel}>{label}</Text>
      <View style={statsStyles.barTrack}>
        <View style={[statsStyles.barFill, { width: `${total > 0 ? (count / total) * 100 : 0}%`, backgroundColor: color }]} />
      </View>
      <Text style={statsStyles.barCount}>{count}</Text>
    </View>
  );

  return (
    <ScrollView style={statsStyles.container} contentContainerStyle={{ padding: 20, gap: 16 }}>
      {/* Summary cards */}
      <View style={statsStyles.summaryRow}>
        <StatCard label="总词数" value={total} color="#10212b" />
        <StatCard label="已学" value={reviewed} color="#0284c7" />
        <StatCard label="待复习" value={counts.due} color="#dc2626" />
        <StatCard label="已掌握" value={counts.mastered} color="#059669" />
      </View>

      <Text style={statsStyles.sectionTitle}>进度分布</Text>
      {bar("新词", newWords, "#94a3b8")}
      {bar("待复习", counts.due, "#dc2626")}
      {bar("学习中", counts.learning, "#a16207")}
      {bar("已掌握", counts.mastered, "#059669")}

      <Text style={statsStyles.sectionTitle}>记忆难度</Text>
      <Text style={{ fontSize: 13, color: "#64748b" }}>基于 SM-2 间隔重复算法，EF ≥ 2.5 为正常</Text>
    </ScrollView>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={[statsStyles.card, { borderColor: color }]}>
      <Text style={[statsStyles.cardValue, { color }]}>{value}</Text>
      <Text style={statsStyles.cardLabel}>{label}</Text>
    </View>
  );
}

// ──────── Styles ────────

const s = {
  container: { flex: 1, backgroundColor: "#f4efe6" },
  header: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  backButton: { paddingVertical: 4, paddingRight: 12 },
  backText: { fontSize: 16, color: "#c84f2d", fontWeight: "600" as const },
  headerTitle: { fontSize: 20, fontWeight: "800" as const, color: "#10212b" },
};

const tabBarStyles = {
  row: { flexDirection: "row" as const, marginHorizontal: 20, marginBottom: 8, backgroundColor: "#e2dcd3", borderRadius: 12, padding: 3 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: "center" as const },
  tabActive: { backgroundColor: "#ffffff" },
  tabText: { fontSize: 14, fontWeight: "600" as const, color: "#7a8b94" },
  tabTextActive: { color: "#10212b" },
};

const studyStyles = {
  container: { flex: 1 },
  progressBar: { flexDirection: "row" as const, alignItems: "center" as const, marginHorizontal: 20, marginBottom: 8, height: 24, backgroundColor: "#e2dcd3", borderRadius: 12, overflow: "hidden" as const },
  progressFill: { position: "absolute" as const, left: 0, top: 0, bottom: 0, backgroundColor: "#c84f2d", borderRadius: 12 },
  progressText: { flex: 1, textAlign: "center" as const, fontSize: 12, fontWeight: "700" as const, color: "#10212b", zIndex: 1 },
  cardArea: { flex: 1, paddingHorizontal: 20, paddingVertical: 8 },
  card: { flex: 1, backgroundColor: "#ffffff", borderRadius: 24, padding: 28, elevation: 3, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, alignItems: "center" as const, justifyContent: "center" as const },
  wordText: { fontSize: 32, fontWeight: "800" as const, color: "#10212b", textAlign: "center" as const },
  ipaText: { marginTop: 8, fontSize: 16, color: "#7a8b94", fontFamily: "monospace" as const },
  divider: { width: 40, height: 2, backgroundColor: "#e2e8f0", marginVertical: 16, borderRadius: 1 },
  cnText: { fontSize: 20, color: "#10212b", fontWeight: "600" as const, textAlign: "center" as const, lineHeight: 28 },
  speakBtn: { marginTop: 20, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 999, backgroundColor: "#f4efe6" },
  speakBtnText: { fontSize: 14, color: "#c84f2d", fontWeight: "600" as const },
  tapHint: { marginTop: 20, fontSize: 14, color: "#9aa8b2" },
  gradeRow: { flexDirection: "row" as const, gap: 8, paddingHorizontal: 20, paddingBottom: 24 },
  gradeBtn: { flex: 1, paddingVertical: 14, borderRadius: 16, alignItems: "center" as const, gap: 2 },
  gradeLabel: { fontSize: 14, fontWeight: "700" as const, color: "#10212b" },
  gradeSub: { fontSize: 11, color: "#64748b" },
  doneWrap: { flex: 1, alignItems: "center" as const, justifyContent: "center" as const, paddingHorizontal: 20, gap: 10 },
  doneCircle: { width: 64, height: 64, borderRadius: 32, alignItems: "center" as const, justifyContent: "center" as const },
  doneTitle: { fontSize: 20, fontWeight: "700" as const, color: "#10212b" },
  doneDesc: { fontSize: 14, color: "#7a8b94" },
  restartBtn: { marginTop: 8, backgroundColor: "#c84f2d", paddingHorizontal: 32, paddingVertical: 12, borderRadius: 999 },
  restartBtnText: { color: "#ffffff", fontSize: 15, fontWeight: "700" as const },
  backBtn: { paddingVertical: 8, paddingHorizontal: 20 },
  backBtnText: { color: "#c84f2d", fontSize: 14, fontWeight: "600" as const },
};

const browseStyles = {
  list: { flex: 1, paddingHorizontal: 16 },
  row: { flexDirection: "row" as const, alignItems: "center" as const, backgroundColor: "#ffffff", borderRadius: 12, padding: 14, marginBottom: 6, elevation: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2 },
  word: { fontSize: 15, fontWeight: "700" as const, color: "#10212b" },
  cn: { fontSize: 12, color: "#7a8b94", marginTop: 2 },
  ef: { fontSize: 10, color: "#9aa8b2", marginTop: 2 },
};

const statsStyles = {
  container: { flex: 1 },
  summaryRow: { flexDirection: "row" as const, gap: 8 },
  card: { flex: 1, backgroundColor: "#ffffff", borderRadius: 14, padding: 12, alignItems: "center" as const, borderWidth: 1.5, elevation: 1 },
  cardValue: { fontSize: 22, fontWeight: "800" as const },
  cardLabel: { fontSize: 11, color: "#7a8b94", marginTop: 2 },
  sectionTitle: { fontSize: 16, fontWeight: "700" as const, color: "#10212b", marginTop: 8 },
  barRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: 8 },
  barLabel: { width: 60, fontSize: 13, color: "#64748b" },
  barTrack: { flex: 1, height: 10, backgroundColor: "#e2e8f0", borderRadius: 999, overflow: "hidden" as const },
  barFill: { height: "100%" as const, borderRadius: 999 },
  barCount: { width: 36, textAlign: "right" as const, fontSize: 13, fontWeight: "600" as const, color: "#10212b" },
};
