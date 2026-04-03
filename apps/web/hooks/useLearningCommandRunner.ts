"use client";

import { useCallback } from "react";
import type { NextTask, SessionFilters, SessionMode, ViewTab, Locale } from "../types";
import {
  parseLearningAction,
  resolvePartGroupFromPart,
  resolveViewTabForPart,
} from "../lib/learning-action";

const COPY = {
  zh: {
    unsupported: (action: string) => `暂不支持该任务动作: ${action}`,
    diagnosticRequired: "请先完成 20 题自测，再开启完整训练计划。",
  },
  ja: {
    unsupported: (action: string) => `未対応のアクション: ${action}`,
    diagnosticRequired: "まず20問の診断テストを完了してください。",
  },
} as const;

type RunnerDeps = {
  locale?: Locale;
  requiresDiagnostic: boolean;
  setActiveView: (view: ViewTab) => void;
  setMessage: (msg: string) => void;
  startSession: (mode: SessionMode, filters?: SessionFilters) => Promise<boolean>;
  loadMistakes: () => Promise<void>;
  loadVocabularyCards: () => Promise<void>;
};

export function useLearningCommandRunner({
  locale = "zh",
  requiresDiagnostic,
  setActiveView,
  setMessage,
  startSession,
  loadMistakes,
  loadVocabularyCards,
}: RunnerDeps) {
  const openPracticeViewForPart = useCallback((partNo?: number, fallback: ViewTab = "listening") => {
    setActiveView(resolveViewTabForPart(partNo, fallback));
  }, [setActiveView]);

  const runAction = useCallback(
    async (action: string): Promise<boolean> => {
      const t = COPY[locale];
      const parsedAction = parseLearningAction(action);
      if (!parsedAction) {
        setMessage(t.unsupported(action));
        return false;
      }

      const { command, filters } = parsedAction;
      const { partNo, difficulty, partGroup } = filters;

      if (requiresDiagnostic && command !== "diagnostic:start") {
        setMessage(t.diagnosticRequired);
        setActiveView("dashboard");
        return false;
      }

      if (command === "practice:start" || command === "diagnostic:start") {
        const mode = command === "practice:start" ? "practice" : "diagnostic";
        let finalPartNo = partNo;
        let finalPartGroup = partGroup;
        let success = await startSession(mode, { partNo, difficulty, partGroup });
        if (!success && typeof partNo === "number") {
          const inferredPartGroup = partGroup ?? resolvePartGroupFromPart(partNo);
          success = await startSession(mode, {
            difficulty,
            partGroup: inferredPartGroup,
          });
          if (success) {
            finalPartNo = undefined;
            finalPartGroup = inferredPartGroup;
          }
        }
        if (!success && (typeof partNo === "number" || partGroup)) {
          success = await startSession(mode, { difficulty });
          if (success) {
            finalPartNo = undefined;
            finalPartGroup = undefined;
          }
        }
        if (!success) return false;
        if (finalPartGroup === "reading") {
          setActiveView("reading");
          return true;
        }
        if (finalPartGroup === "listening") {
          setActiveView("listening");
          return true;
        }
        openPracticeViewForPart(finalPartNo, "listening");
        return true;
      }

      if (command === "mock:start") {
        const success = await startSession("mock", { difficulty, partGroup });
        if (!success) {
          return false;
        }
        setActiveView("mock");
        return true;
      }

      if (command === "mistakes:start") {
        setActiveView("mistakes");
        await loadMistakes();
        return true;
      }

      if (command === "vocab:start") {
        setActiveView("vocab");
        await loadVocabularyCards();
        return true;
      }

      if (command === "shadowing:start") {
        setActiveView("shadowing");
        return true;
      }

      setMessage(t.unsupported(action));
      return false;
    },
    [
      locale,
      loadMistakes,
      loadVocabularyCards,
      openPracticeViewForPart,
      requiresDiagnostic,
      setActiveView,
      setMessage,
      startSession,
    ],
  );

  const runTask = useCallback(async (task: NextTask): Promise<boolean> => {
    return runAction(task.action);
  }, [runAction]);

  return {
    runAction,
    runTask,
    openPracticeViewForPart,
  };
}
