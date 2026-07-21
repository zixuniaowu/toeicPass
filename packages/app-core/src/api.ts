import type {
  AdPlacement,
  AnalyticsOverview,
  ConversationScenario,
  DailyPlan,
  DueCard,
  GrammarPayload,
  LoginResponse,
  MistakeLibraryItem,
  NextTask,
  OptionKey,
  PlanCode,
  SessionFilters,
  SessionMode,
  SessionQuestion,
  SubmitReport,
  SubscriptionPlan,
  UserProfile,
  VocabularyPayload,
} from "./types";

const DEFAULT_API_BASE =
  process.env.NEXT_PUBLIC_API_URL ??
  process.env.EXPO_PUBLIC_API_URL ??
  process.env.API_BASE_URL ??
  "https://jackywangsh-toeicpass.hf.space/api/v1";

export type RequestOptions = {
  token?: string;
  tenantCode?: string;
  apiBase?: string;
};

export type ApiProbeResult = {
  success: boolean;
  status: number | null;
  latencyMs: number;
  url: string;
  error?: string;
  health?: {
    ok?: boolean;
    service?: string;
    time?: string;
  };
};

function stripTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, "");
}

export function normalizeApiBase(value: string): string {
  return stripTrailingSlashes(value.trim());
}

export function isValidApiBase(value: string): boolean {
  try {
    const normalized = normalizeApiBase(value);
    const url = new URL(normalized);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function resolveApiBase(options?: Pick<RequestOptions, "apiBase"> | null): string {
  const candidate = options?.apiBase?.trim();
  if (!candidate) {
    return DEFAULT_API_BASE;
  }
  return normalizeApiBase(candidate);
}

function buildApiUrl(path: string, options?: Pick<RequestOptions, "apiBase"> | null): string {
  return `${resolveApiBase(options)}${path}`;
}

const API_BASE = DEFAULT_API_BASE;

let onUnauthorized: (() => void) | null = null;

export function setOnUnauthorized(cb: (() => void) | null): void {
  onUnauthorized = cb;
}

function handleUnauthorized(res: Response): void {
  if (res.status === 401 && onUnauthorized) {
    onUnauthorized();
  }
}

function createHeaders(options: RequestOptions): HeadersInit {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }
  if (options.tenantCode) {
    headers["x-tenant-code"] = options.tenantCode;
  }
  return headers;
}

async function parseApiError(res: Response): Promise<string> {
  const raw = (await res.text()).trim();
  if (!raw) {
    return `HTTP ${res.status}`;
  }
  try {
    const parsed = JSON.parse(raw) as { message?: string | string[]; error?: string };
    if (Array.isArray(parsed.message)) {
      return parsed.message.join("; ");
    }
    if (typeof parsed.message === "string" && parsed.message.trim().length > 0) {
      return parsed.message;
    }
    if (typeof parsed.error === "string" && parsed.error.trim().length > 0) {
      return parsed.error;
    }
  } catch {
    // Fall back to raw body text.
  }
  return raw;
}

export async function register(payload: {
  tenantCode: string;
  tenantName: string;
  email: string;
  password: string;
  displayName: string;
}, options?: Pick<RequestOptions, "apiBase">): Promise<{ success: boolean; error?: string }> {
  const res = await fetch(buildApiUrl("/auth/register", options), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    return { success: false, error: await parseApiError(res) };
  }
  return { success: true };
}

export async function login(payload: {
  tenantCode?: string;
  email: string;
  password: string;
}, options?: Pick<RequestOptions, "apiBase">): Promise<{ success: boolean; token?: string; tenantCode?: string; refreshToken?: string; error?: string }> {
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (payload.tenantCode) {
    headers["x-tenant-code"] = payload.tenantCode;
  }
  const res = await fetch(buildApiUrl("/auth/login", options), {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    return { success: false, error: await parseApiError(res) };
  }
  const json = (await res.json()) as LoginResponse;
  return {
    success: true,
    token: json.accessToken,
    refreshToken: json.refreshToken,
    tenantCode: json.tenantCode,
  };
}

export async function oauthLogin(payload: {
  provider: string;
  code: string;
  redirectUri?: string;
  tenantCode?: string;
}, options?: Pick<RequestOptions, "apiBase">): Promise<{ success: boolean; token?: string; tenantCode?: string; isNewUser?: boolean; error?: string }> {
  const res = await fetch(buildApiUrl("/auth/oauth/login", options), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    return { success: false, error: await parseApiError(res) };
  }
  const json = (await res.json()) as { accessToken: string; tenantCode: string; isNewUser: boolean };
  return { success: true, token: json.accessToken, tenantCode: json.tenantCode, isNewUser: json.isNewUser };
}

export async function probeApiBase(apiBase: string): Promise<ApiProbeResult> {
  if (!isValidApiBase(apiBase)) {
    return {
      success: false,
      status: null,
      latencyMs: 0,
      url: apiBase,
      error: "Invalid API base URL",
    };
  }

  const url = buildApiUrl("/health", { apiBase });
  const startedAt = Date.now();

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });
    const latencyMs = Date.now() - startedAt;
    const raw = await res.text();
    let parsed: ApiProbeResult["health"] | undefined;

    if (raw.trim()) {
      try {
        parsed = JSON.parse(raw) as ApiProbeResult["health"];
      } catch {
        parsed = undefined;
      }
    }

    if (!res.ok) {
      return {
        success: false,
        status: res.status,
        latencyMs,
        url,
        error: raw.trim() || `HTTP ${res.status}`,
        health: parsed,
      };
    }

    return {
      success: true,
      status: res.status,
      latencyMs,
      url,
      health: parsed,
    };
  } catch (error) {
    return {
      success: false,
      status: null,
      latencyMs: Date.now() - startedAt,
      url,
      error: error instanceof Error ? error.message : "Network request failed",
    };
  }
}

