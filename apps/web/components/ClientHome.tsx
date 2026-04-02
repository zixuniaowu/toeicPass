"use client";

import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import type { Locale, ViewTab } from "../types";
import { useAuth } from "../hooks/useAuth";
import { useSession } from "../hooks/useSession";
import { useMistakes } from "../hooks/useMistakes";
import { useVocab } from "../hooks/useVocab";
import { useLearningCommandRunner } from "../hooks/useLearningCommandRunner";
import { AppShell } from "./layout/AppShell";
import { CardSkeleton } from "./ui/Skeleton";
import { LoginView } from "./auth/LoginView";
import { ViewErrorBoundary } from "./error/ViewErrorBoundary";

const MistakesView = lazy(() => import("./mistakes/MistakesView").then(m => ({ default: m.MistakesView })));
const VocabView = lazy(() => import("./vocab/VocabView").then(m => ({ default: m.VocabView })));
const ShadowingView = lazy(() => import("./shadowing/ShadowingView").then(m => ({ default: m.ShadowingView })));
const MockExamView = lazy(() => import("./mock/MockExamView").then(m => ({ default: m.MockExamView })));

function ViewFallback() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "16px 0" }}>
      <CardSkeleton />
      <CardSkeleton />
    </div>
  );
}

const COMPACT_VIEWS = new Set<ViewTab>(["shadowing", "mock", "mistakes", "vocab"]);

const COPY = {
  zh: {
    submitDone: "已完成模拟考试，已切换到错题集。",
    registerSuccess: "注册并登录成功。",
    jumpMockPart: (partNo: number) => `已切换到模拟考试，优先复练 Part ${partNo}。`,
    jumpMockBatch: (count: number) => `已切换到模拟考试，建议优先复练 ${count} 道错题。`,
    jumpMockSingle: "已切换到模拟考试，建议优先复练这道错题。",
    mistakeBoundaryTitle: "错题库加载失败",
    mistakeBoundaryHint: "错题数据存在异常字段。你可以先点“刷新错题”，系统会尽量自动修复并继续加载。",
  },
  ja: {
    submitDone: "模擬試験を完了しました。ミスノートに切り替えました。",
    registerSuccess: "登録とログインが完了しました。",
    jumpMockPart: (partNo: number) => `模擬試験に切り替えました。Part ${partNo} を優先して復習してください。`,
    jumpMockBatch: (count: number) => `模擬試験に切り替えました。まずは ${count} 問のミスを復習しましょう。`,
    jumpMockSingle: "模擬試験に切り替えました。このミス問題を優先して復習しましょう。",
    mistakeBoundaryTitle: "ミスノートの読み込みに失敗しました",
    mistakeBoundaryHint: "データに不整合がある可能性があります。「ミスを更新」を押して再読み込みしてください。",
  },
} as const;

export function ClientHome() {
  const [activeView, setActiveView] = useState<ViewTab>("shadowing");
  const [locale, setLocale] = useState<Locale>("zh");

  const auth = useAuth(locale);
  const session = useSession(auth.ensureSession, auth.getRequestOptions, auth.setMessage, locale);
  const mistakes = useMistakes(auth.ensureSession, auth.getRequestOptions, auth.setMessage, locale);
  const vocab = useVocab(auth.ensureSession, auth.getRequestOptions, auth.setMessage, locale);

  const runner = useLearningCommandRunner({
    requiresDiagnostic: false,
    setActiveView,
    setMessage: auth.setMessage,
    startSession: session.startSession,
    loadMistakes: mistakes.loadMistakes,
    loadVocabularyCards: vocab.loadCards,
  });

  const handleViewChange = useCallback((newView: ViewTab) => {
    if (!COMPACT_VIEWS.has(newView)) {
      setActiveView("shadowing");
      return;
    }
    if (activeView === "mock" && newView !== "mock") {
      session.resetSession();
    }
    setActiveView(newView);
  }, [activeView, session]);

  const handleStartMock = useCallback(async (message?: string) => {
    const ok = await runner.runAction("mock:start");
    if (!ok) return;
    if (message) auth.setMessage(message);
  }, [runner, auth]);

  const handleSubmitSession = useCallback(async (options?: { allowPartial?: boolean }) => {
    const report = await session.submitSession(options);
    if (!report) return;
    setActiveView("mistakes");
    await mistakes.loadMistakes();
    auth.setMessage(COPY[locale].submitDone);
  }, [session, mistakes, auth, locale]);

  const handleLogin = useCallback(async () => {
    const token = await auth.login();
    if (!token) return;
    setActiveView("shadowing");
  }, [auth]);

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
      case "shadowing":
        return <ShadowingView locale={locale} />;
      case "mistakes":
        return (
          <ViewErrorBoundary
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
      default:
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
    }
  };

  if (!auth.isLoggedIn) {
    return (
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
      <Suspense fallback={<ViewFallback />}>
        {renderView()}
      </Suspense>
    </AppShell>
  );
}
