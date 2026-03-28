import { evaluateQuestionQuality } from "./question-quality";
import { Question } from "./types";

export function isQuestionEligible(question: Question): boolean {
  return evaluateQuestionQuality(question).valid;
}

export function isAttemptSelectableQuestion(question: Question): boolean {
  if (!isQuestionEligible(question)) {
    return false;
  }
  if (question.partNo >= 1 && question.partNo <= 4) {
    const mediaUrl = String(question.mediaUrl ?? "").trim();
    if (!mediaUrl) {
      return false;
    }
    return /#t=\d+(?:\.\d+)?,\d+(?:\.\d+)?$/i.test(mediaUrl);
  }
  return true;
}

export function isDisplayablePart1Image(question: Question): boolean {
  if (question.partNo !== 1 || !question.imageUrl) {
    return false;
  }
  const image = question.imageUrl.trim().toLowerCase();
  if (!image) {
    return false;
  }
  if (image.startsWith("data:image")) {
    return false;
  }
  return true;
}

export function isTrustedPart1VisualQuestion(question: Question): boolean {
  if (!isDisplayablePart1Image(question)) {
    return false;
  }
  const imageUrl = question.imageUrl;
  if (!imageUrl) {
    return false;
  }
  if (!isQuestionEligible(question)) {
    return false;
  }
  const image = imageUrl.toLowerCase();
  const corpus = `${question.stem} ${question.options.map((opt) => opt.text).join(" ")}`.toLowerCase();
  if (image.includes("bicycles")) {
    return /(bicycle|bike|fence|parked)/.test(corpus);
  }
  if (image.includes("truck") || image.includes("unloading")) {
    return /(truck|box|loading|unloading|delivery)/.test(corpus);
  }
  if (image.includes("filing") || image.includes("cabinet")) {
    return /(filing|cabinet|drawer|office)/.test(corpus);
  }
  return false;
}
