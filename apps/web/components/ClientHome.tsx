"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { ViewTab } from "../types";
import * as api from "../lib/api";
import { parseNumericFilter } from "../lib/learning-action";
import { useAuth } from "../hooks/useAuth";
import { useLearningCommandRunner } from "../hooks/useLearningCommandRunner";
import { useSession } from "../hooks/useSession";
import { useAnalytics } from "../hooks/useAnalytics";
import { useMistakes } from "../hooks/useMistakes";
import { useVocab } from "../hooks/useVocab";
import { AppShell } from "./layout/AppShell";
import { DashboardView } from "./dashboard/DashboardView";
import { DiagnosticGate } from "./dashboard/DiagnosticGate";
import { PracticeView } from "./practice/PracticeView";
import { MistakesView } from "./mistakes/MistakesView";
import { VocabView } from "./vocab/VocabView";
import { WritingView } from "./writing/WritingView";
import { SettingsView } from "./settings/SettingsView";
import { ShadowingView } from "./shadowing/ShadowingView";
import { MockExamView } from "./mock/MockExamView";
import { LoginView } from "./auth/LoginView";
import { ViewErrorBoundary } from "./error/ViewErrorBoundary";

const DEFAULT_SPRINT_GOAL_SCORE = 800;
const DEFAULT_SPRINT_DAYS = 90;
const PRACTICE_VIEWS = new Set<ViewTab>(["listening", "grammar", "textcompletion", "reading", "mock"]);
const DIAGNOSTIC_ALLOWED_VIEWS = new Set<ViewTab>(["dashboard", "listening", "mistakes", "settings"]);

const toDateInputValue = (date: Date): string => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
};

const buildGoalDateFromToday = (days: number): string => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return toDateInputValue(date);
};

