declare module "kuromoji" {
  export interface IpadicToken {
    word_id: number;
    word_type: string;
    word_cost: number;
    pos: string;
    pos_detail_1: string;
    pos_detail_2: string;
    pos_detail_3: string;
    conjugated_type: string;
    conjugated_form: string;
    basic_form: string;
    reading?: string;
    pronunciation?: string;
    surface_form: string;
  }

  export interface Tokenizer<T> {
    tokenize(sentence: string): T[];
  }

  export interface TokenizerBuilder<T> {
    dicPath: string;
    build(callback: (error: Error | null, tokenizer: Tokenizer<T>) => void): void;
  }

  const kuromoji: {
    builder<T>(options: { dicPath: string }): TokenizerBuilder<T>;
  };

  export default kuromoji;
}
