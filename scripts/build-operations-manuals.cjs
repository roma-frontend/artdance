/* eslint-disable @typescript-eslint/no-require-imports */
'use strict';

// Standalone tooling: no Next runtime, application server, or network is required.
const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const { chromium } = require('playwright');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_OUT = path.join(ROOT, 'manual/generated');
const LOCALES = ['en', 'hy'];
const MANIFEST_NAME = 'manual-manifest.json';
const REPORT_NAME = 'verification-report.json';
const FONT_FILES = [400, 700].map((weight) => ({
  weight, path: `src/design/og-fonts/noto-sans-armenian-armenian-${weight}-normal.woff`,
}));
const TOOL_FILES = ['scripts/build-operations-manuals.cjs', 'verify-manuals.cjs'];
const PDF_NAME = (locale) => `ArtDance_Operations_Manual_${locale.toUpperCase()}.pdf`;
const HTML_NAME = (locale) => PDF_NAME(locale).replace(/\.pdf$/, '.html');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function relative(file) {
  return path.relative(ROOT, file).split(path.sep).join('/');
}

function text(value, label) {
  assert(typeof value === 'string' && value.trim().length > 0, `${label}: nonempty string required`);
  assert(!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffd]/u.test(value), `${label}: invalid text`);
  return value;
}

function id(value, label) {
  assert(typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(value), `${label}: unsafe ID`);
  return value;
}

