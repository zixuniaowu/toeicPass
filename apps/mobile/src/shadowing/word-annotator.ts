import dict from "./word-dict.json";

export type WordAnnotation = {
  cn: string;
  ipa: string;
};

export type AnnotatedWord = {
  text: string;
  clean: string;
  annotation: WordAnnotation | null;
};

const dictMap = dict as Record<string, WordAnnotation>;

export function annotateSentence(sentence: string): AnnotatedWord[] {
  const words: AnnotatedWord[] = [];
  const tokens = sentence.match(/\S+/g) ?? [];
  for (const token of tokens) {
    const clean = token.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, "").toLowerCase();
    words.push({
      text: token,
      clean,
      annotation: clean ? dictMap[clean] ?? null : null,
    });
  }
  return words;
}

export function lookupWord(word: string): WordAnnotation | null {
  const clean = word.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, "").toLowerCase();
  return clean ? dictMap[clean] ?? null : null;
}
