// Capture user-manual screenshots from the live site with the locally
// installed Chrome (headless). puppeteer-core lives in webapp/frontend's
// devDependencies:  node docs/manual/capture_screenshots.mjs
import { mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const HERE = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(HERE, '..', '..', 'webapp', 'frontend', 'package.json'));
const puppeteer = require('puppeteer-core');

const CHROME = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
const SITE = 'https://sharketfilter.xyz';
const OUT = join(HERE, '..', '..', 'webapp', 'frontend', 'public', 'manual', 'images');
const LANGS = ['en', 'ch'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function clickByText(page, selector, needle) {
  return page.evaluate(({ selector, needle }) => {
    const el = [...document.querySelectorAll(selector)].find((e) =>
      e.textContent.includes(needle)
    );
    if (el) el.click();
    return !!el;
  }, { selector, needle });
}

async function shot(page, lang, name) {
  const file = join(OUT, lang, `${name}.png`);
  await page.screenshot({ path: file });
  console.log('  saved', file);
}

async function captureLang(browser, lang) {
  console.log(`=== ${lang} ===`);
  mkdirSync(join(OUT, lang), { recursive: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 900 });
  await page.goto(SITE, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForSelector('.sidebar .group-header', { timeout: 60000 });
  await sleep(1000);

  // language dropdown
  await page.select('.language-selector select', lang);
  await sleep(800);

  // --- 1. Editor: open Currency -> first file ---
  await clickByText(page, '.sidebar .group-header', lang === 'ch' ? '通货' : 'Currency');
  await sleep(400);
  const hasFile = await page.evaluate(() => {
    const f = document.querySelector('.sidebar .file-item');
    if (f) { f.click(); return true; }
    const s = document.querySelector('.sidebar .subgroup-header');
    if (s) { s.click(); return false; }
    return true; // flat category: the header click already selected it
  });
  if (!hasFile) {
    await sleep(300);
    await page.evaluate(() => document.querySelector('.sidebar .file-item')?.click());
  }
  await page.waitForSelector('.mgr-header', { timeout: 60000 });
  await sleep(1500);
  await shot(page, lang, '01-editor');

  // --- 2. Expand the first tier's item list, hover for the tooltip ---
  await page.click('.mgr-header');
  await page.waitForSelector('.item-card-base', { timeout: 30000 });
  await sleep(600);
  const cards = await page.$$('.item-card-base');
  if (cards.length > 3) {
    await cards[2].hover();
    await sleep(900); // 120ms show delay + render
    await shot(page, lang, '02-tooltip');
    await page.mouse.move(10, 400);
    await sleep(400);
  }

  // --- 3. Global Show/Hide helper ---
  if (await clickByText(page, 'button', '👁')) {
    await page.waitForSelector('.vo-overlay', { timeout: 10000 });
    await sleep(800);
    await shot(page, lang, '03-show-hide');
    await page.mouse.click(10, 450); // overlay click closes
    await sleep(500);
  }

  // --- 4. Bulk tier editor ---
  if (await page.$('.bulk-edit-btn')) {
    await page.click('.bulk-edit-btn');
    await page.waitForSelector('.bulk-toolbar', { timeout: 20000 });
    await sleep(2500); // items fetch + overlay fade
    await shot(page, lang, '04-bulk-editor');
    // close via reload (modal has no overlay-click close)
    await page.goto(SITE, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForSelector('.sidebar .group-header', { timeout: 60000 });
    await sleep(800);
    await page.select('.language-selector select', lang);
    await sleep(800);
  }

  // --- 5. Theme & Sound view (hub + both editors) ---
  await page.evaluate(() => document.querySelectorAll('.nav-links button')[1].click());
  await sleep(2500);
  await shot(page, lang, '05-theme');

  if (await clickByText(page, 'button', lang === 'ch' ? '打开外观预设编辑器' : 'Open Theme Editor')) {
    await page.waitForSelector('.theme-editor-modal', { timeout: 30000 });
    await sleep(3000);
    await shot(page, lang, '05b-theme-editor');
    // 5d. Hue generator: pick a category, open the matrix with a second hue enabled
    await page.evaluate(() => document.querySelector('.theme-editor-modal .cat-group-header')?.click());
    await sleep(400);
    await page.evaluate(() => document.querySelector('.theme-editor-modal .file-leaf')?.click());
    await sleep(400);
    if (await page.$('.hue-gen-btn')) {
      await page.click('.hue-gen-btn');
      await page.waitForSelector('.hue-gen-content', { timeout: 30000 });
      await sleep(400);
      await page.evaluate(() => document.querySelectorAll('.hue-check input')[0]?.click()); // second hue
      await sleep(600);
      await shot(page, lang, '05d-hue-generator');
    }
    await page.goto(SITE, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForSelector('.sidebar .group-header', { timeout: 60000 });
    await sleep(800);
    await page.select('.language-selector select', lang);
    await sleep(800);
    await page.evaluate(() => document.querySelectorAll('.nav-links button')[1].click());
    await sleep(2000);
  }
  if (await clickByText(page, 'button', lang === 'ch' ? '打开音效批量编辑器' : 'Open Sound Bulk Editor')) {
    await page.waitForSelector('.sound-bulk-editor', { timeout: 30000 });
    await sleep(4000); // class data fetch
    await shot(page, lang, '05c-sound-editor');
    await page.goto(SITE, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForSelector('.sidebar .group-header', { timeout: 60000 });
    await sleep(800);
    await page.select('.language-selector select', lang);
    await sleep(800);
  }

  // --- 6. Simulator: generate a few drops ---
  await page.evaluate(() => document.querySelectorAll('.nav-links button')[2].click());
  await page.waitForSelector('.ssp-btn', { timeout: 60000 });
  // wait for prewarm to finish (button enabled)
  await page.waitForFunction(
    () => !document.querySelector('.ssp-btn')?.disabled,
    { timeout: 120000 }
  );
  for (let i = 0; i < 4; i++) {
    await page.click('.ssp-btn');
    await sleep(700);
  }
  await page.click('.ssp-btn-valuable');
  await sleep(1500);
  await shot(page, lang, '06-simulator');

  // --- 7. Save / Export view ---
  await page.evaluate(() => document.querySelectorAll('.nav-links button')[3].click());
  await sleep(1200);
  await shot(page, lang, '07-export');

  await page.close();
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--hide-scrollbars'],
});
try {
  for (const lang of LANGS) await captureLang(browser, lang);
} finally {
  await browser.close();
}
console.log('done');
