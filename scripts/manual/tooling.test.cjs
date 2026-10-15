/* eslint-disable @typescript-eslint/no-require-imports */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  validateContent, localizedRoute, captureEntries, paginateToc, createPlan, normalizeText, imageOrientation,
} = require('../build-operations-manuals.cjs');
const { verifyPdf, imagePixels } = require('../../verify-manuals.cjs');
const { assertPublishKey, assertPdf, publicUrl, signedRead, redacted } = require('./publish.cjs');

function content(count = 1) {
  return Object.fromEntries(['en', 'hy'].map((locale) => [locale, {
    title: locale === 'hy' ? 'Հայերեն ուղեցույց' : 'English manual', subtitle: 'ArtDance', notice: 'Test content only',
    sections: Array.from({ length: count }, (_, i) => ({
      id: `section-${i + 1}`, title: locale === 'hy' ? `Բաժին ${i + 1}` : `Section ${i + 1}`, route: `/admin/resource-${i + 1}`,
      lead: locale === 'hy' ? 'Ստուգեք տվյալները։' : 'Check the record.', steps: [['Inspect', 'Read the full record before acting.']], notes: [],
      shots: [{ id: `shot-${i + 1}`, route: `/admin/resource-${i + 1}` }],
    })),
  }]));
}

function capture(locale = 'en') {
  return { locale, id: 'shot-1', route: '/admin/resource-1', finalPath: `/${locale}/admin/resource-1`, sha256: 'a'.repeat(64), width: 1200, height: 800, visibleSkeletons: 0, rowCount: 0, armenianCharacters: locale === 'hy' ? 12 : 0, source: 'live-demo' };
}

function inputs(count = 1) {
  return {
    content: content(count),
    captures: new Map(['en', 'hy'].flatMap((locale) => Array.from({ length: count }, (_, i) => [`${locale}/shot-${i + 1}`, { ...capture(locale), id: `shot-${i + 1}`, pixelSha256: `${locale}-pixels-${i + 1}` }]))),
  };
}

test('routes require the exact edition and destination, including queries', () => {
  assert.equal(localizedRoute('/admin/bookings?status=paid&q=42', 'hy'), '/hy/admin/bookings?q=42&status=paid');
  assert.equal(localizedRoute('/en/admin', 'en', true), '/en/admin');
  for (const route of ['/en/admin', '/ru/admin', '//example.com/admin', '/admin/../settings', '/admin#hidden', '/admin\\bookings']) {
    assert.throws(() => localizedRoute(route, 'hy'));
  }
  assert.throws(() => localizedRoute('/admin', 'hy', true), /must include/);
});

test('capture metadata rejects redirects, wrong locale, skeletons, and missing Armenian UI', () => {
  assert.equal(captureEntries({ entries: [capture('en'), capture('hy')] }).length, 2);
  for (const change of [
    { finalPath: '/hy/admin' }, { finalPath: '/en/admin/resource-1' }, { source: 'fixture' },
    { visibleSkeletons: 1 }, { rowCount: -1 }, { width: 0 }, { armenianCharacters: 0 }, { sha256: 'unknown' },
  ]) assert.throws(() => captureEntries([{ ...capture('hy'), ...change }]));
  assert.throws(() => captureEntries([capture(), capture()]), /Duplicate/);
});

test('section and screenshot parity is structural, not a fixed section count', () => {
  assert.equal(validateContent(content(27)).hy.sections.length, 27);
  const missing = content(2);
  missing.hy.sections.pop();
  assert.throws(() => validateContent(missing), /count mismatch/);
  const reused = content(2);
  reused.en.sections[1].shots[0].id = reused.en.sections[0].shots[0].id;
  assert.throws(() => validateContent(reused), /reused/);
  const wrongRoute = content();
  wrongRoute.hy.sections[0].shots[0].route = '/admin';
  assert.throws(() => validateContent(wrongRoute), /screenshot parity/);
});

test('measured TOC pagination produces real destinations across different manual lengths', () => {
  for (const count of [1, 9, 27, 45]) {
    const data = inputs(count);
    const groups = paginateToc(Array(count).fill(70), 800);
    const plan = createPlan(data, 'en', groups);
    assert.equal(plan.length, 1 + groups.length + count * 2);
    for (const page of plan.filter((page) => page.type === 'toc')) {
      for (const entry of page.entries) assert.equal(plan[entry.page - 1].sectionId, entry.id);
    }
    assert.deepEqual(plan.map((page) => page.number), Array.from({ length: plan.length }, (_, i) => i + 1));
    assert.deepEqual(createPlan(data, 'hy', groups).map((page) => page.orientation), plan.map((page) => page.orientation));
  }
  assert.throws(() => paginateToc([900], 800), /does not fit/);
  assert.equal(imageOrientation([{ width: 1600, height: 700 }, { width: 1600, height: 700 }]), 'landscape');
  assert.equal(imageOrientation([{ width: 800, height: 1500 }, { width: 800, height: 1500 }]), 'portrait');
});

