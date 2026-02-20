"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { SHADOWING_MATERIALS, type ShadowingMaterial } from "../../data/shadowing-materials";
import { annotateWords, type WordAnnotation } from "../../data/word-dictionary";
import { Card, CardContent } from "../ui/Card";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import styles from "./ShadowingView.module.css";

type ViewMode = "materials" | "practice" | "news";

type CompareWord = {
  word: string;
  status: "correct" | "wrong" | "missing";
};

// Normalize text for comparison: lowercase, remove punctuation
function normalize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9'\s-]/g, "")
    .split(/\s+/)
    .filter(Boolean);
}

// Compare user's speech to original using word alignment
function compareWords(original: string, spoken: string): { words: CompareWord[]; accuracy: number } {
  const origWords = normalize(original);
  const spokenWords = normalize(spoken);
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

export function ShadowingView() {
  const [viewMode, setViewMode] = useState<ViewMode>("materials");
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

  // Word annotation toggles
  const [showWordTranslation, setShowWordTranslation] = useState(false);
  const [showIPA, setShowIPA] = useState(false);

  // Cancel speech and recognition on unmount or material change
  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
      recognitionRef.current?.abort();
    };
  }, [activeMaterial]);

  const speak = useCallback((text: string) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = speechRate;
    utterance.pitch = 1;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [speechRate]);

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

  const startRecording = useCallback((originalText: string) => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      setRecognizedText("浏览器不支持语音识别，请使用 Chrome 浏览器");
      return;
    }

    // Stop TTS if playing
    stopSpeaking();

    const recognition = new SpeechRecognitionAPI();
    recognition.lang = "en-US";
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
        const result = compareWords(originalText, transcript);
        setCompareResult(result);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      setIsRecording(false);
      if (event.error === "no-speech") {
        setRecognizedText("未检测到语音，请再试一次");
      } else if (event.error === "not-allowed") {
        setRecognizedText("麦克风权限被拒绝，请在浏览器设置中允许麦克风访问");
      } else {
        setRecognizedText(`识别出错: ${event.error}`);
      }
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [stopSpeaking]);

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const handleStart = useCallback((material: ShadowingMaterial) => {
    setActiveMaterial(material);
    setCurrentIndex(0);
    setAlwaysShowTranslation(false);
    setCompletedSet(new Set());
    clearRecognition();
    setViewMode("practice");
  }, [clearRecognition]);

  const handleNext = useCallback(() => {
    if (!activeMaterial) return;
    stopSpeaking();
    clearRecognition();
    setCompletedSet((prev) => new Set(prev).add(currentIndex));
    if (currentIndex < activeMaterial.sentences.length - 1) {
      setCurrentIndex((i) => i + 1);
    }
  }, [activeMaterial, currentIndex, stopSpeaking, clearRecognition]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      stopSpeaking();
      clearRecognition();
      setCurrentIndex((i) => i - 1);
    }
  }, [currentIndex, stopSpeaking, clearRecognition]);

  const handleBack = useCallback(() => {
    stopSpeaking();
    clearRecognition();
    setActiveMaterial(null);
    setCurrentIndex(0);
    setAlwaysShowTranslation(false);
    setCompletedSet(new Set());
    setViewMode("materials");
  }, [stopSpeaking, clearRecognition]);

  const loadNews = useCallback(async () => {
    setIsLoadingNews(true);
    try {
      const res = await fetch("/api/news");
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
        setNewsArticles(getDailyNews());
      }
    } catch {
      // Fallback to static news on error
      setNewsArticles(getDailyNews());
    }
    setIsLoadingNews(false);
  }, []);

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

  // Category filter for materials
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const categories = [
    { key: "all", label: "全部" },
    { key: "speech", label: "演讲" },
    { key: "drama", label: "美剧" },
    { key: "ted", label: "TED" },
  ];

  const filteredMaterials = categoryFilter === "all"
    ? SHADOWING_MATERIALS
    : SHADOWING_MATERIALS.filter((m) => m.category === categoryFilter);

  // --- Material Selection Screen ---
  if (viewMode === "materials" || (viewMode === "news" && !activeMaterial)) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h2>跟读练习</h2>
          <p className={styles.subtitle}>逐句跟读练习英语发音和语感，点击「🎙 开始跟读」录音并自动纠错</p>
        </div>

        {/* Tab switcher */}
        <div className={styles.tabBar}>
          <button
            className={`${styles.tab} ${viewMode === "materials" ? styles.tabActive : ""}`}
            onClick={() => setViewMode("materials")}
          >
            经典材料 ({SHADOWING_MATERIALS.length})
          </button>
          <button
            className={`${styles.tab} ${viewMode === "news" ? styles.tabActive : ""}`}
            onClick={() => { setViewMode("news"); if (newsArticles.length === 0) loadNews(); }}
          >
            每日新闻
          </button>
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
                    ? ` (${SHADOWING_MATERIALS.length})`
                    : ` (${SHADOWING_MATERIALS.filter((m) => m.category === cat.key).length})`
                  }
                </button>
              ))}
            </div>
            <div className={styles.materialGrid}>
              {filteredMaterials.map((material) => (
              <Card key={material.id} className={styles.materialCard}>
                <div className={styles.materialHeader}>
                  <h3>{material.title}</h3>
                  <span className={styles.titleCn}>{material.titleCn}</span>
                </div>
                <p className={styles.source}>{material.source}</p>
                <div className={styles.materialMeta}>
                  <Badge variant={getDifficultyVariant(material.difficulty)}>
                    {getDifficultyLabel(material.difficulty)}
                  </Badge>
                  <Badge variant="info">{getCategoryLabel(material.category)}</Badge>
                  <span className={styles.sentenceCount}>{material.sentences.length} 句</span>
                </div>
                <Button onClick={() => handleStart(material)} className={styles.startBtn}>
                  开始跟读
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
                {isLoadingNews ? "加载中..." : "刷新新闻"}
              </Button>
            </div>
            {newsArticles.length === 0 && !isLoadingNews && (
              <p className={styles.emptyNews}>点击「刷新新闻」获取今日英语新闻</p>
            )}
            <div className={styles.materialGrid}>
              {newsArticles.map((article) => (
                <Card key={article.id} className={styles.materialCard}>
                  <div className={styles.materialHeader}>
                    <h3>{article.title}</h3>
                    <span className={styles.titleCn}>{article.titleCn}</span>
                  </div>
                  <p className={styles.source}>{article.source} · {article.date}</p>
                  <div className={styles.materialMeta}>
                    <Badge variant={getDifficultyVariant(article.difficulty)}>
                      {getDifficultyLabel(article.difficulty)}
                    </Badge>
                    <Badge variant="info">新闻</Badge>
                    <span className={styles.sentenceCount}>{article.sentences.length} 句</span>
                  </div>
                  <Button onClick={() => handleStartNews(article)} className={styles.startBtn}>
                    开始跟读
                  </Button>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- Active Practice Screen ---
  if (!activeMaterial) return null;

  const sentence = activeMaterial.sentences[currentIndex];
  const progress = completedSet.size;
  const total = activeMaterial.sentences.length;

  return (
    <div className={styles.container}>
      <div className={styles.sessionHeader}>
        <Button variant="secondary" onClick={handleBack}>
          返回列表
        </Button>
        <div className={styles.sessionTitle}>
          <h2>{activeMaterial.titleCn}</h2>
          <span className={styles.progressLabel}>
            第 {currentIndex + 1} / {total} 句 · 已完成 {progress}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className={styles.progressBar}>
        <div
          className={styles.progressFill}
          style={{ width: `${(progress / total) * 100}%` }}
        />
      </div>

      {/* Controls bar */}
      <div className={styles.controlsBar}>
        <div className={styles.toggleGroup}>
          <label className={styles.toggleLabel}>
            <input
              type="checkbox"
              checked={alwaysShowTranslation}
              onChange={(e) => setAlwaysShowTranslation(e.target.checked)}
            />
            显示翻译
          </label>
          <label className={styles.toggleLabel}>
            <input
              type="checkbox"
              checked={showWordTranslation}
              onChange={(e) => setShowWordTranslation(e.target.checked)}
            />
            逐词释义
          </label>
          <label className={styles.toggleLabel}>
            <input
              type="checkbox"
              checked={showIPA}
              onChange={(e) => setShowIPA(e.target.checked)}
            />
            显示音标
          </label>
        </div>
        <div className={styles.speedControl}>
          <span>语速：</span>
          <button
            className={`${styles.speedBtn} ${speechRate === 0.6 ? styles.speedActive : ""}`}
            onClick={() => setSpeechRate(0.6)}
          >
            慢
          </button>
          <button
            className={`${styles.speedBtn} ${speechRate === 0.85 ? styles.speedActive : ""}`}
            onClick={() => setSpeechRate(0.85)}
          >
            中
          </button>
          <button
            className={`${styles.speedBtn} ${speechRate === 1.0 ? styles.speedActive : ""}`}
            onClick={() => setSpeechRate(1.0)}
          >
            快
          </button>
        </div>
      </div>

      {/* Sentence card */}
      <Card className={styles.sentenceCard}>
        <CardContent>
          <div className={styles.sentenceTop}>
            <div className={styles.sentenceNumber}>#{sentence.id}</div>
            <button
              className={`${styles.speakBtn} ${isSpeaking ? styles.speakBtnActive : ""}`}
              onClick={() => isSpeaking ? stopSpeaking() : speak(sentence.text)}
              title="朗读"
            >
              {isSpeaking ? "⏹ 停止" : "🔊 朗读"}
            </button>
          </div>

          {/* Sentence text - plain or annotated */}
          {!showWordTranslation && !showIPA ? (
            <p className={styles.sentenceText}>{sentence.text}</p>
          ) : (
            <div className={styles.annotatedSentence}>
              {annotateWords(sentence.text).map((w, i) => (
                <span key={i} className={styles.annotatedWord}>
                  <span className={styles.wordMain}>{w.word}</span>
                  {showIPA && w.ipa && (
                    <span className={styles.wordIPA}>{w.ipa}</span>
                  )}
                  {showWordTranslation && w.cn && (
                    <span className={styles.wordCN}>{w.cn}</span>
                  )}
                </span>
              ))}
            </div>
          )}

          {/* Recording section */}
          <div className={styles.recordSection}>
            <div className={styles.recordActions}>
              {!isRecording ? (
                <button
                  className={styles.recordBtn}
                  onClick={() => startRecording(sentence.text)}
                  disabled={isSpeaking}
                >
                  🎙 开始跟读
                </button>
              ) : (
                <button
                  className={`${styles.recordBtn} ${styles.recordBtnActive}`}
                  onClick={stopRecording}
                >
                  ⏹ 停止录音
                </button>
              )}
              {isRecording && (
                <span className={styles.recordingIndicator}>录音中...</span>
              )}
            </div>

            {/* Show recognized text */}
            {recognizedText && !compareResult && (
              <div className={styles.recognizedText}>
                <span className={styles.recognizedLabel}>识别中：</span>
                {recognizedText}
              </div>
            )}

            {/* Show comparison result */}
            {compareResult && (
              <div className={styles.compareResult}>
                <div className={styles.accuracyBar}>
                  <span className={styles.accuracyLabel}>
                    准确率：{compareResult.accuracy}%
                  </span>
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
                      className={
                        w.status === "correct" ? styles.wordCorrect :
                        w.status === "wrong" ? styles.wordWrong :
                        styles.wordMissing
                      }
                      title={
                        w.status === "correct" ? "正确" :
                        w.status === "wrong" ? "多余/错误" :
                        "漏读"
                      }
                    >
                      {w.word}
                    </span>
                  ))}
                </div>
                <div className={styles.compareHint}>
                  <span className={styles.wordCorrect}>绿色=正确</span>
                  <span className={styles.wordWrong}>红色=错误</span>
                  <span className={styles.wordMissing}>灰色=漏读</span>
                </div>
                <button
                  className={styles.retryBtn}
                  onClick={() => startRecording(sentence.text)}
                >
                  🎙 再读一次
                </button>
              </div>
            )}
          </div>

          {sentence.translation && alwaysShowTranslation && (
            <p className={styles.translation}>{sentence.translation}</p>
          )}

          {sentence.translation && !alwaysShowTranslation && (
            <details className={styles.translationDetails}>
              <summary>点击查看翻译</summary>
              <p className={styles.translation}>{sentence.translation}</p>
            </details>
          )}

          {!sentence.translation && (
            <p className={styles.noTranslation}>实时新闻暂无翻译，可使用「逐词释义」辅助理解</p>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className={styles.navigation}>
        <Button
          variant="secondary"
          onClick={handlePrev}
          disabled={currentIndex === 0}
        >
          上一句
        </Button>

        <Button
          variant="secondary"
          onClick={() => speak(sentence.text)}
          disabled={isSpeaking}
        >
          🔊 再听一遍
        </Button>

        {currentIndex < total - 1 ? (
          <Button onClick={handleNext}>
            下一句
          </Button>
        ) : (
          <Button onClick={handleBack}>
            练习完成！
          </Button>
        )}
      </div>

      {/* Tips */}
      <div className={styles.tips}>
        <h4>跟读方法</h4>
        <ol>
          <li><strong>第一步 听 →</strong> 点击「🔊 朗读」听标准发音</li>
          <li><strong>第二步 读 →</strong> 点击「🎙 开始跟读」对着麦克风读出来</li>
          <li><strong>第三步 比 →</strong> 查看对比结果，绿色=正确，红色=错误，灰色=漏读</li>
          <li><strong>第四步 练 →</strong> 反复练习直到准确率达到 80% 以上</li>
        </ol>
      </div>
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

function getDifficultyVariant(d: number): "success" | "warning" | "error" {
  return d === 1 ? "success" : d === 2 ? "warning" : "error";
}

function getDifficultyLabel(d: number): string {
  return d === 1 ? "初级" : d === 2 ? "中级" : "高级";
}

function getCategoryLabel(c: string): string {
  const m: Record<string, string> = { speech: "演讲", drama: "美剧", ted: "TED" };
  return m[c] || c;
}
