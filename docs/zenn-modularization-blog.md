---
title: "Next.js + NestJS で作る TOEIC 学習アプリ ─ シャドーイング・単語・文法を全部入りで実装した話"
emoji: "🎧"
type: "tech"
topics: ["nextjs", "nestjs", "typescript", "toeic", "react"]
published: false
---

## はじめに

TOEIC のスコアを伸ばすには「聞く → 真似る → 覚える → 解く」のサイクルを回す必要があります。既存のアプリはリスニングだけ・単語だけ・模試だけと機能が分散しがちなので、**1 つのアプリで全部できる** TOEIC 学習プラットフォーム「toeicPass」を Next.js + NestJS のモノレポで作りました。

🤗 **デモ**: https://huggingface.co/spaces/peanutao/toeicPass
⭐ **GitHub**: https://github.com/peanutao/toeicPass

この記事では、特にユーザーに人気のある 3 つの学習機能 ──**シャドーイング（跟读）**、**単語学習**、**文法練習**── の技術的な実装を紹介します。

## システム全体像

```
toeicPass/
├── apps/
│   ├── api/     → NestJS バックエンド（Port 8001）
│   └── web/     → Next.js フロントエンド（Port 8000）
├── packages/
│   ├── shared/          → 共通型定義
│   ├── ad-system/       → 広告モジュール
│   └── conversation-ai/ → AI会話モジュール
└── db/          → PostgreSQL スキーマ
```

技術スタック：
- **フロントエンド**: Next.js 15 + React + TypeScript + CSS Modules
- **バックエンド**: NestJS + TypeScript + PostgreSQL（テスト時は PGLite）
- **音声**: Web Speech API（SpeechRecognition / SpeechSynthesis）
- **AI**: Google Gemini 2.0 Flash API
- **認証**: JWT + OAuth2（Google / WeChat / LINE）

主要な学習機能：

| 機能 | 説明 |
| ---- | ---- |
| シャドーイング | TED / YouTube / ドラマ / ニュースの英語素材を文単位で跟读 |
| 単語学習 | SM-2 間隔反復アルゴリズムによるフラッシュカード |
| 文法練習 | TOEIC 頻出文法ルールのカード学習 |
| パート別練習 | TOEIC Part 1〜7 のアダプティブ問題演習 |
| 模擬試験 | 200 問 120 分のフル模試シミュレーション |
| 間違いノート | 誤答を自動収集 → 根因タグ付け → 類似問題ドリル |
| AI 会話 | 8 つの TOEIC シナリオで英語音声チャット |
| ライティング | AI による英作文評価・フィードバック |

---

## 1. シャドーイング機能（跟读練習）

### 概要

シャドーイングとは、英語の音声を聞きながら少し遅れて同じ内容を声に出す練習法です。toeicPass では、TED トーク・YouTube・ニュース・ドラマなどの実用的な英語素材を**文単位で区切り**、聞く → 繰り返す のサイクルをアプリ上で完結させています。

### 素材ライブラリー

```ts:apps/web/data/shadowing-materials.ts
// 英語素材の例
{
  id: "steve-jobs-stanford",
  title: "Steve Jobs' Stanford Commencement Address (2005)",
  difficulty: 2,
  segments: [
    {
      text: "I am honored to be with you today...",
      translation: "今日皆さんとご一緒できて光栄です...",
      startSec: 0,
      endSec: 5.2,
    },
    // ...
  ],
}
```

素材は難易度 1〜3 で分類され、各文に `startSec` / `endSec` の時間情報が付与されています。音声の特定区間だけを再生する仕組みです。

### 素材ソース

| ソース | ファイル | 内容 |
| ---- | ---- | ---- |
| 英語素材 | `shadowing-materials.ts` | Steve Jobs スピーチ、ビジネス英語等 |
| TED トーク | `ted-latest-shadowing.json` | 最新 TED トークの自動同期 |
| 日本語 YouTube | `japanese-youtube-shadowing.json` | 日本語話者向け英語トレーニング |
| 日本語素材 | `japanese-shadowing-materials.ts` | ローカライズされたコンテンツ |

### コンポーネント設計

```tsx:apps/web/components/shadowing/ShadowingView.tsx
// ShadowingView の主要機能
// - タブ切り替え（素材一覧 / 練習 / ニュース / YouTube）
// - 文単位のハイライト表示
// - 音声再生コントロール（play / pause / repeat）
// - 単語クリックで IPA 発音・TTS 発音
// - Web Speech API による音声認識（オプション）
```

![シャドーイング画面 — 文単位でハイライト表示し、音声をループ再生](/images/shadowing-view.png)
*▲ シャドーイング画面：素材を文単位でハイライト表示し、クリックで IPA 発音を確認*

キー技術ポイント：

**文単位再生**：HTML5 Audio の `currentTime` を `startSec` にセットし、`endSec` で停止させることで、素材の特定区間だけをループ再生できます。

**単語アノテーション**：テキスト内の単語をクリックすると IPA（国際音声記号）と日本語・中国語の意味がポップアップ表示されます。

