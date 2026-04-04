import { Question } from "./types";

type Part1Rule = {
  imageUrl: string;
  token: string;
  pattern: RegExp;
  strictPattern: RegExp;
};

const PART1_RULES: Part1Rule[] = [
  {
    imageUrl: "/assets/images/listening/part1-bicycles-real.jpg",
    token: "bicycles",
    pattern: /(bicycle|bike|fence|parked)/,
    strictPattern: /(bicycle|bike|fence|parked|lined up|row)/,
  },
  {
    imageUrl: "/assets/images/listening/part1-unloading-truck.jpg",
    token: "truck",
    pattern: /(truck|box|loading|unloading|delivery)/,
    strictPattern: /(truck|flatbed|delivery|loading dock|unloading|crate)/,
  },
  {
    imageUrl: "/assets/images/listening/part1-filing-cabinets.jpg",
    token: "filing",
    pattern: /(filing|cabinet|drawer|office)/,
    strictPattern: /(filing|cabinet|drawer)/,
  },
  {
    imageUrl: "/assets/images/listening/part1-restaurant-dining.jpg",
    token: "restaurant",
    pattern: /(restaurant|dining|table|chair|seated|meal)/,
    strictPattern: /(restaurant|dining|table.*set|seated|empty.*table)/,
  },
  {
    imageUrl: "/assets/images/listening/part1-construction-site.jpg",
    token: "construction",
    pattern: /(construction|worker|hard hat|helmet|building|rebar|steel)/,
    strictPattern: /(construction|hard hat|helmet|rebar|steel bar|building site)/,
  },
  {
    imageUrl: "/assets/images/listening/part1-library-reading.jpg",
    token: "library",
    pattern: /(library|book|bookshelf|shelf|reading)/,
    strictPattern: /(library|bookshelf|books.*shelf|shelved)/,
  },
  {
    imageUrl: "/assets/images/listening/part1-warehouse-boxes.jpg",
    token: "warehouse",
    pattern: /(warehouse|shelf|storage|aisle|inventory|boxes)/,
    strictPattern: /(warehouse|storage.*shelf|aisle|inventory|stacked.*boxes)/,
  },
  {
    imageUrl: "/assets/images/listening/part1-garden-flowers.jpg",
    token: "garden",
    pattern: /(garden|flower|path|bush|hedge|bloom)/,
    strictPattern: /(garden|flower.*path|hedge|bloom|walkway)/,
  },
  {
    imageUrl: "/assets/images/listening/part1-office-meeting.jpg",
    token: "meeting",
    pattern: /(meeting|presentation|sticky note|whiteboard|laptop|colleague)/,
    strictPattern: /(meeting|presentation|sticky note|whiteboard|brainstorm)/,
  },
  {
    imageUrl: "/assets/images/listening/part1-airport-terminal.jpg",
    token: "airport",
    pattern: /(airplane|plane|aircraft|flying|landing|runway|airport|tarmac)/,
    strictPattern: /(airplane|plane|aircraft|landing|takeoff|runway|airport|tarmac)/,
  },
  {
    imageUrl: "/assets/images/listening/part1-kitchen-cooking.jpg",
    token: "kitchen",
    pattern: /(kitchen|cooking|pot|pan|stove|apron|recipe)/,
    strictPattern: /(kitchen|cooking|apron|stove|counter|preparing food)/,
  },
  {
    imageUrl: "/assets/images/listening/part1-parking-lot.jpg",
    token: "parking",
    pattern: /(parking|car|vehicle|lot|space|parked)/,
    strictPattern: /(parking lot|parked.*car|vehicle|parking space)/,
  },
  {
    imageUrl: "/assets/images/listening/part1-classroom-students.jpg",
    token: "classroom",
    pattern: /(classroom|desk|chalkboard|blackboard|student|chair)/,
    strictPattern: /(classroom|chalkboard|blackboard|desk.*chair)/,
  },
  {
    imageUrl: "/assets/images/listening/part1-supermarket-shelves.jpg",
    token: "supermarket",
    pattern: /(supermarket|grocery|product|cereal|aisle|shopping)/,
    strictPattern: /(supermarket|grocery|cereal|product.*shelf|shopping aisle)/,
  },
  {
    imageUrl: "/assets/images/listening/part1-boat-lake.jpg",
    token: "boat",
    pattern: /(boat|lake|water|mountain|rowing|canoe)/,
    strictPattern: /(boat|lake|canoe|rowing|waterfront)/,
  },
  {
    imageUrl: "/assets/images/listening/part1-park-bench.jpg",
    token: "park",
    pattern: /(park|grass|tree|outdoor|walking|lawn)/,
    strictPattern: /(park|grass|tree|lawn|outdoor.*walk)/,
  },
];

