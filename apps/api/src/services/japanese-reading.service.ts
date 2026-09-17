import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import fs from "fs";
import path from "path";
import { FuriganaSegment } from "../types";

type IpadicToken = {
  surface_form: string;
  reading?: string;
  pronunciation?: string;
};

type KuromojiTokenizer = { tokenize(sentence: string): IpadicToken[] };

// kuromoji ships no type declarations; keep a local minimal typing so both
// tsc and ts-node compile without ambient module resolution.
const kuromoji = require("kuromoji") as {
  builder<T>(options: { dicPath: string }): {
    build(callback: (error: Error | null, tokenizer: KuromojiTokenizer) => void): void;
  };
};

function katakanaToHiragana(text: string): string {
  return String(text ?? "").replace(/[\u30A1-\u30F6]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0x60),
  );
}

function containsKanji(text: string): boolean {
  return /[一-龯々]/u.test(text);
}

/**
 * Tokenizes Japanese sentences with kuromoji (ipadic) and produces furigana
 * segments: the original surface text plus a hiragana reading for kanji
 * segments. Used to annotate shadowing sentences served to mobile clients.
 */
@Injectable()
export class JapaneseReadingService implements OnModuleDestroy {
  private readonly logger = new Logger(JapaneseReadingService.name);
  private tokenizerPromise: Promise<KuromojiTokenizer> | null = null;

  async onModuleDestroy(): Promise<void> {
    this.tokenizerPromise = null;
  }

  private resolveDictionaryPath(): string {
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

  private async getTokenizer(): Promise<KuromojiTokenizer> {
    if (!this.tokenizerPromise) {
      this.tokenizerPromise = new Promise((resolve, reject) => {
        const dicPath = this.resolveDictionaryPath();
        kuromoji.builder<KuromojiTokenizer>({ dicPath }).build((error, tokenizer) => {
          if (error || !tokenizer) {
            reject(error ?? new Error("failed to build kuromoji tokenizer"));
            return;
          }
          this.logger.log("kuromoji tokenizer initialized");
          resolve(tokenizer);
        });
      });
    }
    return this.tokenizerPromise;
  }

  async annotateSentence(text: string): Promise<FuriganaSegment[]> {
    const trimmed = String(text ?? "").trim();
    if (!trimmed) {
      return [];
    }
    try {
      const tokenizer = await this.getTokenizer();
      const tokens: IpadicToken[] = tokenizer.tokenize(trimmed);
      const segments: FuriganaSegment[] = [];
      for (const token of tokens) {
        const surface = String(token.surface_form ?? "").trim();
        if (!surface) {
          continue;
        }
        const reading = katakanaToHiragana(String(token.reading ?? "").trim());
        if (containsKanji(surface) && reading && reading !== surface) {
          segments.push({ surface, reading });
        } else {
          segments.push({ surface, reading: surface });
        }
      }
      return segments;
    } catch (error) {
      this.logger.warn(`Failed to annotate sentence: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }
}
