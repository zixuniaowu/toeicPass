import {
  buildQuestionCorpus,
  isKnownPart1Image,
  isPart1ImageMatch,
  resolvePart1ImageFromQuestion,
} from "./question-quality";

export function normalizePart1Image(
  imageUrl: string | undefined,
  stem: string,
  optionTexts: string[],
): string | undefined {
  const normalizedImageUrl = imageUrl?.trim();
  const corpus = buildQuestionCorpus(stem, optionTexts);
  const derived = resolvePart1ImageFromQuestion(stem, optionTexts);

  if (normalizedImageUrl) {
    if (!isKnownPart1Image(normalizedImageUrl)) {
      return normalizedImageUrl;
    }
    if (isPart1ImageMatch(normalizedImageUrl, corpus)) {
      return normalizedImageUrl;
    }
    return derived ?? syntheticPart1ImageFromStem(stem);
  }

  return derived ?? syntheticPart1ImageFromStem(stem);
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
