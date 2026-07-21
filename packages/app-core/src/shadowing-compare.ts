export type TrainingLanguage = "en" | "ja";

export type CompareWord = {
  word: string;
  status: "correct" | "wrong" | "missing";
};

/**
 * A single phonetic token used for Japanese comparison.
 * `surface` is the original kanji/kana token shown to the learner.
 * `reading` is the hiragana form used for matching against STT output.
 */
export type PhoneticSegment = {
  surface: string;
  reading: string;
};

export function normalizeEnglish(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9'\s-]/g, "")
    .split(/\s+/)
    .filter(Boolean);
}

function katakanaToHiragana(text: string): string {
  return text.replace(/[\u30A1-\u30F6]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0x60),
  );
}

export function normalizeJapanese(text: string): string[] {
  return Array.from(
    katakanaToHiragana(
      String(text ?? "")
        .normalize("NFKC"),
    )
      .replace(/[、。！？!?,，．「」『』（）()[\]{}【】…・〜～―—\-_：;；"'`｀\s]/g, "")
      .trim(),
  ).filter(Boolean);
}

export function normalizeByLanguage(text: string, language: TrainingLanguage): string[] {
  return language === "ja" ? normalizeJapanese(text) : normalizeEnglish(text);
}

export function compareJapaneseSegments(
  segments: PhoneticSegment[],
  spokenText: string,
): { words: CompareWord[]; accuracy: number } {
  const meaningful = segments.filter(
    (segment) => normalizeJapanese(segment.reading).length > 0,
  );

  if (meaningful.length === 0) {
    return { words: [], accuracy: 0 };
  }

  const spokenChars = normalizeJapanese(spokenText);
  let spokenIndex = 0;
  let matchCount = 0;
  const result: CompareWord[] = [];

  for (const segment of meaningful) {
    const readingChars = normalizeJapanese(segment.reading);
    if (readingChars.length === 0) {
      continue;
    }

    if (
      spokenIndex + readingChars.length <= spokenChars.length &&
      spokenChars
        .slice(spokenIndex, spokenIndex + readingChars.length)
        .every((char, index) => char === readingChars[index])
    ) {
      result.push({ word: segment.surface, status: "correct" });
      matchCount++;
      spokenIndex += readingChars.length;
      continue;
    }

    let found = false;
    const lookaheadLimit = Math.min(
      spokenIndex + 12,
      spokenChars.length - readingChars.length + 1,
    );

    for (let lookahead = spokenIndex + 1; lookahead < lookaheadLimit; lookahead++) {
      const candidate = spokenChars.slice(lookahead, lookahead + readingChars.length);
      if (
        candidate.length === readingChars.length &&
        candidate.every((char, index) => char === readingChars[index])
      ) {
        const extraText = spokenChars.slice(spokenIndex, lookahead).join("");
        if (extraText) {
          result.push({ word: extraText, status: "wrong" });
        }
        result.push({ word: segment.surface, status: "correct" });
        matchCount++;
        spokenIndex = lookahead + readingChars.length;
        found = true;
        break;
      }
    }

    if (!found) {
      result.push({ word: segment.surface, status: "missing" });
    }
  }

  if (spokenIndex < spokenChars.length) {
    result.push({ word: spokenChars.slice(spokenIndex).join(""), status: "wrong" });
  }

  return {
    words: result,
    accuracy: Math.round((matchCount / meaningful.length) * 100),
  };
}

export function compareWords(
  original: string,
  spoken: string,
  language: TrainingLanguage,
): { words: CompareWord[]; accuracy: number } {
  const originalWords = normalizeByLanguage(original, language);
  const spokenWords = normalizeByLanguage(spoken, language);
  const result: CompareWord[] = [];
  let matchCount = 0;
  let spokenIndex = 0;

  for (let originalIndex = 0; originalIndex < originalWords.length; originalIndex++) {
    if (
      spokenIndex < spokenWords.length &&
      originalWords[originalIndex] === spokenWords[spokenIndex]
    ) {
      result.push({ word: originalWords[originalIndex], status: "correct" });
      matchCount++;
      spokenIndex++;
      continue;
    }

    let found = false;
    for (
      let lookahead = spokenIndex + 1;
      lookahead < Math.min(spokenIndex + 3, spokenWords.length);
      lookahead++
    ) {
      if (originalWords[originalIndex] === spokenWords[lookahead]) {
        for (let offset = spokenIndex; offset < lookahead; offset++) {
          result.push({ word: spokenWords[offset], status: "wrong" });
        }
        result.push({ word: originalWords[originalIndex], status: "correct" });
        matchCount++;
        spokenIndex = lookahead + 1;
        found = true;
        break;
      }
    }

    if (!found) {
      result.push({ word: originalWords[originalIndex], status: "missing" });
    }
  }

  for (; spokenIndex < spokenWords.length; spokenIndex++) {
    result.push({ word: spokenWords[spokenIndex], status: "wrong" });
  }

  return {
    words: result,
    accuracy: originalWords.length > 0
      ? Math.round((matchCount / originalWords.length) * 100)
      : 0,
  };
}
