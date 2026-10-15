import { describe, expect, it } from "vitest";
import { messages } from "@toeicpass/app-i18n";

describe("app-i18n locales", () => {
  it("zh, ja and en define the same keys with non-empty values", () => {
    const keys = (l: "zh" | "ja" | "en") => Object.keys(messages[l]).sort();
    expect(keys("ja")).toEqual(keys("zh"));
    expect(keys("en")).toEqual(keys("zh"));
    for (const l of ["zh", "ja", "en"] as const) for (const [k, v] of Object.entries(messages[l])) expect(v, `${l}:${k}`).toBeTruthy();
  });
  it("english strings contain no CJK text", () => {
    const bad = Object.entries(messages.en).filter(([k, v]) => !k.startsWith("lang.") && /[\u3040-\u30ff\u4e00-\u9fff]/.test(v));
    expect(bad).toEqual([]);
  });
});
