import { describe, expect, it, vi, beforeEach } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
// @ts-expect-error - plain ESM script
import { normalizeDay, slug } from "../scripts/import-vocab-days.mjs";
import { pickTr, type VocabDay } from "../lib/vocab-roots";
import { prerecordedUrl, registerPrerecorded } from "../lib/tts";
import { VocabRootsView } from "../components/vocab/VocabRootsView";

const pub = join(__dirname, "../public");
const index = JSON.parse(readFileSync(join(pub, "vocab-roots/index.json"), "utf8")) as { days: { day: number }[] };
const days: VocabDay[] = index.days.map((d) => JSON.parse(readFileSync(join(pub, `vocab-roots/day${d.day}.json`), "utf8")));

describe("vocab roots data (imported)", () => {
  it("index lists every imported day file", () => {
    const files = readdirSync(join(pub, "vocab-roots")).filter((f) => /^day\d+\.json$/.test(f));
    expect(index.days.length).toBe(files.length);
    expect(index.days.length).toBeGreaterThanOrEqual(14);
  });
  it("every word has IPA, zh/ja meaning, example + translations and audio files", () => {
    const gaps: string[] = [];
    for (const d of days) for (const g of d.groups) for (const w of g.words) {
      const id = `day${d.day}/${w.w}`;
      if (!/^\/.+\/$/.test(w.ipa)) gaps.push(`${id} ipa`);
      if (!w.meaning.zh || !w.meaning.ja) gaps.push(`${id} meaning`);
      if (!w.ex || !w.exTr.zh || !w.exTr.ja) gaps.push(`${id} example`);
      for (const a of [w.audio, w.exAudio]) if (!existsSync(join(pub, a))) gaps.push(`${id} ${a}`);
    }
    expect(gaps).toEqual([]);
  });
  it("root groups point at a root with meaning and explanation in zh/ja", () => {
    for (const d of days) {
      const rootGroups = d.groups.filter((g) => g.kind === "root");
      expect(rootGroups.length).toBe(d.roots.length);
      for (const g of rootGroups) {
        const r = d.roots[g.rootIndex];
        expect(r && r.meaning.zh && r.meaning.ja && r.explanation.zh && r.explanation.ja).toBeTruthy();
      }
    }
  });
});

describe("import script", () => {
  it("normalizes a day and reports invalid data", () => {
    const raw = {
      day: 99, roots: [{ root: "-spect-", zh: "看", ja: "見る", exp_zh: "x", exp_ja: "y" }],
      groups: [{ id: "spect", title_zh: "词根", title_ja: "語根", words: [{ w: "Inspect", ipa: "/ɪnˈspɛkt/", zh: "检查", ja: "検査する", ex: "Inspect it.", ex_zh: "检查。", ex_ja: "検査して。", parts: [["in-", "里", "中"]] }] }],
    };
    const { errors, day } = normalizeDay(raw);
    expect(errors).toEqual([]);
    expect(day.groups[0]).toMatchObject({ kind: "root", rootIndex: 0 });
    expect(day.groups[0].words[0]).toMatchObject({ id: "inspect", audio: "/audio/vocab/day99/inspect.mp3", exAudio: "/audio/vocab/day99/inspect_ex.mp3" });
    expect(day.groups[0].words[0].parts[0]).toEqual({ text: "in-", zh: "里", ja: "中" });
    expect(normalizeDay({ ...raw, groups: [{ id: "x", words: [{ w: "bad" }] }] }).errors.length).toBeGreaterThan(0);
    expect(slug("follow up")).toBe("follow-up");
  });
});

describe("helpers", () => {
  it("pickTr follows the UI language", () => {
    expect(pickTr({ zh: "看", ja: "見る" }, "ja")).toBe("見る");
    expect(pickTr({ zh: "看", ja: "見る" }, "zh")).toBe("看");
    expect(pickTr({ zh: "看", ja: "見る", en: "see" }, "en")).toBe("see");
  });
  it("registered vocab audio is used for playback", () => {
    registerPrerecorded({ "Please send it.": "/audio/vocab/day1/x_ex.mp3" });
    expect(prerecordedUrl("Please  send it.", "en")).toBe("/audio/vocab/day1/x_ex.mp3");
  });
});

describe("VocabRootsView", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      const file = url.includes("index") ? "vocab-roots/index.json" : `vocab-roots/${url.split("/").pop()}`;
      return { ok: true, json: async () => JSON.parse(readFileSync(join(pub, file), "utf8")) } as Response;
    }));
  });
  it("shows day 1 roots and words in Japanese UI, toggles mastered and opens the shadowing recorder", async () => {
    render(<VocabRootsView uiLang="ja" />);
    expect(await screen.findByText("語根で覚える単語")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("vocab-word-prospective")).toBeInTheDocument());
    expect(screen.getAllByText("見込みのある；将来の").length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole("button", { name: "定着にする" })[0]);
    expect(JSON.parse(localStorage.getItem("lb.vocabRoots.mastered")!)).toHaveLength(1);
    fireEvent.click(screen.getByTestId("vocab-shadow-prospective"));
    expect(screen.getByTestId("vocab-word-prospective").textContent).toMatch(/閉じる/);
  });
});
