"use client";

/**
 * useQuery — lightweight SWR-style data fetching hook.
 *
 * A minimal alternative to TanStack Query that works with the existing
 * Next.js 15 setup without adding new dependencies.
 *
 * Features:
 *  - In-memory cache shared across hook instances (per key)
 *  - Configurable stale-time (default 60 s) and cache TTL (default 5 min)
 *  - Background revalidation on window focus
 *  - Deduplication of in-flight requests for the same key
 *  - Manual invalidation via `invalidateQuery(key)`
 *
 * Usage:
 *   const { data, isLoading, error, refetch } = useQuery(
 *     ['vocab', tenantCode],
 *     () => api.getVocabulary(token, tenantCode),
 *     { staleSec: 120 }
 *   );
 */

import { useCallback, useEffect, useRef, useState } from "react";

// ── Global cache store ────────────────────────────────────────────────────────

type CacheEntry<T> = {
  data: T;
  storedAt: number;
  expiresAt: number;
};

const GLOBAL_CACHE = new Map<string, CacheEntry<unknown>>();
const IN_FLIGHT = new Map<string, Promise<unknown>>();

/** Serialize a query key array to a stable string. */
function serializeKey(key: unknown[]): string {
  return JSON.stringify(key);
}

// ── Invalidation ──────────────────────────────────────────────────────────────

/** Remove one or more entries from the query cache. */
export function invalidateQuery(...key: unknown[]): void {
  const k = serializeKey(key);
  GLOBAL_CACHE.delete(k);
}

/** Remove all cached entries whose key starts with the given prefix. */
export function invalidateQueryPrefix(prefix: string): void {
  for (const k of GLOBAL_CACHE.keys()) {
    if (k.startsWith(prefix)) GLOBAL_CACHE.delete(k);
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export type QueryState<T> = {
  data: T | undefined;
  isLoading: boolean;
  isValidating: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
};

export interface UseQueryOptions {
  /** Seconds before cached data is considered stale. Default: 60. */
  staleSec?: number;
  /** Seconds until the cache entry expires entirely. Default: 300. */
  cacheTtlSec?: number;
  /** If false, skip fetching (useful for conditional queries). Default: true. */
  enabled?: boolean;
  /** Re-fetch when the window regains focus. Default: true. */
  refetchOnFocus?: boolean;
}

export function useQuery<T>(
  key: unknown[],
  fetcher: () => Promise<T>,
  options: UseQueryOptions = {},
): QueryState<T> {
  const {
    staleSec = 60,
    cacheTtlSec = 300,
    enabled = true,
    refetchOnFocus = true,
  } = options;

  const cacheKey = serializeKey(key);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const getCached = (): CacheEntry<T> | undefined => {
    const entry = GLOBAL_CACHE.get(cacheKey) as CacheEntry<T> | undefined;
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      GLOBAL_CACHE.delete(cacheKey);
      return undefined;
    }
    return entry;
  };

  const initial = getCached();
  const [data, setData] = useState<T | undefined>(initial?.data);
  const [isLoading, setIsLoading] = useState<boolean>(!initial && enabled);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const doFetch = useCallback(
    async (background = false) => {
      if (!enabled) return;

      if (background) {
        setIsValidating(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      // Deduplicate concurrent requests
      let promise = IN_FLIGHT.get(cacheKey) as Promise<T> | undefined;
      if (!promise) {
        promise = fetcherRef.current();
        IN_FLIGHT.set(cacheKey, promise);
        promise.finally(() => IN_FLIGHT.delete(cacheKey));
      }

      try {
        const result = await promise;
        const now = Date.now();
        GLOBAL_CACHE.set(cacheKey, {
          data: result,
          storedAt: now,
          expiresAt: now + cacheTtlSec * 1000,
        });
        setData(result);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setIsLoading(false);
        setIsValidating(false);
      }
    },
    [cacheKey, enabled, cacheTtlSec],
  );

  // Initial fetch
  useEffect(() => {
    if (!enabled) return;
    const entry = getCached();
    if (entry) {
      setData(entry.data);
      setIsLoading(false);
      // Background revalidate if stale
      const isStale = Date.now() - entry.storedAt > staleSec * 1000;
      if (isStale) void doFetch(true);
    } else {
      void doFetch(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, enabled]);

  // Refetch on window focus
  useEffect(() => {
    if (!refetchOnFocus || !enabled) return;
    const handler = () => {
      const entry = getCached();
      if (!entry) {
        void doFetch(false);
        return;
      }
      const isStale = Date.now() - entry.storedAt > staleSec * 1000;
      if (isStale) void doFetch(true);
    };
    window.addEventListener("focus", handler);
    return () => window.removeEventListener("focus", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, enabled, staleSec, refetchOnFocus]);

  const refetch = useCallback(() => doFetch(false), [doFetch]);

  return { data, isLoading, isValidating, error, refetch };
}
