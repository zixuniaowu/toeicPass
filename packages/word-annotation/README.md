# @toeicpass/word-annotation

Framework-agnostic word annotation engine — word gloss, Japanese furigana (振り仮名), and sentence translation.

Designed for reuse across:
- Next.js / React web apps
- Chrome / Firefox browser extensions
- CLI tools and scripts
- Any JavaScript/TypeScript environment

---

## Features

- **Word tokenization** — splits English or Japanese sentences into annotatable tokens
- **Word gloss** — fetches brief translations via a pluggable API adapter
- **Japanese furigana** — per-kanji and per-token reading via a pluggable morphological analyzer
- **Sentence translation** — fetches and caches full sentence translations on demand
- **Pluggable adapters** — connect to any translation/reading backend via simple async functions
- **Zero framework dependencies** in the core package

---

## Installation

```bash
npm install @toeicpass/word-annotation
```

---

## Usage

### Core (any JS/TS environment)

```typescript
import { WordAnnotationEngine } from "@toeicpass/word-annotation";

const engine = new WordAnnotationEngine({
  trainingLanguage: "en",  // "en" | "ja"
  uiLang: "ja",            // "zh" | "ja" | "en"

  // Pluggable translation adapter — implement for your backend
  translate: async (text, targetLang, sourceLang) => {
    const res = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, targetLang, sourceLang }),
    });
    const data = await res.json();
    return data.translation ?? text;
  },

  // Pluggable Japanese reading adapter
  getReading: async (text) => {
    const res = await fetch("/api/japanese-reading", {
      method: "POST",
      body: JSON.stringify({ text }),
    });
    return res.json(); // { readingText: string, tokens: JapaneseReadingToken[] }
  },
});

// Subscribe to cache updates
engine.onStateChange = (state) => {
  console.log("gloss map updated:", state.wordGlossMap);
};

// Tokenize a sentence
const words = engine.tokenize("The quick brown fox");
// [{ word: "The", clean: "the", ... }, ...]

// Trigger annotation fetch (fire & forget — updates arrive via onStateChange)
words.forEach((w) => engine.ensureJaWordGloss(w));
```

### Browser Extension (Chrome)

```typescript
// content-script.ts
import { WordAnnotationEngine } from "@toeicpass/word-annotation";

const engine = new WordAnnotationEngine({
  trainingLanguage: "en",
  uiLang: "ja",
  translate: (text, targetLang) =>
    chrome.runtime.sendMessage({ type: "translate", text, targetLang }),
  getReading: (text) =>
    chrome.runtime.sendMessage({ type: "reading", text }),
});

engine.onStateChange = (state) => {
  // Re-render your annotations in the page
  renderGlossAnnotations(state.wordGlossMap);
};

document.querySelectorAll(".sentence").forEach((el) => {
  const words = engine.tokenize(el.textContent ?? "");
  words.forEach((w) => engine.ensureJaWordGloss(w));
  engine.ensureSentenceTokens(el.textContent ?? "");
});
```

### React

```tsx
import { useWordAnnotation } from "@toeicpass/word-annotation/react";

function PracticeView() {
  const annotation = useWordAnnotation({
    trainingLanguage: "en",
    uiLang: "ja",
    translate: (text, targetLang) =>
      fetch("/api/translate", {
        method: "POST",
        body: JSON.stringify({ text, targetLang }),
      }).then((r) => r.json()).then((d) => d.translation),
    getReading: (text) =>
      fetch("/api/japanese-reading", {
        method: "POST",
        body: JSON.stringify({ text }),
      }).then((r) => r.json()),
  });

  const sentence = "The quick brown fox jumps over the lazy dog.";
  const words = annotation.getAnnotatedWords(sentence);

  return (
    <div>
      {words.map((w, i) => {
        const gloss = annotation.getWordGloss(w);
        annotation.ensureJaWordGloss(w);
        return (
          <span key={i} title={gloss ?? ""}>
            {w.word}
            {gloss && <small style={{ display: "block", fontSize: "0.7em" }}>{gloss}</small>}
          </span>
        );
      })}
    </div>
  );
}
```

---

## API Reference

### `WordAnnotationEngine`

#### Constructor

```typescript
new WordAnnotationEngine(options: WordAnnotationOptions)
```

| Option | Type | Description |
|--------|------|-------------|
| `trainingLanguage` | `"en" \| "ja"` | Language being practised |
| `uiLang` | `"zh" \| "ja" \| "en"` | UI display language |
| `translate?` | `TranslateAdapter` | Async function to translate text |
| `getReading?` | `JapaneseReadingAdapter` | Async function for furigana |
| `getGloss?` | `WordGlossAdapter` | Async function for word gloss (falls back to `translate`) |

#### Methods

| Method | Description |
|--------|-------------|
| `tokenize(text)` | Split sentence into `WordAnnotation[]` |
| `getWordGloss(word)` | Get cached gloss or `null` |
| `getJapaneseWordReading(word)` | Get cached furigana or `null` |
| `getSentenceTokens(text)` | Get cached token array or `null` |
| `getSentenceTranslation(materialId, sentenceId, sentence)` | Get cached translation |
| `getSecondaryTranslation(sentence)` | Get secondary translation |
| `ensureJaWordGloss(word)` | Trigger gloss fetch (fire & forget) |
| `ensureJapaneseWordGloss(word)` | Trigger Japanese gloss fetch |
| `ensureJapaneseWordReading(word)` | Trigger furigana fetch |
| `ensureSentenceTokens(text)` | Trigger per-token furigana fetch |
| `ensureJaSentenceTranslation(...)` | Trigger sentence translation fetch |
| `getState()` | Get full `AnnotationState` snapshot |
| `onStateChange` | Callback invoked whenever cache updates |

### `useWordAnnotation(options)` — React hook

Same options as `WordAnnotationEngine`. Returns the same methods, but triggers React re-renders automatically when any cache entry updates.

---

## License

MIT
