import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ClientHome } from "../components/ClientHome";

const mockSetLangConfig = vi.fn();
const mockSetIsFirstVisit = vi.fn();
const mockSetUiLang = vi.fn();
const mockSetNativeLang = vi.fn();
const mockSetTargetLang = vi.fn();
const mockUseLangConfig = vi.fn();

vi.mock("../hooks/useLangConfig", () => ({
  useLangConfig: () => mockUseLangConfig(),
}));

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({
    credentials: {
      tenantCode: "",
      tenantName: "",
      email: "user@example.com",
      password: "pass123",
      displayName: "",
    },
    isSubmitting: false,
    message: "",
    updateCredentials: vi.fn(),
    login: vi.fn(async () => null),
    register: vi.fn(async () => false),
    logout: vi.fn(),
    googleLogin: vi.fn(async () => null),
    ensureSession: vi.fn(async () => ""),
    getRequestOptions: vi.fn(() => ({ token: "", tenantCode: "" })),
    setMessage: vi.fn(),
    isLoggedIn: false,
    token: "",
  }),
}));

vi.mock("../hooks/useSession", () => ({
  useSession: () => ({
    activeSession: null,
    sessionResult: null,
    currentQuestion: null,
    currentQuestionIndex: 0,
    totalQuestions: 0,
    answeredCount: 0,
    answerMap: {},
    practiceHint: "",
    isSubmitting: false,
    startSession: vi.fn(async () => undefined),
    submitSession: vi.fn(async () => null),
    resetSession: vi.fn(),
    selectAnswer: vi.fn(),
    goToQuestion: vi.fn(),
    goToPrevious: vi.fn(),
    goToNext: vi.fn(),
  }),
}));

vi.mock("../hooks/useMistakes", () => ({
  useMistakes: () => ({
    mistakeLibrary: [],
    filteredMistakes: [],
    isLoading: false,
    partFilter: "all",
    searchQuery: "",
    noteDraftMap: {},
    rootCauseMap: {},
    savingId: null,
    setPartFilter: vi.fn(),
    setSearchQuery: vi.fn(),
    updateNoteDraft: vi.fn(),
    updateRootCause: vi.fn(),
    saveNote: vi.fn(async () => undefined),
    loadMistakes: vi.fn(async () => undefined),
  }),
}));

vi.mock("../hooks/useVocab", () => ({
  useVocab: () => ({
    cards: [],
    summary: null,
    isLoading: false,
    dueCards: [],
    activeCard: null,
    revealMap: {},
    gradingCardId: null,
    loadCards: vi.fn(async () => undefined),
    toggleReveal: vi.fn(),
    gradeCard: vi.fn(),
  }),
}));

vi.mock("../hooks/useAnalytics", () => ({
  useAnalytics: () => ({
    analytics: null,
    refreshAll: vi.fn(async () => undefined),
    updateLatestScore: vi.fn(),
  }),
}));

vi.mock("../hooks/useLearningCommandRunner", () => ({
  useLearningCommandRunner: () => ({
    runAction: vi.fn(async () => true),
  }),
}));

vi.mock("../hooks/useSubscription", () => ({
  useSubscription: () => ({
    showAds: false,
    planCode: "free",
    isAdmin: false,
    refreshProfile: vi.fn(async () => undefined),
  }),
}));

vi.mock("../hooks/useToast", () => ({
  useToast: () => ({
    toasts: [],
    show: vi.fn(),
    dismiss: vi.fn(),
  }),
}));

vi.mock("../lib/i18n", () => ({
  createT: () => (key: string) => key,
}));

vi.mock("../components/ads/AdBanner", () => ({
  AdBanner: () => null,
}));

vi.mock("../components/ads/InterstitialAd", () => ({
  InterstitialAd: () => null,
}));

vi.mock("../components/ads/NativeFeedAd", () => ({
  NativeFeedAd: () => null,
}));

describe("ClientHome onboarding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const storage = new Map<string, string>();

    Object.defineProperty(window, "localStorage", {
      writable: true,
      configurable: true,
      value: {
        getItem: vi.fn((key: string) => storage.get(key) ?? null),
        setItem: vi.fn((key: string, value: string) => {
          storage.set(key, value);
        }),
        removeItem: vi.fn((key: string) => {
          storage.delete(key);
        }),
        clear: vi.fn(() => {
          storage.clear();
        }),
      },
    });

    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    mockUseLangConfig.mockReturnValue({
      langConfig: { uiLang: "ja", nativeLang: "ja", targetLang: "en" },
      locale: "ja",
      isFirstVisit: true,
      setIsFirstVisit: mockSetIsFirstVisit,
      setLangConfig: mockSetLangConfig,
      setUiLang: mockSetUiLang,
      setNativeLang: mockSetNativeLang,
      setTargetLang: mockSetTargetLang,
    });
  });

  it("persists selected languages from the first-visit popup", async () => {
    render(<ClientHome />);

    const englishOption = (await screen.findAllByRole("button", { name: /English/i }))[1];
    fireEvent.click(englishOption);

    fireEvent.click(screen.getByRole("button", { name: "Start Learning" }));

    expect(mockSetLangConfig).toHaveBeenCalledWith({
      uiLang: "en",
      nativeLang: "en",
      targetLang: "ja",
    });
    expect(mockSetIsFirstVisit).toHaveBeenCalledWith(false);
  });
});