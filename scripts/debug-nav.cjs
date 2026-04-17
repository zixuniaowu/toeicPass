const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  const p = await ctx.newPage();

  // First register via API
  console.log('Registering user via API...');
  const regResult = await p.evaluate(async () => {
    try {
      const r = await fetch('http://localhost:8001/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantCode: 'screenshots',
          tenantName: 'Screenshot Org',
          email: 'screenshot@test.com',
          password: 'test1234',
          displayName: 'Screenshot User'
        })
      });
      return { status: r.status, body: await r.text() };
    } catch (e) { return { error: e.message }; }
  });
  console.log('REGISTER:', JSON.stringify(regResult));

  // Now go to the app and login
  await p.goto('http://localhost:8000', { waitUntil: 'networkidle' });
  await p.waitForTimeout(1500);
  await p.click('button:has-text("中文")');
  await p.waitForTimeout(300);
  await p.fill('input[type="email"]', 'screenshot@test.com');
  await p.fill('input[type="password"]', 'test1234');
  // Expand and fill tenant code
  const details = p.locator('summary, details');
  if (await details.count() > 0) {
    await details.first().click();
    await p.waitForTimeout(300);
  }
  // Fill tenant code field
  const tcField = p.locator('#tenant-code');
  if (await tcField.count() > 0) {
    await tcField.fill('screenshots');
    console.log('Filled tenant code');
  } else {
    console.log('Tenant code field not found');
  }
  await p.click('button:has-text("登录")');
  await p.waitForTimeout(4000);
  
  // Check for error messages
  const errorText = await p.evaluate(() => document.body.innerText);
  // Get only the footer/message area
  const msgs = await p.locator('[class*="message"], [class*="error"], [class*="footer"], [class*="Footer"]').allTextContents();
  console.log('MESSAGES:', JSON.stringify(msgs));
  // Check page text for anything related to login status
  const bodyText = errorText.substring(0, 500);
  console.log('BODY (first 500):', bodyText);
  // Check console errors
  p.on('console', msg => console.log('CONSOLE:', msg.type(), msg.text()));
  // Check if API is returning errors
  const response = await p.evaluate(async () => {
    try {
      const r = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'owner@demo.com', password: 'pass1234' })
      });
      return { status: r.status, body: await r.text() };
    } catch (e) { return { error: e.message }; }
  });
  console.log('API LOGIN RESPONSE:', JSON.stringify(response));

  // Dump all buttons
  const allBtns = await p.locator('button').allTextContents();
  console.log('ALL BUTTONS:', JSON.stringify(allBtns));
  // Dump nav elements
  const navCount = await p.locator('nav').count();
  console.log('NAV count:', navCount);
  if (navCount > 0) {
    const navHTML = await p.locator('nav').first().innerHTML();
    console.log('NAV HTML (first 2000):', navHTML.substring(0, 2000));
  }
  // Dump page URL
  console.log('URL:', p.url());
  // Take debug screenshot
  await p.screenshot({ path: 'tmp-after-login.png', fullPage: true });
  await b.close();
  console.log('Done');
})();
