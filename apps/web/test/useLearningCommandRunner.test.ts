import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useLearningCommandRunner } from "../hooks/useLearningCommandRunner";

const mockSetActiveView = vi.fn();
const mockSetMessage = vi.fn();
const mockStartSession = vi.fn<(mode: string, filters?: Record<string, unknown>) => Promise<boolean>>();
const mockLoadMistakes = vi.fn<() => Promise<void>>();
const mockLoadVocabularyCards = vi.fn<() => Promise<void>>();

function setup(requiresDiagnostic = false) {
  return renderHook(() =>
    useLearningCommandRunner({
      requiresDiagnostic,
      setActiveView: mockSetActiveView,
      setMessage: mockSetMessage,
      startSession: mockStartSession,
      loadMistakes: mockLoadMistakes,
      loadVocabularyCards: mockLoadVocabularyCards,
    })
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockStartSession.mockResolvedValue(true);
  mockLoadMistakes.mockResolvedValue(undefined);
  mockLoadVocabularyCards.mockResolvedValue(undefined);
});

describe("useLearningCommandRunner", () => {
  // -- practice:start --
  it("practice:start starts session and sets listening view", async () => {
    const { result } = setup();

    let success = false;
    await act(async () => {
      success = await result.current.runAction("practice:start");
    });

    expect(success).toBe(true);
    expect(mockStartSession).toHaveBeenCalledWith("practice", { partNo: undefined, difficulty: undefined, partGroup: undefined });
    expect(mockSetActiveView).toHaveBeenCalledWith("listening");
  });

  it("practice:start with part=5 goes to grammar view", async () => {
    const { result } = setup();

    await act(async () => {
      await result.current.runAction("practice:start?part=5");
    });

    expect(mockStartSession).toHaveBeenCalledWith("practice", expect.objectContaining({ partNo: 5 }));
    expect(mockSetActiveView).toHaveBeenCalledWith("grammar");
  });

  it("practice:start with part=6 goes to textcompletion view", async () => {
    const { result } = setup();

    await act(async () => {
      await result.current.runAction("practice:start?part=6");
    });

    expect(mockSetActiveView).toHaveBeenCalledWith("textcompletion");
  });

  it("practice:start with part=7 goes to reading view", async () => {
    const { result } = setup();

    await act(async () => {
      await result.current.runAction("practice:start?part=7");
    });

    expect(mockSetActiveView).toHaveBeenCalledWith("reading");
  });

  it("practice:start with part=2 (listening) goes to listening view", async () => {
    const { result } = setup();

    await act(async () => {
      await result.current.runAction("practice:start?part=2");
    });

    expect(mockSetActiveView).toHaveBeenCalledWith("listening");
  });

  it("practice:start with partGroup=reading sets reading view", async () => {
    const { result } = setup();

    await act(async () => {
      await result.current.runAction("practice:start?partGroup=reading");
    });

    expect(mockSetActiveView).toHaveBeenCalledWith("reading");
  });

  it("practice:start with partGroup=listening sets listening view", async () => {
    const { result } = setup();

    await act(async () => {
      await result.current.runAction("practice:start?partGroup=listening");
    });

    expect(mockSetActiveView).toHaveBeenCalledWith("listening");
  });

  // -- fallback logic --
  it("practice:start falls back to partGroup when part fails", async () => {
    mockStartSession
      .mockResolvedValueOnce(false) // first attempt with partNo
      .mockResolvedValueOnce(true); // fallback with partGroup
    const { result } = setup();

    let success = false;
    await act(async () => {
      success = await result.current.runAction("practice:start?part=5");
    });

    expect(success).toBe(true);
    expect(mockStartSession).toHaveBeenCalledTimes(2);
    // Second call should use partGroup instead of partNo
    expect(mockStartSession).toHaveBeenNthCalledWith(2, "practice", expect.objectContaining({ partGroup: "reading" }));
  });

  it("practice:start falls back to no filters when partGroup also fails", async () => {
    mockStartSession
      .mockResolvedValueOnce(false) // part
      .mockResolvedValueOnce(false) // partGroup
      .mockResolvedValueOnce(true); // no filters
    const { result } = setup();

    let success = false;
    await act(async () => {
      success = await result.current.runAction("practice:start?part=3");
    });

    expect(success).toBe(true);
    expect(mockStartSession).toHaveBeenCalledTimes(3);
    expect(mockStartSession).toHaveBeenNthCalledWith(3, "practice", expect.objectContaining({ difficulty: undefined }));
  });

  it("practice:start returns false when all fallbacks fail", async () => {
    mockStartSession.mockResolvedValue(false);
    const { result } = setup();

    let success = true;
    await act(async () => {
      success = await result.current.runAction("practice:start?part=3");
    });

    expect(success).toBe(false);
    expect(mockStartSession).toHaveBeenCalledTimes(3);
  });

  // -- diagnostic:start --
  it("diagnostic:start starts diagnostic session", async () => {
    const { result } = setup();

    let success = false;
    await act(async () => {
      success = await result.current.runAction("diagnostic:start");
    });

    expect(success).toBe(true);
    expect(mockStartSession).toHaveBeenCalledWith("diagnostic", expect.objectContaining({}));
  });

  // -- mock:start --
  it("mock:start starts mock session and sets mock view", async () => {
    const { result } = setup();

    let success = false;
    await act(async () => {
      success = await result.current.runAction("mock:start");
    });

    expect(success).toBe(true);
    expect(mockStartSession).toHaveBeenCalledWith("mock", expect.objectContaining({}));
    expect(mockSetActiveView).toHaveBeenCalledWith("mock");
  });

  it("mock:start returns false on failure", async () => {
    mockStartSession.mockResolvedValueOnce(false);
    const { result } = setup();

    let success = true;
    await act(async () => {
      success = await result.current.runAction("mock:start");
    });

    expect(success).toBe(false);
  });

  // -- mistakes:start --
  it("mistakes:start switches to mistakes view and loads", async () => {
    const { result } = setup();

    let success = false;
    await act(async () => {
      success = await result.current.runAction("mistakes:start");
    });

    expect(success).toBe(true);
    expect(mockSetActiveView).toHaveBeenCalledWith("mistakes");
    expect(mockLoadMistakes).toHaveBeenCalled();
  });

  // -- vocab:start --
  it("vocab:start switches to vocab view and loads cards", async () => {
    const { result } = setup();

    let success = false;
    await act(async () => {
      success = await result.current.runAction("vocab:start");
    });

    expect(success).toBe(true);
    expect(mockSetActiveView).toHaveBeenCalledWith("vocab");
    expect(mockLoadVocabularyCards).toHaveBeenCalled();
  });

  // -- shadowing:start --
  it("shadowing:start switches to shadowing view", async () => {
    const { result } = setup();

    let success = false;
    await act(async () => {
      success = await result.current.runAction("shadowing:start");
    });

    expect(success).toBe(true);
    expect(mockSetActiveView).toHaveBeenCalledWith("shadowing");
  });

  // -- invalid action --
  it("invalid action sets error message and returns false", async () => {
    const { result } = setup();

    let success = true;
    await act(async () => {
      success = await result.current.runAction("unknown:action");
    });

    expect(success).toBe(false);
    expect(mockSetMessage).toHaveBeenCalledWith(expect.stringContaining("unknown:action"));
  });

  // -- requiresDiagnostic guard --
  it("blocks non-diagnostic actions when requiresDiagnostic is true", async () => {
    const { result } = setup(true);

    let success = true;
    await act(async () => {
      success = await result.current.runAction("practice:start");
    });

    expect(success).toBe(false);
    expect(mockSetMessage).toHaveBeenCalledWith(expect.stringContaining("自测"));
    expect(mockSetActiveView).toHaveBeenCalledWith("dashboard");
    expect(mockStartSession).not.toHaveBeenCalled();
  });

  it("allows diagnostic:start when requiresDiagnostic is true", async () => {
    const { result } = setup(true);

    let success = false;
    await act(async () => {
      success = await result.current.runAction("diagnostic:start");
    });

    expect(success).toBe(true);
    expect(mockStartSession).toHaveBeenCalled();
  });

  // -- action aliases --
  it("resolves alias 'practice' to practice:start", async () => {
    const { result } = setup();

    await act(async () => {
      await result.current.runAction("practice");
    });

    expect(mockStartSession).toHaveBeenCalledWith("practice", expect.anything());
  });

  it("resolves alias 'review' to mistakes:start", async () => {
    const { result } = setup();

    await act(async () => {
      await result.current.runAction("review");
    });

    expect(mockSetActiveView).toHaveBeenCalledWith("mistakes");
  });

  // -- runTask --
  it("runTask delegates to runAction with task.action", async () => {
    const { result } = setup();

    let success = false;
    await act(async () => {
      success = await result.current.runTask({
        id: "t1",
        title: "Practice Part 5",
        reason: "weak",
        action: "practice:start?part=5",
        priority: 1,
      });
    });

    expect(success).toBe(true);
    expect(mockStartSession).toHaveBeenCalled();
  });

  // -- openPracticeViewForPart --
  it("openPracticeViewForPart sets correct view for listening part", () => {
    const { result } = setup();

    act(() => result.current.openPracticeViewForPart(3));

    expect(mockSetActiveView).toHaveBeenCalledWith("listening");
  });

  it("openPracticeViewForPart sets grammar for part 5", () => {
    const { result } = setup();

    act(() => result.current.openPracticeViewForPart(5));

    expect(mockSetActiveView).toHaveBeenCalledWith("grammar");
  });

  it("openPracticeViewForPart uses fallback when no part", () => {
    const { result } = setup();

    act(() => result.current.openPracticeViewForPart(undefined, "reading"));

    expect(mockSetActiveView).toHaveBeenCalledWith("reading");
  });
});
