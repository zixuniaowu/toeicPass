"use client";

import { useState, useEffect, useCallback, useRef, lazy, Suspense } from "react";
import type { Locale, ViewTab, NextTask } from "../types";
import { TABS } from "../types";
import { useAuth } from "../hooks/useAuth";
import { useSession } from "../hooks/useSession";
import { useMistakes } from "../hooks/useMistakes";
import { useVocab } from "../hooks/useVocab";
import { useAnalytics } from "../hooks/useAnalytics";
import { useLearningCommandRunner } from "../hooks/useLearningCommandRunner";
import { useSubscription } from "../hooks/useSubscription";
import { useLangConfig } from "../hooks/useLangConfig";
import { createT } from "../lib/i18n";
import { AppShell } from "./layout/AppShell";
import { CardSkeleton } from "./ui/Skeleton";
import { LoginView } from "./auth/LoginView";
import { ViewErrorBoundary } from "./error/ViewErrorBoundary";
import { ToastContainer } from "./ui/Toast";
import { useToast } from "../hooks/useToast";
import { AdBanner } from "./ads/AdBanner";
import { InterstitialAd } from "./ads/InterstitialAd";
import { NativeFeedAd } from "./ads/NativeFeedAd";
import * as api from "../lib/api";

const MistakesView = lazy(() => import("./mistakes/MistakesView").then(m => ({ default: m.MistakesView })));
const VocabView = lazy(() => import("./vocab/VocabView").then(m => ({ default: m.VocabView })));
const ShadowingView = lazy(() => import("./shadowing/ShadowingView").then(m => ({ default: m.ShadowingView })));
const MockExamView = lazy(() => import("./mock/MockExamView").then(m => ({ default: m.MockExamView })));

const SettingsView = lazy(() => import("./settings/SettingsView").then(m => ({ default: m.SettingsView })));
const PracticeView = lazy(() => import("./practice/PracticeView").then(m => ({ default: m.PracticeView })));
const SubscriptionView = lazy(() => import("./subscription/SubscriptionView").then(m => ({ default: m.SubscriptionView })));
const AdManagerView = lazy(() => import("./admin/AdManagerView").then(m => ({ default: m.AdManagerView })));
const ConversationView = lazy(() => import("./conversation/ConversationView").then(m => ({ default: m.ConversationView })));

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
const WECHAT_APP_ID = process.env.NEXT_PUBLIC_WECHAT_APP_ID ?? "";
const LINE_CHANNEL_ID = process.env.NEXT_PUBLIC_LINE_CHANNEL_ID ?? "";


function ViewFallback() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "16px 0" }}>
      <CardSkeleton />
      <CardSkeleton />
    </div>
  );
}

const NAV_VIEWS = new Set<ViewTab>(TABS.map(t => t.key));
const PRACTICE_VIEWS = new Set<ViewTab>(["listening", "grammar", "textcompletion", "reading"]);
const ALL_VIEWS = new Set<ViewTab>([...NAV_VIEWS, ...PRACTICE_VIEWS]);

const COPY = {
  zh: {
    jumpMockPart: (partNo: number) => `已切换到模拟考试，优先复练 Part ${partNo}。`,
    jumpMockBatch: (count: number) => `已切换到模拟考试，建议优先复练 ${count} 道错题。`,
    jumpMockSingle: "已切换到模拟考试，建议优先复练这道错题。",
    mistakeBoundaryTitle: "错题库加载失败",
    mistakeBoundaryHint: "错题数据存在异常字段。你可以先点「刷新错题」，系统会尽量自动修复并继续加载。",
    submitDone: "提交完成！",
    registerSuccess: "注册成功！",
    goalSaved: "目标已保存！",
    goalFailed: "目标保存失败，请重试。",
  },
  ja: {
    jumpMockPart: (partNo: number) => `模擬試験に切り替えました。Part ${partNo} を優先して復習してください。`,
    jumpMockBatch: (count: number) => `模擬試験に切り替えました。まずは ${count} 問のミスを復習しましょう。`,
    jumpMockSingle: "模擬試験に切り替えました。このミス問題を優先して復習しましょう。",
    mistakeBoundaryTitle: "ミスノートの読み込みに失敗しました",
    mistakeBoundaryHint: "データに不整合がある可能性があります。「ミスを更新」を押して再読み込みしてください。",
    submitDone: "提出完了！",
    registerSuccess: "登録に成功しました！",
    goalSaved: "目標を保存しました！",
    goalFailed: "目標の保存に失敗しました。もう一度お試しください。",
  },
  en: {
    jumpMockPart: (partNo: number) => `Switched to mock exam. Focus on Part ${partNo} first.`,
    jumpMockBatch: (count: number) => `Switched to mock exam. Review these ${count} mistakes first.`,
    jumpMockSingle: "Switched to mock exam. Focus on this mistake first.",
    mistakeBoundaryTitle: "Failed to load mistake library",
    mistakeBoundaryHint: "Data may be inconsistent. Click 'Refresh' to reload.",
    submitDone: "Submitted successfully!",
    registerSuccess: "Registration successful!",
    goalSaved: "Goal saved!",
    goalFailed: "Failed to save goal. Please try again.",
  },
} as const;

