"use client";

import { useState, useCallback, useRef } from "react";

export type ToastVariant = "info" | "success" | "error" | "warning";

export type ToastItem = {
  id: number;
  message: string;
  variant: ToastVariant;
};

let nextId = 1;

export function useToast(autoDismissMs = 4000) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (message: string, variant: ToastVariant = "info") => {
      const id = nextId++;
      setToasts((prev) => [...prev.slice(-4), { id, message, variant }]);
      if (autoDismissMs > 0) {
        const timer = setTimeout(() => dismiss(id), autoDismissMs);
        timersRef.current.set(id, timer);
      }
    },
    [autoDismissMs, dismiss],
  );

  return { toasts, show, dismiss };
}
