import type { LearningActionCommand, LearningPartGroup } from "@toeicpass/shared";

export type { LearningActionCommand, LearningPartGroup } from "@toeicpass/shared";

type ParsedLearningAction = {
  command: LearningActionCommand;
  partNo?: number;
  difficulty?: number;
  partGroup?: LearningPartGroup;
};

const LEARNING_ACTION_ALIASES: Record<string, LearningActionCommand> = {
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

const normalize = (value: string): string =>
  value
    .replace(/\u3000/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const parseBoundedInt = (rawValue: string | null, min: number, max: number): number | undefined => {
  if (rawValue === null) {
    return undefined;
  }
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  const rounded = Math.round(parsed);
  if (rounded < min || rounded > max) {
    return undefined;
  }
  return rounded;
};

const parseLearningAction = (action: string): ParsedLearningAction | null => {
  const compact = normalize(action);
  if (!compact) {
    return null;
  }

  const [rawCommand, rawQuery] = compact.split("?", 2);
  const commandToken = rawCommand.trim();
  const command = LEARNING_ACTION_ALIASES[commandToken] ?? commandToken;
  if (!ALLOWED_COMMANDS.has(command as LearningActionCommand)) {
    return null;
  }

  const query = new URLSearchParams(rawQuery ?? "");
  const partNo = parseBoundedInt(query.get("part"), 1, 7);
  const difficulty = parseBoundedInt(query.get("difficulty"), 1, 5);
  const partGroupRaw = query.get("partGroup");
  const partGroup =
    partGroupRaw === "listening" || partGroupRaw === "reading"
      ? partGroupRaw
      : undefined;

  return {
    command: command as LearningActionCommand,
    partNo,
    difficulty,
    partGroup,
  };
};

const buildLearningAction = (action: ParsedLearningAction): string => {
  const query = new URLSearchParams();
  if (typeof action.partNo === "number") {
    query.set("part", String(action.partNo));
  }
  if (typeof action.difficulty === "number") {
    query.set("difficulty", String(action.difficulty));
  }
  if (action.partGroup) {
    query.set("partGroup", action.partGroup);
  }
  const queryText = query.toString();
  return queryText ? `${action.command}?${queryText}` : action.command;
};

export function sanitizeLearningAction(action: string): string {
  const parsed = parseLearningAction(action);
  if (!parsed) {
    return "practice:start";
  }
  return buildLearningAction(parsed);
}
