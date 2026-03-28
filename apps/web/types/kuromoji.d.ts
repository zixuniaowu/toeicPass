declare module "kuromoji" {
  export type IpadicToken = {
    surface_form: string;
    reading?: string;
    pronunciation?: string;
    pos?: string;
    word_type?: string;
  };

  export type Tokenizer<TToken = IpadicToken> = {
    tokenize(text: string): TToken[];
  };

  export type Builder<TToken = IpadicToken> = {
    build(callback: (error: Error | null, tokenizer: Tokenizer<TToken>) => void): void;
  };

  export function builder<TToken = IpadicToken>(options: { dicPath: string }): Builder<TToken>;

  const kuromoji: {
    builder: typeof builder;
  };

  export default kuromoji;
}
