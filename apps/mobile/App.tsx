import { createT, type UiLang } from "@toeicpass/app-i18n";
import { defineShadowingMaterials, getShadowingMaterialsByLanguage, type ShadowingMaterial } from "@toeicpass/shadowing-content";
import { useCallback, useMemo, useState } from "react";
import {
  MobileSafeAreaProvider,
  MobileScreenShell,
  MobileScrollPane,
  MobileStatusBar,
} from "./src/platform/mobile-safe-shell";
import { HomeScreen } from "./src/screens/home-screen";
import { ShadowingScreen } from "./src/screens/shadowing-screen";
import { VocabScreen } from "./src/screens/vocab-screen";
import { YouTubeScreen } from "./src/screens/youtube-screen";
import { useShadowingTraining } from "./src/shadowing/use-shadowing-training";
import { fetchYoutubeSubtitles } from "./src/services/youtube-subtitles";

type ActiveScreen = "home" | "shadowing" | "vocab" | "youtube";

const YOUTUBE_MATERIALS: ShadowingMaterial[] = defineShadowingMaterials([
  // ====== TED / Speech (EN) ======
  {
    id: "yt-sinek-golden-circle",
    title: "Simon Sinek - Start With Why (TED)",
    titleCn: "西蒙·斯涅克：黄金圈法则",
    source: "TED@Pudget Sound",
    category: "ted",
    difficulty: 2,
    youtubeVideoId: "u4ZoJKF_VuA",
    sentences: [
      { id: 1, text: "How do you explain when things don't go as we assume?", translation: "当事情不按我们的假设发展时，你如何解释？" },
      { id: 2, text: "For example, why is Apple so innovative?", translation: "例如，为什么苹果如此创新？" },
      { id: 3, text: "They have the same access to the same talent, the same agencies, the same consultants, the same media.", translation: "他们拥有相同的人才、代理商、顾问和媒体渠道。" },
      { id: 4, text: "Then why is it that they seem to have something different?", translation: "那为什么他们看起来有些不同呢？" },
      { id: 5, text: "I call it the golden circle.", translation: "我称之为黄金圈。" },
      { id: 6, text: "Every single organization on the planet knows what they do.", translation: "这个星球上的每个组织都知道他们做什么。" },
      { id: 7, text: "But very few know why they do what they do.", translation: "但很少人知道他们为什么这样做。" },
      { id: 8, text: "People don't buy what you do; they buy why you do it.", translation: "人们买的不是你做什么，而是你为什么这样做。" },
      { id: 9, text: "There are leaders and there are those who lead.", translation: "有领导者，也有引领者。" },
      { id: 10, text: "We follow those who lead, not because we have to, but because we want to.", translation: "我们追随引领者，不是因为我们必须，而是因为我们愿意。" },
    ],
  },
  {
    id: "yt-jobs-stanford",
    title: "Steve Jobs - Stay Hungry Stay Foolish",
    titleCn: "乔布斯：求知若饥 虚怀若愚",
    source: "Stanford Commencement 2005",
    category: "speech",
    difficulty: 2,
    youtubeVideoId: "UF8uR6Z6KLc",
    sentences: [
      { id: 1, text: "I am honored to be with you today for your commencement.", translation: "今天能参加你们的毕业典礼，我深感荣幸。" },
      { id: 2, text: "Truth be told, I never graduated from college.", translation: "说实话，我从未大学毕业。" },
      { id: 3, text: "Today I want to tell you three stories from my life. That's it. No big deal. Just three stories.", translation: "今天我想讲三个人生故事。就这样，没什么大不了的。" },
      { id: 4, text: "The first story is about connecting the dots.", translation: "第一个故事是关于串联人生点滴。" },
      { id: 5, text: "You can't connect the dots looking forward; you can only connect them looking backward.", translation: "你无法向前串联点滴，只能回首时串联。" },
      { id: 6, text: "So you have to trust that the dots will somehow connect in your future.", translation: "所以你必须相信，这些点滴未来会以某种方式串联。" },
      { id: 7, text: "Your work is going to fill a large part of your life.", translation: "工作将占据你生活的大部分。" },
      { id: 8, text: "The only way to do great work is to love what you do.", translation: "成就伟大的唯一途径是热爱你所做的事。" },
      { id: 9, text: "Stay Hungry. Stay Foolish.", translation: "求知若饥，虚怀若愚。" },
    ],
  },
  {
    id: "yt-obama-yes-we-can",
    title: "Barack Obama - Yes We Can",
    titleCn: "奥巴马：是的，我们能",
    source: "Election Night 2008",
    category: "speech",
    difficulty: 2,
    youtubeVideoId: "j66XH1x7is0",
    sentences: [
      { id: 1, text: "If there is anyone out there who still doubts that America is a place where all things are possible, tonight is your answer.", translation: "若还有人怀疑美国是一切皆有可能的地方，今晚便是答案。" },
      { id: 2, text: "It's been a long time coming, but tonight, change has come to America.", translation: "这一刻等了很久，但今晚，变革已降临美国。" },
      { id: 3, text: "I just received an extraordinarily gracious call from Senator McCain.", translation: "我刚接到麦凯恩参议员非常亲切的电话。" },
      { id: 4, text: "I want to thank my campaign manager David Plouffe, who was the unsung hero of this campaign.", translation: "我要感谢我的竞选经理大卫·普洛夫，他是这场竞选的无名英雄。" },
      { id: 5, text: "The road ahead will be long. Our climb will be steep.", translation: "前方的路还很长，攀登会很陡峭。" },
      { id: 6, text: "We may not get there in one year or even one term, but America, I have never been more hopeful than I am tonight.", translation: "我们可能无法在一年甚至一个任期内到达，但美国，我从未像今晚这样充满希望。" },
    ],
  },
  // ====== Drama (EN) ======
  {
    id: "yt-friends-ross",
    title: "Friends - Ross at the Coffee Shop",
    titleCn: "老友记 - 咖啡厅对话",
    source: "Friends S1E1",
    category: "drama",
    difficulty: 1,
    youtubeVideoId: "6s8YJ97UZcg",
    sentences: [
      { id: 1, text: "So you wanna tell us how you ended up living in a house with a bunch of guys?", translation: "所以你想告诉我们你是怎么和一帮男人住在一起的？" },
      { id: 2, text: "Welcome to the real world! It sucks, but you're gonna love it!", translation: "欢迎来到现实世界！它很糟糕，但你会喜欢的！" },
      { id: 3, text: "I don't even have a 'plan'! I just have 'things'!", translation: "我甚至没有一个计划！我只有一堆事情！" },
      { id: 4, text: "It's like all of my life everyone has always told me 'You're so special'!", translation: "好像我一生中所有人都告诉我'你太特别了'！" },
      { id: 5, text: "I'm not so good with the advice, can I interest you in a sarcastic comment?", translation: "我不太擅长给建议，给你来点讽刺的评论如何？" },
    ],
  },
  // ====== Japanese materials with youtubeVideoId ======
  {
    id: "yt-ja-easy-japanese",
    title: "Easy Japanese Podcast - Daily Conversation",
    titleCn: "Easy Japanese 播客 - 日常对话",
    source: "Easy Japanese YouTube",
    category: "drama",
    difficulty: 2,
    youtubeVideoId: "0jmdQBruTGc",
    sentences: [
      { id: 1, text: "はい、皆さんこんばんは。", translation: "大家晚上好。" },
      { id: 2, text: "今日も元気ですか。", translation: "今天也有精神吗？" },
      { id: 3, text: "私は毎日日本語を勉強しています。", translation: "我每天都在学习日语。" },
      { id: 4, text: "ゆっくりでもいいから、続けることが大切です。", translation: "慢一点也没关系，坚持最重要。" },
      { id: 5, text: "間違えても気にしないでください。", translation: "说错了也没关系。" },
      { id: 6, text: "一緒に頑張りましょう。", translation: "一起加油吧。" },
      { id: 7, text: "今日はこれで終わります。ありがとうございました。", translation: "今天就到这里。谢谢大家。" },
    ],
  },
]);

export default function App() {
  const [uiLang, setUiLang] = useState<UiLang>("zh");
  const [targetLang, setTargetLang] = useState<"en" | "ja">("en");
  const [activeScreen, setActiveScreen] = useState<ActiveScreen>("home");
  const [importedMaterials, setImportedMaterials] = useState<ShadowingMaterial[]>([]);

  const t = useMemo(() => createT(uiLang), [uiLang]);

  const ttsMaterials = useMemo(
    () => getShadowingMaterialsByLanguage(targetLang).slice(0, 8),
    [targetLang],
  );

  const allMaterials = useMemo(
    () => {
      if (targetLang === "ja") {
        return [...importedMaterials, ...YOUTUBE_MATERIALS.filter(m => m.id.startsWith("yt-ja-"))];
      }
      return [...importedMaterials, ...ttsMaterials, ...YOUTUBE_MATERIALS.filter(m => !m.id.startsWith("yt-ja-"))];
    },
    [targetLang, ttsMaterials, importedMaterials],
  );

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
              onPlayRecording={() => void shadowing.handlePlayRecording()}
              onClearRecording={() => void shadowing.clearRecording()}
            />
          )}
        </MobileScrollPane>
      </MobileScreenShell>
    </MobileSafeAreaProvider>
  );
}
