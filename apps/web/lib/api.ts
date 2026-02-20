import type {
  LoginResponse,
  SessionMode,
  SessionFilters,
  SessionQuestion,
  SubmitReport,
  AnalyticsOverview,
  NextTask,
  DueCard,
  MistakeLibraryItem,
  VocabularyPayload,
  OptionKey,
} from "../types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001/api/v1";

type RequestOptions = {
  token?: string;
  tenantCode?: string;
};

const createHeaders = (options: RequestOptions): HeadersInit => {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  if (options.token) {
    headers["Authorization"] = `Bearer ${options.token}`;
  }
  if (options.tenantCode) {
    headers["x-tenant-code"] = options.tenantCode;
  }
  return headers;
};

// Auth API
export async function register(payload: {
  tenantCode: string;
  tenantName: string;
  email: string;
  password: string;
  displayName: string;
}): Promise<{ success: boolean; error?: string }> {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const txt = await res.text();
    return { success: false, error: txt };
  }
  return { success: true };
}

export async function login(payload: {
  tenantCode: string;
  email: string;
  password: string;
}): Promise<{ success: boolean; token?: string; error?: string }> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-tenant-code": payload.tenantCode },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const txt = await res.text();
    return { success: false, error: txt };
  }
  const json = (await res.json()) as LoginResponse;
  return { success: true, token: json.accessToken };
}

// Analytics API
export async function fetchAnalyticsOverview(
  options: RequestOptions
): Promise<AnalyticsOverview | null> {
  const res = await fetch(`${API_BASE}/analytics/overview`, {
    method: "GET",
    headers: createHeaders(options),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function fetchNextTasks(options: RequestOptions): Promise<NextTask[]> {
  const res = await fetch(`${API_BASE}/learning/next-tasks`, {
    method: "GET",
    headers: createHeaders(options),
  });
  if (!res.ok) return [];
  const payload = (await res.json()) as { tasks?: NextTask[] };
  return payload.tasks ?? [];
}

export async function fetchPrediction(
  options: RequestOptions
): Promise<number | null> {
  const res = await fetch(`${API_BASE}/predictions/latest`, {
    method: "GET",
    headers: createHeaders(options),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { predictedTotal?: number } | null;
  return json?.predictedTotal ?? null;
}

// Session API
export async function startSession(
  mode: SessionMode,
  filters: SessionFilters | undefined,
  options: RequestOptions
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

  const suffix = query.toString() ? `?${query.toString()}` : "";
  const res = await fetch(`${API_BASE}${endpoint}${suffix}`, {
    method: "POST",
    headers: createHeaders(options),
  });

  if (!res.ok) {
    const txt = await res.text();
    return { success: false, error: txt };
  }

  const payload = (await res.json()) as {
    attemptId: string;
    questions: SessionQuestion[];
  };
  return { success: true, attemptId: payload.attemptId, questions: payload.questions };
}

export async function submitSession(
  mode: SessionMode,
  attemptId: string,
  answers: Array<{ questionId: string; selectedKey: OptionKey; durationMs: number }>,
  options: RequestOptions
): Promise<{ success: boolean; report?: SubmitReport; error?: string }> {
  const endpoint =
    mode === "diagnostic"
      ? `/diagnostics/${attemptId}/submit`
      : mode === "mock"
        ? `/mock-tests/${attemptId}/submit`
        : `/practice/sessions/${attemptId}/complete`;

  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: "POST",
    headers: createHeaders(options),
    body: JSON.stringify({ answers }),
  });

  if (!res.ok) {
    const txt = await res.text();
    return { success: false, error: txt };
  }

  const report = (await res.json()) as SubmitReport;
  return { success: true, report };
}

// Review API
export async function fetchDueCards(options: RequestOptions): Promise<DueCard[]> {
  const res = await fetch(`${API_BASE}/review/cards/due`, {
    method: "GET",
    headers: createHeaders(options),
  });
  if (!res.ok) return [];
  return res.json();
}

// Mistakes API
export async function fetchMistakeLibrary(
  options: RequestOptions
): Promise<MistakeLibraryItem[]> {
  const res = await fetch(`${API_BASE}/mistakes/library`, {
    method: "GET",
    headers: createHeaders(options),
  });
  if (!res.ok) return [];
  return res.json();
}

export async function saveMistakeNote(
  attemptItemId: string,
  note: string,
  rootCause: string | undefined,
  options: RequestOptions
): Promise<{ success: boolean; error?: string }> {
  const res = await fetch(`${API_BASE}/mistakes/${attemptItemId}/notes`, {
    method: "POST",
    headers: createHeaders(options),
    body: JSON.stringify({ note, rootCause }),
  });
  if (!res.ok) {
    const txt = await res.text();
    return { success: false, error: txt };
  }
  return { success: true };
}

// Vocabulary API
export async function fetchVocabularyCards(
  options: RequestOptions
): Promise<VocabularyPayload | null> {
  const res = await fetch(`${API_BASE}/learning/vocabulary/cards`, {
    method: "GET",
    headers: createHeaders(options),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function gradeVocabularyCard(
  cardId: string,
  grade: number,
  options: RequestOptions
): Promise<{ success: boolean; error?: string }> {
  const res = await fetch(`${API_BASE}/learning/vocabulary/cards/${cardId}/grade`, {
    method: "POST",
    headers: createHeaders(options),
    body: JSON.stringify({ grade }),
  });
  if (!res.ok) {
    const txt = await res.text();
    return { success: false, error: txt };
  }
  return { success: true };
}

// Goals API
export async function createGoal(
  targetScore: number,
  targetExamDate: string,
  options: RequestOptions
): Promise<{ success: boolean; error?: string }> {
  const res = await fetch(`${API_BASE}/goals`, {
    method: "POST",
    headers: createHeaders(options),
    body: JSON.stringify({ targetScore, targetExamDate }),
  });
  if (!res.ok) {
    const txt = await res.text();
    return { success: false, error: txt };
  }
  return { success: true };
}

export { API_BASE };