export type QuestionQualityIssue =
  | "invalid-part"
  | "stem-too-short"
  | "options-not-4"
  | "option-text-empty"
  | "correct-option-count"
  | "listening-missing-media"
  | "part1-missing-image"
  | "part1-image-mismatch"
  | "part2-non-question-prompt"
  | "part3-context-too-short"
  | "part4-context-too-short"
  | "part5-missing-blank"
  | "part6-missing-blank"
  | "part6-context-too-thin"
  | "part7-missing-passage"
  | "part7-passage-too-short"
  | "part7-passage-too-thin"
  | "part7-stem-not-question";

export type QuestionQualityReport = {
  valid: boolean;
  issues: QuestionQualityIssue[];
};

export function buildQuestionCorpus(stem: string, optionTexts: string[]): string {
  return `${stem} ${optionTexts.join(" ")}`.trim().toLowerCase();
}

function part1RuleFromImage(imageUrl: string): Part1Rule | undefined {
  const lowered = imageUrl.toLowerCase();
  if (lowered.startsWith("data:")) {
    return undefined;
  }
  return PART1_RULES.find((rule) => lowered.includes(rule.token));
}

function patternHitCount(text: string, pattern: RegExp): number {
  const scopedPattern = new RegExp(pattern.source, "g");
  const matches = text.match(scopedPattern);
  return matches?.length ?? 0;
}

export function isKnownPart1Image(imageUrl: string): boolean {
  return Boolean(part1RuleFromImage(imageUrl));
}

export function isPart1ImageMatch(imageUrl: string, corpus: string): boolean {
  const rule = part1RuleFromImage(imageUrl);
  if (!rule) {
    return true;
  }
  return rule.pattern.test(corpus.toLowerCase());
}

export function isPart1QuestionStrongMatch(
  imageUrl: string,
  stem: string,
  optionTexts: string[],
  correctOptionText: string,
): boolean {
  const rule = part1RuleFromImage(imageUrl);
  if (!rule) {
    return true;
  }
  const strict = rule.strictPattern;
  const stemHit = strict.test(stem.toLowerCase());
  const correctHit = strict.test(correctOptionText.toLowerCase());
  if (!stemHit || !correctHit) {
    return false;
  }
  const wrongMatches = optionTexts
    .filter((text) => text.trim().toLowerCase() !== correctOptionText.trim().toLowerCase())
    .filter((text) => strict.test(text.toLowerCase()))
    .length;
  return wrongMatches <= 1;
}

export function resolvePart1ImageFromQuestion(stem: string, optionTexts: string[]): string | undefined {
  const corpus = buildQuestionCorpus(stem, optionTexts);
  let bestRule: Part1Rule | undefined;
  let bestScore = 0;
  PART1_RULES.forEach((rule) => {
    const score = patternHitCount(corpus, rule.pattern);
    if (score > bestScore) {
      bestScore = score;
      bestRule = rule;
    }
  });
  if (!bestRule || bestScore < 2) {
    return undefined;
  }
  if (!bestRule.strictPattern.test(corpus.toLowerCase())) {
    return undefined;
  }
  return bestRule.imageUrl;
}

export function isQuestionLikePrompt(text: string): boolean {
  const normalized = text.trim();
  if (!normalized) {
    return false;
  }
  if (normalized.endsWith("?")) {
    return true;
  }
  return /^(could|would|can|will|when|where|why|how|who|what|which|do|did|is|are|please)\b/i.test(
    normalized,
  );
}

