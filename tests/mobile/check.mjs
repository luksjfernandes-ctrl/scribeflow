import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Playwright é opcional: pode ficar fora do clone para não alterar dependências.
const { webkit, devices } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.MOBILE_TEST_URL || 'http://127.0.0.1:4318';
assert.equal(new URL(base).hostname, '127.0.0.1', 'Teste permitido só no servidor local da fixture');
const output = path.resolve(process.env.MOBILE_TEST_OUTPUT || 'tests/mobile/results');
await mkdir(output, { recursive: true });
const browser = await webkit.launch();
const results = [];
let lastPage;

async function openChapter(page) {
  await page.locator('.app-root.is-mobile').waitFor();
  await page.getByTitle('Mostrar ou esconder a estrutura').tap();
  const chapter = page.locator('[data-binder-id="c1"]');
  if (!await chapter.isVisible()) await page.locator('[data-binder-id="f-man"] .disclosure-triangle').tap();
  await chapter.tap();
}

async function viewport(page, patch) {
  await page.evaluate(values => {
    Object.assign(window.__mobileViewport, values);
    window.__mobileViewport.dispatchEvent(new Event('resize'));
    window.__mobileViewport.dispatchEvent(new Event('scroll'));
  }, patch);
  await page.waitForFunction(() => !document.documentElement.style.getPropertyValue('--app-height').includes('NaN'));
  // Aguarda os dois frames que publicam o viewport e recalculam o layout.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function geometry(page) {
  return page.evaluate(() => {
    const rect = document.querySelector('.app-root').getBoundingClientRect();
    const bar = document.querySelector('.format-bar').getBoundingClientRect();
    return {
      top: rect.top, height: rect.height, right: rect.right, barBottom: bar.bottom,
      keyboard: document.documentElement.dataset.keyboard || null,
    };
  });
}

