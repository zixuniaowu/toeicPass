"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { PlanCode, UserProfile } from "../types";
import * as api from "../lib/api";

interface RequestOptions {
  token: string;
  tenantCode: string;
}

export function useSubscription(getRequestOptions: () => RequestOptions, isLoggedIn: boolean) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const loadedRef = useRef(false);

  const planCode: PlanCode = profile?.plan?.code ?? "free";
  const showAds = profile?.plan?.features?.show_ads ?? true;
  const isAdmin = profile?.roles?.some((r) => r === "tenant_admin" || r === "super_admin") ?? false;

  const refreshProfile = useCallback(async () => {
    const opts = getRequestOptions();
    if (!opts.token) return;
    setLoading(true);
    try {
      const p = await api.fetchUserProfile(opts);
      setProfile(p);
    } finally {
      setLoading(false);
    }
  }, [getRequestOptions]);

  // Auto-load on mount when logged in
  useEffect(() => {
    if (isLoggedIn && !loadedRef.current) {
      loadedRef.current = true;
      void refreshProfile();
    }
    if (!isLoggedIn) {
      loadedRef.current = false;
      setProfile(null);
    }
  }, [isLoggedIn, refreshProfile]);

  return {
    profile,
    planCode,
    showAds,
    isAdmin,
    loading,
    refreshProfile,
  };
}