**ブラウザ音声認識**：Web Speech API の `SpeechRecognition` を使い、ユーザーの発話をテキスト変換します。外部ライブラリ不要でブラウザネイティブです。

```ts
// Web Speech API による音声認識（TypeScript）
const recognition = new (window.SpeechRecognition
  || window.webkitSpeechRecognition)();
recognition.lang = "en-US";
recognition.interimResults = true;

recognition.onresult = (event) => {
  const transcript = event.results[0][0].transcript;
  // ユーザーの発話テキストを取得
};
```

**Text-to-Speech**：`SpeechSynthesis` API で英語音声を自動再生。テキスト選択 → 発音 の機能も実装しています。

---

## 2. 単語学習（ボキャブラリー）

### 概要

TOEIC 頻出単語を **SM-2 間隔反復アルゴリズム** でフラッシュカード学習します。カードには品詞、例文、中国語・日本語の定義、CEFR レベル、対応する TOEIC パートなどのメタ情報が付与されています。

### カードデータ構造

```ts
interface VocabCard {
  term: string;           // 英単語
  pos: string;            // 品詞 (noun, verb, adjective...)
  definition: string;     // 英語定義
  definitionCn?: string;  // 中国語定義
  definitionJa?: string;  // 日本語定義
  example: string;        // 例文
  sourcePart: number;     // TOEIC Part (1-7)
  tags: string[];         // タグ
  cefrLevel: string;      // CEFR レベル (A1-C2)
  difficulty: number;     // 難易度 (1-5)
  scoreBand: string;      // 目標スコア帯 (600, 730, 860...)

  // SM-2 パラメータ
  easeFactor: number;     // 覚えやすさ係数 (≥1.3)
  intervalDays: number;   // 次回復習までの日数
  dueAt: string;          // 次回復習日
  lastGrade: number;      // 前回の評価
}
```

![単語学習の Study タブ — フラッシュカード形式で復習](/images/vocab-flashcard.png)
*▲ フラッシュカード画面：カードをめくって 3 段階で評価*

### SM-2 間隔反復アルゴリズム

SM-2 は「覚えた → 間隔を延ばす、忘れた → 短くする」というシンプルな原理です：

```
Grade 1 (忘れた)     → intervalDays = 1, easeFactor -= 0.2
Grade 2 (うろ覚え)   → intervalDays = 1, easeFactor -= 0.1
Grade 3 (覚えた)     → intervalDays × easeFactor, easeFactor += 0.1
```

### 3 つのタブ

**Study タブ**：
- 今日の復習対象カードをまとめて表示
- デイリー目標（例: 「今日打卡目标：先完成 20 词」）
- カードめくり → 「忘れた / うろ覚え / 完璧」の 3 段階評価
- 進捗カウンター（例：「第 1 / 250 張」）

**Browse タブ**：
- 全カードのリスト表示
- パート別・スコア帯別・状態別フィルター
- 用語・定義でのテキスト検索
- 覚えやすさ係数・間隔でのソート

**Stats タブ**：
- 全体進捗（マスター率 % / 学習中 % / 復習待ち %）
- パート別分布グラフ
- スコア帯別分布
- 記憶難易度グラフ（EF ファクター分布）

### API

```
GET  /learning/vocabulary/cards       → ユーザーのカード一覧
POST /learning/vocabulary/cards/:id/grade → カード評価（1-3）
```

### データ

約 500+ 枚のカードが `vocab-seed.json`、`vocab-seed-1.json`、`vocab-seed-2.json` に分割して格納されています。TOEIC 公式問題集・頻出語彙集から厳選しています。

---

## 3. 文法練習

### 概要

TOEIC Part 5〜7 で頻出する文法ルールを**カード形式**で学習します。各ルールには英語・中国語・日本語の 3 言語で解説が付いています。

### 文法カード構造

```ts
interface GrammarCard {
  ruleId: string;        // ルールID
  title: string;         // 英語タイトル
  titleCn: string;       // 中国語タイトル
  titleJa: string;       // 日本語タイトル
  category: string;      // カテゴリ
  explanation: string;   // 解説テキスト
  examples: string[];    // 例文リスト
  sourcePart: number;    // TOEIC Part (5-7)
  difficulty: number;    // 難易度
  cefrLevel: string;     // CEFR レベル
}
```

### 主なカテゴリ

| カテゴリ | 内容 | TOEIC パート |
| ---- | ---- | ---- |
| 主語-動詞一致 | 三人称単数の -s、集合名詞 | Part 5 |
| 時制の一致 | 現在完了 vs 過去形、未来表現 | Part 5, 6 |
| 関係代名詞 | who / which / that の使い分け | Part 5, 6 |
| 修飾語の配置 | 形容詞の語順、分詞構文 | Part 5 |
| 動詞の形 | 動名詞 vs 不定詞、使役動詞 | Part 5, 6 |
| 前置詞・コロケーション | in charge of, due to, 等 | Part 5, 6, 7 |

