import type { Locale, MistakeLibraryItem, ReviewItem } from "../types";
import { ROOT_CAUSE_OPTIONS } from "../types";

function normalizeRootCause(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function rootCauseLabel(value: string | null | undefined): string {
  return rootCauseLabelByLocale(value, "zh");
}

export function rootCauseLabelByLocale(value: string | null | undefined, locale: Locale = "zh"): string {
  const normalized = normalizeRootCause(value);
  const labelsByLocale: Record<Locale, Record<string, string>> = {
    zh: {
      "": "未标注",
      vocab: "词汇",
      grammar: "语法",
      logic: "逻辑理解",
      careless: "粗心",
    },
    ja: {
      "": "未選択",
      vocab: "語彙",
      grammar: "文法",
      logic: "論理理解",
      careless: "不注意ミス",
    },
  };
  const matched = ROOT_CAUSE_OPTIONS.find((item) => item.value === normalized)?.value ?? "";
  const labels = labelsByLocale[locale];
  if (matched in labels) {
    return labels[matched];
  }
  return labels[""];
}

export function summarizeMistake(item: Pick<ReviewItem, "selectedKey" | "correctKey">, locale: Locale = "zh"): string {
  if (!item.selectedKey) {
    return locale === "ja"
      ? "この問題は未回答でした。ミス問題として記録されています。"
      : "这题当时未作答，系统按错题记录。";
  }
  if (item.selectedKey === item.correctKey) {
    return locale === "ja"
      ? "この問題は正解です。追加の錯因分析は不要です。"
      : "这题作答正确，无需错因分析。";
  }
  return locale === "ja"
    ? `あなたの回答は ${item.selectedKey}、正解は ${item.correctKey ?? "-"} です。`
    : `你选了 ${item.selectedKey}，正确答案是 ${item.correctKey ?? "-"}`;
}

function partFixSteps(partNo: number | null, locale: Locale): string[] {
  if (locale === "ja") {
    if (partNo === 1) {
      return [
        "写真の「主語 + 動作/状態」を先に特定し、見える事実だけで判断する。",
        "音声では名詞と動詞を先に拾い、時制・人物が合わない選択肢を除外する。",
        "解いた後に 1 文で要約し、感覚だけで選ばない癖をつける。",
      ];
    }
    if (partNo === 2) {
      return [
        "質問タイプ（When/Where/Why/How/Yes-No/応答）を先に判別する。",
        "同語反復ではなく、質問意図に合う応答だけを選ぶ。",
        "時間・場所・理由のトリガー語を記録して 1 回聞き直す。",
      ];
    }
    if (partNo === 3 || partNo === 4) {
      return [
        "先に設問キーワードを確認してから音声を聞き、聞きながら位置を取る。",
        "選択肢比較では本文で明示された情報を最優先する。",
        "復習時に「聞き漏れ語」か「定位遅れ」を具体的に 1 つ記録する。",
      ];
    }
    if (partNo === 5) {
      return [
        "空欄の品詞（名詞/動詞/形容詞/副詞）を先に判定する。",
        "固定表現と時制トリガー（by, since, already など）を確認する。",
        "4択を代入し、文法と意味が両立する選択肢だけ残す。",
      ];
    }
    if (partNo === 6) {
      return [
        "空欄前後 2 文で論理関係（並列/逆接/因果）を先に判断する。",
        "文脈と時制・語調が一致しない選択肢を優先的に除外する。",
        "解答後に段落全体を読み直し、自然な流れか確認する。",
      ];
    }
    if (partNo === 7) {
      return [
        "設問の固有名詞・時間・数字・目的語を先にマークする。",
        "本文の根拠文を定位し、根拠がある選択肢だけ選ぶ。",
        "常識推測は使わず、本文の方向と一致する内容を選ぶ。",
      ];
    }
    return [
      "設問キーワードを先に定位してから、選択肢を順に除外する。",
      "本文または音声に根拠がある選択肢だけ残す。",
      "復習では再利用できる誤答パターンを 1 つ記録する。",
    ];
  }

  if (partNo === 1) {
    return [
      "先看图里“主语 + 动作/状态”，只保留肉眼可见事实。",
      "听音频先抓名词和动词，再排除时态或角色不匹配选项。",
      "做完复述一句：谁在做什么，避免靠感觉乱选。",
    ];
  }
  if (partNo === 2) {
    return [
      "先判句型（When/Where/Why/How/Yes-No/陈述回应）。",
      "只选“对得上问法”的回答，不选同词复读但逻辑错的。",
      "做完标记触发词（时间/地点/原因）并复听 1 次。",
    ];
  }
  if (partNo === 3 || partNo === 4) {
    return [
      "先读题干关键词，再播放音频，边听边定位关键词。",
      "选项对比时优先看信息是否被原文明确提到。",
      "错题强化时写下“听漏词”或“定位慢”的具体点。",
    ];
  }
  if (partNo === 5) {
    return [
      "先看空格词性（名词/动词/形容词/副词）。",
      "再看固定搭配和时态触发词（by, since, already 等）。",
      "最后快速代入四个选项，保留语法和语义同时成立的答案。",
    ];
  }
  if (partNo === 6) {
    return [
      "先看空格前后两句，判断逻辑关系（并列/转折/因果）。",
      "优先排除语气或时态与上下文不一致的选项。",
      "做完回读整段，确认句子通顺且语义连贯。",
    ];
  }
  if (partNo === 7) {
    return [
      "先圈题干关键词（人名/时间/数字/目的词）。",
      "回到原文定位对应句，答案必须有文本依据。",
      "不靠常识推测，选项要和原文表达方向一致。",
    ];
  }
  return [
    "先定位题干关键词，再逐项排除干扰项。",
    "只保留有文本或音频依据的选项。",
    "做完记录一个可复用的错误模式。",
  ];
}

function rootCauseFixSteps(rootCause: string, locale: Locale): string[] {
  if (locale === "ja") {
    if (rootCause === "vocab") {
      return [
        "不明語を「意味・コロケーション・例文」の 3 行で記録する。",
        "当日 2 回（今 + 4 時間後）復習し、翌日に再チェックする。",
      ];
    }
    if (rootCause === "grammar") {
      return [
        "この問題の文法トリガー（時制・節・一致など）を 1 行で書く。",
        "同ルールの問題を 3 問すぐ解いて、転移できるか確認する。",
      ];
    }
    if (rootCause === "logic") {
      return [
        "設問の問いを 1 文で言語化し、本文の根拠文を先に探す。",
        "誤選択肢の誘導点を記録し、同型のひっかけを先に除外する。",
      ];
    }
    if (rootCause === "careless") {
      return [
        "解答後に 5 秒チェック（人称・時制・否定語・数字）を必ず行う。",
        "提出前に通す個人チェックリストを 1 つ固定する。",
      ];
    }
    return [];
  }

  if (rootCause === "vocab") {
    return [
      "把这题不熟词写成 3 行：词义、搭配、例句。",
      "今天内复习 2 次（现在 + 4 小时后），明天再测一次。",
    ];
  }
  if (rootCause === "grammar") {
    return [
      "写出本题触发规则（如时态、从句、主谓一致）。",
      "立即做同规则 3 题，确保规则能迁移。",
    ];
  }
  if (rootCause === "logic") {
    return [
      "用一句话写清题干在问什么，再去找原文证据句。",
      "把错选项的误导点写出来，下次先排这种干扰。",
    ];
  }
  if (rootCause === "careless") {
    return [
      "答题后强制做 5 秒复核：人称、时态、否定词、数字。",
      "给自己加一条检查清单，提交前必须过一遍。",
    ];
  }
  return [];
}

export function buildFixPlan(
  partNo: number | null,
  rootCause: string | null | undefined,
  locale: Locale = "zh",
): string[] {
  const partSteps = partFixSteps(partNo, locale);
  const causeSteps = rootCauseFixSteps(normalizeRootCause(rootCause), locale);
  return [...partSteps, ...causeSteps].slice(0, 5);
}

export function inferRootCauseFromReview(item: ReviewItem): string {
  const text = `${item.stem} ${item.explanation}`.toLowerCase();
  if (/(grammar|tense|verb|preposition|conjunction|subject|agreement|article)/.test(text)) {
    return "grammar";
  }
  if (/(vocabulary|word|meaning|term|definition|phrase)/.test(text)) {
    return "vocab";
  }
  if (item.partNo === 7 || item.partNo === 6 || item.partNo === 3 || item.partNo === 4) {
    return "logic";
  }
  return "careless";
}

export function buildReviewFixPlan(item: ReviewItem, locale: Locale = "zh"): string[] {
  const rootCause = inferRootCauseFromReview(item);
  return buildFixPlan(item.partNo, rootCause, locale);
}

export function summarizeLibraryMistake(item: MistakeLibraryItem, locale: Locale = "zh"): string {
  return summarizeMistake({
    selectedKey: item.lastSelectedKey,
    correctKey: item.correctKey,
  }, locale);
}
