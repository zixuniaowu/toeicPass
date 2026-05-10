import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClientHome } from "../components/ClientHome";

const mockUseLangConfig = vi.fn();

vi.mock("../hooks/useLangConfig", () => ({
  useLangConfig: () => mockUseLangConfig(),
}));

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({
    credentials: {
      tenantCode: "demo",
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
    ensureSession: vi.fn(async () => "token"),
    getRequestOptions: vi.fn(() => ({ token: "token", tenantCode: "demo" })),
    setMessage: vi.fn(),
    isLoggedIn: true,
    token: "token",
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

vi.mock("../components/layout/AppShell", () => ({
  AppShell: ({ children, onViewChange }: { children: React.ReactNode; onViewChange: (view: string) => void }) => (
    <div>
      <button type="button" onClick={() => onViewChange("writing")}>Open writing</button>
      <button type="button" onClick={() => onViewChange("grammar")}>Open grammar</button>
      <button type="button" onClick={() => onViewChange("reading")}>Open reading</button>
      {children}
    </div>
  ),
}));

vi.mock("../components/layout/TopBar", () => ({
  TopBar: () => null,
}));

vi.mock("../components/writing/WritingView", () => ({
  WritingView: () => <div>writing-view</div>,
}));

vi.mock("../components/grammar/JlptGrammarView", () => ({
  JlptGrammarView: () => <div>jlpt-grammar-view</div>,
}));

vi.mock("../components/reading/JlptReadingView", () => ({
  JlptReadingView: () => <div>jlpt-reading-view</div>,
}));

vi.mock("../components/practice/PracticeView", () => ({
  PracticeView: () => <div>practice-view</div>,
}));

vi.mock("../components/shadowing/ShadowingView", () => ({
  ShadowingView: () => <div>shadowing-view</div>,
}));

vi.mock("../components/error/ViewErrorBoundary", () => ({
  ViewErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("../components/ui/Toast", () => ({
  ToastContainer: () => null,
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

describe("ClientHome writing entry", () => {
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
      langConfig: { uiLang: "en", nativeLang: "en", targetLang: "en" },
      locale: "en",
      isFirstVisit: false,
      setIsFirstVisit: vi.fn(),
      setLangConfig: vi.fn(),
      setUiLang: vi.fn(),
      setNativeLang: vi.fn(),
      setTargetLang: vi.fn(),
    });
  });

  it("renders WritingView when switching to the writing tab", async () => {
    render(<ClientHome />);

    fireEvent.click(await screen.findByRole("button", { name: "Open writing" }));

    expect(await screen.findByText("writing-view")).toBeInTheDocument();
    expect(screen.queryByText("practice-view")).not.toBeInTheDocument();
  });

  it("renders JLPT grammar view when targetLang is ja and switching to grammar", async () => {
    mockUseLangConfig.mockReturnValue({
      langConfig: { uiLang: "ja", nativeLang: "ja", targetLang: "ja" },
      locale: "ja",
      isFirstVisit: false,
      setIsFirstVisit: vi.fn(),
      setLangConfig: vi.fn(),
      setUiLang: vi.fn(),
      setNativeLang: vi.fn(),
      setTargetLang: vi.fn(),
    });

    render(<ClientHome />);

    fireEvent.click(await screen.findByRole("button", { name: "Open grammar" }));

    expect(await screen.findByText("jlpt-grammar-view")).toBeInTheDocument();
    expect(screen.queryByText("practice-view")).not.toBeInTheDocument();
  });

  it("renders JLPT reading view when targetLang is ja and switching to reading", async () => {
    mockUseLangConfig.mockReturnValue({
      langConfig: { uiLang: "ja", nativeLang: "ja", targetLang: "ja" },
      locale: "ja",
      isFirstVisit: false,
      setIsFirstVisit: vi.fn(),
      setLangConfig: vi.fn(),
      setUiLang: vi.fn(),
      setNativeLang: vi.fn(),
      setTargetLang: vi.fn(),
    });

    render(<ClientHome />);

    fireEvent.click(await screen.findByRole("button", { name: "Open reading" }));

    expect(await screen.findByText("jlpt-reading-view")).toBeInTheDocument();
    expect(screen.queryByText("practice-view")).not.toBeInTheDocument();
  });
});