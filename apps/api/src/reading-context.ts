export function extractPassageAndStem(
  partNo: number,
  stem: string,
  existingPassage?: string,
): { passage?: string; stem: string } {
  if (partNo !== 7) {
    const normalizedPassage = existingPassage?.trim();
    return {
      passage: normalizedPassage && normalizedPassage.length > 0 ? normalizedPassage : undefined,
      stem,
    };
  }
  if (existingPassage?.trim()) {
    return { passage: existingPassage.trim(), stem: stem.trim() };
  }
  const normalizedStem = stem.trim();
  const normalizePassage = (raw: string) =>
    raw
      .trim()
      .replace(/\r\n/g, "\n")
      .replace(/^[""'`]+/, "")
      .replace(/[""'`]+$/, "");

  const quotedExcerpt = normalizedStem.match(/^(?:[^:]+excerpt:\s*)[""']([\s\S]+?)[""']\s*(.+\?)$/i);
  if (quotedExcerpt) {
    return {
      passage: normalizePassage(quotedExcerpt[1]),
      stem: quotedExcerpt[2].trim(),
    };
  }

  const singleQuotedLabel = normalizedStem.match(/^(?:[^:]{1,28}:\s*)'([\s\S]+)'\s*(.+\?)$/i);
  if (singleQuotedLabel) {
    const passageCandidate = normalizePassage(singleQuotedLabel[1]);
    const stemCandidate = singleQuotedLabel[2].trim();
    if (passageCandidate.length >= 40) {
      return {
        passage: passageCandidate,
        stem: stemCandidate,
      };
    }
  }

  const quotedLabel = normalizedStem.match(/^(?:[^:]{1,28}:\s*)[""']([\s\S]+?)[""']\s*(.+\?)$/i);
  if (quotedLabel) {
    const passageCandidate = normalizePassage(quotedLabel[1]);
    const stemCandidate = quotedLabel[2].trim();
    if (passageCandidate.length >= 50) {
      return {
        passage: passageCandidate,
        stem: stemCandidate,
      };
    }
  }

  const lines = normalizedStem.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  if (lines.length >= 2) {
    const stemCandidate = lines[lines.length - 1];
    const passageCandidate = lines.slice(0, -1).join("\n");
    if (stemCandidate.endsWith("?") && passageCandidate.length >= 50) {
      return {
        passage: normalizePassage(passageCandidate),
        stem: stemCandidate,
      };
    }
  }

  const lower = normalizedStem.toLowerCase();
  const markers = [" what ", " why ", " which ", " who ", " where ", " when ", " how ", " according ", " based "];
  let splitAt = -1;
  markers.forEach((marker) => {
    const idx = lower.indexOf(marker);
    if (idx > 0 && (splitAt < 0 || idx < splitAt)) {
      splitAt = idx;
    }
  });
  if (splitAt > 0) {
    const passageCandidate = normalizePassage(
      normalizedStem.slice(0, splitAt).replace(/^[^:]+excerpt:\s*/i, ""),
    );
    const stemCandidate = normalizedStem.slice(splitAt).trim();
    if (passageCandidate.length >= 50 && stemCandidate.endsWith("?")) {
      return {
        passage: passageCandidate,
        stem: stemCandidate,
      };
    }
  }

  const tailQuestion = normalizedStem.match(/^(.*?)(?:\s+)((?:What|Why|Which|Who|Where|When|How|According|Based)[\s\S]*\?)$/i);
  if (tailQuestion) {
    const passageCandidate = normalizePassage(tailQuestion[1]);
    const stemCandidate = tailQuestion[2].trim();
    if (passageCandidate.length >= 60) {
      return {
        passage: passageCandidate,
        stem: stemCandidate,
      };
    }
  }

  if (normalizedStem.length >= 140) {
    return {
      passage: normalizePassage(normalizedStem),
      stem: "What is the most likely correct answer?",
    };
  }
  return { passage: undefined, stem: normalizedStem };
}

export function normalizeReadingContext(
  partNo: number,
  stem: string,
  passage: string | undefined,
  explanation: string,
): { stem: string; passage?: string } {
  if (partNo === 6) {
    const normalizedStem = stem.trim();
    const normalizedPassage = ensurePart6Passage(normalizedStem, passage, explanation);
    return {
      stem: normalizedStem,
      passage: normalizedPassage,
    };
  }

  if (partNo === 7) {
    const normalizedStem = ensureQuestionStem(stem);
    const normalizedPassage = ensurePart7Passage(normalizedStem, passage, explanation);
    return {
      stem: normalizedStem,
      passage: normalizedPassage,
    };
  }

  return {
    stem: stem.trim(),
    passage,
  };
}

export function ensureQuestionStem(stem: string): string {
  const normalizedStem = stem.trim();
  if (normalizedStem.endsWith("?")) {
    return normalizedStem;
  }
  if (/^(what|why|which|who|where|when|how|according|based)\b/i.test(normalizedStem)) {
    return `${normalizedStem.replace(/[.。!！]+$/, "").trim()}?`;
  }
  return "What is the most likely correct answer?";
}

function ensurePart6Passage(stem: string, passage: string | undefined, explanation: string): string | undefined {
  const normalizedPassage = passage?.trim();
  const context = `${normalizedPassage ?? ""} ${stem}`.trim();
  const sentenceCount = (context.match(/[.!?](\s|$)/g) ?? []).length;
  if (context.length >= 60 && sentenceCount >= 2) {
    return normalizedPassage;
  }

  const baseExplanation = explanation
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[.!?]+$/, "");
  const guidance =
    baseExplanation.length > 0
      ? `${baseExplanation}.`
      : "Read the sentence in a workplace context and choose the most natural completion.";
  const bridge = "Use the surrounding business context to decide which option best completes the blank.";
  return `Workplace memo: ${guidance} ${bridge}`;
}

function ensurePart7Passage(stem: string, passage: string | undefined, explanation: string): string {
  const normalizedPassage = passage?.trim();
  if (!normalizedPassage) {
    return buildSyntheticPart7Passage(stem, explanation);
  }

  const sentenceCount = (normalizedPassage.match(/[.!?](\s|$)/g) ?? []).length;
  if (normalizedPassage.length >= 90 && sentenceCount >= 2) {
    return normalizedPassage;
  }

  const addition = buildPart7SupportSentence(explanation);
  let expanded = normalizedPassage;
  if (!expanded.endsWith(".") && !expanded.endsWith("!") && !expanded.endsWith("?")) {
    expanded = `${expanded}.`;
  }
  expanded = `${expanded} ${addition}`;

  const expandedSentenceCount = (expanded.match(/[.!?](\s|$)/g) ?? []).length;
  if (expanded.length < 90 || expandedSentenceCount < 2) {
    expanded = `${expanded} The announcement applies to regular business operations and should be followed as written.`;
  }
  return expanded;
}

function buildSyntheticPart7Passage(stem: string, explanation: string): string {
  const detail = buildPart7SupportSentence(explanation);
  const topic = part7TopicFromStem(stem);
  return `${topic} ${detail}`;
}

function part7TopicFromStem(stem: string): string {
  const normalizedStem = stem.toLowerCase();
  if (normalizedStem.includes("purpose")) {
    return "An internal notice was shared to explain an operational policy update for staff members.";
  }
  if (normalizedStem.includes("infer")) {
    return "A business email describes a recent situation and asks readers to infer the most likely conclusion.";
  }
  if (normalizedStem.includes("when") || normalizedStem.includes("schedule")) {
    return "A scheduling update was distributed to clarify deadlines, timing, and expected next steps.";
  }
  if (normalizedStem.includes("where")) {
    return "A workplace announcement provides location details for an upcoming task or event.";
  }
  return "A short business message was distributed to inform employees and customers about a practical update.";
}

function buildPart7SupportSentence(explanation: string): string {
  const normalizedExplanation = explanation
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[.!?]+$/, "");
  if (normalizedExplanation.length > 0) {
    return `${normalizedExplanation}. Readers should rely on the stated information when choosing the best answer.`;
  }
  return "Readers should rely on the stated information when choosing the best answer.";
}
