import { describe, expect, it } from "vitest";
import {
  compareBest,
  compareJapaneseSegments,
  compareWords,
  japanesePhoneticKey,
  numberToKana,
} from "@toeicpass/app-core/shadowing-compare";

const seg = (...pairs: [string, string][]) => pairs.map(([surface, reading]) => ({ surface, reading }));
const en = (a: string, b: string) => compareWords(a, b, "en");

describe("English tolerant scoring", () => {
  it.each([
    ["It's 3 o'clock.", "it is three o'clock"],
    ["It’s fine", "it's fine"],
    ["I'll send it by 5 p.m.", "I will send it by 5 PM"],
    ["The meeting is at 10:30.", "the meeting is at 10 30"],
    ["The meeting is at 10:30.", "the meeting is at ten thirty"],
    ["We need 25 copies.", "we need twenty five copies"],
    ["Please review the e-mail.", "please review the email"],
    ["I'd like to buy two tickets.", "I'd like to buy to tickets"],
    ["The report's due Monday.", "the reports due Monday"],
    ["Don't forget the well-known rule", "don't forget the well known rule"],
    ["It costs $15.", "it costs fifteen dollars"],
    ["Their office is over there.", "there office is over their"],
    ["Hello, Mr. Smith!", "hello mister Smith"],
    ["The 1st floor", "the first floor"],
    ["We can't attend.", "we cannot attend"],
    ["Check the API latency.", "check the a p i latency"],
    ["We need a new API key.", "we need a new a p i key"],
    ["Open the checkout page.", "open the check out page"],
    ["Revenue rose 12% last quarter.", "revenue rose twelve percent last quarter"],
  ])("%s ≈ %s → 100%%", (target, heard) => {
    const r = en(target, heard);
    expect(r.accuracy).toBe(100);
    expect(r.words.every((w) => w.status === "correct")).toBe(true);
  });

  it("penalises extra words instead of ignoring them", () => {
    const r = en("please send the revised report to the manager", "please send the the revised report to the manager");
    expect(r.accuracy).toBeLessThan(100);
    expect(r.words.some((w) => w.status === "extra")).toBe(true);
  });

  it("ignores fillers", () => {
    expect(en("send the report", "uh send um the report").accuracy).toBe(100);
  });

  it("recovers alignment after several inserted words", () => {
    const r = en("please call me tomorrow", "please you know really call me tomorrow");
    expect(r.words.filter((w) => w.status === "correct").map((w) => w.word)).toEqual(["please", "call", "me", "tomorrow"]);
  });

  it("marks near-miss pronunciations as close with tips", () => {
    const r = en("I think this is right", "I sink this is light");
    const think = r.words.find((w) => w.word === "think")!;
    const right = r.words.find((w) => w.word === "right")!;
    expect(think.heard).toBe("sink");
    expect(think.tip).toBe("th-sound");
    expect(right.status).toBe("close");
    expect(r.accuracy).toBeGreaterThan(50);
    expect(r.accuracy).toBeLessThan(100);
  });

  it("reports dropped -ed endings", () => {
    const w = en("She worked yesterday", "she work yesterday").words.find((x) => x.word === "worked")!;
    expect(w.tip).toBe("ending-ed");
    expect(w.heard).toBe("work");
  });

  it("keeps contraction as one display word", () => {
    const r = en("It's ready", "it ready");
    expect(r.words[0].word).toBe("It's");
    expect(r.words[0].status).toBe("close");
    expect(r.words[0].tip).toBe("contraction");
  });

  it("gives 0 for unrelated speech and percentage in between", () => {
    expect(en("The quick brown fox", "banana").accuracy).toBeLessThan(20);
    const mid = en("we will review the budget on friday", "we review budget friday").accuracy;
    expect(mid).toBeGreaterThan(40);
    expect(mid).toBeLessThan(80);
  });

  it("compareBest picks the best alternative", () => {
    const r = compareBest("I'd like two tickets", ["I like to ticket", "I'd like two tickets"], "en");
    expect(r.accuracy).toBe(100);
    expect(r.transcript).toBe("I'd like two tickets");
  });
});

describe("Japanese tolerant scoring", () => {
  it.each([
    [seg(["今日", "きょう"], ["は", "は"], ["会議", "かいぎ"], ["が", "が"], ["あります", "あります"]), "きょうはかいぎがあります"],
    [seg(["三", "さん"], ["時", "じ"], ["に", "に"], ["来", "き"], ["ます", "ます"]), "3じにきます"],
    [seg(["こんにちは", "こんにちは"]), "こんにちわ"],
    [seg(["コーヒー", "コーヒー"], ["を", "を"], ["ください", "ください"]), "こーひーおください"],
    [seg(["ありがとう", "ありがとう"], ["ございます", "ございます"]), "ありがとーございます"],
    [seg(["はい", "はい"], ["、", "、"], ["そうです", "そうです"]), "はい。そうです！"],
    [seg(["よろしく", "よろしく"], ["お願い", "おねがい"], ["し", "し"], ["ます", "ます"]), "よろしくおねがいします"],
    [seg(["駅", "えき"], ["へ", "へ"], ["行きます", "いきます"]), "えきえいきます"],
    [seg(["ケーキ", "ケーキ"]), "けえき"],
    [seg(["先生", "せんせい"]), "せんせー"],
  ])("%#: matches tolerant variants", (segments, heard) => {
    const r = compareJapaneseSegments(segments, heard);
    expect(r.accuracy).toBe(100);
  });

  it("flags a missing long vowel as close with a tip", () => {
    const r = compareJapaneseSegments(seg(["東京", "とうきょう"], ["に", "に"], ["行きます", "いきます"]), "ときょうにいきます");
    expect(r.words[0].status).toBe("close");
    expect(r.words[0].tip).toBe("long-vowel");
    expect(r.accuracy).toBeGreaterThan(70);
  });

  it("flags a missing small tsu", () => {
    const r = compareJapaneseSegments(seg(["切手", "きって"]), "きて");
    expect(r.words[0].tip).toBe("small-tsu");
  });

  it("reports extra and missing segments", () => {
    const r = compareJapaneseSegments(seg(["資料", "しりょう"], ["を", "を"], ["送ります", "おくります"]), "しりょうおくります");
    expect(r.accuracy).toBeLessThan(100);
    expect(r.words.some((w) => w.status !== "correct")).toBe(true);
  });

  it("phonetic key folds kana variations", () => {
    expect(japanesePhoneticKey("トウキョウ")).toBe(japanesePhoneticKey("とーきょー"));
    expect(numberToKana(300)).toBe("さんびゃく");
    expect(numberToKana(2026)).toBe("にせんにじゅうろく");
    expect(numberToKana(8000)).toBe("はっせん");
  });
});
