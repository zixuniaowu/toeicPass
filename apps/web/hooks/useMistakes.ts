"use client";

import { useState, useCallback, useMemo } from "react";
import type { MistakeLibraryItem } from "../types";
import * as api from "../lib/api";

const normalizeOptionKey = (value: unknown): "A" | "B" | "C" | "D" => {
  const key = String(value ?? "").toUpperCase();
  if (key === "A" || key === "B" || key === "C" || key === "D") {
    return key;
  }
  return "A";
};

const normalizeOptionalOptionKey = (value: unknown): "A" | "B" | "C" | "D" | null => {
  const key = String(value ?? "").toUpperCase();
  if (key === "A" || key === "B" || key === "C" || key === "D") {
    return key;
  }
  return null;
};

const normalizeMistakeItem = (raw: MistakeLibraryItem, index: number): MistakeLibraryItem => {
  const options = Array.isArray(raw.options)
    ? raw.options
        .filter((opt) => Boolean(opt))
        .map((opt) => ({
          key: normalizeOptionKey(opt.key),
          text: String(opt.text ?? "").trim(),
        }))
        .filter((opt) => opt.text.length > 0)
    : [];

  const questionId = String(raw.questionId ?? "").trim() || `mistake-q-${index + 1}`;
  const latestAttemptItemId = String(raw.latestAttemptItemId ?? "").trim() || `${questionId}-latest`;
  const partNo = typeof raw.partNo === "number" && Number.isFinite(raw.partNo) ? raw.partNo : null;
  const wrongCountRaw = Number(raw.wrongCount ?? 0);
  const wrongCount = Number.isFinite(wrongCountRaw) && wrongCountRaw > 0 ? Math.floor(wrongCountRaw) : 1;
  const lastWrongAt = String(raw.lastWrongAt ?? "").trim() || new Date().toISOString();

  return {
    questionId,
    partNo,
    stem: String(raw.stem ?? "").trim(),
    explanation: String(raw.explanation ?? "").trim(),
    mediaUrl: typeof raw.mediaUrl === "string" && raw.mediaUrl.trim().length > 0 ? raw.mediaUrl : null,
    imageUrl: typeof raw.imageUrl === "string" && raw.imageUrl.trim().length > 0 ? raw.imageUrl : null,
    options,
    correctKey: normalizeOptionalOptionKey(raw.correctKey),
    wrongCount,
    latestAttemptItemId,
    lastSelectedKey: normalizeOptionalOptionKey(raw.lastSelectedKey),
    lastWrongAt,
    latestNote: raw.latestNote && typeof raw.latestNote.note === "string"
      ? {
          note: raw.latestNote.note,
          rootCause: raw.latestNote.rootCause ?? null,
          createdAt: String(raw.latestNote.createdAt ?? "").trim() || lastWrongAt,
        }
      : null,
  };
};

export function useMistakes(
  ensureSession: () => Promise<string | null>,
  getRequestOptions: (token?: string) => { token?: string; tenantCode?: string },
  setMessage: (msg: string) => void
) {
  const [mistakeLibrary, setMistakeLibrary] = useState<MistakeLibraryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [partFilter, setPartFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [noteDraftMap, setNoteDraftMap] = useState<Record<string, string>>({});
  const [rootCauseMap, setRootCauseMap] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const loadMistakes = useCallback(
    async (token?: string) => {
      const activeToken = token ?? (await ensureSession());
      if (!activeToken) return;

      setIsLoading(true);
      try {
        const items = await api.fetchMistakeLibrary(getRequestOptions(activeToken));
        const safeItems = (Array.isArray(items) ? items : []).map((item, index) =>
          normalizeMistakeItem(item, index)
        );
        setMistakeLibrary(safeItems);
        setNoteDraftMap(
          Object.fromEntries(safeItems.map((item) => [item.latestAttemptItemId, item.latestNote?.note ?? ""]))
        );
        setRootCauseMap(
          Object.fromEntries(safeItems.map((item) => [item.latestAttemptItemId, item.latestNote?.rootCause ?? ""]))
        );
      } catch (error) {
        setMessage(`加载错题库异常: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        setIsLoading(false);
      }
    },
    [ensureSession, getRequestOptions, setMessage]
  );

  const updateNoteDraft = useCallback((itemId: string, note: string) => {
    setNoteDraftMap((prev) => ({ ...prev, [itemId]: note }));
  }, []);

  const updateRootCause = useCallback((itemId: string, cause: string) => {
    setRootCauseMap((prev) => ({ ...prev, [itemId]: cause }));
  }, []);

  const saveNote = useCallback(
    async (item: MistakeLibraryItem) => {
      const token = await ensureSession();
      if (!token) return false;

      const note = (noteDraftMap[item.latestAttemptItemId] ?? "").trim();
      if (!note) {
        setMessage("请先输入错题备注。");
        return false;
      }

      setSavingId(item.latestAttemptItemId);
      try {
        const rootCause = (rootCauseMap[item.latestAttemptItemId] ?? "").trim() || undefined;
        const result = await api.saveMistakeNote(
          item.latestAttemptItemId,
          note,
          rootCause,
          getRequestOptions(token)
        );

        if (!result.success) {
          setMessage(`保存错题备注失败: ${result.error}`);
          return false;
        }

        setMessage("错题备注已保存。");
        await loadMistakes(token);
        return true;
      } catch (error) {
        setMessage(`保存错题备注异常: ${error instanceof Error ? error.message : String(error)}`);
        return false;
      } finally {
        setSavingId(null);
      }
    },
    [ensureSession, getRequestOptions, noteDraftMap, rootCauseMap, setMessage, loadMistakes]
  );

  const filteredMistakes = useMemo(() => {
    return mistakeLibrary.filter((item) => {
      if (partFilter !== "all" && String(item.partNo ?? "") !== partFilter) {
        return false;
      }
      if (!searchQuery.trim()) {
        return true;
      }
      const q = searchQuery.trim().toLowerCase();
      const stem = String(item.stem ?? "").toLowerCase();
      const explanation = String(item.explanation ?? "").toLowerCase();
      return (
        stem.includes(q) ||
        explanation.includes(q) ||
        (Array.isArray(item.options) &&
          item.options.some((opt) => String(opt?.text ?? "").toLowerCase().includes(q)))
      );
    });
  }, [mistakeLibrary, partFilter, searchQuery]);

  return {
    mistakeLibrary,
    filteredMistakes,
    isLoading,
    partFilter,
    searchQuery,
    noteDraftMap,
    rootCauseMap,
    savingId,
    setPartFilter,
    setSearchQuery,
    loadMistakes,
    updateNoteDraft,
    updateRootCause,
    saveNote,
  };
}
