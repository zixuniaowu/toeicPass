---
title: "TOEIC 対策を 1 つのアプリで完結させたくて、Next.js + NestJS でフルスタック学習プラットフォームを作った"
emoji: "🎧"
type: "tech"
topics: ["nextjs", "nestjs", "typescript", "toeic", "webspeechapi"]
published: true
---

## はじめに

「リスニングは A アプリ、単語は B アプリ、模試は C サイト……」── TOEIC の勉強をしていると、ツールが分散してモチベーションも分散しがちです。

**聞く → 真似る → 覚える → 解く → 振り返る** のサイクルを 1 つの画面で回せたら、もっと続けやすいんじゃないか。そう思って、フルスタックの TOEIC 学習アプリ **toeicPass** を作りました。

🤗 **デモ（Hugging Face Spaces）** → https://huggingface.co/spaces/jackywangsh/toeicPass
⭐ **GitHub（OSS）** → https://github.com/zixuniaowu/toeicPass

この記事では「どんな機能があるか」と「技術的に面白かったポイント」を中心に紹介します。

---

## toeicPass でできること

![toeicPass のホーム画面 ── ナビバーに全機能が並ぶ](/images/home-dashboard.png)
*▲ ログイン後のホーム画面。ナビバーからシャドーイング・模擬試験・文法練習・AI 会話・ミスノート・単語帳に直接アクセスできます。*

| 機能 | 概要 |
| ---- | ---- |
| 🎙️ **シャドーイング** | TED / YouTube / ニュース素材を文単位で再生し、音声認識で発話をチェック |
| 📝 **単語学習** | SM-2 間隔反復アルゴリズムのフラッシュカード（500+ 語） |
| 📖 **文法練習** | TOEIC 頻出文法をカード形式で反復学習 |
| 🎯 **パート別練習** | Part 1〜7 を UI 最適化した 3,000+ 問の問題演習 |
| 📋 **200 問フル模試** | 120 分タイマー・スコア換算・パート別フィードバック付き |
| 📓 **間違いノート** | 誤答を自動収集 → 根因タグ付け → 類似問題ドリル |
| 💬 **AI 英会話** | 8 つの TOEIC シナリオで Gemini ベースの音声チャット |
| ✍️ **ライティング** | Gemini API が語彙・文法・構成をスコアリング＋改善提案 |

すべてブラウザだけで動作し、インストール不要。スマホでも PC でも使えます。

---

## アーキテクチャ概要

```
toeicPass/
├── apps/
│   ├── api/   → NestJS バックエンド（Port 8001）
│   └── web/   → Next.js フロントエンド（Port 8000）
├── packages/
│   ├── shared/          → 共通型定義
│   ├── ad-system/       → 広告モジュール
│   └── conversation-ai/ → AI 会話モジュール
└── db/        → PostgreSQL スキーマ & マイグレーション
```

| レイヤー | 技術 |
| ---- | ---- |
| フロントエンド | Next.js 15 · React · TypeScript · CSS Modules |
| バックエンド | NestJS · TypeScript · PostgreSQL（テスト時は PGLite） |
| 音声 | Web Speech API（SpeechRecognition / SpeechSynthesis） |
| AI | Google Gemini 2.0 Flash |
| 認証 | JWT + OAuth2（Google / LINE） |
| CI/CD | GitHub Actions → Hugging Face Spaces に自動デプロイ |

モノレポ構成で `npm run dev` だけで API・Web 両方が立ち上がります。テスト時は PGLite（インメモリ PostgreSQL）を使うので外部 DB 不要です。

---

## 技術的に面白かった 4 つのポイント

### 1. シャドーイング ── Web Speech API だけでここまでできる

![シャドーイング練習画面 ── TED・ドラマ・YouTube 素材を文単位で練習](/images/shadowing-practice.png)
*▲ シャドーイング画面：Steve Jobs スピーチ、TED トーク、ドラマなど 45+ 素材を難易度別に選択*

シャドーイングは「英語音声を聞いて、少し遅れて声に出す」練習法です。toeicPass では TED トーク・YouTube・ニュースなどの素材を**文単位で区切って**再生し、ブラウザの音声認識でユーザーの発話をリアルタイムにテキスト変換します。

**文単位の区間再生**がポイントです。各セグメントに `startSec` / `endSec` を持たせ、HTML5 Audio の `timeupdate` イベントで区間外に出たら巻き戻します。

```ts
// 区間ループ再生の核心部分
audio.addEventListener("timeupdate", () => {
  if (audio.currentTime >= segment.endSec) {
    audio.pause();
    audio.currentTime = segment.startSec;  // 自動巻き戻し
  }
});
```

もう一つの工夫は**単語タップで即座に発音確認**できること。テキスト内の単語をクリックすると IPA（国際音声記号）と日本語訳がポップアップし、`SpeechSynthesis` API でネイティブ発音を再生します。外部 API やライブラリは一切不要で、ブラウザネイティブだけで完結しています。

### 2. SM-2 間隔反復 ── 「忘れる前に復習」を自動化

![単語学習画面 ── 9,000+ 枚のフラッシュカード](/images/vocab-flashcard.png)
*▲ 単語学習画面：スコア帯別フィルター（600 / 700 / 800 / 900 点）、復習期限カード管理*