### 単語学習との UI 共有

文法カードは `FlashCard.tsx` コンポーネントを単語カードと共有しています：

```tsx:apps/web/components/vocab/FlashCard.tsx
// FlashCard — 単語・文法兼用のカードコンポーネント
// - カードのめくりアニメーション
// - 3段階マークボタン（忘れた / うろ覚え / 完璧）
// - IPA 発音 + TTS 読み上げ
// - 例文ハイライト
```

同じ SM-2 アルゴリズムで復習間隔を管理し、文法ルールの定着を促します。

---

## 4. その他の学習機能

### パート別練習

TOEIC 全 7 パートに対応する問題演習です。問題タイプごとにUIを最適化しています：

![Part 1 写真描写問題の例](/images/part1-sample.jpg)
*▲ Part 1 写真描写問題 — 実際の問題画面*

- **Part 1（写真描写）**: 画像表示 + 4 択音声選択
- **Part 2（応答問題）**: 音声 + 3 択
- **Part 3-4（長文リスニング）**: 音声 + 会話/説明パッセージ + 複数設問
- **Part 5（文法穴埋め）**: 英文 + 4 択
- **Part 6（長文穴埋め）**: パッセージ + 複数穴埋め
- **Part 7（読解）**: 長文 + 複数設問

問題データは 15+ の JSON ファイル（`question-bank.json`、`question-bank-expansion-*.json`）に数千問格納されています。

![Part 3 図表問題の例](/images/part3-graphic.jpg)
*▲ Part 3-4 で出題される図表問題*

### 模擬試験

200 問 / 120 分の本番形式フル模試です：

- 強制タイマー（時間切れで自動終了）
- フルスクリーンモード対応
- 公式スコア換算（450〜990 点レンジ）
- パート別正答率の結果画面
- 間違えた問題の即時復習

### 間違いノート

- 誤答を自動収集
- 根因タグ（語彙 / 文法 / 論理理解 / 不注意）
- 回避策メモ入力
- 「類似問題を練習」ボタン

### AI ライティング評価

- 自由テキスト入力 → Gemini API が語彙・文法・構成を評価
- スコア + 具体的な改善提案を返却

---

## 5. ローカライゼーション

toeicPass は**中国語（簡体字）**と**日本語**の 2 言語に完全対応しています：

```ts
const I18N = {
  zh: {
    title: "AI 语音对话",
    hold: "按住说话",
    listening: "正在听...",
    thinking: "AI 回复中...",
    corrections: "纠正",
    suggestions: "建议",
  },
  ja: {
    title: "AI 音声会話",
    hold: "押して話す",
    listening: "聞いています...",
    thinking: "AI 返信中...",
    corrections: "修正",
    suggestions: "アドバイス",
  },
};
```

UI ラベルだけでなく、単語の定義、文法の解説、シャドーイング素材の翻訳もすべて多言語で提供しています。

---

## 6. 技術的なチャレンジと解決策

### SSR ハイドレーション不整合

Next.js の Server-Side Rendering と、クライアントサイドでしか利用できない Web Speech API の組み合わせで、ハイドレーションエラーが発生しました。

**解決策**：`mounted` ステートガードを導入

```tsx
const [mounted, setMounted] = useState(false);
useEffect(() => { setMounted(true); }, []);

if (!mounted) return <LoadingSkeleton />;
return <ShadowingView />;  // ブラウザ API 依存のコンポーネント
```

### 音声区間再生

シャドーイング素材は 1 つの音声ファイルから特定区間だけを再生する必要があります。HTML5 Audio の `#t=start,end` フラグメントを活用しています：

```tsx
const audio = new Audio(`/assets/audio/ted-talk.mp3#t=${startSec},${endSec}`);
audio.play();
```

ループ再生時は `timeupdate` イベントで `endSec` を超えた時点で `pause()` + `currentTime = startSec` にリセットします。

### SM-2 パラメータのチューニング

標準 SM-2 ではカードが「簡単すぎる」と判定されて間隔が伸びすぎる問題がありました。TOEIC 学習の特性（試験日までの制約）に合わせて、最大間隔を 30 日にキャップしています。

---

## まとめ

toeicPass は「シャドーイング・単語・文法・問題演習・模試・AI 会話」を 1 つのアプリに統合した TOEIC 学習プラットフォームです。

技術的なポイント：
- **Web Speech API** でサードパーティ不要の音声認識・音声合成
- **SM-2 間隔反復** で科学的な単語記憶
- **3 言語対応** で中国語・日本語話者をサポート
- **モノレポ構成** で広告・AI 会話を独立パッケージに分離
- **PGLite** でテスト時にインメモリ DB を使い、CI を高速化

TOEIC 対策アプリの開発に興味がある方、または音声系 Web API の実装例を探している方の参考になれば幸いです。

🤗 **デモ**: https://huggingface.co/spaces/peanutao/toeicPass
⭐ **GitHub**: https://github.com/peanutao/toeicPass