import type { MistakeLibraryItem, ReviewItem, RootCauseValue, UiLang } from "./types";
import { ROOT_CAUSE_OPTIONS } from "./types";

function normalizeRootCause(value: string | null | undefined): RootCauseValue {
  return (value ?? "").trim().toLowerCase() as RootCauseValue;
}

export function rootCauseLabel(value: string | null | undefined): string {
  return rootCauseLabelByLocale(value, "zh");
}

export function rootCauseLabelByLocale(value: string | null | undefined, locale: UiLang = "zh"): string {
  const normalized = normalizeRootCause(value);
  const labelsByLocale: Record<UiLang, Record<RootCauseValue, string>> = {
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
    en: {
      "": "Unlabeled",
      vocab: "Vocabulary",
      grammar: "Grammar",
      logic: "Logic",
      careless: "Careless",
    },
  };
  const matched = ROOT_CAUSE_OPTIONS.find((item) => item.value === normalized)?.value ?? "";
  return labelsByLocale[locale]?.[matched] ?? labelsByLocale.en[""];
}

export function summarizeMistake(item: Pick<ReviewItem, "selectedKey" | "correctKey">, locale: UiLang = "zh"): string {
  if (!item.selectedKey) {
    if (locale === "ja") {
      return "この問題は未回答でした。ミス問題として記録されています。";
    }
    if (locale === "en") {
      return "This item was left unanswered and has been recorded as a mistake.";
    }
    return "这题当时未作答，系统按错题记录。";
  }
  if (item.selectedKey === item.correctKey) {
    if (locale === "ja") {
      return "この問題は正解です。追加の錯因分析は不要です。";
    }
    if (locale === "en") {
      return "This item is correct, so no extra mistake analysis is needed.";
    }
    return "这题作答正确，无需错因分析。";
  }
  if (locale === "ja") {
    return `あなたの回答は ${item.selectedKey}、正解は ${item.correctKey ?? "-"} です。`;
  }
  if (locale === "en") {
    return `You chose ${item.selectedKey}, while the correct answer is ${item.correctKey ?? "-"}.`;
  }
  return `你选了 ${item.selectedKey}，正确答案是 ${item.correctKey ?? "-"}`;
}

