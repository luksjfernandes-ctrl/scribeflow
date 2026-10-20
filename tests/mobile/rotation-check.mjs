import assert from 'node:assert/strict';

// A página real recebe medições transitórias de rotação. Toques são reais do
// motor de teste; visualViewport/teclado são injetados, não um aparelho iOS.
const engines = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const engine = process.env.BROWSER_ENGINE || 'chromium';
const base = process.env.MOBILE_TEST_URL || 'http://127.0.0.1:4318';
assert.equal(new URL(base).hostname, '127.0.0.1');
const browser = await engines[engine].launch(engine === 'chromium' && process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 }, screen: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
});
await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
await context.addInitScript(() => {
  localStorage.setItem('scribeflow-last-project', 'demo-projeto');
  const vv = new EventTarget();
  Object.assign(vv, { width: 390, height: 844, offsetTop: 0, scale: 1 });
  window.__rotationViewport = vv;
  Object.defineProperty(window, 'visualViewport', { configurable: true, get: () => vv });
});
const page = await context.newPage();
page.setDefaultTimeout(10000);
const pageErrors = [];
page.on('pageerror', error => pageErrors.push(error.message));
async function measure(patch, rotate = false) {
  await page.evaluate(({ patch, rotate }) => {
    Object.assign(window.__rotationViewport, patch);
    if (rotate) window.dispatchEvent(new Event('orientationchange'));
    window.__rotationViewport.dispatchEvent(new Event('resize'));
    window.__rotationViewport.dispatchEvent(new Event('scroll'));
  }, { patch, rotate });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
async function toolbarWorks() {
  await page.locator('.app-root.is-mobile').waitFor();
  const metrics = await page.evaluate(() => {
    const root = document.querySelector('.app-root').getBoundingClientRect();
    const bar = document.querySelector('.macos-toolbar').getBoundingClientRect();
    const button = document.querySelector('.toolbar-btn-binder-toggle');
    const rect = button.getBoundingClientRect();
    return {
      top: root.top, height: root.height, innerHeight, barTop: bar.top, barBottom: bar.bottom,
      hit: button.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)),
    };
  });
  assert.equal(metrics.top, 0, 'Sem offset residual fora da edição');
  assert.ok(Math.abs(metrics.height - metrics.innerHeight) < 1, 'A altura normal acompanha CSS/dvh');
  assert.ok(metrics.barTop >= 0 && metrics.barBottom <= metrics.innerHeight, 'Barra dentro da tela');
  assert.equal(metrics.hit, true, 'O toque alcança o botão que está desenhado');
  const binder = page.getByTitle('Mostrar ou esconder a estrutura');
  await binder.tap();
  await page.locator('.mobile-drawer').waitFor();
  await binder.tap();
  await page.locator('.mobile-drawer').waitFor({ state: 'hidden' });
  const more = page.getByRole('button', { name: 'Mais', exact: true });
  await more.tap();
  await page.locator('.mobile-more-menu').waitFor();
  await page.getByRole('button', { name: 'Fechar menu', exact: true }).tap({ position: { x: 5, y: 5 } });
  await page.locator('.mobile-more-menu').waitFor({ state: 'hidden' });
}
try {
  await page.goto(base);
  await toolbarWorks();
  // Ida e volta sem editor, incluindo offset persistente e escala transitória.
  for (let cycle = 0; cycle < 3; cycle++) {
    await page.getByRole('button', { name: 'Mais', exact: true }).tap();
    await page.locator('.mobile-more-menu').waitFor();
    await page.setViewportSize({ width: 844, height: 390 });
    await measure({ height: 844, offsetTop: 90, scale: 0.46 }, true);
    await page.locator('.mobile-more-menu').waitFor({ state: 'hidden' });
    assert.equal(await page.getByRole('button', { name: 'Fechar menu', exact: true }).count(), 0);
    await toolbarWorks();
    await measure({ height: 390, offsetTop: 90, scale: 1 });
    await toolbarWorks();
    await page.setViewportSize({ width: 390, height: 844 });
    await measure({ height: 390, offsetTop: 90, scale: 1 }, true);
    await toolbarWorks();
    await measure({ height: 844, offsetTop: 90, scale: 1 });
    await toolbarWorks();
  }
  // Editor e teclado: manter o texto e recuperar os controles ao sair da edição.
  await page.getByTitle('Mostrar ou esconder a estrutura').tap();
  const chapter = page.locator('[data-binder-id="c1"]');
  if (!await chapter.isVisible()) await page.locator('[data-binder-id="f-man"] .disclosure-triangle').tap();
  await chapter.tap();
  const editor = page.locator('.editor-page [contenteditable="true"]');
  await editor.fill('Texto fictício que precisa sobreviver à rotação.');
  await measure({ height: 350, offsetTop: 80, scale: 1 });
  assert.equal(await page.evaluate(() => document.documentElement.dataset.keyboard), 'open');
  await page.setViewportSize({ width: 844, height: 390 });
  await measure({ height: 200, offsetTop: 40, scale: 1 }, true);
  assert.ok((await editor.innerText()).includes('sobreviver à rotação'));
  await page.setViewportSize({ width: 390, height: 844 });
  await measure({ height: 350, offsetTop: 80, scale: 1 }, true);
  await editor.evaluate(element => element.blur());
  // Mesmo com medida velha e zoom transitório, blur precisa destravar a raiz.
  await measure({ height: 350, offsetTop: 90, scale: 0.8 });
  await toolbarWorks();
  await measure({ height: 844, offsetTop: 90, scale: 1 });
  await toolbarWorks();
  assert.ok((await editor.innerText()).includes('sobreviver à rotação'));
  assert.deepEqual(pageErrors, []);
  console.log('Rotação: três idas/voltas, offset/escala transitórios, hit-test e toques, edição e blur passaram.');
} finally {
  await browser.close();
}
