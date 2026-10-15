import { describe, expect, it, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { allowedUiLangs, sanitizeLangConfig, useLangConfig } from "../hooks/useLangConfig";

describe("language config", () => {
  beforeEach(() => localStorage.clear());

  it("blocks nonsensical combinations", () => {
    expect(sanitizeLangConfig({ uiLang: "ja", targetLang: "ja" })).toEqual({ uiLang: "zh", nativeLang: "zh", targetLang: "ja" });
    expect(sanitizeLangConfig({ uiLang: "en", targetLang: "en" })).toEqual({ uiLang: "zh", nativeLang: "zh", targetLang: "en" });
    expect(sanitizeLangConfig({ uiLang: "ja", targetLang: "en" })).toEqual({ uiLang: "ja", nativeLang: "ja", targetLang: "en" });
    expect(allowedUiLangs("ja")).toEqual(["zh"]);
  });

  it("defaults to Chinese UI learning English", () => {
    expect(sanitizeLangConfig(undefined)).toEqual({ uiLang: "zh", nativeLang: "zh", targetLang: "en" });
  });

  it("migrates legacy stored config on load", () => {
    localStorage.setItem("langboost-lang-config", JSON.stringify({ uiLang: "en", nativeLang: "en", targetLang: "ja" }));
    const { result } = renderHook(() => useLangConfig());
    expect(result.current.langConfig).toEqual({ uiLang: "zh", nativeLang: "zh", targetLang: "ja" });
    expect(JSON.parse(localStorage.getItem("langboost-lang-config")!).uiLang).toBe("zh");
  });

  it("switching to Japanese forces a Chinese UI", () => {
    const { result } = renderHook(() => useLangConfig());
    act(() => result.current.setUiLang("ja"));
    expect(result.current.langConfig.uiLang).toBe("ja");
    act(() => result.current.setTargetLang("ja"));
    expect(result.current.langConfig).toEqual({ uiLang: "zh", nativeLang: "zh", targetLang: "ja" });
  });
});