function partFixSteps(partNo: number | null, locale: UiLang): string[] {
  if (locale === "ja") {
    if (partNo === 1) {
      return [
        "写真の「主語 + 動作/状態」を先に特定し、見える事実だけで判断する。",
        "音声では名詞と動詞を先に拾い、時制・人物が合わない選択肢を除外する。",
        "解いた後に1文で要約し、感覚だけで選ばない癖をつける。",
      ];
    }
    if (partNo === 2) {
      return [
        "質問タイプを先に判別し、応答の意図が合うものだけ残す。",
        "同語反復ではなく、問いに直接つながる返答だけを選ぶ。",
        "時間・場所・理由のトリガー語を記録して1回聞き直す。",
      ];
    }
    if (partNo === 3 || partNo === 4) {
      return [
        "先に設問キーワードを確認してから音声を聞き、聞きながら位置を取る。",
        "選択肢比較では本文で明示された情報を最優先する。",
        "復習時に「聞き漏れ語」か「定位遅れ」を具体的に1つ記録する。",
      ];
    }
    if (partNo === 5) {
      return [
        "空欄の品詞を先に判定する。",
        "固定表現と時制トリガーを確認する。",
        "4択を代入し、文法と意味が両立する選択肢だけ残す。",
      ];
    }
    if (partNo === 6) {
      return [
        "空欄前後2文で論理関係を先に判断する。",
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
      "復習では再利用できる誤答パターンを1つ記録する。",
    ];
  }

  if (locale === "en") {
    if (partNo === 1) {
      return [
        "Identify the subject and visible action first, then keep only facts you can actually see.",
        "Listen for the main noun and verb, and eliminate options with the wrong tense or role.",
        "Summarize the picture in one sentence after answering so you stop guessing by feel.",
      ];
    }
    if (partNo === 2) {
      return [
        "Classify the question type first and keep only responses that match the intent.",
        "Do not reward word overlap if the reply does not logically answer the question.",
        "Mark time, place, and reason triggers, then replay once.",
      ];
    }
    if (partNo === 3 || partNo === 4) {
      return [
        "Read the question keywords first, then listen while tracking where each clue appears.",
        "When comparing options, prefer information that is explicitly stated in the audio.",
        "Write down one concrete issue in review: missed word or slow location.",
      ];
    }
    if (partNo === 5) {
      return [
        "Decide the blank's part of speech first.",
        "Check collocations and tense triggers before comparing choices.",
        "Substitute all four options and keep only the one that works in grammar and meaning.",
      ];
    }
    if (partNo === 6) {
      return [
        "Use the two surrounding sentences to identify the logical relationship first.",
        "Remove options whose tone or tense does not fit the paragraph.",
        "Re-read the full paragraph after answering to confirm the flow is natural.",
      ];
    }
    if (partNo === 7) {
      return [
        "Mark names, dates, numbers, and purpose words in the question first.",
        "Locate the evidence sentence in the passage and keep only evidence-based options.",
        "Do not rely on common-sense guesses if the passage points in a different direction.",
      ];
    }
    return [
      "Locate the question keyword first, then remove distractors one by one.",
      "Keep only options supported by the text or audio.",
      "Record one reusable error pattern during review.",
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
      "先判句型，只选对得上问法的回答。",
      "不选同词复读但逻辑不对的选项。",
      "做完标记触发词并复听1次。",
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
      "先看空格词性。",
      "再看固定搭配和时态触发词。",
      "最后快速代入四个选项，保留语法和语义同时成立的答案。",
    ];
  }
  if (partNo === 6) {
    return [
      "先看空格前后两句，判断逻辑关系。",
      "优先排除语气或时态与上下文不一致的选项。",
      "做完回读整段，确认句子通顺且语义连贯。",
    ];
  }
  if (partNo === 7) {
    return [
      "先圈题干关键词。",
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

function rootCauseFixSteps(rootCause: RootCauseValue, locale: UiLang): string[] {
  if (locale === "ja") {
    if (rootCause === "vocab") {
      return [
        "不明語を「意味・コロケーション・例文」の3行で記録する。",
        "当日2回復習し、翌日に再チェックする。",
      ];
    }
    if (rootCause === "grammar") {
      return [
        "この問題の文法トリガーを1行で書く。",
        "同ルールの問題を3問すぐ解いて、転移できるか確認する。",
      ];
    }
    if (rootCause === "logic") {
      return [
        "設問の問いを1文で言語化し、本文の根拠文を先に探す。",
        "誤選択肢の誘導点を記録し、同型のひっかけを先に除外する。",
      ];
    }
    if (rootCause === "careless") {
      return [
        "解答後に5秒チェックを必ず行う。",
        "提出前に通す個人チェックリストを1つ固定する。",
      ];
    }
    return [];
  }

  if (locale === "en") {
    if (rootCause === "vocab") {
      return [
        "Write the unknown word in three lines: meaning, collocation, and example.",
        "Review it twice today and test it again tomorrow.",
      ];
    }
    if (rootCause === "grammar") {
      return [
        "Write the grammar trigger for this item in one line.",
        "Do three more questions with the same rule immediately.",
      ];
    }
    if (rootCause === "logic") {
      return [
        "Rewrite what the question is actually asking in one sentence, then find the evidence line.",
        "Write down why the wrong choice looked tempting so you can reject that trap faster next time.",
      ];
    }
    if (rootCause === "careless") {
      return [
        "Force a five-second check for person, tense, negatives, and numbers before locking the answer.",
        "Use one fixed pre-submit checklist every time.",
      ];
    }
    return [];
  }

  if (rootCause === "vocab") {
    return [
      "把这题不熟词写成3行：词义、搭配、例句。",
      "今天内复习2次，明天再测一次。",
    ];
  }
  if (rootCause === "grammar") {
    return [
      "写出本题触发规则。",
      "立即做同规则3题，确保规则能迁移。",
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
      "答题后强制做5秒复核。",
      "给自己加一条检查清单，提交前必须过一遍。",
    ];
  }
  return [];
}

export function buildFixPlan(
  partNo: number | null,
  rootCause: string | null | undefined,
  locale: UiLang = "zh",
): string[] {
  const partSteps = partFixSteps(partNo, locale);
  const causeSteps = rootCauseFixSteps(normalizeRootCause(rootCause), locale);
  return [...partSteps, ...causeSteps].slice(0, 5);
}

export function inferRootCauseFromReview(item: ReviewItem): RootCauseValue {
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

export function buildReviewFixPlan(item: ReviewItem, locale: UiLang = "zh"): string[] {
  const rootCause = inferRootCauseFromReview(item);
  return buildFixPlan(item.partNo, rootCause, locale);
}

export function summarizeLibraryMistake(item: MistakeLibraryItem, locale: UiLang = "zh"): string {
  return summarizeMistake(
    {
      selectedKey: item.lastSelectedKey,
      correctKey: item.correctKey,
    },
    locale,
  );
}
