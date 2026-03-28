export type AttemptFilters = {
  partNo?: number;
  difficulty?: number;
  partGroup?: "listening" | "reading";
};

type RawAttemptFilters = {
  part?: string;
  difficulty?: string;
  partGroup?: string;
};

const parseNumericFilter = (value: string | undefined): number | undefined => {
  if (!value) {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  return parsed;
};

const toBoundedInteger = (
  value: number | undefined,
  min: number,
  max: number,
): number | undefined => {
  if (typeof value !== "number") {
    return undefined;
  }
  const rounded = Math.round(value);
  if (rounded < min || rounded > max) {
    return undefined;
  }
  return rounded;
};

export function parseAttemptFilters(input: RawAttemptFilters): AttemptFilters {
  const parsedPart = toBoundedInteger(parseNumericFilter(input.part), 1, 7);
  const parsedDifficulty = toBoundedInteger(parseNumericFilter(input.difficulty), 1, 5);

  return {
    partNo: parsedPart,
    difficulty: parsedDifficulty,
    partGroup: input.partGroup === "listening" || input.partGroup === "reading"
      ? input.partGroup
      : undefined,
  };
}
