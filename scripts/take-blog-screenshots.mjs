/**
 * Playwright スクリプト: ブログ用スクリーンショット撮影
 *
 * 使い方:
 *   1. ローカル開発サーバーを起動: npm run dev
 *   2. スクリプト実行: npx playwright test scripts/take-blog-screenshots.mjs
 *      または: node scripts/take-blog-screenshots.mjs
 *
 * HF Space から撮る場合は BASE_URL を変更:
 *   BASE_URL=https://jackywangsh-toeicpass.hf.space node scripts/take-blog-screenshots.mjs
 */

import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE_URL = process.env.BASE_URL || "http://localhost:8000";
const OUT_DIR = resolve(__dirname, "..", "docs", "images");

mkdirSync(OUT_DIR, { recursive: true });

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    locale: "ja-JP",
  });
  const page = await context.newPage();

  console.log(`📸 スクリーンショット撮影開始 (${BASE_URL})`);

  // ===== ログイン =====
  console.log("  → ログイン中...");
  await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(1500);

  // 日本語に切り替え
  const jaBtn = page.locator('button:has-text("日本語")');
  if (await jaBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await jaBtn.click();
    await page.waitForTimeout(500);
  }

  // owner@demo.com / pass1234 でログイン
  await page.fill('input[type="email"]', "owner@demo.com");
  await page.fill('input[type="password"]', "toeic123");
  const loginBtn = page.locator('button:has-text("ログイン"), button:has-text("登录"), button[type="submit"]').first();
  await loginBtn.click();
  await page.waitForTimeout(4000);
  console.log("    ✅ ログイン完了");

  // ログイン後に再度日本語に切り替え（リセットされる場合）
  const jaBtn2 = page.locator('button:has-text("日本語")');
  if (await jaBtn2.isVisible({ timeout: 2000 }).catch(() => false)) {
    await jaBtn2.click();
    await page.waitForTimeout(500);
  }

  // 1. ホーム画面（ログイン後のダッシュボード）
  console.log("  → ホーム画面...");
  await page.screenshot({ path: `${OUT_DIR}/home-dashboard.png`, fullPage: false });

  // ===== ナビゲーションヘルパー =====
  async function goToTab(label, filename) {
    console.log(`  → ${label}...`);
    try {
      const btn = page.locator(`nav button:has-text("${label}")`);
      if (await btn.count() > 0) {
        await btn.click();
        await page.waitForTimeout(2500);
        await page.screenshot({ path: `${OUT_DIR}/${filename}`, fullPage: false });
      } else {
        console.log(`    ⚠ "${label}" タブが見つかりません`);
      }
    } catch (e) {
      console.log(`    ⚠ ${label} の撮影をスキップ: ${e.message}`);
    }
  }

  // 2. シャドーイング画面
  await goToTab("シャドーイング", "shadowing-practice.png");

  // 3. 単語帳（フラッシュカード）
  await goToTab("単語帳", "vocab-flashcard.png");

  // 4. 文法練習
  await goToTab("文法練習", "grammar-practice.png");

  // 5. 模擬試験
  await goToTab("模擬試験", "mock-result.png");

  // 6. AI 会話
  await goToTab("AI会話", "ai-conversation.png");

  // 7. ミスノート
  await goToTab("ミスノート", "mistakes-notebook.png");

  await browser.close();
  console.log(`\n✅ 完了！画像は ${OUT_DIR} に保存されました。`);
  console.log("   Zenn エディタで画像をドラッグ＆ドロップしてアップロードしてください。");
}

main().catch((err) => {
  console.error("エラー:", err);
  process.exit(1);
});