// A neutral content route is explicitly localized. Already-localized routes must
// match their own edition; finalPath must always contain the actual locale.
function localizedRoute(route, locale, requirePrefix = false) {
  text(route, `${locale} route`);
  assert(route.startsWith('/') && !route.startsWith('//') && !/[\\#\s]/u.test(route), `Invalid route: ${route}`);
  const url = new URL(route, 'https://manual.invalid');
  assert(url.origin === 'https://manual.invalid' && url.pathname === route.split('?')[0], `Noncanonical route: ${route}`);
  const prefix = url.pathname.split('/')[1];
  const hasLocale = ['en', 'hy', 'ru'].includes(prefix);
  assert(!hasLocale || prefix === locale, `${locale}: wrong-language route ${route}`);
  assert(!requirePrefix || hasLocale, `${locale}: finalPath must include /${locale}: ${route}`);
  const pathname = hasLocale ? url.pathname : `/${locale}${url.pathname === '/' ? '' : url.pathname}`;
  url.searchParams.sort();
  return pathname + url.search;
}

function neutralRoute(route, locale) {
  return localizedRoute(route, locale).replace(new RegExp(`^/${locale}(?=/|\\?|$)`), '');
}

function validateContent(content) {
  for (const locale of LOCALES) {
    const manual = content?.[locale];
    assert(manual && typeof manual === 'object', `Missing ${locale} content`);
    for (const field of ['title', 'subtitle', 'notice']) text(manual[field], `${locale}.${field}`);
    assert(Array.isArray(manual.sections) && manual.sections.length > 0, `${locale}: sections required`);
    const sectionIds = new Set();
    const shotIds = new Set();
    for (const section of manual.sections) {
      id(section.id, `${locale} section.id`);
      assert(!sectionIds.has(section.id), `${locale}: repeated section ${section.id}`);
      sectionIds.add(section.id);
      for (const field of ['title', 'lead']) text(section[field], `${locale}.${section.id}.${field}`);
      localizedRoute(section.route, locale);
      assert(Array.isArray(section.steps) && section.steps.length > 0, `${locale}.${section.id}: steps required`);
      for (const step of section.steps) {
        assert(Array.isArray(step) && step.length === 2, `${section.id}: step must be [heading, body]`);
        step.forEach((part) => text(part, `${locale}.${section.id}.step`));
      }
      assert(Array.isArray(section.notes), `${section.id}: notes must be an array`);
      section.notes.forEach((note) => text(note, `${locale}.${section.id}.note`));
      assert(Array.isArray(section.shots), `${section.id}: shots must be an array`);
      for (const shot of section.shots) {
        id(shot.id, `${locale}.${section.id}.shot.id`);
        assert(!shotIds.has(shot.id), `${locale}: screenshot ${shot.id} is reused; provide a distinct relevant capture`);
        shotIds.add(shot.id);
        localizedRoute(shot.route, locale);
        if (shot.focus !== undefined) text(shot.focus, `${locale}.${shot.id}.focus`);
      }
      if (locale === 'hy') assert(/\p{Script=Armenian}/u.test(section.title + section.lead), `${section.id}: Armenian text missing`);
    }
  }
  assert(content.en.sections.length === content.hy.sections.length, 'EN/HY section count mismatch');
  content.en.sections.forEach((en, index) => {
    const hy = content.hy.sections[index];
    assert(en.id === hy.id, `EN/HY section order/ID mismatch at ${index + 1}`);
    assert(neutralRoute(en.route, 'en') === neutralRoute(hy.route, 'hy'), `${en.id}: EN/HY route mismatch`);
    assert(en.steps.length === hy.steps.length && en.notes.length === hy.notes.length, `${en.id}: EN/HY step/note parity mismatch`);
    assert(en.shots.length === hy.shots.length, `${en.id}: EN/HY illustration count mismatch`);
    en.shots.forEach((shot, i) => {
      assert(shot.id === hy.shots[i].id && neutralRoute(shot.route, 'en') === neutralRoute(hy.shots[i].route, 'hy'), `${en.id}: EN/HY screenshot parity mismatch`);
    });
  });
  return content;
}

function captureEntries(manifest) {
  const entries = Array.isArray(manifest) ? manifest : manifest?.entries ?? manifest?.captures;
  assert(Array.isArray(entries) && entries.length > 0, 'capture-manifest.json must contain an entries (or captures) array');
  const keys = new Set();
  for (const entry of entries) {
    assert(LOCALES.includes(entry.locale), 'Capture locale must be en or hy');
    id(entry.id, 'capture.id');
    const key = `${entry.locale}/${entry.id}`;
    assert(!keys.has(key), `Duplicate capture metadata: ${key}`);
    keys.add(key);
    assert(entry.source === 'live-demo', `${key}: capture source must be live-demo`);
    assert(/^[a-f0-9]{64}$/.test(entry.sha256), `${key}: invalid SHA-256`);
    for (const field of ['width', 'height', 'visibleSkeletons', 'rowCount', 'armenianCharacters']) {
      assert(Number.isSafeInteger(entry[field]) && entry[field] >= 0, `${key}: invalid ${field}`);
    }
    assert(entry.width > 0 && entry.height > 0, `${key}: invalid dimensions`);
    assert(entry.visibleSkeletons === 0, `${key}: visible loading skeletons`);
    if (entry.locale === 'hy') assert(entry.armenianCharacters > 0, `${key}: no Armenian UI characters`);
    assert(localizedRoute(entry.route, entry.locale) === localizedRoute(entry.finalPath, entry.locale, true), `${key}: capture redirected away from its requested route`);
  }
  return entries;
}

async function fileRecord(file) {
  const bytes = await fs.readFile(file);
  return { path: relative(file), sha256: sha256(bytes), bytes: bytes.length };
}

async function exists(file) {
  return fs.access(file).then(() => true, () => false);
}

async function loadInputs(options = {}) {
  const output = path.resolve(options.output ?? DEFAULT_OUT);
  const contentPath = path.resolve(options.content ?? path.join(ROOT, 'docs/operations-manual/content.cjs'));
  const screenshots = path.resolve(options.screenshots ?? path.join(output, 'screenshots'));
  let capturePath = options.captureManifest && path.resolve(options.captureManifest);
  if (!capturePath) {
    const candidates = [path.join(output, 'capture-manifest.json'), path.join(screenshots, 'capture-manifest.json')];
    const present = (await Promise.all(candidates.map(async (file) => await exists(file) ? file : null))).filter(Boolean);
    assert(present.length === 1, `Expected one capture-manifest.json in ${output} or ${screenshots}; use --capture-manifest to disambiguate`);
    [capturePath] = present;
  }
  assert(await exists(contentPath), `Manual content not supplied: ${contentPath}`);
  delete require.cache[require.resolve(contentPath)];
  const content = validateContent(require(contentPath));
  const entries = captureEntries(JSON.parse(await fs.readFile(capturePath, 'utf8')));
  const byKey = new Map(entries.map((entry) => [`${entry.locale}/${entry.id}`, entry]));
  const captures = new Map();
  const pixelOwners = new Map();
  const hashOwners = new Map();
  for (const locale of LOCALES) {
    for (const section of content[locale].sections) {
      for (const shot of section.shots) {
        const key = `${locale}/${shot.id}`;
        const entry = byKey.get(key);
        assert(entry, `Missing exact capture metadata: ${key}; no screenshot fallback is permitted`);
        const route = localizedRoute(shot.route, locale);
        assert(localizedRoute(entry.route, locale) === route && localizedRoute(entry.finalPath, locale, true) === route, `${key}: screenshot route does not match content ${route}`);
        const file = path.join(screenshots, locale, `${shot.id}.png`);
        const bytes = await fs.readFile(file);
        assert(sha256(bytes) === entry.sha256, `${key}: screenshot file hash mismatch`);
        assert(!hashOwners.has(entry.sha256), `${key}: identical screenshot reused from ${hashOwners.get(entry.sha256)}`);
        hashOwners.set(entry.sha256, key);
        const meta = await sharp(bytes).metadata();
        assert(meta.format === 'png' && meta.width === entry.width && meta.height === entry.height, `${key}: PNG/dimension mismatch`);
        const stats = await sharp(bytes).stats();
        assert(stats.isOpaque, `${key}: screenshot must be opaque`);
        assert(stats.channels.slice(0, 3).some((channel) => channel.stdev > 2 && channel.max - channel.min > 16), `${key}: blank/solid screenshot`);
        const pixels = await sharp(bytes).removeAlpha().toColourspace('srgb').raw().toBuffer();
        const pixelSha256 = sha256(pixels);
        assert(!pixelOwners.has(pixelSha256), `${key}: decoded pixels reused from ${pixelOwners.get(pixelSha256)}`);
        pixelOwners.set(pixelSha256, key);
        captures.set(key, { ...entry, path: relative(file), pixelSha256, bytes });
      }
    }
  }
  const fonts = await Promise.all(FONT_FILES.map(async (font) => ({ ...font, ...await fileRecord(path.join(ROOT, font.path)), data: await fs.readFile(path.join(ROOT, font.path)) })));
  return {
    output, content, captures, fonts,
    source: { content: await fileRecord(contentPath), captures: await fileRecord(capturePath), screenshots: relative(screenshots) },
  };
}

function parseArgs(argv) {
  const options = {};
  const names = { '--content': 'content', '--output': 'output', '--screenshots': 'screenshots', '--capture-manifest': 'captureManifest' };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--help') { options.help = true; continue; }
    assert(names[argv[i]] && argv[i + 1] && !argv[i + 1].startsWith('--'), `Unknown/incomplete argument: ${argv[i]}`);
    assert(!options[names[argv[i]]], `Repeated argument: ${argv[i]}`);
    options[names[argv[i]]] = argv[++i];
  }
  return options;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function plainText(value) {
  return value.replace(/<\/?code>/g, '');
}

function formatText(value) {
  return escapeHtml(value).replace(/&lt;code&gt;(.*?)&lt;\/code&gt;/gs, '<code>$1</code>').replace(/\n/g, '<br>');
}

function normalizeText(value) {
  return plainText(value).normalize('NFKC').replace(/[\s\u00ad\u200b\ufeff]+/gu, '');
}

const LABELS = {
  en: { edition: 'ENGLISH EDITION', toc: 'Contents', section: 'Section', illustration: 'Illustration', notes: 'Notes', demo: 'Live demonstration data', page: 'Page' },
  hy: { edition: 'ՀԱՅԵՐԵՆ ՀՐԱՏԱՐԱԿՈՒԹՅՈՒՆ', toc: 'Բովանդակություն', section: 'Բաժին', illustration: 'Պատկեր', notes: 'Նշումներ', demo: 'Ցուցադրական տվյալներ', page: 'Էջ' },
};

function imageOrientation(captures) {
  // Select the orientation that gives BOTH editions the larger uncropped image.
  const score = (width, height) => Math.min(...captures.map((shot) => Math.min(width / shot.width, height / shot.height)));
  return score(269, 145) > score(182, 232) ? 'landscape' : 'portrait';
}

function paginateToc(heights, available) {
  assert(Number.isFinite(available) && available > 0, 'Invalid TOC space');
  const groups = [];
  let group = [];
  let used = 0;
  heights.forEach((height, index) => {
    assert(Number.isFinite(height) && height > 0 && height <= available, `TOC entry ${index + 1} does not fit a page`);
    if (used + height > available && group.length) { groups.push(group); group = []; used = 0; }
    group.push(index);
    used += height;
  });
  if (group.length) groups.push(group);
  return groups;
}

function createPlan(inputs, locale, tocGroups) {
  const manual = inputs.content[locale];
  const pages = [{ type: 'cover', title: manual.title, expectedText: [manual.title, manual.subtitle, manual.notice, LABELS[locale].edition] }];
  tocGroups.forEach((indices) => pages.push({ type: 'toc', title: LABELS[locale].toc, indices, expectedText: [LABELS[locale].toc] }));
  manual.sections.forEach((section, index) => {
    pages.push({
      type: 'text', sectionId: section.id, sectionIndex: index + 1, title: section.title,
      route: localizedRoute(section.route, locale),
      expectedText: [section.title, localizedRoute(section.route, locale), section.lead, ...section.steps.flat(), ...section.notes],
    });
    section.shots.forEach((shot) => pages.push({
      type: 'illustration', sectionId: section.id, sectionIndex: index + 1, title: section.title,
      shotId: shot.id, route: localizedRoute(shot.route, locale),
      orientation: imageOrientation(LOCALES.map((language) => inputs.captures.get(`${language}/${shot.id}`))),
      expectedText: [section.title, localizedRoute(shot.route, locale), shot.focus ?? LABELS[locale].demo],
    }));
  });
  pages.forEach((page, i) => {
    page.number = i + 1;
    page.orientation ??= 'portrait';
    page.widthMm = page.orientation === 'landscape' ? 297 : 210;
    page.heightMm = page.orientation === 'landscape' ? 210 : 297;
    page.footer = `${LABELS[locale].page} ${page.number} / ${pages.length}`;
  });
  const sectionPages = new Map(pages.filter((page) => page.type === 'text').map((page) => [page.sectionId, page.number]));
  for (const page of pages.filter((page) => page.type === 'toc')) {
    page.entries = page.indices.map((index) => ({ id: manual.sections[index].id, title: manual.sections[index].title, page: sectionPages.get(manual.sections[index].id) }));
    page.expectedText.push(...page.entries.flatMap((entry) => [entry.title, String(entry.page)]));
  }
  return pages;
}

function stylesheet(fonts) {
  return `${fonts.map((font) => `@font-face{font-family:"Noto Sans Armenian";src:url(data:font/woff;base64,${font.data.toString('base64')}) format("woff");font-weight:${font.weight};font-style:normal;font-display:block}`).join('\n')}
    @page{size:A4 portrait;margin:0}@page landscape{size:A4 landscape;margin:0}
    *{box-sizing:border-box}html,body{margin:0;padding:0;color:#282328;background:white;font-family:"Noto Sans Armenian",Arial,sans-serif;font-size:10pt;line-height:1.42;font-synthesis:none;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .page{position:relative;width:210mm;height:297mm;break-after:page;background:white}
    .page:last-child{break-after:auto}.page.landscape{page:landscape;width:297mm;height:210mm}
    .page-head{position:absolute;top:10mm;left:14mm;right:14mm;display:flex;justify-content:space-between;gap:6mm;padding-bottom:3mm;border-bottom:1px solid #d8c9cf;font-size:8pt;color:#862e49}
    .page-content{position:absolute;top:29mm;bottom:23mm;left:14mm;right:14mm;padding-top:2mm;display:flow-root}
    footer{position:absolute;bottom:9mm;left:14mm;right:14mm;border-top:1px solid #d8c9cf;padding-top:2mm;display:flex;justify-content:space-between;gap:6mm;font-size:8pt;color:#65565f}
    h1,h2,h3,p{margin:0}h1{font-size:34pt;line-height:1.22;font-weight:700;color:#57273a}h2{font-size:22pt;line-height:1.28;font-weight:700;color:#57273a;margin-bottom:3mm}h3{font-size:10.5pt;font-weight:700;margin-bottom:1mm}
    p,li{overflow-wrap:break-word}.route{font-family:Arial,sans-serif;font-size:9pt;color:#6b4253;overflow-wrap:anywhere;margin-bottom:4mm}.lead{font-size:11pt;line-height:1.44;margin-bottom:5mm;color:#51444b}
    .steps{margin:0;padding-left:6mm}.steps>li{padding-left:2mm;margin-bottom:3.5mm}.steps>li::marker{font-weight:700;color:#862e49}.steps p{margin:0}
    .notes{margin-top:4mm;padding:3mm 4mm;border-left:1mm solid #862e49;background:#f7f2f4}.notes ul{padding-left:5mm;margin:1mm 0 0}.notes li+li{margin-top:2mm}
    code{font-family:inherit;color:#6b2944;overflow-wrap:anywhere}.cover .page-content{padding-top:22mm}.edition{font-size:11pt;font-weight:700;color:#862e49;margin-bottom:8mm}.subtitle{font-size:17pt;line-height:1.5;margin-top:9mm}.notice{font-size:11pt;line-height:1.6;margin-top:18mm;padding:6mm;border-left:1mm solid #862e49;background:#f7f2f4}
    .toc-list{margin-top:5mm}.toc-entry{display:grid;grid-template-columns:1fr 12mm;column-gap:3mm;padding:2.4mm 0;border-bottom:1px solid #e5dce0;font-size:10.5pt;line-height:1.38;color:inherit;text-decoration:none}.toc-entry span:last-child{text-align:right;font-weight:700}
    .illustration .page-content{display:flex;flex-direction:column;top:25mm;bottom:22mm}.illustration h2{font-size:16pt;line-height:1.3;margin-bottom:2mm}.illustration .route{margin-bottom:0}.illustration figure{flex:1;min-height:0;margin:3mm 0;display:flex;align-items:center;justify-content:center}.illustration img{display:block;width:100%;height:100%;object-fit:contain;overflow:visible}.caption{font-size:9pt;line-height:1.4;color:#51444b}
    @media screen{body{background:#ece8ea}.page{margin:12px auto;box-shadow:0 2px 9px #aaa}}`;
}

function documentHtml(locale, title, fonts, body) {
  return `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline'"><title>${escapeHtml(title)}</title><style>${stylesheet(fonts)}</style></head><body>${body}</body></html>`;
}

function tocRows(entries) {
  return entries.map((entry) => `<a class="toc-entry" href="#section-${entry.id}" data-toc-id="${entry.id}" data-target-page="${entry.page}"><span>${escapeHtml(entry.title)}</span><span>${entry.page}</span></a>`).join('');
}

function renderHtml(inputs, locale, plan) {
  const manual = inputs.content[locale];
  const labels = LABELS[locale];
  const pages = plan.map((page) => {
    const section = manual.sections.find((item) => item.id === page.sectionId);
    let content;
    if (page.type === 'cover') {
      content = `<p class="edition">${labels.edition}</p><h1>${escapeHtml(manual.title)}</h1><p class="subtitle">${formatText(manual.subtitle)}</p><aside class="notice">${formatText(manual.notice)}</aside>`;
    } else if (page.type === 'toc') {
      content = `<h2>${labels.toc}</h2><nav class="toc-list">${tocRows(page.entries)}</nav>`;
    } else if (page.type === 'text') {
      content = `<h2>${escapeHtml(section.title)}</h2><p class="route">${escapeHtml(page.route)}</p><p class="lead">${formatText(section.lead)}</p><ol class="steps">${section.steps.map(([heading, body]) => `<li><h3>${formatText(heading)}</h3><p>${formatText(body)}</p></li>`).join('')}</ol>${section.notes.length ? `<aside class="notes"><h3>${labels.notes}</h3><ul>${section.notes.map((note) => `<li>${formatText(note)}</li>`).join('')}</ul></aside>` : ''}`;
    } else {
      const shot = section.shots.find((item) => item.id === page.shotId);
      const capture = inputs.captures.get(`${locale}/${shot.id}`);
      content = `<h2>${escapeHtml(section.title)}</h2><p class="route">${escapeHtml(page.route)}</p><figure><img data-capture-key="${locale}/${shot.id}" src="data:image/png;base64,${capture.bytes.toString('base64')}" alt="${escapeHtml(shot.focus ?? section.title)}" width="${capture.width}" height="${capture.height}"></figure><p class="caption">${formatText(shot.focus ?? labels.demo)}</p>`;
    }
    const kicker = page.sectionIndex ? `${labels.section} ${page.sectionIndex}${page.type === 'illustration' ? ` · ${labels.illustration}` : ''}` : labels.edition;
    return `<section class="page ${page.type} ${page.orientation}" data-page="${page.number}" data-type="${page.type}"${page.type === 'text' ? ` id="section-${section.id}"` : ''}><header class="page-head"><strong>ArtDance · Հայաստան</strong><span>${kicker}</span></header><main class="page-content">${content}</main><footer><span>ArtDance · Հայաստան</span><span class="page-number">${page.footer}</span></footer></section>`;
  });
  return documentHtml(locale, manual.title, inputs.fonts, pages.join(''));
}

async function readyPage(page, html) {
  await page.emulateMedia({ media: 'print', reducedMotion: 'reduce' });
  await page.setContent(html, { waitUntil: 'load', timeout: 120_000 });
  await page.evaluate(async () => {
    await Promise.all([400, 700].map((weight) => document.fonts.load(`${weight} 16px "Noto Sans Armenian"`, 'Հայաստան')));
    await document.fonts.ready;
    if (![400, 700].every((weight) => [...document.fonts].some((font) => font.family.replaceAll('"', '') === 'Noto Sans Armenian' && font.weight === String(weight) && font.status === 'loaded'))) throw new Error('Armenian regular/bold font did not load');
    await Promise.all([...document.images].map(async (image) => {
      await image.decode();
      if (!image.complete || !image.naturalWidth || !image.naturalHeight) throw new Error('Undecoded image');
    }));
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

async function measureToc(browser, inputs) {
  const measurements = [];
  const page = await browser.newPage();
  try {
    for (const locale of LOCALES) {
      const rows = inputs.content[locale].sections.map((section) => ({ ...section, page: 9999 }));
      const html = documentHtml(locale, 'TOC measurement', inputs.fonts, `<section class="page"><main class="page-content"><h2>${LABELS[locale].toc}</h2><nav class="toc-list">${tocRows(rows)}</nav></main></section>`);
      await readyPage(page, html);
      measurements.push(await page.evaluate(() => ({
        available: document.querySelector('.page-content').getBoundingClientRect().bottom - document.querySelector('.toc-list').getBoundingClientRect().top - 3,
        heights: [...document.querySelectorAll('.toc-entry')].map((entry) => entry.getBoundingClientRect().height),
      })));
    }
  } finally { await page.close(); }
  return paginateToc(measurements[0].heights.map((height, i) => Math.max(height, measurements[1].heights[i])), Math.min(...measurements.map((item) => item.available)));
}

async function auditPage(page, plan) {
  const audit = await page.evaluate(() => {
    const failures = [];
    const tolerance = 0.8; // Subpixel layout rounding, in CSS pixels; never a content allowance.
    const inside = (a, b) => a.left >= b.left - tolerance && a.right <= b.right + tolerance && a.top >= b.top - tolerance && a.bottom <= b.bottom + tolerance;
    const box = (rect, origin) => ({ x: rect.left - origin.left, y: rect.top - origin.top, width: rect.width, height: rect.height });
    const pages = [...document.querySelectorAll('.page')].map((sheet) => {
      const number = Number(sheet.dataset.page);
      const fail = (message) => failures.push(`Page ${number}: ${message}`);
      const bounds = sheet.getBoundingClientRect();
      const main = sheet.querySelector('.page-content');
      const content = main.getBoundingClientRect();
      const header = sheet.querySelector('.page-head').getBoundingClientRect();
      const footer = sheet.querySelector('footer').getBoundingClientRect();
      if (!inside(header, bounds) || !inside(footer, bounds) || !inside(content, bounds)) fail('page furniture out of bounds');
      if (header.bottom > content.top - 2 || content.bottom > footer.top - 2) fail('header/footer collision');
      if (main.scrollHeight > main.clientHeight + 1 || main.scrollWidth > main.clientWidth + 1) fail('content overflow');
      for (const element of [sheet, ...sheet.querySelectorAll('*')]) {
        const style = getComputedStyle(element);
        if ([style.overflowX, style.overflowY].some((value) => ['hidden', 'clip', 'scroll', 'auto'].includes(value))) fail(`clipping/scrolling on ${element.tagName}`);
        if (style.clipPath !== 'none' || style.maskImage !== 'none' || style.clip !== 'auto') fail('masked content');
        if (style.display === 'none' || style.visibility !== 'visible' || Number(style.opacity) !== 1) fail('hidden content');
        if (style.textOverflow === 'ellipsis' || style.webkitLineClamp !== 'none') fail('truncated text');
        if (element.tagName === 'IMG' && style.objectFit !== 'contain') fail('image is not contained');
        if (element !== sheet && !inside(element.getBoundingClientRect(), bounds)) fail(`${element.tagName} exceeds page`);
        if (main.contains(element) && element !== main && !inside(element.getBoundingClientRect(), content)) fail(`${element.tagName} exceeds content area`);
      }
      // Text ranges catch a last line escaping an otherwise in-bounds element.
      const walker = document.createTreeWalker(sheet, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        if (!node.textContent.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        const area = main.contains(node) ? content : bounds;
        for (const rect of range.getClientRects()) if (!inside(rect, area)) fail(`text overflow: ${node.textContent.slice(0, 75)}`);
      }
      const images = [...sheet.querySelectorAll('img')].map((image) => {
        const rect = image.getBoundingClientRect();
        const scale = Math.min(rect.width / image.naturalWidth, rect.height / image.naturalHeight);
        const width = image.naturalWidth * scale;
        const height = image.naturalHeight * scale;
        return { key: image.dataset.captureKey, width: image.naturalWidth, height: image.naturalHeight, scale, rect: { x: rect.x - bounds.x + (rect.width - width) / 2, y: rect.y - bounds.y + (rect.height - height) / 2, width, height } };
      });
      if (!main.innerText.trim()) fail('blank page');
      return { number, type: sheet.dataset.type, width: bounds.width, height: bounds.height, content: box(content, bounds), footer: box(footer, bounds), footerText: sheet.querySelector('.page-number').textContent, text: main.innerText, images };
    });
    return { failures: [...new Set(failures)], pages, fontsReady: document.fonts.status === 'loaded', imagesDecoded: [...document.images].every((image) => image.complete && image.naturalWidth > 0) };
  });
  assert(audit.failures.length === 0, `HTML layout validation failed:\n${audit.failures.join('\n')}`);
  assert(audit.pages.length === plan.length, 'HTML page count mismatch');
  audit.pages.forEach((page, index) => {
    const expected = plan[index];
    assert(page.number === expected.number && page.type === expected.type, `HTML page order mismatch at ${index + 1}`);
    assert(Math.abs(page.width - expected.widthMm * 96 / 25.4) < 1 && Math.abs(page.height - expected.heightMm * 96 / 25.4) < 1, `HTML paper size mismatch at ${page.number}`);
    assert(page.footerText === expected.footer, `Incorrect page number on page ${page.number}`);
    for (const fragment of expected.expectedText) assert(normalizeText(page.text).includes(normalizeText(fragment)), `HTML page ${page.number}: missing text ${fragment.slice(0, 90)}`);
    assert(page.images.length === (expected.type === 'illustration' ? 1 : 0), `HTML page ${page.number}: unexpected/missing images`);
    if (page.images.length) assert(page.images[0].key.endsWith(`/${expected.shotId}`), `HTML page ${page.number}: wrong illustration`);
  });
  const imageSources = await page.locator('img').evaluateAll((images) => images.map((image) => ({ key: image.dataset.captureKey, src: image.getAttribute('src') })));
  audit.imageHashes = imageSources.map(({ key, src }) => {
    assert(src?.startsWith('data:image/png;base64,'), `Non-embedded PNG: ${key}`);
    return { key, sha256: sha256(Buffer.from(src.slice('data:image/png;base64,'.length), 'base64')) };
  });
  return audit;
}

async function inspectHtml(browser, html, plan, inputs) {
  const page = await browser.newPage();
  try {
    await readyPage(page, html);
    const audit = await auditPage(page, plan);
    for (const image of audit.imageHashes) assert(inputs.captures.get(image.key)?.sha256 === image.sha256, `${image.key}: HTML screenshot bytes differ from capture`);
    return audit;
  } finally { await page.close(); }
}

async function contactSheet(inputs) {
  const cards = [];
  for (const [key, capture] of inputs.captures) {
    const thumbnail = await sharp(capture.bytes).resize({ width: 620, height: 440, fit: 'inside', withoutEnlargement: true }).png().toBuffer();
    cards.push(`<figure><img src="data:image/png;base64,${thumbnail.toString('base64')}" alt="${escapeHtml(key)}"><figcaption><strong>${escapeHtml(key)}</strong><br>${escapeHtml(capture.finalPath)}<br>${capture.width} × ${capture.height} · rows: ${capture.rowCount} · Armenian: ${capture.armenianCharacters}<br><code>${capture.sha256}</code></figcaption></figure>`);
  }
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>ArtDance capture contact sheet</title><style>body{font:14px Arial,sans-serif;margin:24px;color:#282328}main{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px}figure{margin:0;break-inside:avoid}img{display:block;max-width:100%;height:auto}figcaption{padding:10px 0;line-height:1.6}code{overflow-wrap:anywhere;font-size:11px}</style></head><body><h1>ArtDance · capture contact sheet</h1><p>Live-demo capture metadata; full, uncropped thumbnails. EN and HY must be distinct.</p><main>${cards.join('')}</main></body></html>`;
}

async function build(options = {}) {
  const inputs = await loadInputs(options);
  await fs.mkdir(inputs.output, { recursive: true });
  // A build is never a successful verification. Invalidate any older pass first.
  await fs.writeFile(path.join(inputs.output, REPORT_NAME), JSON.stringify({ schemaVersion: 1, status: 'not-verified', reason: 'Build started; run node verify-manuals.cjs', at: new Date().toISOString() }, null, 2) + '\n', 'utf8');
  const staging = await fs.mkdtemp(path.join(inputs.output, '.build-'));
  const browser = await chromium.launch({ headless: true });
  try {
    const tocGroups = await measureToc(browser, inputs);
    const manifest = {
      schemaVersion: 1, kind: 'artdance-operations-manuals', buildId: randomUUID(), generatedAt: new Date().toISOString(),
      source: inputs.source, chromium: browser.version(), tocGroups,
      tools: await Promise.all(TOOL_FILES.map((file) => fileRecord(path.join(ROOT, file)))),
      fonts: inputs.fonts.map(({ weight, path: file, sha256: hash, bytes }) => ({ weight, path: file, sha256: hash, bytes })),
      captures: [...inputs.captures.values()].map(({ bytes, ...capture }) => ({ ...capture, bytes: bytes.length })),
      locales: {},
    };
    for (const locale of LOCALES) {
      const plan = createPlan(inputs, locale, tocGroups);
      const html = renderHtml(inputs, locale, plan);
      const page = await browser.newPage();
      try {
        await readyPage(page, html);
        const layout = await auditPage(page, plan);
        await fs.writeFile(path.join(staging, HTML_NAME(locale)), html, 'utf8');
        await page.pdf({ path: path.join(staging, PDF_NAME(locale)), preferCSSPageSize: true, printBackground: true, displayHeaderFooter: false, tagged: true, outline: true });
        manifest.locales[locale] = {
          title: inputs.content[locale].title, sectionCount: inputs.content[locale].sections.length, pageCount: plan.length,
          plan, layout,
          pdf: { ...await fileRecord(path.join(staging, PDF_NAME(locale))), path: relative(path.join(inputs.output, PDF_NAME(locale))) },
          html: { ...await fileRecord(path.join(staging, HTML_NAME(locale))), path: relative(path.join(inputs.output, HTML_NAME(locale))) },
        };
      } finally { await page.close(); }
    }
    assert(manifest.locales.en.pageCount === manifest.locales.hy.pageCount, 'EN/HY page parity mismatch');
    const sheet = 'screenshot-contact-sheet.html';
    await fs.writeFile(path.join(staging, sheet), await contactSheet(inputs), 'utf8');
    manifest.contactSheet = { ...await fileRecord(path.join(staging, sheet)), path: relative(path.join(inputs.output, sheet)) };
    // Detect content/capture changes during rendering, before adopting artifacts.
    for (const record of [inputs.source.content, inputs.source.captures, ...manifest.fonts, ...manifest.tools, ...manifest.captures]) {
      assert((await fileRecord(path.resolve(ROOT, record.path))).sha256 === record.sha256, `Input changed during build: ${record.path}`);
    }
    for (const file of [...LOCALES.flatMap((locale) => [PDF_NAME(locale), HTML_NAME(locale)]), sheet]) await fs.rename(path.join(staging, file), path.join(inputs.output, file));
    await fs.writeFile(path.join(inputs.output, MANIFEST_NAME), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
    await fs.rmdir(staging);
    for (const locale of LOCALES) console.log(`${PDF_NAME(locale)}: ${manifest.locales[locale].pageCount} pages; SHA-256 ${manifest.locales[locale].pdf.sha256}`);
    console.log(`Built previews, contact sheet, and ${MANIFEST_NAME}. Publication remains gated on verification.`);
    return manifest;
  } catch (error) {
    error.message += `\nBuild staging (not publishable): ${staging}`;
    throw error;
  } finally { await browser.close(); }
}

module.exports = {
  ROOT, DEFAULT_OUT, LOCALES, MANIFEST_NAME, REPORT_NAME, FONT_FILES, TOOL_FILES, PDF_NAME, HTML_NAME,
  assert, sha256, relative, localizedRoute, neutralRoute, validateContent, captureEntries, fileRecord, loadInputs,
  parseArgs, normalizeText, plainText, imageOrientation, paginateToc, createPlan, renderHtml, readyPage, auditPage, inspectHtml, measureToc, build,
};

if (require.main === module) {
  Promise.resolve().then(() => {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) return console.log('Usage: node scripts/build-operations-manuals.cjs [--content FILE] [--output DIR] [--screenshots DIR] [--capture-manifest FILE]\nDefaults: docs/operations-manual/content.cjs; manual/generated. Every text section occupies one A4 page; every capture has its own uncropped A4 illustration page. Overflow fails the build.');
    return build(options);
  }).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
