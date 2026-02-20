"use client";

import { useState, useCallback, useMemo } from "react";
import type { MistakeLibraryItem } from "../types";
import * as api from "../lib/api";

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
        setMistakeLibrary(items);
        setNoteDraftMap(
          Object.fromEntries(items.map((item) => [item.latestAttemptItemId, item.latestNote?.note ?? ""]))
        );
        setRootCauseMap(
          Object.fromEntries(items.map((item) => [item.latestAttemptItemId, item.latestNote?.rootCause ?? ""]))
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
      return (
        item.stem.toLowerCase().includes(q) ||
        item.explanation.toLowerCase().includes(q) ||
        item.options.some((opt) => opt.text.toLowerCase().includes(q))
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