単語カードと文法カードは同じ **SM-2 アルゴリズム**で復習タイミングを管理しています。

```
😣 忘れた     → 翌日に再出題、覚えやすさ係数 −0.2
🤔 うろ覚え   → 翌日に再出題、覚えやすさ係数 −0.1
✅ 完璧       → 間隔 × 係数 で次回を延長、係数 +0.1
```

標準の SM-2 だと間隔が 60 日以上に伸びることがありますが、TOEIC は試験日が決まっているので**最大 30 日にキャップ**するチューニングを入れました。これで試験直前に「全然見てない単語」が溜まる事態を防いでいます。

カードには CEFR レベル・目標スコア帯（600 / 730 / 860+）・TOEIC パート番号などのメタ情報が付いており、Browse タブでフィルタリング、Stats タブで進捗のグラフ確認ができます。

### 3. Part 1〜7 全対応の問題演習 UI

![ミスノート画面 ── 誤答を自動収集して復習](/images/mistakes-notebook.png)
*▲ ミスノート：174 件の誤答を Part 別・キーワードで検索、絞り込み再演習や頻出ミス集中演習が可能*

TOEIC の 7 パートはそれぞれ出題形式が違います。Part 1 は写真 + 音声の 4 択、Part 5 は文法穴埋めの 4 択、Part 7 は長文読解 + 複数設問……。

toeicPass では**パートごとに UI コンポーネントを分けて最適化**しています。

- **Part 1**: 写真を大きく表示 + 音声 4 択ボタン
- **Part 2**: 音声再生 + 3 択
- **Part 3-4**: 会話/説明パッセージ + 図表 + 複数設問
- **Part 5**: 英文 + 4 択（ハイライト付き解説）
- **Part 6**: パッセージ全体 + 複数箇所の穴埋め
- **Part 7**: 長文 + 設問群

問題データは 15+ の JSON ファイルに約 3,000 問を格納。アダプティブに難易度を調整し、弱点パートを重点的に出題します。

### 4. SSR と Web Speech API の共存

Next.js の SSR（Server-Side Rendering）と、ブラウザでしか動かない Web Speech API の組み合わせは要注意です。サーバー側で `window.SpeechRecognition` にアクセスするとエラーになります。

解決策はシンプルで、`mounted` ステートガードを入れてクライアントサイドでのみレンダリングします。

```tsx
const [mounted, setMounted] = useState(false);
useEffect(() => { setMounted(true); }, []);

if (!mounted) return <LoadingSkeleton />;
return <ShadowingView />;  // ブラウザ API 依存
```

地味ですが、Web Speech API を使うすべてのコンポーネントに適用する必要があり、見落とすとハイドレーションエラーが頻発します。この パターンは音声系 Web アプリでは定番になるはずです。

---

## その他の学習機能

### 200 問フル模試

![模擬試験開始画面 ── 200 問 120 分のフル TOEIC 模試](/images/mock-result.png)
*▲ 模擬試験：本番と同じ 200 問・120 分・Part 1-7 で実施*

本番と同じ 200 問 / 120 分形式です。強制タイマー、フルスクリーンモード、公式換算スコア（450〜990 点）、パート別正答率のレポートがあります。間違えた問題はそのまま復習に回せます。

### AI 英会話

![AI 音声会話 ── 8 つのビジネスシナリオで英語チャット](/images/ai-conversation.png)
*▲ AI 音声会話：Office Meeting、Restaurant Order、Job Interview など 8 シナリオ*

Google Gemini 2.0 Flash を使った音声チャットです。「ホテルのチェックイン」「会議のスケジュール調整」など 8 つの TOEIC 頻出シナリオで練習できます。発話は Web Speech API で認識し、AI の返答も音声で再生。修正ポイントやアドバイスをリアルタイムでフィードバックします。

### 間違いノート & ライティング評価

- **間違いノート**: 誤答を自動収集し、根因（語彙 / 文法 / 論理 / 不注意）をタグ付け。類似問題をドリル出題します。
- **ライティング評価**: 自由テキスト入力 → Gemini API が語彙・文法・構成をスコアリングし、具体的な改善提案を返します。

---

## 多言語対応

toeicPass は**日本語**と**中国語（簡体字）** の 2 言語に完全対応しています。UI ラベルだけでなく、単語の定義・文法の解説・シャドーイング素材の翻訳もすべて多言語で提供しています。

---

## まとめ

toeicPass は「リスニング・単語・文法・問題演習・模試・AI 会話・ライティング」を 1 つの Web アプリに統合した TOEIC 学習プラットフォームです。

個人的に学びが大きかったポイント：

- **Web Speech API** はサードパーティ不要で音声認識・合成をカバーできるが、SSR との共存は `mounted` ガードが必須
- **SM-2 間隔反復**は試験日制約がある学習には最大間隔キャップが重要
- **PGLite** を使えば CI でインメモリ DB テストが回せてフィードバックが速い
- **モノレポ**（Next.js + NestJS）は DX が良い反面、ビルド設定の管理が複雑になる

オープンソースなので、フォーク・PR 大歓迎です。TOEIC の勉強に使ってくれる方も、コードを読んで参考にしてくれる方も、ぜひ触ってみてください。

🤗 **デモ** → https://huggingface.co/spaces/jackywangsh/toeicPass
⭐ **GitHub** → https://github.com/zixuniaowu/toeicPass