test('PDF text normalization tolerates line wrapping and Armenian ligatures without dropping words', () => {
  assert.equal(normalizeText('Read <code>/hy/admin</code>\n first'), 'Read/hy/adminfirst');
  assert.equal(normalizeText('և'), normalizeText('եւ'));
  assert.notEqual(normalizeText('Check the order'), normalizeText('Check the booking'));
});

function parsedFixture() {
  const data = inputs();
  const plan = createPlan(data, 'en', [[0]]);
  const layout = { pages: plan.map((page) => ({ content: { y: 100, height: 600 }, footer: { y: 740 }, images: page.type === 'illustration' ? [{ rect: { x: 20, y: 150, width: 600, height: 400 } }] : [] })) };
  const pdf = {
    title: data.content.en.title, language: 'en', fonts: [{ name: 'NotoSansArmenian-Regular', embedded: true }, { name: 'NotoSansArmenian-Bold', embedded: true }],
    pages: plan.map((page) => ({
      number: page.number, width: page.widthMm * 72 / 25.4, height: page.heightMm * 72 / 25.4,
      text: [...page.expectedText, page.footer].join('\n'), missingGlyphs: [],
      spans: [{ text: page.footer, bbox: [20, 556, 100, 564] }],
      images: page.type === 'illustration' ? [{ width: 1200, height: 800, pixelSha256: 'en-pixels-1', bbox: [15, 112.5, 465, 412.5] }] : [],
      links: page.type === 'toc' ? page.entries.map((entry) => ({ page: entry.page })) : [],
    })),
  };
  return { data, plan, layout, pdf };
}

test('PDF gate rejects absent text, wrong pixels, broken glyphs, wrong links and unembedded fonts', () => {
  const run = (fixture) => verifyPdf(fixture.pdf, fixture.plan, fixture.layout, fixture.data, 'en', new Map());
  assert.equal(run(parsedFixture()).pageCount, 4);
  for (const mutate of [
    (f) => { f.pdf.pages[2].text = f.plan[2].footer; },
    (f) => { f.pdf.pages[3].images[0].pixelSha256 = 'dashboard-fallback'; },
    (f) => { f.pdf.pages[1].links = []; },
    (f) => { f.pdf.pages[2].missingGlyphs = ['ա']; },
    (f) => { f.pdf.fonts[1].embedded = false; },
    (f) => { f.pdf.pages.push(f.pdf.pages[0]); },
    (f) => { f.pdf.pages[2].spans.push({ text: 'colliding content', bbox: [20, 520, 300, 560] }); },
  ]) {
    const fixture = parsedFixture();
    mutate(fixture);
    assert.throws(() => run(fixture));
  }
});

test('RGB image identity cannot silently discard alpha', () => {
  assert.deepEqual(imagePixels({ width: 1, height: 1, data: Uint8Array.from([7, 8, 9, 255]) }), Buffer.from([7, 8, 9]));
  assert.throws(() => imagePixels({ width: 1, height: 1, data: Uint8Array.from([7, 8, 9, 0]) }), /transparent/);
});

test('publication helpers restrict every target and keep credentials out of public URLs/errors', () => {
  const key = 'docs/ArtDance_Operations_Manual_EN.pdf';
  assert.equal(assertPublishKey(key), key);
  for (const other of ['media/photo.png', '../docs/ArtDance_Operations_Manual_EN.pdf', `${key}?copy=1`, 'docs/ArtDance_Operations_Manual_RU.pdf']) {
    assert.throws(() => assertPublishKey(other));
  }
  assert.equal(publicUrl('https://cdn.example.test/assets/', key), `https://cdn.example.test/assets/${key}`);
  assert.throws(() => publicUrl('https://private:secret@cdn.example.test', key));
  assert.throws(() => publicUrl('http://cdn.example.test', key));
  assert.throws(() => assertPdf(Buffer.from('<html>error</html>'), 'application/pdf', 'response'));
  assert.throws(() => assertPdf(Buffer.from('%PDF-1.7'), 'text/html', 'response'));
  const config = { accountId: 'example', bucket: 'manuals', accessKeyId: 'test-access', secretAccessKey: 'test-secret' };
  const request = signedRead(config, key, new Date('2026-10-14T00:00:00Z'));
  assert.equal(request.headers['x-amz-date'], '20261014T000000Z');
  assert.match(request.headers.authorization, /Credential=test-access\/20261014\/auto\/s3\/aws4_request/);
  assert.ok(!request.url.includes(config.accessKeyId) && !request.url.includes(config.secretAccessKey));
  assert.equal(redacted('test-access and test-secret', config), '[redacted] and [redacted]');
});