export async function fetchAnalyticsOverview(options: RequestOptions): Promise<AnalyticsOverview | null> {
  const res = await fetch(buildApiUrl("/analytics/overview", options), {
    method: "GET",
    headers: createHeaders(options),
  });
  if (!res.ok) {
    handleUnauthorized(res);
    return null;
  }
  return res.json();
}

export async function fetchNextTasks(options: RequestOptions): Promise<NextTask[]> {
  const res = await fetch(buildApiUrl("/learning/next-tasks", options), {
    method: "GET",
    headers: createHeaders(options),
  });
  if (!res.ok) {
    handleUnauthorized(res);
    return [];
  }
  const payload = (await res.json()) as { tasks?: NextTask[] };
  return payload.tasks ?? [];
}

export async function fetchDailyPlan(options: RequestOptions): Promise<DailyPlan | null> {
  const res = await fetch(buildApiUrl("/learning/daily-plan", options), {
    method: "GET",
    headers: createHeaders(options),
  });
  if (!res.ok) {
    handleUnauthorized(res);
    return null;
  }
  return (await res.json()) as DailyPlan;
}

export async function fetchPrediction(options: RequestOptions): Promise<number | null> {
  const res = await fetch(buildApiUrl("/predictions/latest", options), {
    method: "GET",
    headers: createHeaders(options),
  });
  if (!res.ok) {
    handleUnauthorized(res);
    return null;
  }
  const payload = (await res.json()) as { predictedTotal?: number } | null;
  return payload?.predictedTotal ?? null;
}

