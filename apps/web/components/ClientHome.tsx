"use client";

import { useState, useEffect, useCallback, useRef, lazy, Suspense } from "react";
import type { Locale, ViewTab, NextTask } from "../types";
import { TABS } from "../types";
import { useAuth } from "../hooks/useAuth";
import { useSession } from "../hooks/useSession";
import { useMistakes } from "../hooks/useMistakes";
import { useVocab } from "../hooks/useVocab";
import { useAnalytics } from "../hooks/useAnalytics";
import { useConversation } from "../hooks/useConversation";
import { useLearningCommandRunner } from "../hooks/useLearningCommandRunner";
import { AppShell } from "./layout/AppShell";
import { CardSkeleton } from "./ui/Skeleton";
import { LoginView } from "./auth/LoginView";
import { ViewErrorBoundary } from "./error/ViewErrorBoundary";
import { ToastContainer } from "./ui/Toast";
import { useToast } from "../hooks/useToast";
import * as api from "../lib/api";

const MistakesView = lazy(() => import("./mistakes/MistakesView").then(m => ({ default: m.MistakesView })));
const VocabView = lazy(() => import("./vocab/VocabView").then(m => ({ default: m.VocabView })));
const ShadowingView = lazy(() => import("./shadowing/ShadowingView").then(m => ({ default: m.ShadowingView })));
const MockExamView = lazy(() => import("./mock/MockExamView").then(m => ({ default: m.MockExamView })));
const DashboardView = lazy(() => import("./dashboard/DashboardView").then(m => ({ default: m.DashboardView })));
const SettingsView = lazy(() => import("./settings/SettingsView").then(m => ({ default: m.SettingsView })));
const PracticeView = lazy(() => import("./practice/PracticeView").then(m => ({ default: m.PracticeView })));
const ConversationView = lazy(() => import("./conversation/ConversationView").then(m => ({ default: m.ConversationView })));

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
    submitDone: "\u5df2\u5b8c\u6210\u6a21\u62df\u8003\u8bd5\uff0c\u5df2\u5207\u6362\u5230\u9519\u9898\u96c6\u3002",
    registerSuccess: "\u6ce8\u518c\u5e76\u767b\u5f55\u6210\u529f\u3002",
    jumpMockPart: (partNo: number) => `\u5df2\u5207\u6362\u5230\u6a21\u62df\u8003\u8bd5\uff0c\u4f18\u5148\u590d\u7ec3 Part ${partNo}\u3002`,
    jumpMockBatch: (count: number) => `\u5df2\u5207\u6362\u5230\u6a21\u62df\u8003\u8bd5\uff0c\u5efa\u8bae\u4f18\u5148\u590d\u7ec3 ${count} \u9053\u9519\u9898\u3002`,
    jumpMockSingle: "\u5df2\u5207\u6362\u5230\u6a21\u62df\u8003\u8bd5\uff0c\u5efa\u8bae\u4f18\u5148\u590d\u7ec3\u8fd9\u9053\u9519\u9898\u3002",
    mistakeBoundaryTitle: "\u9519\u9898\u5e93\u52a0\u8f7d\u5931\u8d25",
    mistakeBoundaryHint: "\u9519\u9898\u6570\u636e\u5b58\u5728\u5f02\u5e38\u5b57\u6bb5\u3002\u4f60\u53ef\u4ee5\u5148\u70b9\u201c\u5237\u65b0\u9519\u9898\u201d\uff0c\u7cfb\u7edf\u4f1a\u5c3d\u91cf\u81ea\u52a8\u4fee\u590d\u5e76\u7ee7\u7eed\u52a0\u8f7d\u3002",
    goalSaved: "\u76ee\u6807\u5df2\u4fdd\u5b58\u3002",
    goalFailed: "\u76ee\u6807\u4fdd\u5b58\u5931\u8d25\uff0c\u8bf7\u91cd\u8bd5\u3002",
    confirmLeaveExam: "模拟考试尚未提交，确定要离开吗？",
    confirmLeavePractice: "当前练习尚未完成，确定要离开吗？",
  },
  ja: {
    submitDone: "\u6a21\u64ec\u8a66\u9a13\u3092\u5b8c\u4e86\u3057\u307e\u3057\u305f\u3002\u30df\u30b9\u30ce\u30fc\u30c8\u306b\u5207\u308a\u66ff\u3048\u307e\u3057\u305f\u3002",
    registerSuccess: "\u767b\u9332\u3068\u30ed\u30b0\u30a4\u30f3\u304c\u5b8c\u4e86\u3057\u307e\u3057\u305f\u3002",
    jumpMockPart: (partNo: number) => `\u6a21\u64ec\u8a66\u9a13\u306b\u5207\u308a\u66ff\u3048\u307e\u3057\u305f\u3002Part ${partNo} \u3092\u512a\u5148\u3057\u3066\u5fa9\u7fd2\u3057\u3066\u304f\u3060\u3055\u3044\u3002`,
    jumpMockBatch: (count: number) => `\u6a21\u64ec\u8a66\u9a13\u306b\u5207\u308a\u66ff\u3048\u307e\u3057\u305f\u3002\u307e\u305a\u306f ${count} \u554f\u306e\u30df\u30b9\u3092\u5fa9\u7fd2\u3057\u307e\u3057\u3087\u3046\u3002`,
    jumpMockSingle: "\u6a21\u64ec\u8a66\u9a13\u306b\u5207\u308a\u66ff\u3048\u307e\u3057\u305f\u3002\u3053\u306e\u30df\u30b9\u554f\u984c\u3092\u512a\u5148\u3057\u3066\u5fa9\u7fd2\u3057\u307e\u3057\u3087\u3046\u3002",
    mistakeBoundaryTitle: "\u30df\u30b9\u30ce\u30fc\u30c8\u306e\u8aad\u307f\u8fbc\u307f\u306b\u5931\u6557\u3057\u307e\u3057\u305f",
    mistakeBoundaryHint: "\u30c7\u30fc\u30bf\u306b\u4e0d\u6574\u5408\u304c\u3042\u308b\u53ef\u80fd\u6027\u304c\u3042\u308a\u307e\u3059\u3002\u300c\u30df\u30b9\u3092\u66f4\u65b0\u300d\u3092\u62bc\u3057\u3066\u518d\u8aad\u307f\u8fbc\u307f\u3057\u3066\u304f\u3060\u3055\u3044\u3002",
    goalSaved: "\u76ee\u6a19\u3092\u4fdd\u5b58\u3057\u307e\u3057\u305f\u3002",
    goalFailed: "\u76ee\u6a19\u306e\u4fdd\u5b58\u306b\u5931\u6557\u3057\u307e\u3057\u305f\u3002\u3082\u3046\u4e00\u5ea6\u304a\u8a66\u3057\u304f\u3060\u3055\u3044\u3002",
    confirmLeaveExam: "模擬試験がまだ提出されていません。本当に離れますか？",
    confirmLeavePractice: "練習がまだ完了していません。本当に離れますか？",
  },
} as const;