try {
  for (const [name, size] of [
    ['iphone-retrato', { width: 390, height: 844 }],
    ['iphone-deitado', { width: 844, height: 390 }],
    ['iphone-pequeno', { width: 320, height: 568 }],
  ]) {
    const context = await browser.newContext({ ...devices['iPhone 13'], viewport: size, screen: size, locale: 'pt-BR' });
    const blocked = [];
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === '127.0.0.1') return route.continue();
      blocked.push(url.hostname);
      return route.abort();
    });
    await context.addInitScript(size => {
      localStorage.setItem('scribeflow-last-project', 'demo-projeto');
      localStorage.setItem('scribeflow-composition-prefs', JSON.stringify({ fontSize: 14, paperWidth: 680, fontFamily: 'serif', lineHeight: 1.8 }));
      localStorage.setItem('scribeflow-editor-display', JSON.stringify({ font: 'palatino', size: 14 }));
      const real = window.visualViewport;
      const vv = new EventTarget();
      // O initScript roda ANTES da meta viewport: innerHeight ainda pode ser
      // o layout padrão de 980px do WebKit. Usa o perfil explícito do teste.
      Object.assign(vv, { height: size.height, width: size.width, offsetTop: 0, offsetLeft: 0, pageTop: 0, pageLeft: 0, scale: 1 });
      window.__mobileViewport = vv;
      Object.defineProperty(window, 'visualViewport', { configurable: true, get: () => vv });
      // O teclado e a pinça são injetados; não são um teclado/gesto iOS real.
      window.__originalVisualViewport = real;
    }, size);
    const page = await context.newPage();
    lastPage = page;
    console.log(`${name}: abre app`);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base);
    await page.locator('.app-root.is-mobile').waitFor();
    await page.screenshot({ path: path.join(output, `${name}-abertura-diagnostico.png`) });
    await openChapter(page);
    console.log(`${name}: escreve e salva`);
    const editor = page.locator('.editor-page [contenteditable="true"]');
    await editor.waitFor();
    assert.equal(await page.locator('.mobile-drawer').count(), 0);
    assert.equal(await page.locator('.mobile-sheet').count(), 0);
    const style = await editor.evaluate(el => ({ font: parseFloat(getComputedStyle(el).fontSize), select: getComputedStyle(el).webkitUserSelect }));
    assert.ok(style.font >= 16);
    assert.equal(style.select, 'text');
    await editor.tap();
    assert.equal(await editor.evaluate(el => el === document.activeElement), true, 'Toque no editor dá foco');
    const text = `Escrita fictícia no celular — ${name}.`;
    await editor.fill(text);
    await page.getByRole('button', { name: 'Salvar', exact: true }).tap();
    await page.waitForFunction(value => {
      const data = JSON.parse(localStorage.getItem('mobile-test-tables') || '{}');
      return data.docs?.some(doc => doc.id === 'c1' && doc.content.includes(value));
    }, text);
    await page.reload();
    await openChapter(page);
    await editor.waitFor();
    assert.ok((await editor.innerText()).includes(text), 'Texto gravado reaparece ao recarregar a fixture');
    const initial = await geometry(page);
    assert.ok(initial.right <= size.width + 1, 'Sem transbordamento horizontal');
    await viewport(page, { height: size.height / 2, offsetTop: 80, scale: 2 });
    assert.deepEqual(await geometry(page), initial, 'Pinça não reorganiza a raiz nem simula teclado');
    await viewport(page, { height: size.height, offsetTop: 0, scale: 1 });
    const keyboardHeight = name === 'iphone-deitado' ? 240 : 350;
    await viewport(page, { height: keyboardHeight, offsetTop: 80, scale: 1 });
    const keyboard = await geometry(page);
    assert.equal(keyboard.height, keyboardHeight);
    assert.equal(keyboard.top, 80);
    assert.equal(keyboard.keyboard, 'open');
    assert.ok(keyboard.barBottom <= keyboard.top + keyboard.height + 1);
    await page.screenshot({ path: path.join(output, `${name}-teclado-injetado.png`) });
    await viewport(page, { height: keyboardHeight / 2, offsetTop: 120, scale: 2 });
    assert.deepEqual(await geometry(page), keyboard, 'Zoom conserva teclado já aberto');
    await viewport(page, { height: size.height, offsetTop: 0, scale: 1 });
    assert.deepEqual(await geometry(page), initial, 'Fechar teclado restaura a geometria');
    await page.screenshot({ path: path.join(output, `${name}-editor.png`) });
    console.log(`${name}: abre inspetor e foco`);
    await page.getByTitle('Mostrar ou esconder os detalhes').tap();
    const synopsis = page.locator('.mobile-sheet textarea').first();
    await synopsis.waitFor();
    assert.ok(await synopsis.evaluate(el => parseFloat(getComputedStyle(el).fontSize) >= 16));
    await page.screenshot({ path: path.join(output, `${name}-inspetor.png`) });
    await page.locator('.mobile-sheet-header button').tap();
    await page.getByRole('button', { name: 'Mais', exact: true }).tap();
    await page.getByRole('menuitem', { name: 'Modo de Foco', exact: true }).tap();
    const focus = page.locator('.composition-overlay [contenteditable="true"]');
    await focus.waitFor();
    const focusStyle = await focus.evaluate(el => ({ font: parseFloat(getComputedStyle(el).fontSize), select: getComputedStyle(el).webkitUserSelect }));
    assert.ok(focusStyle.font >= 16, 'Foco respeita mínimo mesmo com preferência de 14px');
    assert.equal(focusStyle.select, 'text');
    await focus.tap();
    await focus.fill(`Foco fictício — ${name}.`);
    await viewport(page, { height: keyboardHeight, offsetTop: 80, scale: 1 });
    const focusRect = await page.locator('.composition-overlay').boundingBox();
    assert.equal(focusRect.height, keyboardHeight);
    assert.equal(focusRect.y, 80);
    await page.screenshot({ path: path.join(output, `${name}-foco-teclado-injetado.png`) });
    await page.getByTitle('Sair do Modo de Foco (ESC)').tap();
    await page.locator('.composition-overlay').waitFor({ state: 'hidden' });
    assert.ok((await editor.innerText()).includes(`Foco fictício — ${name}.`));
    if (name === 'iphone-retrato') {
      await page.setViewportSize({ width: 844, height: 390 });
      await viewport(page, { height: 390, width: 844, offsetTop: 0, scale: 1 });
      await page.locator('.app-root.is-mobile').waitFor();
      assert.equal((await geometry(page)).height, 390);
      assert.ok((await editor.innerText()).includes(`Foco fictício — ${name}.`));
      await page.screenshot({ path: path.join(output, 'iphone-rotacao-deitado.png') });
      await page.setViewportSize(size);
      await viewport(page, { height: size.height, width: size.width, offsetTop: 0, scale: 1 });
      assert.ok((await editor.innerText()).includes(`Foco fictício — ${name}.`));
    }
    assert.deepEqual(errors, []);
    results.push({ name, viewport: size, initial, keyboard, focusStyle, pageErrors: errors, externalHostsBlocked: [...new Set(blocked)], passed: true });
    await context.close();
  }
  // Também usa o visualViewport NATIVO do WebKit: escrita e rotação sem
  // substituir a API. O teclado virtual do aparelho continua fora do ensaio.
  const native = await browser.newContext({ ...devices['iPhone 13'], locale: 'pt-BR' });
  await native.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await native.addInitScript(() => localStorage.setItem('scribeflow-last-project', 'demo-projeto'));
  const nativePage = await native.newPage();
  lastPage = nativePage;
  await nativePage.goto(base);
  await openChapter(nativePage);
  const nativeEditor = nativePage.locator('.editor-page [contenteditable="true"]');
  const nativeBefore = await geometry(nativePage);
  await nativeEditor.tap();
  await nativeEditor.fill('Escrita fictícia com viewport nativo do WebKit.');
  await nativePage.getByRole('button', { name: 'Salvar', exact: true }).tap();
  assert.equal(await nativePage.evaluate(() => window.visualViewport.scale), 1);
  assert.equal((await geometry(nativePage)).height, nativeBefore.height);
  await nativePage.screenshot({ path: path.join(output, 'iphone-viewport-nativo.png') });
  await nativePage.setViewportSize({ width: 844, height: 390 });
  await nativePage.waitForFunction(() => Math.abs(document.querySelector('.app-root').getBoundingClientRect().height - window.visualViewport.height) < 1);
  assert.equal(await nativePage.locator('.app-root.is-mobile').count(), 1);
  assert.ok((await nativeEditor.innerText()).includes('viewport nativo do WebKit'));
  const nativeAfter = await geometry(nativePage);
  await nativePage.screenshot({ path: path.join(output, 'iphone-rotacao-viewport-nativo.png') });
  await native.close();

  // Mesa continua com três painéis; o breakpoint novo só inclui toque deitado.
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await desktop.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  const page = await desktop.newPage();
  await page.goto(base);
  await page.locator('.app-root').waitFor();
  assert.equal(await page.locator('.app-root.is-mobile').count(), 0);
  await desktop.close();
  await writeFile(path.join(output, 'results.json'), JSON.stringify({ engine: browser.version(), keyboardAndPinch: 'visualViewport injetado; sem teclado ou pinça reais do iOS', cases: results, nativeViewport: { before: nativeBefore, after: nativeAfter, passed: true }, desktop: 'passou' }, null, 2));
  console.log(`WebKit: ${results.length} perfis de iPhone + viewport nativo/rotação + desktop passaram.`);
} catch (error) {
  if (lastPage && !lastPage.isClosed()) await lastPage.screenshot({ path: path.join(output, 'falha-diagnostico.png') });
  throw error;
} finally {
  await browser.close();
}