function optionsLookLikeResponses(optionTexts: string[]): boolean {
  return optionTexts.some((text) =>
    /^(yes|no|sure|of course|then|well|actually|i|we|he|she|they|there|in|at|on|by|to|what|when|where|why|how)\b/i.test(
      text,
    ),
  );
}

export function countSentences(text: string): number {
  return (text.match(/[.!?](\s|$)/g) ?? []).length;
}

export function evaluateQuestionQuality(question: Question): QuestionQualityReport {
  const issues: QuestionQualityIssue[] = [];
  const partNo = Number(question.partNo);
  const stem = String(question.stem ?? "").trim();
  const options = Array.isArray(question.options) ? question.options : [];
  const optionTexts = options.map((item) => String(item.text ?? "").trim());

  if (!Number.isFinite(partNo) || partNo < 1 || partNo > 7) {
    issues.push("invalid-part");
  }
  if (stem.length < 8) {
    issues.push("stem-too-short");
  }
  const hasValidOptionCount =
    partNo === 2
      ? options.length === 3 || options.length === 4
      : options.length === 4;
  if (!hasValidOptionCount) {
    issues.push("options-not-4");
  }
  if (optionTexts.some((text) => text.length === 0)) {
    issues.push("option-text-empty");
  }
  if (options.filter((opt) => opt.isCorrect).length !== 1) {
    issues.push("correct-option-count");
  }

  if (partNo >= 1 && partNo <= 4 && !String(question.mediaUrl ?? "").trim()) {
    const allowMissingOfficialAudio = question.source === "official_pack" && partNo <= 4;
    if (!allowMissingOfficialAudio) {
      issues.push("listening-missing-media");
    }
  }

  if (partNo === 1) {
    const imageUrl = String(question.imageUrl ?? "").trim();
    if (!imageUrl) {
      issues.push("part1-missing-image");
    } else {
      const corpus = buildQuestionCorpus(stem, optionTexts);
      if (!isPart1ImageMatch(imageUrl, corpus)) {
        issues.push("part1-image-mismatch");
      } else {
        const correctText = options.find((opt) => opt.isCorrect)?.text ?? "";
        if (!isPart1QuestionStrongMatch(imageUrl, stem, optionTexts, String(correctText))) {
          issues.push("part1-image-mismatch");
        }
      }
    }
  }

  if (partNo === 2) {
    const statementLike = stem.endsWith(".");
    const declarativeLike = /^(i|you|he|she|they|we|it|there)\b/i.test(stem);
    const questionLike = isQuestionLikePrompt(stem);
    if (!questionLike && !((statementLike || declarativeLike) && optionsLookLikeResponses(optionTexts))) {
      issues.push("part2-non-question-prompt");
    }
  }

  if (partNo === 3 && stem.length < 12) {
    issues.push("part3-context-too-short");
  }

  if (partNo === 4 && stem.length < 12) {
    issues.push("part4-context-too-short");
  }

  if (partNo === 5 && !stem.includes("___")) {
    issues.push("part5-missing-blank");
  }

  if (partNo === 6) {
    if (!stem.includes("___")) {
      issues.push("part6-missing-blank");
    }
    const contextText = `${question.passage ?? ""} ${stem}`.trim();
    const sentenceCount = countSentences(contextText);
    const hasMultilineContext = /\n/.test(contextText) && contextText.length >= 90;
    if (contextText.length < 60 || (sentenceCount < 2 && !hasMultilineContext)) {
      issues.push("part6-context-too-thin");
    }
  }

  if (partNo === 7) {
    const passage = String(question.passage ?? "").trim();
    if (!passage) {
      issues.push("part7-missing-passage");
    } else {
      const sentenceCount = countSentences(passage);
      const hasMultilineContext = /\n/.test(passage) && passage.length >= 110;
      if (passage.length < 90) {
        issues.push("part7-passage-too-short");
      }
      if (sentenceCount < 2 && !hasMultilineContext) {
        issues.push("part7-passage-too-thin");
      }
    }
    if (!stem.endsWith("?")) {
      issues.push("part7-stem-not-question");
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}
