import {
  buildQuestionCorpus,
  isKnownPart1Image,
  isPart1ImageMatch,
  isPart1QuestionStrongMatch,
  resolvePart1ImageFromQuestion,
} from "./question-quality";

export function normalizePart1Image(
  imageUrl: string | undefined,
  stem: string,
  optionTexts: string[],
  correctOptionText?: string,
): string | undefined {
  const normalizedImageUrl = imageUrl?.trim();
  const corpus = buildQuestionCorpus(stem, optionTexts);
  const derived = resolvePart1ImageFromQuestion(stem, optionTexts);

  if (normalizedImageUrl) {
    if (!isKnownPart1Image(normalizedImageUrl)) {
      return normalizedImageUrl;
    }
    if (isPart1ImageMatch(normalizedImageUrl, corpus)) {
      if (!correctOptionText || isPart1QuestionStrongMatch(normalizedImageUrl, stem, optionTexts, correctOptionText)) {
        return normalizedImageUrl;
      }
    }
  }

  if (derived) {
    if (isPart1ImageMatch(derived, corpus)) {
      if (!correctOptionText || isPart1QuestionStrongMatch(derived, stem, optionTexts, correctOptionText)) {
        return derived;
      }
    }
  }

  return syntheticPart1ImageFromStem(stem);
}

