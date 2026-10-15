import { describe, expect, it, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { allowedUiLangs, sanitizeLangConfig, useLangConfig } from "../hooks/useLangConfig";

describe("language config", () => {
  beforeEach(() => localStorage.clear());

  it("blocks nonsensical combinations", () => {
    expect(sanitizeLangConfig({ uiLang: "ja", targetLang: "ja" })).toEqual({ uiLang: "zh", nativeLang: "zh", targetLang: "ja" });
    expect(sanitizeLangConfig({ uiLang: "en", targetLang: "en" })).toEqual({ uiLang: "zh", nativeLang: "zh", targetLang: "en" });
    expect(sanitizeLangConfig({ uiLang: "ja", targetLang: "en" })).toEqual({ uiLang: "ja", nativeLang: "ja", targetLang: "en" });
    expect(sanitizeLangConfig({ uiLang: "en", targetLang: "ja" })).toEqual({ uiLang: "en", nativeLang: "en", targetLang: "ja" });
    expect(allowedUiLangs("ja")).toEqual(["zh", "en"]);
    expect(allowedUiLangs("en")).toEqual(["zh", "ja"]);
  });

  it("defaults to Chinese UI learning English", () => {
    expect(sanitizeLangConfig(undefined)).toEqual({ uiLang: "zh", nativeLang: "zh", targetLang: "en" });
  });

  it("migrates legacy stored config on load", () => {
    localStorage.setItem("langboost-lang-config", JSON.stringify({ uiLang: "ja", nativeLang: "ja", targetLang: "ja" }));
    const { result } = renderHook(() => useLangConfig());
    expect(result.current.langConfig).toEqual({ uiLang: "zh", nativeLang: "zh", targetLang: "ja" });
    expect(JSON.parse(localStorage.getItem("langboost-lang-config")!).uiLang).toBe("zh");
  });

  it("switching to Japanese keeps an English UI only when allowed", () => {
    const { result } = renderHook(() => useLangConfig());
    act(() => result.current.setUiLang("ja"));
    expect(result.current.langConfig.uiLang).toBe("ja");
    act(() => result.current.setTargetLang("ja"));
    expect(result.current.langConfig).toEqual({ uiLang: "zh", nativeLang: "zh", targetLang: "ja" });
    act(() => result.current.setUiLang("en"));
    expect(result.current.langConfig).toEqual({ uiLang: "en", nativeLang: "en", targetLang: "ja" });
    act(() => result.current.setTargetLang("en"));
    expect(result.current.langConfig.uiLang).toBe("zh");
  });

  it("choosing English UI while learning English switches the target to Japanese (and Japanese UI → English)", () => {
    const { result } = renderHook(() => useLangConfig());
    act(() => result.current.setUiLang("en"));
    expect(result.current.langConfig).toEqual({ uiLang: "en", nativeLang: "en", targetLang: "ja" });
    expect(JSON.parse(localStorage.getItem("langboost-lang-config")!).uiLang).toBe("en");
    act(() => result.current.setUiLang("ja"));
    expect(result.current.langConfig).toEqual({ uiLang: "ja", nativeLang: "ja", targetLang: "en" });
    act(() => result.current.setUiLang("zh"));
    expect(result.current.langConfig.targetLang).toBe("en");
  });
});