export type ThemeMode = "light" | "dark" | "auto";

export function ClientHome() {
  const [activeView, setActiveView] = useState<ViewTab>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("lb.view") as ViewTab | null;
      if (saved && ["dashboard", "listening", "grammar", "textcompletion", "reading", "shadowing", "mock", "conversation", "mistakes", "vocab", "writing", "settings"].includes(saved)) {
        return saved;
      }
    }
    return "dashboard";
  });
  const [locale, setLocale] = useState<Locale>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("lb.locale") as Locale) || "zh";
    }
    return "zh";
  });
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

  const auth = useAuth(locale);
  const toast = useToast();
  const session = useSession(auth.ensureSession, auth.getRequestOptions, auth.setMessage, locale);
  const mistakes = useMistakes(auth.ensureSession, auth.getRequestOptions, auth.setMessage, locale);
  const vocab = useVocab(auth.ensureSession, auth.getRequestOptions, auth.setMessage, locale);
  const analytics = useAnalytics(auth.getRequestOptions);
  const conversation = useConversation(auth.ensureSession, auth.getRequestOptions, auth.setMessage, locale);

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

  // Persist locale
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

  // Auto-load analytics on login and when dashboard becomes active
  useEffect(() => {
    if (auth.isLoggedIn && activeView === "dashboard") {
      void analytics.refreshAll(auth.token);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.isLoggedIn, activeView]);

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
      if (!window.confirm(COPY[locale].confirmLeaveExam)) return;
      session.resetSession();
    } else if (activeView === "mock" && newView !== "mock") {
      session.resetSession();
    }
    if (PRACTICE_VIEWS.has(activeView) && !PRACTICE_VIEWS.has(newView) && session.activeSession) {
      if (!window.confirm(COPY[locale].confirmLeavePractice)) return;
      session.resetSession();
    } else if (PRACTICE_VIEWS.has(activeView) && !PRACTICE_VIEWS.has(newView)) {
      session.resetSession();
    }
    setActiveView(newView);
  }, [activeView, session, locale]);

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
  }, [session, mistakes, auth, locale, analytics]);

  const handleLogin = useCallback(async () => {
    const token = await auth.login();
    if (!token) return;
    setActiveView("dashboard");
  }, [auth]);

  const handleRegisterAndLogin = useCallback(async () => {
    const registered = await auth.register();
    if (!registered) return;
    const token = await auth.login(true);
    if (!token) return;
    auth.setMessage(COPY[locale].registerSuccess);
    setActiveView("dashboard");
  }, [auth, locale]);

  const handleLogout = useCallback(() => {
    session.resetSession();
    setActiveView("dashboard");
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
  }, [session, mistakes, toast, locale, analytics]);

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
      case "dashboard":
        return (
          <DashboardView
            locale={locale}
            analytics={analytics.analytics}
            nextTasks={analytics.nextTasks}
            dailyPlan={analytics.dailyPlan}
            currentScore={analytics.currentScore}
            predictedScore={analytics.predictedScore}
            currentGap={analytics.currentGap}
            accuracyLabel={analytics.accuracyLabel}
            avgTimeLabel={analytics.avgTimeLabel}
            isSyncing={analytics.isSyncing}
            onRefresh={() => void analytics.refreshAll(auth.token)}
            onStartDiagnostic={() => void runner.runAction("diagnostic:start")}
            onViewChange={handleViewChange}
            onRunTask={handleRunTask}
            onRunAction={(action: string) => runner.runAction(action)}
          />
        );
      case "settings":
        return (
          <SettingsView
            locale={locale}
            credentials={auth.credentials}
            currentScore={currentScoreInput}
            goalScore={goalScore}
            goalDate={goalDate}
            theme={theme}
            onThemeChange={setTheme}
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
      case "shadowing":
        return <ShadowingView locale={locale} />;
      case "mistakes":
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
          />
        );
      case "conversation":
        return (
          <ConversationView
            locale={locale}
            scenarios={conversation.scenarios}
            activeSession={conversation.activeSession}
            isLoading={conversation.isLoading}
            inputText={conversation.inputText}
            onInputChange={conversation.setInputText}
            onStartSession={conversation.startSession}
            onSendMessage={conversation.sendMessage}
            onEndSession={conversation.endSession}
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
          />
        );
      default:
        return (
          <DashboardView
            locale={locale}
            analytics={analytics.analytics}
            nextTasks={analytics.nextTasks}
            dailyPlan={analytics.dailyPlan}
            currentScore={analytics.currentScore}
            predictedScore={analytics.predictedScore}
            currentGap={analytics.currentGap}
            accuracyLabel={analytics.accuracyLabel}
            avgTimeLabel={analytics.avgTimeLabel}
            isSyncing={analytics.isSyncing}
            onRefresh={() => void analytics.refreshAll(auth.token)}
            onStartDiagnostic={() => void runner.runAction("diagnostic:start")}
            onViewChange={handleViewChange}
            onRunTask={handleRunTask}
            onRunAction={(action: string) => runner.runAction(action)}
          />
        );
    }
  };

  if (!auth.isLoggedIn) {
    return (
      <>
        <LoginView
          locale={locale}
          credentials={auth.credentials}
          isSubmitting={auth.isSubmitting}
          message={auth.message}
          onCredentialsChange={auth.updateCredentials}
          onLogin={() => void handleLogin()}
          onRegister={() => void handleRegisterAndLogin()}
          onLocaleChange={setLocale}
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
      locale={locale}
      onLocaleChange={setLocale}
    >
      <ViewErrorBoundary locale={locale}>
        <Suspense fallback={<ViewFallback />}>
          {renderView()}
        </Suspense>
      </ViewErrorBoundary>
      <ToastContainer toasts={toast.toasts} onDismiss={toast.dismiss} />
    </AppShell>
  );
}
