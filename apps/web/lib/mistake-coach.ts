import type { MistakeLibraryItem, ReviewItem } from "../types";
import { ROOT_CAUSE_OPTIONS } from "../types";

function normalizeRootCause(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function rootCauseLabel(value: string | null | undefined): string {
  const normalized = normalizeRootCause(value);
  const matched = ROOT_CAUSE_OPTIONS.find((item) => item.value === normalized);
  if (matched) {
    return matched.label;
  }
  return "未标注";
}

export function summarizeMistake(item: Pick<ReviewItem, "selectedKey" | "correctKey">): string {
  if (!item.selectedKey) {
    return "这题当时未作答，系统按错题记录。";
  }
  if (item.selectedKey === item.correctKey) {
    return "这题作答正确，无需错因分析。";
  }
  return `你选了 ${item.selectedKey}，正确答案是 ${item.correctKey ?? "-"}`;
}

function partFixSteps(partNo: number | null): string[] {
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

function rootCauseFixSteps(rootCause: string): string[] {
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

export function buildFixPlan(partNo: number | null, rootCause: string | null | undefined): string[] {
  const partSteps = partFixSteps(partNo);
  const causeSteps = rootCauseFixSteps(normalizeRootCause(rootCause));
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

export function buildReviewFixPlan(item: ReviewItem): string[] {
  const rootCause = inferRootCauseFromReview(item);
  return buildFixPlan(item.partNo, rootCause);
}

export function summarizeLibraryMistake(item: MistakeLibraryItem): string {
  return summarizeMistake({
    selectedKey: item.lastSelectedKey,
    correctKey: item.correctKey,
  });
}