export async function startSession(
  mode: SessionMode,
  filters: SessionFilters | undefined,
  options: RequestOptions,
): Promise<{ success: boolean; attemptId?: string; questions?: SessionQuestion[]; error?: string }> {
  const endpoint =
    mode === "diagnostic"
      ? "/diagnostics/start"
      : mode === "mock"
        ? "/mock-tests/start"
        : "/practice/sessions";

  const query = new URLSearchParams();
  if (typeof filters?.partNo === "number") {
    query.set("part", String(filters.partNo));
  }
  if (typeof filters?.difficulty === "number") {
    query.set("difficulty", String(filters.difficulty));
  }
  if (filters?.partGroup) {
    query.set("partGroup", filters.partGroup);
  }

  const suffix = query.toString() ? `?${query.toString()}` : "";
  const res = await fetch(buildApiUrl(`${endpoint}${suffix}`, options), {
    method: "POST",
    headers: createHeaders(options),
  });
  if (!res.ok) {
    handleUnauthorized(res);
    return { success: false, error: await parseApiError(res) };
  }
  const payload = (await res.json()) as { attemptId: string; questions: SessionQuestion[] };
  return { success: true, attemptId: payload.attemptId, questions: payload.questions };
}

export async function submitSession(
  mode: SessionMode,
  attemptId: string,
  answers: Array<{ questionId: string; selectedKey: OptionKey; durationMs: number }>,
  options: RequestOptions,
): Promise<{ success: boolean; report?: SubmitReport; error?: string }> {
  const endpoint =
    mode === "diagnostic"
      ? `/diagnostics/${attemptId}/submit`
      : mode === "mock"
        ? `/mock-tests/${attemptId}/submit`
        : `/practice/sessions/${attemptId}/complete`;

  const res = await fetch(buildApiUrl(endpoint, options), {
    method: "POST",
    headers: createHeaders(options),
    body: JSON.stringify({ answers }),
  });
  if (!res.ok) {
    handleUnauthorized(res);
    return { success: false, error: await parseApiError(res) };
  }
  const report = (await res.json()) as SubmitReport;
  return { success: true, report };
}