export function syntheticPart1ImageFromStem(stem: string): string {
  const normalizedStem = stem.trim().replace(/\s+/g, " ");
  const lines = wrapSyntheticCaption(normalizedStem, 34, 3);
  const escapedLines = lines.map((line) => escapeSvgText(line));
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f2f6ff"/>
      <stop offset="100%" stop-color="#e7eef9"/>
    </linearGradient>
  </defs>
  <rect width="960" height="540" fill="url(#bg)"/>
  <rect x="64" y="60" width="832" height="420" rx="20" fill="#ffffff" stroke="#c7d7f1" stroke-width="3"/>
  <text x="96" y="118" font-size="32" font-family="Segoe UI, Arial, sans-serif" fill="#1f3a6d" font-weight="700">TOEIC Part 1 Visual Cue</text>
  <text x="96" y="168" font-size="22" font-family="Segoe UI, Arial, sans-serif" fill="#445b82">Use the image description below to match the audio options.</text>
  <text x="96" y="238" font-size="30" font-family="Segoe UI, Arial, sans-serif" fill="#1f2a3d">${escapedLines[0] ?? ""}</text>
  <text x="96" y="288" font-size="30" font-family="Segoe UI, Arial, sans-serif" fill="#1f2a3d">${escapedLines[1] ?? ""}</text>
  <text x="96" y="338" font-size="30" font-family="Segoe UI, Arial, sans-serif" fill="#1f2a3d">${escapedLines[2] ?? ""}</text>
</svg>`.trim();
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function wrapSyntheticCaption(text: string, lineWidth: number, maxLines: number): string[] {
  const words = text.split(" ").filter(Boolean);
  if (words.length === 0) {
    return ["Image description unavailable"];
  }
  const lines: string[] = [];
  let current = "";

  words.forEach((word) => {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= lineWidth) {
      current = candidate;
      return;
    }
    if (current) {
      lines.push(current);
    }
    current = word;
  });
  if (current) {
    lines.push(current);
  }

  if (lines.length > maxLines) {
    const clipped = lines.slice(0, maxLines);
    const last = clipped[maxLines - 1];
    clipped[maxLines - 1] = last.length > lineWidth - 3 ? `${last.slice(0, lineWidth - 3)}...` : `${last}...`;
    return clipped;
  }

  return lines;
}

export function escapeSvgText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function padOptionsToFour(
  options: Array<{ key: "A" | "B" | "C" | "D"; text: string; sourceKey?: string; isCorrect?: boolean }>,
  stem: string,
  partNo?: number,
  source?: string,
): void {
  if (partNo === 2 && source === "official_pack") {
    return;
  }
  const fallback = [
    "No additional details were provided.",
    "The information is not mentioned.",
    "The request has already been completed.",
    "The schedule remains unchanged.",
  ];
  while (options.length < 4) {
    const key = ["A", "B", "C", "D"][options.length] as "A" | "B" | "C" | "D";
    const text = fallback[options.length - 1] ?? `Not related to: ${stem.slice(0, 24)}`;
    options.push({ key, text, sourceKey: key, isCorrect: false });
  }
}

export function defaultSkillTag(partNo: number): string {
  if (partNo === 1) return "photo-description";
  if (partNo === 2) return "question-response";
  if (partNo === 3) return "conversation-detail";
  if (partNo === 4) return "talk-detail";
  if (partNo === 5) return "grammar";
  if (partNo === 6) return "text-completion";
  return "reading-comprehension";
}

export function normalizeSkillTag(tag: string, partNo: number): string {
  if (!tag) return defaultSkillTag(partNo);

  const CANONICAL: Record<number, Record<string, string>> = {
    2: { "short-response": "question-response" },
    3: {
      "short-conversation": "conversation-detail",
      "conversation-location": "conversation-detail",
      "conversation-action": "conversation-detail",
      "conversation-purpose": "conversation-detail",
      "conversation-problem": "conversation-detail",
      "conversation-topic": "conversation-detail",
      "conversation-reason": "conversation-detail",
      "conversation-suggestion": "conversation-detail",
      "conversation-situation": "conversation-detail",
      "conversation-inference": "conversation-detail",
    },
    4: {
      "short-talk": "talk-detail",
      "talk-purpose": "talk-detail", "talk-location": "talk-detail",
      "talk-instruction": "talk-detail", "talk-rule": "talk-detail",
      "talk-audience": "talk-detail", "talk-topic": "talk-detail",
      "talk-benefit": "talk-detail", "talk-reason": "talk-detail",
      "talk-main-idea": "talk-detail", "talk-requirement": "talk-detail",
      "talk-condition": "talk-detail", "talk-suggestion": "talk-detail",
      "talk-inference": "talk-detail",
    },
    5: {
      "grammar-preposition": "grammar", "grammar-preposition-time": "grammar",
      "grammar-participle": "grammar",
      "grammar-adverb": "grammar", "grammar-passive": "grammar",
      "grammar-conjunction": "grammar", "grammar-conditional": "grammar",
      "grammar-inversion": "grammar", "grammar-verb": "grammar",
      "grammar-article": "grammar", "grammar-comparative": "grammar",
      "grammar-infinitive": "grammar", "grammar-gerund": "grammar",
      "grammar-relative": "grammar", "grammar-subject-verb": "grammar",
      "grammar-pronoun": "grammar", "grammar-tense": "grammar",
      "grammar-agreement": "grammar", "grammar-comparison": "grammar",
      "grammar-modal": "grammar", "grammar-vocabulary": "grammar",
      "grammar-word-form": "grammar",
      "prepositions": "grammar", "verb-forms": "grammar",
      "adverb-placement": "grammar", "verb-tense": "grammar",
      "conjunctions": "grammar", "verb-patterns": "grammar",
      "adverbs": "grammar", "conditionals": "grammar",
      "sentence-structure": "grammar", "incomplete-sentence": "grammar",
      "vocabulary-phrasal": "vocabulary", "vocabulary-collocation": "vocabulary",
      "vocabulary-word-form": "vocabulary", "phrasal-verbs": "vocabulary",
      "collocations": "vocabulary", "word-form": "vocabulary",
      "vocab-collocation": "vocabulary", "vocab-in-context": "vocabulary",
    },
    7: {
      "reading-purpose": "reading-inference", "reading-vocabulary": "reading-detail",
      "reading-sequence": "reading-detail", "reading-calculation": "reading-detail",
      "reading-reference": "reading-detail", "reading-audience": "reading-inference",
      "reading-classification": "reading-detail", "reading-comparison": "reading-detail",
      "reading-source": "reading-detail", "reading-reason": "reading-inference",
      "reading-requirement": "reading-detail", "reading-suggestion": "reading-detail",
      "reading-comprehension": "reading-main-idea",
      "reading-insert-text": "reading-detail", "reading-pragmatics": "reading-inference",
      "vocab-in-context": "reading-detail",
    },
  };

  const partMap = CANONICAL[partNo];
  if (partMap && partMap[tag]) return partMap[tag];
  return tag;
}
