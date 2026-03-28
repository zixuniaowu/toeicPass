"use client";

import { useState, useEffect, useCallback } from "react";
import type { Locale, ViewTab } from "../types";
import { useAuth } from "../hooks/useAuth";
import { useSession } from "../hooks/useSession";
import { useMistakes } from "../hooks/useMistakes";
import { useVocab } from "../hooks/useVocab";
import { AppShell } from "./layout/AppShell";
import { MistakesView } from "./mistakes/MistakesView";
import { VocabView } from "./vocab/VocabView";
import { ShadowingView } from "./shadowing/ShadowingView";
import { MockExamView } from "./mock/MockExamView";
import { LoginView } from "./auth/LoginView";
import { ViewErrorBoundary } from "./error/ViewErrorBoundary";

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
    const success = await session.startSession("mock");
    if (!success) return;
    setActiveView("mock");
    if (message) {
      auth.setMessage(message);
    }
  }, [session, auth]);

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
  }, [activeView, mistakes, vocab]);

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
      {auth.isLoggedIn ? (
        renderView()
      ) : (
        <LoginView
          locale={locale}
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
