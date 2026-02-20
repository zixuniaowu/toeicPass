"use client";

import { useState, useEffect, useCallback } from "react";
import type { ViewTab, NextTask, SessionFilters } from "../types";
import { isListeningPart } from "../types";
import * as api from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import { useSession } from "../hooks/useSession";
import { useAnalytics } from "../hooks/useAnalytics";
import { useMistakes } from "../hooks/useMistakes";
import { useVocab } from "../hooks/useVocab";
import { useConversation } from "../hooks/useConversation";
import { AppShell } from "./layout/AppShell";
import { DashboardView } from "./dashboard/DashboardView";
import { PracticeView } from "./practice/PracticeView";
import { ReviewView } from "./review/ReviewView";
import { MistakesView } from "./mistakes/MistakesView";
import { VocabView } from "./vocab/VocabView";
import { SettingsView } from "./settings/SettingsView";
import { ConversationView } from "./conversation/ConversationView";
import { ShadowingView } from "./shadowing/ShadowingView";
import { MockExamView } from "./mock/MockExamView";

export function ClientHome() {
  const [activeView, setActiveView] = useState<ViewTab>("dashboard");
  const [goalScore, setGoalScore] = useState<number>(800);
  const [goalDate, setGoalDate] = useState<string>("2026-09-30");
  const [listeningPartFilter, setListeningPartFilter] = useState<string>("all");
  const [readingPartFilter, setReadingPartFilter] = useState<string>("all");


  const auth = useAuth();
  const session = useSession(auth.ensureSession, auth.getRequestOptions, auth.setMessage);
  const analytics = useAnalytics(auth.getRequestOptions);
  const mistakes = useMistakes(auth.ensureSession, auth.getRequestOptions, auth.setMessage);
  const vocab = useVocab(auth.ensureSession, auth.getRequestOptions, auth.setMessage);
  const conversation = useConversation();

  // Reset session when switching between practice tabs to avoid showing stale questions
  const PRACTICE_VIEWS = new Set(["listening", "grammar", "textcompletion", "reading", "mock"]);

  const handleViewChange = useCallback((newView: ViewTab) => {
    // If switching between different practice views, reset the session
    if (PRACTICE_VIEWS.has(newView) && PRACTICE_VIEWS.has(activeView) && newView !== activeView) {
      session.resetSession();
    }
    // If leaving a practice view for a non-practice view, also reset
    if (PRACTICE_VIEWS.has(activeView) && !PRACTICE_VIEWS.has(newView)) {
      session.resetSession();
    }
    setActiveView(newView);
  }, [activeView, session]);

  const parseFilter = (value: string): number | undefined => {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  };

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
    const success = await session.startSession("practice", {
      partNo: parseFilter(listeningPartFilter),
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

  const handleLoadDueCards = useCallback(async () => {
    const token = await auth.ensureSession();
    if (!token) return;

    const dueCards = await api.fetchDueCards(auth.getRequestOptions(token));
    const firstPart = dueCards.find((card) => typeof card.question?.partNo === "number")?.question?.partNo;
    await session.startSession("practice", { partNo: firstPart });
    setActiveView("review");
  }, [auth, session]);

  const handleSubmitSession = useCallback(async () => {
    const report = await session.submitSession();
    if (report) {
      analytics.updateLatestScore(report.scoreTotal);
      await analytics.refreshAll();
      setActiveView("review");
    }
  }, [session, analytics]);

  const handleRunTask = useCallback(
    async (task: NextTask) => {
      const [command, queryString] = task.action.split("?");
      const query = new URLSearchParams(queryString ?? "");
      const partNo = parseFilter(query.get("part") ?? "");
      const difficulty = parseFilter(query.get("difficulty") ?? "");

      if (command === "practice:start") {
        const success = await session.startSession("practice", { partNo, difficulty });
        if (success) {
          if (typeof partNo === "number") {
            if (isListeningPart(partNo)) {
              setActiveView("listening");
            } else if (partNo === 5) {
              setActiveView("grammar");
            } else if (partNo === 6) {
              setActiveView("textcompletion");
            } else {
              setActiveView("reading");
            }
          } else {
            setActiveView("listening");
          }
        }
        return;
      }

      if (command === "mock:start") {
        const success = await session.startSession("mock", { difficulty });
        if (success) setActiveView("mock");
        return;
      }

      if (command === "review:start") {
        await handleLoadDueCards();
        return;
      }

      if (command === "mistakes:start") {
        setActiveView("mistakes");
        await mistakes.loadMistakes();
        return;
      }

      if (command === "vocab:start") {
        setActiveView("vocab");
        await vocab.loadCards();
        return;
      }

      auth.setMessage(`暂不支持该任务动作: ${task.action}`);
    },
    [session, handleLoadDueCards, mistakes, vocab, auth]
  );

  const handleSaveGoal = useCallback(async () => {
    const token = await auth.ensureSession();
    if (!token) return;

    const result = await api.createGoal(goalScore, goalDate, auth.getRequestOptions(token));
    if (result.success) {
      auth.setMessage(`目标已保存：${goalScore} 分。`);
      await analytics.refreshInsights(token);
    } else {
      auth.setMessage(`保存目标失败: ${result.error}`);
    }
  }, [auth, goalScore, goalDate, analytics]);

  const handleMistakePractice = useCallback(
    async (partNo: number) => {
      const success = await session.startSession("practice", { partNo });
      if (success) {
        if (isListeningPart(partNo)) {
          setActiveView("listening");
        } else if (partNo === 5) {
          setActiveView("grammar");
        } else if (partNo === 6) {
          setActiveView("textcompletion");
        } else {
          setActiveView("reading");
        }
      }
    },
    [session]
  );

  // Effects for loading data when views change
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
        return (
          <DashboardView
            analytics={analytics.analytics}
            nextTasks={analytics.nextTasks}
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

      case "review":
        return (
          <ReviewView
            sessionResult={session.sessionResult}
            onLoadDueCards={handleLoadDueCards}
          />
        );

      case "mistakes":
        return (
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
          />
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

      case "conversation":
        return (
          <ConversationView
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

      case "settings":
        return (
          <SettingsView
            credentials={auth.credentials}
            goalScore={goalScore}
            goalDate={goalDate}
            onCredentialsChange={auth.updateCredentials}
            onGoalScoreChange={setGoalScore}
            onGoalDateChange={setGoalDate}
            onRegister={() => auth.register()}
            onLogin={() => auth.login()}
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
    >
      {renderView()}
    </AppShell>
  );
}