export function ClientHome() {
  const [activeView, setActiveView] = useState<ViewTab>("dashboard");
  const [currentExamScore, setCurrentExamScore] = useState<number>(590);
  const [goalScore, setGoalScore] = useState<number>(DEFAULT_SPRINT_GOAL_SCORE);
  const [goalDate, setGoalDate] = useState<string>("");
  const [listeningPartFilter, setListeningPartFilter] = useState<string>("all");


  const auth = useAuth();
  const session = useSession(auth.ensureSession, auth.getRequestOptions, auth.setMessage);
  const analytics = useAnalytics(auth.getRequestOptions);
  const mistakes = useMistakes(auth.ensureSession, auth.getRequestOptions, auth.setMessage);
  const vocab = useVocab(auth.ensureSession, auth.getRequestOptions, auth.setMessage);
  const bootstrapped = useRef(false);
  const goalHydratedRef = useRef(false);
  const diagnosticAttempts = analytics.analytics?.modeBreakdown?.diagnostic ?? 0;
  const requiresDiagnostic = auth.isLoggedIn && diagnosticAttempts === 0;

  // Reset session when switching between practice tabs to avoid showing stale questions
  const handleViewChange = useCallback((newView: ViewTab) => {
    if (requiresDiagnostic && !DIAGNOSTIC_ALLOWED_VIEWS.has(newView)) {
      auth.setMessage("请先完成 20 题自测，再开启完整训练计划。");
      setActiveView("dashboard");
      return;
    }

    // If switching between different practice views, reset the session
    if (PRACTICE_VIEWS.has(newView) && PRACTICE_VIEWS.has(activeView) && newView !== activeView) {
      session.resetSession();
    }
    // If leaving a practice view for a non-practice view, also reset
    if (PRACTICE_VIEWS.has(activeView) && !PRACTICE_VIEWS.has(newView)) {
      session.resetSession();
    }
    setActiveView(newView);
  }, [activeView, auth, requiresDiagnostic, session]);

  const {
    runAction: handleRunAction,
    runTask: handleRunTask,
    openPracticeViewForPart,
  } = useLearningCommandRunner({
    requiresDiagnostic,
    setActiveView,
    setMessage: auth.setMessage,
    startSession: session.startSession,
    loadMistakes: mistakes.loadMistakes,
    loadVocabularyCards: vocab.loadCards,
  });

  // Handlers
  const handleStartDiagnostic = useCallback(async () => {
    const success = await session.startSession("diagnostic");
    if (success) setActiveView("listening");
  }, [session]);

  const handleStartMock = useCallback(async () => {
    const success = await session.startSession("mock");
    if (success) setActiveView("mock");
  }, [session]);

  const handleStartListeningPractice = useCallback(async () => {
    const parsedPart = parseNumericFilter(listeningPartFilter);
    const success = await session.startSession("practice", {
      partNo: parsedPart,
      partGroup: typeof parsedPart === "number" ? undefined : "listening",
    });
    if (success) setActiveView("listening");
  }, [session, listeningPartFilter]);

  const handleStartGrammarPractice = useCallback(async () => {
    const success = await session.startSession("practice", {
      partNo: 5,
    });
    if (success) setActiveView("grammar");
  }, [session]);

  const handleStartTextCompletionPractice = useCallback(async () => {
    const success = await session.startSession("practice", {
      partNo: 6,
    });
    if (success) setActiveView("textcompletion");
  }, [session]);

  const handleStartReadingPractice = useCallback(async () => {
    const success = await session.startSession("practice", {
      partNo: 7,
    });
    if (success) setActiveView("reading");
  }, [session]);

  const handleSubmitSession = useCallback(async (options?: { allowPartial?: boolean }) => {
    const report = await session.submitSession(options);
    if (report) {
      analytics.updateLatestScore(report.scoreTotal);
      await analytics.refreshAll();
      setActiveView("mistakes");
      await mistakes.loadMistakes();
      auth.setMessage("已完成本轮练习，已自动切换到错题库继续强化。");
    }
  }, [session, analytics, mistakes, auth]);

  const handleSaveGoal = useCallback(async () => {
    const token = await auth.ensureSession();
    if (!token) return;

    const result = await api.createGoal(goalScore, goalDate, currentExamScore, auth.getRequestOptions(token));
    if (result.success) {
      auth.setMessage(`目标已保存：当前 ${currentExamScore} 分，目标 ${goalScore} 分。`);
      await analytics.refreshInsights(token);
    } else {
      auth.setMessage(`保存目标失败: ${result.error}`);
    }
  }, [auth, goalScore, goalDate, currentExamScore, analytics]);

  const handleLogin = useCallback(async () => {
    const token = await auth.login();
    if (!token) return;
    setActiveView("dashboard");
    await analytics.refreshAll(token);
  }, [auth, analytics]);

  const handleRegisterAndLogin = useCallback(async () => {
    const registered = await auth.register();
    if (!registered) return;
    const token = await auth.login(true);
    if (!token) return;
    auth.setMessage("注册并登录成功，先完成 20 题自测。");
    setActiveView("dashboard");
    await analytics.refreshAll(token);
  }, [auth, analytics]);

  const handleLogout = useCallback(() => {
    session.resetSession();
    setActiveView("dashboard");
    bootstrapped.current = false;
    goalHydratedRef.current = false;
    auth.logout();
  }, [auth, session]);

  const handleApplyNinetyDayGoal = useCallback(() => {
    setGoalScore(DEFAULT_SPRINT_GOAL_SCORE);
    setGoalDate(buildGoalDateFromToday(DEFAULT_SPRINT_DAYS));
    auth.setMessage(`已填入冲刺目标：当前 ${currentExamScore} 分 -> 800 分 / 90 天。请点“保存目标”。`);
  }, [auth, currentExamScore]);

  const handleMistakePractice = useCallback(
    async (partNo: number) => {
      const success = await session.startSession("practice", { partNo });
      if (success) openPracticeViewForPart(partNo, "reading");
    },
    [session, openPracticeViewForPart]
  );

  const handlePracticeFilteredMistakes = useCallback(
    async (payload: { questionIds: string[]; partNo?: number }) => {
      const firstPart = await session.startMistakeDrill({
        questionIds: payload.questionIds,
        partNo: payload.partNo,
        limit: Math.min(payload.questionIds.length || 20, 20),
      });
      if (typeof firstPart !== "number") return;
      openPracticeViewForPart(firstPart, "reading");
    },
    [session, openPracticeViewForPart]
  );

  const handlePracticeSingleMistake = useCallback(
    async (questionId: string, partNo?: number) => {
      const firstPart = await session.startMistakeDrill({
        questionIds: [questionId],
        partNo,
        limit: 5,
      });
      if (typeof firstPart !== "number") return;
      openPracticeViewForPart(firstPart, "reading");
    },
    [session, openPracticeViewForPart]
  );

  // Effects for loading data when views change
  useEffect(() => {
    if (!auth.isLoggedIn) {
      bootstrapped.current = false;
      goalHydratedRef.current = false;
      return;
    }
    if (bootstrapped.current) {
      return;
    }
    bootstrapped.current = true;
    void (async () => {
      await analytics.refreshAll();
    })();
  }, [auth.isLoggedIn, analytics]);

  useEffect(() => {
    if (goalHydratedRef.current) {
      return;
    }
    const goal = analytics.analytics?.goal;
    if (!goal) {
      return;
    }
    let hydrated = false;
    if (typeof goal.targetScore === "number") {
      setGoalScore(goal.targetScore);
      hydrated = true;
    }
    if (typeof goal.baselineScore === "number") {
      setCurrentExamScore(goal.baselineScore);
      hydrated = true;
    }
    if (typeof goal.targetExamDate === "string" && goal.targetExamDate.length >= 10) {
      setGoalDate(goal.targetExamDate.slice(0, 10));
      hydrated = true;
    }
    if (hydrated) {
      goalHydratedRef.current = true;
    }
  }, [analytics.analytics]);

  useEffect(() => {
    if (goalHydratedRef.current || goalDate) {
      return;
    }
    setGoalDate(buildGoalDateFromToday(DEFAULT_SPRINT_DAYS));
  }, [goalDate]);

  useEffect(() => {
    if (goalHydratedRef.current) {
      return;
    }
    if (typeof analytics.currentScore === "number") {
      setCurrentExamScore(analytics.currentScore);
    }
  }, [analytics.currentScore]);

  useEffect(() => {
    if (activeView === "mistakes") {
      void mistakes.loadMistakes();
    }
    if (activeView === "vocab") {
      void vocab.loadCards();
    }
  }, [activeView]);

  // Render active view
  const renderView = () => {
    switch (activeView) {
      case "dashboard":
        if (requiresDiagnostic) {
          return <DiagnosticGate onStartDiagnostic={handleStartDiagnostic} />;
        }
        return (
          <DashboardView
            analytics={analytics.analytics}
            nextTasks={analytics.nextTasks}
            dailyPlan={analytics.dailyPlan}
            currentScore={analytics.currentScore}
            predictedScore={analytics.predictedScore}
            currentGap={analytics.currentGap}
            accuracyLabel={analytics.accuracyLabel}
            avgTimeLabel={analytics.avgTimeLabel}
            isSyncing={analytics.isSyncing}
            onRefresh={() => analytics.refreshAll()}
            onStartDiagnostic={handleStartDiagnostic}
            onViewChange={handleViewChange}
            onRunTask={handleRunTask}
            onRunAction={handleRunAction}
            progressStorageKey={`${auth.credentials.tenantCode}:${auth.credentials.email}`}
          />
        );

      case "listening":
        return (
          <PracticeView
            type="listening"
            activeSession={session.activeSession}
            currentQuestion={session.currentQuestion}
            currentQuestionIndex={session.currentQuestionIndex}
            totalQuestions={session.totalQuestions}
            answeredCount={session.answeredCount}
            answerMap={session.answerMap}
            practiceHint={session.practiceHint}
            isSubmitting={session.isSubmitting}
            partFilter={listeningPartFilter}

            onPartFilterChange={setListeningPartFilter}

            onStartPractice={handleStartListeningPractice}
            onSelectAnswer={session.selectAnswer}
            onPrevious={session.goToPrevious}
            onNext={session.goToNext}
            onSubmit={handleSubmitSession}
          />
        );

      case "grammar":
        return (
          <PracticeView
            type="grammar"
            activeSession={session.activeSession}
            currentQuestion={session.currentQuestion}
            currentQuestionIndex={session.currentQuestionIndex}
            totalQuestions={session.totalQuestions}
            answeredCount={session.answeredCount}
            answerMap={session.answerMap}
            practiceHint={session.practiceHint}
            isSubmitting={session.isSubmitting}
            partFilter="5"

            onPartFilterChange={() => {}}

            onStartPractice={handleStartGrammarPractice}
            onSelectAnswer={session.selectAnswer}
            onPrevious={session.goToPrevious}
            onNext={session.goToNext}
            onSubmit={handleSubmitSession}
          />
        );

      case "textcompletion":
        return (
          <PracticeView
            type="textcompletion"
            activeSession={session.activeSession}
            currentQuestion={session.currentQuestion}
            currentQuestionIndex={session.currentQuestionIndex}
            totalQuestions={session.totalQuestions}
            answeredCount={session.answeredCount}
            answerMap={session.answerMap}
            practiceHint={session.practiceHint}
            isSubmitting={session.isSubmitting}
            partFilter="6"

            onPartFilterChange={() => {}}

            onStartPractice={handleStartTextCompletionPractice}
            onSelectAnswer={session.selectAnswer}
            onPrevious={session.goToPrevious}
            onNext={session.goToNext}
            onSubmit={handleSubmitSession}
          />
        );

      case "reading":
        return (
          <PracticeView
            type="reading"
            activeSession={session.activeSession}
            currentQuestion={session.currentQuestion}
            currentQuestionIndex={session.currentQuestionIndex}
            totalQuestions={session.totalQuestions}
            answeredCount={session.answeredCount}
            answerMap={session.answerMap}
            practiceHint={session.practiceHint}
            isSubmitting={session.isSubmitting}
            partFilter="7"

            onPartFilterChange={() => {}}

            onStartPractice={handleStartReadingPractice}
            onSelectAnswer={session.selectAnswer}
            onPrevious={session.goToPrevious}
            onNext={session.goToNext}
            onSubmit={handleSubmitSession}
          />
        );

      case "shadowing":
        return <ShadowingView />;

      case "mock":
        return (
          <MockExamView
            activeSession={session.activeSession}
            currentQuestion={session.currentQuestion}
            currentQuestionIndex={session.currentQuestionIndex}
            totalQuestions={session.totalQuestions}
            answeredCount={session.answeredCount}
            answerMap={session.answerMap}
            isSubmitting={session.isSubmitting}
            sessionResult={session.sessionResult}
            onStartMock={handleStartMock}
            onSelectAnswer={session.selectAnswer}
            onGoToQuestion={session.goToQuestion}
            onPrevious={session.goToPrevious}
            onNext={session.goToNext}
            onSubmit={handleSubmitSession}
          />
        );

      case "mistakes":
        return (
          <ViewErrorBoundary
            title="错题库加载失败"
            hint="错题数据存在异常字段。你可以先点“刷新错题”，系统会尽量自动修复并继续加载。"
          >
            <MistakesView
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

      case "writing":
        return <WritingView />;

      case "settings":
        return (
          <SettingsView
            credentials={auth.credentials}
            currentScore={currentExamScore}
            goalScore={goalScore}
            goalDate={goalDate}
            onCredentialsChange={auth.updateCredentials}
            onCurrentScoreChange={setCurrentExamScore}
            onGoalScoreChange={setGoalScore}
            onGoalDateChange={setGoalDate}
            onRegister={() => void handleRegisterAndLogin()}
            onLogin={() => void handleLogin()}
            onApplyNinetyDayGoal={handleApplyNinetyDayGoal}
            onSaveGoal={handleSaveGoal}
          />
        );

      default:
        return null;
    }
  };

  return (
    <AppShell
      activeView={activeView}
      onViewChange={handleViewChange}
      isLoggedIn={auth.isLoggedIn}
      message={auth.message}
      onLogout={handleLogout}
    >
      {auth.isLoggedIn ? (
        renderView()
      ) : (
        <LoginView
          credentials={auth.credentials}
          isSubmitting={auth.isSubmitting}
          message={auth.message}
          onCredentialsChange={auth.updateCredentials}
          onLogin={() => void handleLogin()}
          onRegister={() => void handleRegisterAndLogin()}
        />
      )}
    </AppShell>
  );
}
