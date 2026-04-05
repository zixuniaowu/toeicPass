/** Default seed ads for bootstrapping. */
export const DEFAULT_AD_SEEDS = [
  { slot: "banner_top", title: "Upgrade to Premium", linkUrl: "#upgrade", ctaText: "Upgrade Now", priority: 100 },
  { slot: "banner_top", title: "TOEIC 公式問題集 発売中", linkUrl: "https://example.com/toeic-book", ctaText: "詳しく見る", priority: 80 },
  { slot: "interstitial", title: "TOEIC スコアアップ特訓コース", imageUrl: "https://placehold.co/600x400?text=TOEIC+Course", linkUrl: "https://example.com/course", ctaText: "無料体験", priority: 90 },
  { slot: "interstitial", title: "英語学習アプリ プレミアム", imageUrl: "https://placehold.co/600x400?text=Premium+App", linkUrl: "#upgrade", ctaText: "今すぐアップグレード", priority: 85 },
  { slot: "native_feed", title: "TOEIC 頻出単語帳 2025", imageUrl: "https://placehold.co/120x120?text=Vocab+Book", linkUrl: "https://example.com/vocab-book", ctaText: "チェックする →", priority: 70 },
  { slot: "native_feed", title: "オンライン英会話 初月50%OFF", imageUrl: "https://placehold.co/120x120?text=English+Talk", linkUrl: "https://example.com/english-talk", ctaText: "キャンペーン詳細 →", priority: 75 },
  { slot: "reward_video", title: "追加練習チャンスを獲得", linkUrl: "#reward", ctaText: "動画を見る", priority: 95 },
  { slot: "banner_top", title: "Hugging Face - The AI community building the future", imageUrl: "https://huggingface.co/front/assets/huggingface_logo-noborder.svg", linkUrl: "https://huggingface.co/", ctaText: "Visit Hugging Face 🤗", priority: 110 },
  { slot: "native_feed", title: "Hugging Face Models - 開源AI模型庫", imageUrl: "https://huggingface.co/front/assets/huggingface_logo-noborder.svg", linkUrl: "https://huggingface.co/models", ctaText: "探索AI模型 →", priority: 88 },
  { slot: "interstitial", title: "Hugging Face Spaces - Build & Share AI Apps", imageUrl: "https://huggingface.co/front/assets/huggingface_logo-noborder.svg", linkUrl: "https://huggingface.co/spaces", ctaText: "Try Spaces Free 🚀", priority: 92 },
] as const;
