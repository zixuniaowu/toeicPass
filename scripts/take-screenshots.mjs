/**
 * Playwright screenshot script for product documentation.
 * Usage: node scripts/take-screenshots.mjs
 *
 * Captures key pages of the toeicPass web app and saves to docs/screenshots/.
 */
import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "docs", "screenshots");
mkdirSync(OUT, { recursive: true });

const BASE = "http://localhost:8000";

// Credentials for the demo account
const EMAIL = "owner@demo.com";
const PASSWORD = "pass1234";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    locale: "zh-CN",
  });
  const page = await context.newPage();

  // 1. Login page (default Japanese locale)
  console.log("📸  Login page (Japanese)...");
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(OUT, "01-login-ja.png"), fullPage: false });

  // Switch to Chinese
  console.log("🌐  Switching to Chinese...");
  await page.click('button:has-text("中文")');
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(OUT, "01-login-zh.png"), fullPage: false });

  // 2. Login
  console.log("🔑  Logging in...");
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button:has-text("登录")');
  await page.waitForTimeout(4000);

  // Ensure Chinese locale after login (may reset)
  const zhBtn = page.locator('button:has-text("中文")');
  if (await zhBtn.count() > 0) {
    await zhBtn.click();
    await page.waitForTimeout(500);
  }
  
  // 3. Dashboard / Home
  console.log("📸  Dashboard...");
  await page.screenshot({ path: join(OUT, "02-dashboard.png"), fullPage: false });

  // Helper to navigate tabs using exact Chinese labels from TABS array
  async function goToTab(tabText, filename) {
    console.log(`📸  ${tabText}...`);
    try {
      const btn = page.locator(`nav button:has-text("${tabText}")`);
      if (await btn.count() > 0) {
        await btn.click();
        await page.waitForTimeout(2000);
        await page.screenshot({ path: join(OUT, filename), fullPage: false });
      } else {
        console.log(`  ⚠  Tab "${tabText}" not found, skipping`);
      }
    } catch (e) {
      console.log(`  ⚠  Error on ${tabText}: ${e.message}`);
    }
  }

  // Navigate through major views (Chinese labels from types/index.ts TABS)
  await goToTab("跟读练习", "03-shadowing.png");
  await goToTab("模拟考试", "04-mock-exam.png");
  await goToTab("语法练习", "05-grammar.png");
  await goToTab("AI对话", "06-conversation.png");
  await goToTab("错题集", "07-mistakes.png");
  await goToTab("背单词", "08-vocab.png");
  await goToTab("设置", "09-settings.png");

  // Mobile viewport capture of login page
  console.log("📸  Mobile login...");
  const mobilePage = await context.newPage();
  await mobilePage.setViewportSize({ width: 390, height: 844 });
  await mobilePage.goto(BASE, { waitUntil: "networkidle" });
  await mobilePage.waitForTimeout(1500);
  await mobilePage.screenshot({ path: join(OUT, "10-mobile-login.png"), fullPage: false });
  await mobilePage.close();

  await browser.close();
  console.log(`\n✅  Screenshots saved to ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