export async function startMistakeDrillSession(
  payload: { partNo?: number; questionIds?: string[]; limit?: number },
  options: RequestOptions,
): Promise<{ success: boolean; attemptId?: string; questions?: SessionQuestion[]; error?: string }> {
  const res = await fetch(buildApiUrl("/practice/sessions/mistakes/start", options), {
    method: "POST",
    headers: createHeaders(options),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    handleUnauthorized(res);
    return { success: false, error: await parseApiError(res) };
  }
  const response = (await res.json()) as { attemptId: string; questions: SessionQuestion[] };
  return { success: true, attemptId: response.attemptId, questions: response.questions };
}

export async function fetchDueCards(options: RequestOptions): Promise<DueCard[]> {
  const res = await fetch(buildApiUrl("/review/cards/due", options), {
    method: "GET",
    headers: createHeaders(options),
  });
  if (!res.ok) {
    handleUnauthorized(res);
    return [];
  }
  return res.json();
}

export async function fetchMistakeLibrary(options: RequestOptions): Promise<MistakeLibraryItem[]> {
  const res = await fetch(buildApiUrl("/mistakes/library", options), {
    method: "GET",
    headers: createHeaders(options),
  });
  if (!res.ok) {
    handleUnauthorized(res);
    return [];
  }
  return res.json();
}

export async function saveMistakeNote(
  attemptItemId: string,
  note: string,
  rootCause: string | undefined,
  options: RequestOptions,
): Promise<{ success: boolean; error?: string }> {
  const res = await fetch(buildApiUrl(`/mistakes/${attemptItemId}/notes`, options), {
    method: "POST",
    headers: createHeaders(options),
    body: JSON.stringify({ note, rootCause }),
  });
  if (!res.ok) {
    handleUnauthorized(res);
    return { success: false, error: await parseApiError(res) };
  }
  return { success: true };
}

export async function fetchVocabularyCards(
  options: RequestOptions,
  targetLang: "en" | "ja" = "en",
): Promise<VocabularyPayload | null> {
  const query = new URLSearchParams({ targetLang }).toString();
  const res = await fetch(buildApiUrl(`/learning/vocabulary/cards?${query}`, options), {
    method: "GET",
    headers: createHeaders(options),
  });
  if (!res.ok) {
    handleUnauthorized(res);
    return null;
  }
  return res.json();
}

export async function gradeVocabularyCard(
  cardId: string,
  grade: number,
  options: RequestOptions,
): Promise<{ success: boolean; error?: string }> {
  const res = await fetch(buildApiUrl(`/learning/vocabulary/cards/${cardId}/grade`, options), {
    method: "POST",
    headers: createHeaders(options),
    body: JSON.stringify({ grade }),
  });
  if (!res.ok) {
    handleUnauthorized(res);
    return { success: false, error: await parseApiError(res) };
  }
  return { success: true };
}

export async function fetchGrammarCards(
  options: RequestOptions,
  targetLang: "en" | "ja" = "en",
): Promise<GrammarPayload | null> {
  const query = new URLSearchParams({ targetLang }).toString();
  const res = await fetch(buildApiUrl(`/learning/grammar/cards?${query}`, options), {
    method: "GET",
    headers: createHeaders(options),
  });
  if (!res.ok) {
    handleUnauthorized(res);
    return null;
  }
  return res.json();
}

export async function gradeGrammarCard(
  cardId: string,
  grade: number,
  options: RequestOptions,
): Promise<{ success: boolean; error?: string }> {
  const res = await fetch(buildApiUrl(`/learning/grammar/cards/${cardId}/grade`, options), {
    method: "POST",
    headers: createHeaders(options),
    body: JSON.stringify({ grade }),
  });
  if (!res.ok) {
    handleUnauthorized(res);
    return { success: false, error: await parseApiError(res) };
  }
  return { success: true };
}

export async function createGoal(
  targetScore: number,
  targetExamDate: string,
  currentScore: number | null,
  options: RequestOptions,
): Promise<{ success: boolean; error?: string }> {
  const res = await fetch(buildApiUrl("/goals", options), {
    method: "POST",
    headers: createHeaders(options),
    body: JSON.stringify({
      targetScore,
      targetExamDate,
      ...(typeof currentScore === "number" ? { currentScore } : {}),
    }),
  });
  if (!res.ok) {
    handleUnauthorized(res);
    return { success: false, error: await parseApiError(res) };
  }
  return { success: true };
}

export async function fetchPlans(): Promise<SubscriptionPlan[]> {
  const res = await fetch(buildApiUrl("/plans"));
  if (!res.ok) {
    return [];
  }
  const payload = (await res.json()) as { plans?: SubscriptionPlan[] };
  return payload.plans ?? [];
}

export async function fetchUserProfile(options: RequestOptions): Promise<UserProfile | null> {
  const res = await fetch(buildApiUrl("/me/profile", options), {
    method: "GET",
    headers: createHeaders(options),
  });
  if (!res.ok) {
    handleUnauthorized(res);
    return null;
  }
  return res.json();
}

export async function subscribe(
  planCode: PlanCode,
  billingCycle: "monthly" | "yearly",
  options: RequestOptions,
): Promise<{ success: boolean; error?: string }> {
  const res = await fetch(buildApiUrl("/me/subscribe", options), {
    method: "POST",
    headers: createHeaders(options),
    body: JSON.stringify({ planCode, billingCycle }),
  });
  if (!res.ok) {
    handleUnauthorized(res);
    return { success: false, error: await parseApiError(res) };
  }
  return { success: true };
}

export async function cancelSubscription(options: RequestOptions): Promise<{ success: boolean; error?: string }> {
  const res = await fetch(buildApiUrl("/me/subscribe/cancel", options), {
    method: "POST",
    headers: createHeaders(options),
  });
  if (!res.ok) {
    handleUnauthorized(res);
    return { success: false, error: await parseApiError(res) };
  }
  return { success: true };
}

export async function fetchAds(options: RequestOptions, slot?: string): Promise<AdPlacement[]> {
  const params = slot ? `?slot=${encodeURIComponent(slot)}` : "";
  const res = await fetch(buildApiUrl(`/ads${params}`, options), {
    method: "GET",
    headers: createHeaders(options),
  });
  if (!res.ok) {
    handleUnauthorized(res);
    return [];
  }
  const payload = (await res.json()) as { ads?: AdPlacement[] };
  return payload.ads ?? [];
}

export async function recordAdEvent(
  placementId: string,
  eventType: "impression" | "click" | "dismiss",
  options: RequestOptions,
): Promise<void> {
  await fetch(buildApiUrl("/ads/event", options), {
    method: "POST",
    headers: createHeaders(options),
    body: JSON.stringify({ placementId, eventType }),
  });
}

export async function fetchAdminAds(options: RequestOptions): Promise<AdPlacement[]> {
  const res = await fetch(buildApiUrl("/admin/ads", options), {
    headers: createHeaders(options),
  });
  if (!res.ok) {
    return [];
  }
  const payload = (await res.json()) as { ads?: AdPlacement[] };
  return payload.ads ?? [];
}

export interface AdStats {
  totalPlacements: number;
  activePlacements: number;
  totalImpressions: number;
  totalClicks: number;
  ctr: number;
  bySlot: Record<string, { count: number; impressions: number; clicks: number }>;
  recentEvents: Array<{ id: string; placementId: string; eventType: string; createdAt: string }>;
}

export async function fetchAdStats(options: RequestOptions): Promise<AdStats | null> {
  const res = await fetch(buildApiUrl("/admin/ads/stats", options), {
    headers: createHeaders(options),
  });
  if (!res.ok) {
    return null;
  }
  return res.json();
}

export async function createAdPlacement(
  data: {
    slot: string;
    title: string;
    imageUrl?: string;
    linkUrl: string;
    ctaText: string;
    priority: number;
    targetPlans: string[];
    startsAt?: string;
    expiresAt?: string;
  },
  options: RequestOptions,
): Promise<AdPlacement | null> {
  const res = await fetch(buildApiUrl("/admin/ads", options), {
    method: "POST",
    headers: createHeaders(options),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    return null;
  }
  const payload = (await res.json()) as { ad?: AdPlacement };
  return payload.ad ?? null;
}

export async function updateAdPlacement(
  adId: string,
  data: Record<string, unknown>,
  options: RequestOptions,
): Promise<AdPlacement | null> {
  const res = await fetch(buildApiUrl(`/admin/ads/${encodeURIComponent(adId)}`, options), {
    method: "PUT",
    headers: createHeaders(options),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    return null;
  }
  const payload = (await res.json()) as { ad?: AdPlacement };
  return payload.ad ?? null;
}

export async function deleteAdPlacement(adId: string, options: RequestOptions): Promise<boolean> {
  const res = await fetch(buildApiUrl(`/admin/ads/${encodeURIComponent(adId)}`, options), {
    method: "DELETE",
    headers: createHeaders(options),
  });
  return res.ok;
}

export async function fetchConversationScenarios(options: RequestOptions): Promise<ConversationScenario[]> {
  const res = await fetch(buildApiUrl("/conversation/scenarios", options), {
    method: "GET",
    headers: createHeaders(options),
  });
  if (!res.ok) {
    handleUnauthorized(res);
    return [];
  }
  return res.json();
}

export async function fetchConversationReply(
  payload: { scenarioId: string; text: string; history: string[] },
  options: RequestOptions,
): Promise<{ success: boolean; content?: string; corrections?: string[]; suggestions?: string[]; error?: string }> {
  const res = await fetch(buildApiUrl("/conversation/reply", options), {
    method: "POST",
    headers: createHeaders(options),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    handleUnauthorized(res);
    return { success: false, error: await parseApiError(res) };
  }
  const json = (await res.json()) as {
    content: string;
    corrections?: string[];
    suggestions?: string[];
  };
  return { success: true, content: json.content, corrections: json.corrections, suggestions: json.suggestions };
}

export { API_BASE };
