import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import kuromoji, { type IpadicToken, type Tokenizer } from "kuromoji";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_TEXT_LENGTH = 400;

type RequestBody = {
  text?: string;
};

type ReadingToken = {
  surface: string;
  reading: string | null;
  hasKanji: boolean;
};

let tokenizerPromise: Promise<Tokenizer<IpadicToken>> | null = null;

function resolveDictionaryPath(): string {
  const candidates = [
    path.join(process.cwd(), "node_modules", "kuromoji", "dict"),
    path.join(process.cwd(), "..", "node_modules", "kuromoji", "dict"),
    path.join(process.cwd(), "..", "..", "node_modules", "kuromoji", "dict"),
  ];
  const found = candidates.find((candidate) =>
    fs.existsSync(path.join(candidate, "base.dat.gz")),
  );
  if (!found) {
    throw new Error("kuromoji dictionary not found");
  }
  return found;
}

function containsKanji(text: string): boolean {
  return /[一-龯々]/u.test(text);
}

function katakanaToHiragana(text: string): string {
  return String(text ?? "").replace(/[\u30A1-\u30F6]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0x60),
  );
}

function normalizeReading(raw: string | undefined): string {
  const value = String(raw ?? "").trim();
  if (!value || value === "*") {
    return "";
  }
  return katakanaToHiragana(value);
}

async function getTokenizer(): Promise<Tokenizer<IpadicToken>> {
  if (!tokenizerPromise) {
    tokenizerPromise = new Promise((resolve, reject) => {
      const dicPath = resolveDictionaryPath();
      kuromoji.builder<IpadicToken>({ dicPath }).build((error, tokenizer) => {
        if (error || !tokenizer) {
          reject(error ?? new Error("failed to build kuromoji tokenizer"));
          return;
        }
        resolve(tokenizer);
      });
    });
  }
  return tokenizerPromise;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as RequestBody;
    const text = String(body.text ?? "").trim();
    if (!text) {
      return NextResponse.json({ success: false, error: "text is required" }, { status: 400 });
    }
    if (text.length > MAX_TEXT_LENGTH) {
      return NextResponse.json({ success: false, error: "text too long" }, { status: 413 });
    }

    const tokenizer = await getTokenizer();
    const tokens = tokenizer.tokenize(text);
    const readingTokens: ReadingToken[] = tokens
      .map((token) => {
        const surface = String(token.surface_form ?? "").trim();
        if (!surface) {
          return null;
        }
        const reading = normalizeReading(token.reading ?? token.pronunciation);
        const hasKanji = containsKanji(surface);
        const normalizedReading = hasKanji && reading && reading !== surface ? reading : null;
        return {
          surface,
          reading: normalizedReading,
          hasKanji,
        } as ReadingToken;
      })
      .filter((item): item is ReadingToken => Boolean(item));

    const readingText = readingTokens.map((token) => token.reading ?? token.surface).join("");

    return NextResponse.json({
      success: true,
      readingText,
      tokens: readingTokens,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "japanese reading failed" },
      { status: 500 },
    );
  }
}