export type ThemeMode = "light" | "dark" | "auto";

export function ClientHome() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const [activeView, setActiveView] = useState<ViewTab>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("lb.view") as ViewTab | null;
      if (saved && ["listening", "grammar", "textcompletion", "reading", "shadowing", "mock", "mistakes", "vocab", "settings", "subscription"].includes(saved)) {
        return saved;
      }
    }
    return "shadowing";
  });

  // New 3-dimensional language configuration
  const { langConfig, locale, setUiLang, setNativeLang, setTargetLang } = useLangConfig();
  const t = createT(langConfig.uiLang);

  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("lb.theme") as ThemeMode) || "auto";
    }
    return "auto";
  });

  // Goal settings state for SettingsView
  const [goalScore, setGoalScore] = useState(800);
  const [goalDate, setGoalDate] = useState("");
  const [currentScoreInput, setCurrentScoreInput] = useState(400);
  // Practice view state
  const [practicePartFilter, setPracticePartFilter] = useState("all");
  // Interstitial ad state: show after session submit for free users
  const [showInterstitial, setShowInterstitial] = useState(false);

  const auth = useAuth(locale);
  const toast = useToast();
  const session = useSession(auth.ensureSession, auth.getRequestOptions, auth.setMessage, locale);
  const mistakes = useMistakes(auth.ensureSession, auth.getRequestOptions, auth.setMessage, locale);
  const vocab = useVocab(auth.ensureSession, auth.getRequestOptions, auth.setMessage, locale);
  const analytics = useAnalytics(auth.getRequestOptions);
  const subscription = useSubscription(auth.getRequestOptions, auth.isLoggedIn);


  // Bridge auth.message changes into toast notifications
  const lastMessageRef = useRef("");
  useEffect(() => {
    if (auth.message && auth.message !== lastMessageRef.current) {
      lastMessageRef.current = auth.message;
      const variant = auth.message.includes("\u5931\u8d25") || auth.message.includes("\u5931\u6557") || auth.message.includes("error") || auth.message.includes("Error")
        ? "error" as const
        : auth.message.includes("\u6210\u529f") || auth.message.includes("\u5b8c\u4e86") || auth.message.includes("\u5b8c\u6210")
          ? "success" as const
          : "info" as const;
      toast.show(auth.message, variant);
    }
  }, [auth.message, toast]);

  const runner = useLearningCommandRunner({
    locale,
    requiresDiagnostic: false,
    setActiveView,
    setMessage: auth.setMessage,
    startSession: session.startSession,
    loadMistakes: mistakes.loadMistakes,
    loadVocabularyCards: vocab.loadCards,
  });

  // Persist locale (backward compat: keep lb.locale in sync for legacy code)
  useEffect(() => {
    localStorage.setItem("lb.locale", locale);
  }, [locale]);

  // Persist active view
  useEffect(() => {
    localStorage.setItem("lb.view", activeView);
  }, [activeView]);

  // Apply and persist theme
  useEffect(() => {
    localStorage.setItem("lb.theme", theme);
    const root = document.documentElement;
    if (theme === "dark") {
      root.setAttribute("data-theme", "dark");
    } else if (theme === "light") {
      root.removeAttribute("data-theme");
    } else {
      // auto: follow system preference
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (prefersDark) {
        root.setAttribute("data-theme", "dark");
      } else {
        root.removeAttribute("data-theme");
      }
    }
  }, [theme]);

  // Listen for system theme changes when in auto mode
  useEffect(() => {
    if (theme !== "auto") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      document.documentElement.setAttribute("data-theme", e.matches ? "dark" : "");
      if (!e.matches) document.documentElement.removeAttribute("data-theme");
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  // Warn before closing tab during active session
  useEffect(() => {
    if (!session.activeSession || session.sessionResult) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [session.activeSession, session.sessionResult]);

  // Auto-load analytics on login
  useEffect(() => {
    if (auth.isLoggedIn) {
      void analytics.refreshAll(auth.token);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.isLoggedIn]);

  // Sync goal settings from analytics
  useEffect(() => {
    if (analytics.analytics?.goal) {
      const g = analytics.analytics.goal;
      if (typeof g.targetScore === "number") setGoalScore(g.targetScore);
      if (g.targetExamDate) setGoalDate(g.targetExamDate);
      if (typeof g.baselineScore === "number") setCurrentScoreInput(g.baselineScore);
    }
  }, [analytics.analytics?.goal]);

  const handleViewChange = useCallback((newView: ViewTab) => {
    if (!ALL_VIEWS.has(newView)) return;
    // Confirm before leaving active exam/practice with unsaved progress
    if (activeView === "mock" && newView !== "mock" && session.activeSession && !session.sessionResult) {
      if (!window.confirm(t("home.confirmLeaveExam"))) return;
      session.resetSession();
    } else if (activeView === "mock" && newView !== "mock") {
      session.resetSession();
    }
    if (PRACTICE_VIEWS.has(activeView) && !PRACTICE_VIEWS.has(newView) && session.activeSession) {
      if (!window.confirm(t("home.confirmLeavePractice"))) return;
      session.resetSession();
    } else if (PRACTICE_VIEWS.has(activeView) && !PRACTICE_VIEWS.has(newView)) {
      session.resetSession();
    }
    setActiveView(newView);
  }, [activeView, session, t]);

  const handleStartMock = useCallback(async (message?: string) => {
    const ok = await runner.runAction("mock:start");
    if (!ok) return;
    if (message) auth.setMessage(message);
  }, [runner, auth]);

  const handleSubmitSession = useCallback(async (options?: { allowPartial?: boolean }) => {
    const report = await session.submitSession(options);
    if (!report) return;
    // Stay on mock view to show results + interactive review; load mistakes in background
    await mistakes.loadMistakes();
    auth.setMessage(COPY[locale].submitDone);
    if (typeof report.scoreTotal === "number") {
      analytics.updateLatestScore(report.scoreTotal);
    }
    // Show interstitial ad for free users after mock submit
    if (subscription.showAds) setShowInterstitial(true);
  }, [session, mistakes, auth, locale, analytics, subscription.showAds]);

  const handleLogin = useCallback(async () => {
    const token = await auth.login();
    if (!token) return;
    setActiveView("shadowing");
  }, [auth]);

  const handleGoogleLogin = useCallback(() => {
    if (!GOOGLE_CLIENT_ID) {
      const msg = locale === "ja"
        ? "Google ログインを利用するには NEXT_PUBLIC_GOOGLE_CLIENT_ID を設定してください。"
        : "使用 Google 登录需要配置 NEXT_PUBLIC_GOOGLE_CLIENT_ID 环境变量。";
      alert(msg);
      return;
    }
    const redirectUri = `${window.location.origin}/`;
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      access_type: "offline",
      prompt: "select_account",
    });
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }, [locale]);

  const handleWeChatLogin = useCallback(() => {
    if (!WECHAT_APP_ID) {
      const msg = locale === "ja"
        ? "WeChat ログインを利用するには NEXT_PUBLIC_WECHAT_APP_ID を設定してください。"
        : "使用微信登录需要配置 NEXT_PUBLIC_WECHAT_APP_ID 环境变量。";
      alert(msg);
      return;
    }
    const redirectUri = encodeURIComponent(`${window.location.origin}/`);
    window.location.href = `https://open.weixin.qq.com/connect/qrconnect?appid=${WECHAT_APP_ID}&redirect_uri=${redirectUri}&response_type=code&scope=snsapi_login&state=wechat#wechat_redirect`;
  }, [locale]);

  const handleLineLogin = useCallback(() => {
    if (!LINE_CHANNEL_ID) {
      const msg = locale === "ja"
        ? "LINE ログインを利用するには NEXT_PUBLIC_LINE_CHANNEL_ID を設定してください。"
        : "使用 LINE 登录需要配置 NEXT_PUBLIC_LINE_CHANNEL_ID 环境变量。";
      alert(msg);
      return;
    }
    const redirectUri = encodeURIComponent(`${window.location.origin}/`);
    const state = crypto.randomUUID();
    window.location.href = `https://access.line.me/oauth2/v2.1/authorize?response_type=code&client_id=${LINE_CHANNEL_ID}&redirect_uri=${redirectUri}&state=${state}&scope=profile%20openid%20email`;
  }, [locale]);

  // Handle OAuth redirect callback (Google, WeChat, LINE)
  useEffect(() => {
    if (auth.isLoggedIn) return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (!code) return;

    // Determine provider from state or URL context
    const state = params.get("state");
    let provider = "google";
    if (state === "wechat" || params.has("appid")) {
      provider = "wechat";
    } else if (state && state !== "wechat") {
      // LINE sends a random state we generated
      provider = "line";
    }

    // Clean up URL
    window.history.replaceState({}, "", window.location.pathname);
    const redirectUri = `${window.location.origin}/`;
    void (async () => {
      const token = await auth.googleLogin(code, redirectUri, provider);
      if (token) setActiveView("shadowing");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRegisterAndLogin = useCallback(async () => {
    const registered = await auth.register();
    if (!registered) return;
    const token = await auth.login(true);
    if (!token) return;
    auth.setMessage(COPY[locale].registerSuccess);
    setActiveView("shadowing");
  }, [auth, locale]);

  const handleLogout = useCallback(() => {
    session.resetSession();
    setActiveView("shadowing");
    auth.logout();
  }, [auth, session]);

  const handleMistakePractice = useCallback(async (partNo: number) => {
    await handleStartMock(COPY[locale].jumpMockPart(partNo));
  }, [handleStartMock, locale]);

  const handlePracticeFilteredMistakes = useCallback(async (payload: { questionIds: string[]; partNo?: number }) => {
    const count = payload.questionIds.length;
    await handleStartMock(COPY[locale].jumpMockBatch(count));
  }, [handleStartMock, locale]);

  const handlePracticeSingleMistake = useCallback(async (_questionId: string, _partNo?: number) => {
    await handleStartMock(COPY[locale].jumpMockSingle);
  }, [handleStartMock, locale]);

  const handleSaveGoal = useCallback(async () => {
    const opts = auth.getRequestOptions();
    if (!opts.token) return;
    const result = await api.createGoal(goalScore, goalDate, currentScoreInput, opts);
    if (result.success) {
      auth.setMessage(COPY[locale].goalSaved);
      void analytics.refreshAll(auth.token);
    } else {
      auth.setMessage(COPY[locale].goalFailed);
    }
  }, [auth, goalScore, goalDate, currentScoreInput, locale, analytics]);

  const handleApplyNinetyDayGoal = useCallback(() => {
    setGoalScore(800);
    const d = new Date();
    d.setDate(d.getDate() + 90);
    setGoalDate(d.toISOString().slice(0, 10));
  }, []);

  const practiceFiltersForView = useCallback((view: ViewTab): { partNo?: number; partGroup?: "listening" | "reading" } => {
    switch (view) {
      case "listening": return { partGroup: "listening" };
      case "grammar": return { partNo: 5 };
      case "textcompletion": return { partNo: 6 };
      case "reading": return { partNo: 7 };
      default: return {};
    }
  }, []);

  const handleStartPractice = useCallback(async () => {
    const filters = practiceFiltersForView(activeView);
    if (practicePartFilter !== "all") {
      filters.partNo = Number(practicePartFilter);
      delete filters.partGroup;
    }
    await session.startSession("practice", filters);
  }, [activeView, practicePartFilter, session, practiceFiltersForView]);

  const handleSubmitPractice = useCallback(async () => {
    const report = await session.submitSession();
    if (!report) return;
    await mistakes.loadMistakes();
    toast.show(COPY[locale].submitDone, "success");
    if (typeof report.scoreTotal === "number") {
      analytics.updateLatestScore(report.scoreTotal);
    }
    // Show interstitial ad for free users after practice submit
    if (subscription.showAds) setShowInterstitial(true);
  }, [session, mistakes, toast, locale, analytics, subscription.showAds]);

  const handleRunTask = useCallback(async (task: NextTask): Promise<boolean> => {
    return runner.runAction(task.action);
  }, [runner]);

  useEffect(() => {
    if (activeView === "mistakes") {
      void mistakes.loadMistakes();
    }
    if (activeView === "vocab") {
      void vocab.loadCards();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView, mistakes.loadMistakes, vocab.loadCards]);

  const renderView = () => {
    switch (activeView) {
      case "settings":
        return (
          <SettingsView
            credentials={auth.credentials}
            currentScore={currentScoreInput}
            goalScore={goalScore}
            goalDate={goalDate}
            theme={theme}
            uiLang={langConfig.uiLang}
            nativeLang={langConfig.nativeLang}
            targetLang={langConfig.targetLang}
            onThemeChange={setTheme}
            onUiLangChange={setUiLang}
            onNativeLangChange={setNativeLang}
            onTargetLangChange={setTargetLang}
            onCredentialsChange={auth.updateCredentials}
            onCurrentScoreChange={setCurrentScoreInput}
            onGoalScoreChange={setGoalScore}
            onGoalDateChange={setGoalDate}
            onRegister={() => void auth.register()}
            onLogin={() => void auth.login()}
            onApplyNinetyDayGoal={handleApplyNinetyDayGoal}
            onSaveGoal={() => void handleSaveGoal()}
          />
        );
      case "subscription":
        return (
          <SubscriptionView
            locale={locale}
            token={auth.token}
            tenantCode={auth.credentials.tenantCode}
            onSubscribed={() => void subscription.refreshProfile()}
          />
        );
      case "admin":
        return (
          <AdManagerView
            locale={locale}
            token={auth.token}
            tenantCode={auth.credentials.tenantCode}
          />
        );
      case "conversation":
        return (
          <ConversationView
            locale={locale}
            token={auth.token}
            tenantCode={auth.credentials.tenantCode}
          />
        );
      case "shadowing":
        return <ShadowingView locale={locale} uiLang={langConfig.uiLang} />;
        return (
          <ViewErrorBoundary
            locale={locale}
            title={COPY[locale].mistakeBoundaryTitle}
            hint={COPY[locale].mistakeBoundaryHint}
          >
            <MistakesView
              locale={locale}
              mistakeLibrary={mistakes.mistakeLibrary}
              filteredMistakes={mistakes.filteredMistakes}
              isLoading={mistakes.isLoading}
              partFilter={mistakes.partFilter}
              searchQuery={mistakes.searchQuery}
              noteDraftMap={mistakes.noteDraftMap}
              rootCauseMap={mistakes.rootCauseMap}
              savingId={mistakes.savingId}
              onPartFilterChange={mistakes.setPartFilter}
              onSearchQueryChange={mistakes.setSearchQuery}
              onNoteDraftChange={mistakes.updateNoteDraft}
              onRootCauseChange={mistakes.updateRootCause}
              onSaveNote={mistakes.saveNote}
              onRefresh={() => mistakes.loadMistakes()}
              onPractice={handleMistakePractice}
              onPracticeFiltered={handlePracticeFilteredMistakes}
              onPracticeQuestion={handlePracticeSingleMistake}
              showAds={subscription.showAds}
              token={auth.token}
              tenantCode={auth.credentials.tenantCode}
            />
          </ViewErrorBoundary>
        );
      case "vocab":
        return (
          <VocabView
            locale={locale}
            cards={vocab.cards}
            summary={vocab.summary}
            isLoading={vocab.isLoading}
            dueCards={vocab.dueCards}
            activeCard={vocab.activeCard}
            revealMap={vocab.revealMap}
            gradingCardId={vocab.gradingCardId}
            onRefresh={() => vocab.loadCards()}
            onToggleReveal={vocab.toggleReveal}
            onGrade={vocab.gradeCard}
            showAds={subscription.showAds}
            token={auth.token}
            tenantCode={auth.credentials.tenantCode}
          />
        );
      case "mock":
        return (
          <MockExamView
            locale={locale}
            activeSession={session.activeSession}
            currentQuestion={session.currentQuestion}
            currentQuestionIndex={session.currentQuestionIndex}
            totalQuestions={session.totalQuestions}
            answeredCount={session.answeredCount}
            answerMap={session.answerMap}
            isSubmitting={session.isSubmitting}
            sessionResult={session.sessionResult}
            onStartMock={() => void handleStartMock()}
            onSelectAnswer={session.selectAnswer}
            onGoToQuestion={session.goToQuestion}
            onPrevious={session.goToPrevious}
            onNext={session.goToNext}
            onSubmit={handleSubmitSession}
            showAds={subscription.showAds}
            token={auth.token}
            tenantCode={auth.credentials.tenantCode}
          />
        );
      case "listening":
      case "grammar":
      case "textcompletion":
      case "reading":
        return (
          <PracticeView
            type={activeView as "listening" | "grammar" | "textcompletion" | "reading"}
            locale={locale}
            activeSession={session.activeSession}
            currentQuestion={session.currentQuestion}
            currentQuestionIndex={session.currentQuestionIndex}
            totalQuestions={session.totalQuestions}
            answeredCount={session.answeredCount}
            answerMap={session.answerMap}
            practiceHint={session.practiceHint}
            isSubmitting={session.isSubmitting}
            partFilter={practicePartFilter}
            onPartFilterChange={setPracticePartFilter}
            onStartPractice={() => void handleStartPractice()}
            onSelectAnswer={session.selectAnswer}
            onPrevious={session.goToPrevious}
            onNext={session.goToNext}
            onSubmit={() => void handleSubmitPractice()}
            showAds={subscription.showAds}
            token={auth.token}
            tenantCode={auth.credentials.tenantCode}
          />
        );
      case "writing":
        // Redirect legacy "writing" to grammar practice
        return (
          <PracticeView
            type="grammar"
            locale={locale}
            activeSession={session.activeSession}
            currentQuestion={session.currentQuestion}
            currentQuestionIndex={session.currentQuestionIndex}
            totalQuestions={session.totalQuestions}
            answeredCount={session.answeredCount}
            answerMap={session.answerMap}
            practiceHint={session.practiceHint}
            isSubmitting={session.isSubmitting}
            partFilter={practicePartFilter}
            onPartFilterChange={setPracticePartFilter}
            onStartPractice={() => void handleStartPractice()}
            onSelectAnswer={session.selectAnswer}
            onPrevious={session.goToPrevious}
            onNext={session.goToNext}
            onSubmit={() => void handleSubmitPractice()}
            showAds={subscription.showAds}
            token={auth.token}
            tenantCode={auth.credentials.tenantCode}
          />
        );
      default:
        return <ShadowingView locale={locale} uiLang={langConfig.uiLang} />;
    }
  };

  // Prevent SSR hydration mismatch: wait until mounted on client
  if (!mounted) {
    return null;
  }

  if (!auth.isLoggedIn) {
    return (
      <>
        <LoginView
          locale={locale}
          uiLang={langConfig.uiLang}
          credentials={auth.credentials}
          isSubmitting={auth.isSubmitting}
          message={auth.message}
          onCredentialsChange={auth.updateCredentials}
          onLogin={() => void handleLogin()}
          onRegister={() => void handleRegisterAndLogin()}
          onGoogleLogin={handleGoogleLogin}
          onWeChatLogin={handleWeChatLogin}
          onLineLogin={handleLineLogin}
          onLocaleChange={setUiLang}
        />
        <ToastContainer toasts={toast.toasts} onDismiss={toast.dismiss} />
      </>
    );
  }

  return (
    <AppShell
      activeView={activeView}
      onViewChange={handleViewChange}
      isLoggedIn={auth.isLoggedIn}
      message={auth.message}
      onLogout={handleLogout}
      uiLang={langConfig.uiLang}
      targetLang={langConfig.targetLang}
      onUiLangChange={setUiLang}
      onTargetLangChange={setTargetLang}
      planCode={subscription.planCode}
      isAdmin={subscription.isAdmin}
    >
      {subscription.showAds && (
        <AdBanner
          locale={locale}
          token={auth.token}
          tenantCode={auth.credentials.tenantCode}
          slot="banner_top"
          showAds={subscription.showAds}
        />
      )}
      <ViewErrorBoundary locale={locale}>
        <Suspense fallback={<ViewFallback />}>
          {renderView()}
        </Suspense>
      </ViewErrorBoundary>
      {subscription.showAds && (
        <NativeFeedAd
          locale={locale}
          token={auth.token}
          tenantCode={auth.credentials.tenantCode}
          showAds={subscription.showAds}
        />
      )}
      <ToastContainer toasts={toast.toasts} onDismiss={toast.dismiss} />
      {showInterstitial && (
        <InterstitialAd
          locale={locale}
          token={auth.token}
          tenantCode={auth.credentials.tenantCode}
          showAds={subscription.showAds}
          onClose={() => setShowInterstitial(false)}
        />
      )}
    </AppShell>
  );
}
