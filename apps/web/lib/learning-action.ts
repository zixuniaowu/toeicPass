import type { LearningActionCommand, SessionFilters } from "@toeicpass/shared";
import type { ViewTab } from "../types";
import { isListeningPart } from "../types";

export type { LearningActionCommand } from "@toeicpass/shared";

export type ParsedLearningAction = {
  command: LearningActionCommand;
  filters: SessionFilters;
};

const ACTION_ALIASES: Record<string, LearningActionCommand> = {
  practice: "practice:start",
  diagnostic: "diagnostic:start",
  mock: "mock:start",
  review: "mistakes:start",
  "review:start": "mistakes:start",
  mistakes: "mistakes:start",
  vocab: "vocab:start",
  shadowing: "shadowing:start",
};

const ALLOWED_COMMANDS = new Set<LearningActionCommand>([
  "practice:start",
  "diagnostic:start",
  "mock:start",
  "mistakes:start",
  "vocab:start",
  "shadowing:start",
]);

export function parseNumericFilter(value: string | null | undefined): number | undefined {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    return undefined;
  }
  const numericToken = normalized.match(/-?\d+(?:\.\d+)?/)?.[0] ?? normalized;
  const parsed = Number(numericToken);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toBoundedInteger(
  value: number | undefined,
  min: number,
  max: number,
): number | undefined {
  if (typeof value !== "number") {
    return undefined;
  }
  const rounded = Math.round(value);
  if (rounded < min || rounded > max) {
    return undefined;
  }
  return rounded;
}

function normalizeAction(action: string): string {
  const compact = action
    .replace(/\u3000/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return ACTION_ALIASES[compact] ?? compact;
}

export function parseLearningAction(action: string): ParsedLearningAction | null {
  const normalizedAction = normalizeAction(action);
  if (!normalizedAction) {
    return null;
  }

  const [rawCommand, queryString] = normalizedAction.split("?");
  const command = rawCommand.trim() as LearningActionCommand;
  if (!ALLOWED_COMMANDS.has(command)) {
    return null;
  }

  const query = new URLSearchParams(queryString ?? "");
  const partNo = toBoundedInteger(parseNumericFilter(query.get("part")), 1, 7);
  const difficulty = toBoundedInteger(parseNumericFilter(query.get("difficulty")), 1, 5);
  const rawPartGroup = query.get("partGroup");
  const partGroup =
    rawPartGroup === "listening" || rawPartGroup === "reading"
      ? rawPartGroup
      : undefined;

  return {
    command,
    filters: {
      partNo,
      difficulty,
      partGroup,
    },
  };
}

export function resolvePartGroupFromPart(
  partNo: number | undefined,
): SessionFilters["partGroup"] {
  if (typeof partNo !== "number") {
    return undefined;
  }
  return isListeningPart(partNo) ? "listening" : "reading";
}

export function resolveViewTabForPart(
  partNo: number | undefined,
  fallback: ViewTab = "listening",
): ViewTab {
  if (typeof partNo !== "number") {
    return fallback;
  }
  if (isListeningPart(partNo)) {
    return "listening";
  }
  if (partNo === 5) {
    return "grammar";
  }
  if (partNo === 6) {
    return "textcompletion";
  }
  return "reading";
}
