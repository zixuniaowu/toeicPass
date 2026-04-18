import { chromium } from 'playwright';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'docs', 'images');
mkdirSync(outDir, { recursive: true });

const BASE = 'http://localhost:8000';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'en' });
  const page = await ctx.newPage();

  // 1. Login page screenshot
  await page.goto(BASE);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: join(outDir, 'login-page.png') });
  console.log('login-page.png');

  // Register via API first
  const regRes = await page.evaluate(async () => {
    const r = await fetch('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'ss@test.com', password: 'Test1234!', displayName: 'SS', tenantName: 'Default', tenantCode: 'default' })
    });
    return r.json();
  });
  console.log('Register:', JSON.stringify(regRes));

  // Login via form
  await page.locator('input[type="email"]').first().fill('ss@test.com');
  await page.locator('input[type="password"]').first().fill('Test1234!');
  await page.locator('button:has-text("ログイン")').first().click();
  await page.waitForTimeout(3000);

  // 2. Home / shadowing page
  await page.screenshot({ path: join(outDir, 'shadowing-practice.png') });
  console.log('shadowing-practice.png');

  // Click first practice
  const practiceBtn = page.locator('button:has-text("練習開始")').first();
  if (await practiceBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await practiceBtn.click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: join(outDir, 'shadowing-player.png') });
    console.log('shadowing-player.png');
    await page.goBack();
    await page.waitForTimeout(2000);
  }

  // 3. AI Conversation
  await page.locator('a:has-text("AI会話")').first().click().catch(() => {});
  await page.waitForTimeout(2000);
  await page.screenshot({ path: join(outDir, 'ai-conversation.png') });
  console.log('ai-conversation.png');

  // 4. Vocabulary
  await page.locator('a:has-text("単語帳")').first().click().catch(() => {});
  await page.waitForTimeout(2000);
  await page.screenshot({ path: join(outDir, 'vocab-flashcard.png') });
  console.log('vocab-flashcard.png');

  // 5. Grammar
  await page.locator('a:has-text("文法練習")').first().click().catch(() => {});
  await page.waitForTimeout(2000);
  await page.screenshot({ path: join(outDir, 'grammar-practice.png') });
  console.log('grammar-practice.png');

  // 6. Mistakes notebook
  await page.locator('a:has-text("ミスノート")').first().click().catch(() => {});
  await page.waitForTimeout(2000);
  await page.screenshot({ path: join(outDir, 'mistakes-notebook.png') });
  console.log('mistakes-notebook.png');

  await browser.close();
  console.log('Done!');
}

main().catch(e => { console.error(e); process.exit(1); });
