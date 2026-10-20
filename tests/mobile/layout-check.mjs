import assert from 'node:assert/strict';

// Chromium permite simular o layout encolhendo com o teclado (resizes-content).
// Só dados fictícios da fixture local; não mede um teclado físico de iPhone.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.MOBILE_TEST_URL || 'http://127.0.0.1:4318';
assert.equal(new URL(base).hostname, '127.0.0.1');
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
let cases = 0;
try {
  for (const width of [768, 820, 1023]) {
    const context = await browser.newContext({
      viewport: { width, height: 1180 }, screen: { width, height: 1180 },
      hasTouch: true, isMobile: true,
    });
    await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
    await context.addInitScript(() => localStorage.setItem('scribeflow-last-project', 'demo-projeto'));
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await page.goto(base);
    await page.locator('.app-root').waitFor();
    assert.equal(await page.evaluate(() => matchMedia('(pointer: coarse)').matches), true);
    for (const height of [1180, 450, 300, 1180]) {
      // setViewportSize também muda screen no Playwright. O CDP permite
      // simular só o layout encolhendo, conservando a tela do dispositivo.
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width, height, mobile: true, deviceScaleFactor: 1, screenWidth: width, screenHeight: 1180,
      });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const legacyMatch = await page.evaluate(() => matchMedia('(max-width: 767px), (max-width: 1023px) and (max-height: 500px) and (pointer: coarse)').matches);
      assert.equal(legacyMatch, height <= 500, 'O cenário reproduz a troca no breakpoint antigo');
      assert.equal(await page.locator('.app-root.is-mobile').count(), 0,
        `Tablet ${width}px não deve trocar o layout com altura ${height}px`);
    }
    await context.close();
    cases++;
  }
  const phone = await browser.newContext({
    viewport: { width: 390, height: 844 }, screen: { width: 390, height: 844 }, hasTouch: true, isMobile: true,
  });
  await phone.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  const page = await phone.newPage();
  await page.goto(base);
  for (const size of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 844, height: 200 }]) {
    await page.setViewportSize(size);
    await page.locator('.app-root.is-mobile').waitFor();
    assert.equal(await page.locator('.app-root.is-mobile').count(), 1);
  }
  await phone.close();
  cases++;
  console.log(`${cases} perfis passaram: três tablets com teclado simulado e celular com rotação.`);
} finally {
  await browser.close();
}
