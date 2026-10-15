/* eslint-disable @typescript-eslint/no-require-imports */
'use strict';

// All browser pages below are in-memory/offline fixtures. No application server,
// real credentials, database, R2, or manual output directories are contacted.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const sharp = require('sharp');
const { chromium } = require('playwright');
const capture = require('./capture.cjs');

let browser;
before(async () => {
  const env = { ...process.env, MANUAL_EMAIL: '', MANUAL_PASSWORD: '' };
  browser = await chromium.launch({ headless: true, env });
});
after(async () => { await browser?.close(); });

const contentFor = (shots) => Object.fromEntries(['en', 'hy'].map((locale) => [locale, { sections: [{ shots }] }]));
const policy = {
  ui: ['Dashboard', 'Search', 'Add', 'Nothing here yet', 'New entry', 'General', 'Save', 'Name', 'Title',
    'Կառավարման վահանակ', 'Աշխատանքային տարածք', 'Նոր գրառում'],
  errors: ['Something went wrong', 'Page not found', 'Access denied', 'Հասանելիություն չկա'],
  empty: ['Nothing here yet'], create: ['Add', 'New', 'Create', 'Ավելացնել'],
};
const tracker = { pending: () => 0, assert: () => {} };

function hasCode(code) {
  return (error) => error instanceof capture.CaptureError && error.code === code;
}

async function fixture(t, body, locale = 'en') {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1200 }, reducedMotion: 'reduce' });
  t.after(() => page.close());
  await page.setContent(`<!doctype html><html lang="${locale}"><head><style>
    body{margin:0;font:18px Arial;background:white} main{margin:140px 40px 0 330px;width:900px;min-height:300px}
    td,th{padding:12px;border:1px solid #ddd} .sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}
    </style></head><body><div class="admin-shell"><header class="admin-shell-header">
    <button type="button" data-slot="theme-toggle" data-theme-choice="system">Theme</button></header>
    <main>${body}</main></div></body></html>`);
  await page.evaluate(() => document.querySelector('[data-slot="theme-toggle"]').addEventListener('click', (event) => {
    const button = event.currentTarget;
    button.dataset.themeChoice = { system: 'light', light: 'dark', dark: 'system' }[button.dataset.themeChoice];
  }));
  return page;
}

const inspect = (page, locale = 'en', selector = 'main') => page.evaluate(capture.inspectDOM, { selector, locale, policy });

test('deduplicates shots per locale, selects IDs in both locales, and rejects conflicting definitions', () => {
  const shots = [{ id: 'dashboard', route: '/admin' }, { id: 'classes-create', route: '/admin/classes', focus: 'main form', prepare: 'create' }];
  const plan = capture.collectShots(contentFor([...shots, shots[0]]), 'classes-create');
  assert.equal(plan.all.length, 4);
  assert.deepEqual(plan.selected.map((shot) => shot.locale), ['en', 'hy']);
  assert.equal(plan.subset, true);
  assert.throws(() => capture.collectShots(contentFor([...shots, { ...shots[0], focus: 'main form' }])), hasCode('SHOT_CONFLICT'));
  assert.throws(() => capture.collectShots(contentFor(shots), 'missing'), hasCode('SHOT_SELECTION'));
  assert.throws(() => capture.collectShots(contentFor(shots), ''), hasCode('SHOT_ID'));
});

test('rejects traversal, localized/external/PII routes, unsafe IDs and arbitrary preparation', () => {
  for (const id of ['../x', 'CON', 'con', 'name.png', 'a/b', 'two words']) {
    assert.throws(() => capture.collectShots(contentFor([{ id, route: '/admin' }])), hasCode('SHOT_ID'));
  }
  for (const route of ['/en/admin', '//other.test/admin', '/admin/../settings', '/admin?q=private', '/admin/users/record-id',
    '/admin?tab=reviews&tab=venues', '/admin?status=private', '/admin#fragment', '/admin/%61']) {
    assert.throws(() => capture.collectShots(contentFor([{ id: 'safe', route }])));
  }
  assert.equal(capture.collectShots(contentFor([{ id: 'safe', route: '/admin/moderation?tab=reviews&status=PENDING&page=1' }])).selected.length, 2);
  assert.equal(capture.collectShots(contentFor([{ id: 'safe', route: '/admin/support/translations' }])).selected.length, 2);
  assert.throws(() => capture.collectShots(contentFor([{ id: 'safe', route: '/admin', prepare: 'submit' }])), hasCode('SHOT_PREPARE'));
});

test('requires environment credentials, keeps errors nonsecret, and validates final locale/route exactly', () => {
  const env = { MANUAL_EMAIL: 'fixture@example.invalid', MANUAL_PASSWORD: 'fixture-only-password' };
  assert.equal(capture.readConfig(env).origin, 'http://localhost:3000');
  assert.throws(() => capture.readConfig({}), hasCode('CREDENTIALS'));
  assert.throws(() => capture.readConfig({ ...env, DEBUG: 'pw:api' }), hasCode('DEBUG_DISABLED'));
  for (const base of ['https://fixture-only-password@manual.test', 'https://manual.test/path', 'file:///test', 'https://manual.test/?token=fixture']) {
    assert.throws(() => capture.readConfig({ ...env, MANUAL_BASE_URL: base }), (error) => {
      assert.ok(!error.message.includes('fixture'));
      return hasCode('BASE_URL')(error);
    });
  }
  assert.equal(capture.verifyUrl('http://manual.test/hy/admin', 'http://manual.test', 'hy', '/admin'), '/hy/admin');
  for (const final of ['/en/admin', '/hy/sign-in', '/hy/admin?unexpected=value', '/hy/admin#x']) {
    assert.throws(() => capture.verifyUrl(`http://manual.test${final}`, 'http://manual.test', 'hy', '/admin'), hasCode('REDIRECT'));
  }
});

test('loads current English/Armenian UI policies without importing app/server code', () => {
  const en = capture.loadPolicy('en');
  const hy = capture.loadPolicy('hy');
  assert.ok(en.ui.includes('Dashboard'));
  assert.ok(en.create.includes('Add'));
  assert.ok(hy.create.includes('Ավելացնել'));
  assert.ok(hy.errors.includes('Էջը չգտնվեց'));
  assert.ok(hy.ui.some((text) => /\p{Script=Armenian}/u.test(text)));
  assert.ok(en.ui.every((text) => !/[{}<>@]/.test(text)));
});

test('counts real desktop rows, recognizes empty status panels, and rejects error/locale pages', async (t) => {
  const page = await fixture(t, '<h1>Dashboard</h1><table><thead><tr><th>Name</th></tr></thead><tbody><tr><td>Fixture one</td></tr><tr><td>Fixture two</td></tr></tbody></table><table hidden><tbody><tr><td>Hidden</td></tr></tbody></table>');
  let state = await inspect(page);
  assert.equal(state.rowCount, 2);
  assert.equal(state.empty, false);
  await page.locator('main').evaluate((el) => { el.innerHTML = '<h1>Dashboard</h1><div role="status"><p>Nothing here yet</p></div>'; });
  state = await inspect(page);
  assert.equal(state.rowCount, 0);
  assert.equal(state.empty, true);
  assert.equal((await inspect(page, 'hy')).problem, 'LOCALE');
  await page.locator('main').evaluate((el) => { el.innerHTML = '<h1>Dashboard</h1><div role="status"><p>Access denied</p></div>'; });
  assert.equal((await inspect(page)).problem, 'ERROR_PAGE');
  await page.locator('main').evaluate((el) => { el.innerHTML = '<h1>Page not found</h1>'; });
  assert.equal((await inspect(page)).problem, 'ERROR_PAGE');
});

test('fails on visible skeletons/busy states, waits for streamed content, and rejects hanging data requests', async (t) => {
  const page = await fixture(t, '<h1>Dashboard</h1><p>Search for a fixture entry</p><div class="skeleton" style="width:200px;height:30px"></div>');
  assert.equal((await inspect(page)).visibleSkeletons, 1);
  await assert.rejects(capture.waitStable(page, 'main', 'en', policy, tracker, 350), hasCode('SKELETONS'));
  await page.locator('.skeleton').evaluate((el) => { el.hidden = true; });
  assert.equal((await inspect(page)).visibleSkeletons, 0);
  await page.locator('main').evaluate((el) => { el.setAttribute('aria-busy', 'true'); });
  assert.equal((await inspect(page)).ready, false);
  await page.locator('main').evaluate((el) => { setTimeout(() => el.removeAttribute('aria-busy'), 150); });
  assert.equal((await capture.waitStable(page, 'main', 'en', policy, tracker, 3000)).ready, true);
  await assert.rejects(capture.waitStable(page, 'main', 'en', policy, { ...tracker, pending: () => 1 }, 350), hasCode('READINESS'));
});

test('only treats a network-idle TimeoutError as provisional, never a generic error', async () => {
  assert.equal(await capture.networkIdle({ waitForLoadState: async () => {} }, 1), false);
  assert.equal(await capture.networkIdle({ waitForLoadState: async () => { const e = new Error(); e.name = 'TimeoutError'; throw e; } }, 1), true);
  await assert.rejects(capture.networkIdle({ waitForLoadState: async () => { throw new Error('closed'); } }, 1));
});

test('proves client interaction and converges to light without form submission', async (t) => {
  const page = await fixture(t, '<h1>Dashboard</h1><p>Search for a fixture entry</p>');
  await capture.proveHydration(page);
  assert.equal(await page.locator('[data-slot="theme-toggle"]').getAttribute('data-theme-choice'), 'light');
  await capture.proveHydration(page);
  assert.equal(await page.locator('[data-slot="theme-toggle"]').getAttribute('data-theme-choice'), 'light');
});

test('rejects broken visible images and fails before a screenshot', async (t) => {
  const page = await fixture(t, '<h1>Dashboard</h1><p>Search for a fixture entry</p><img src="data:image/png;base64,broken" width="100" height="100">');
  assert.equal((await inspect(page)).imagesReady, false);
  await assert.rejects(capture.assetsReady(page, 300), hasCode('ASSETS'));
});

test('redacts dynamic text, record cells and filled inputs; keeps a bounded working-area crop', async (t) => {
  const page = await fixture(t, '<h1>Dashboard</h1><p>Search</p><p id="private">PRIVATE FIXTURE TEXT</p><input value="PRIVATE FIXTURE VALUE"><table><thead><tr><th>Name</th></tr></thead><tbody><tr><td>Dashboard</td></tr></tbody></table><div style="height:5000px"></div>');
  const clip = await capture.cropFor(page, 'main');
  assert.ok(clip.width <= 1200 && clip.height <= clip.width);
  assert.ok(clip.x >= 330);
  await capture.assetsReady(page, 1000);
  await capture.waitStable(page, 'main', 'en', policy, tracker, 3000);
  const plan = await page.evaluate(capture.privacyPlan, { clip, policy, selector: 'main' });
  assert.ok(plan.rectangles.length >= 3);
  const frame = await capture.redactedFrame(page, 'main', { locale: 'en' }, policy, clip, tracker);
  assert.deepEqual(capture.pngSize(frame.bytes), { width: 1100, height: 1100 });
  const bounds = await page.locator('#private').evaluate((el) => {
    const range = document.createRange(); range.selectNodeContents(el);
    const rect = range.getBoundingClientRect(); return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  });
  const x = Math.round((bounds.x - clip.x + bounds.width / 2) * 1100 / clip.width);
  const y = Math.round((bounds.y - clip.y + bounds.height / 2) * 1100 / clip.width);
  const pixel = await sharp(frame.bytes).extract({ left: x, top: y, width: 1, height: 1 }).removeAlpha().raw().toBuffer();
  assert.deepEqual([...pixel], [214, 216, 220]);
  assert.equal(await page.locator('#private').innerText(), 'PRIVATE FIXTURE TEXT', 'redaction must not fabricate/edit the DOM');
  await page.locator('main').evaluate((el) => { el.insertAdjacentHTML('beforeend', '<div data-slot="skeleton" style="width:100px;height:30px"></div>'); });
  await assert.rejects(capture.redactedFrame(page, 'main', { locale: 'en' }, policy, clip, tracker), hasCode('FRAME_READINESS'));
});

test('requires Armenian in actual cropped UI, not just the locale URL or private record text', async (t) => {
  const page = await fixture(t, '<h1>Կառավարման վահանակ</h1><p>Աշխատանքային տարածք</p><p>PRIVATE FIXTURE TEXT</p>', 'hy');
  await capture.assetsReady(page, 1000);
  const clip = await capture.cropFor(page, 'main');
  const frame = await capture.redactedFrame(page, 'main', { locale: 'hy' }, policy, clip, tracker);
  assert.ok(frame.armenianCharacters >= 10);
  const outside = { ...clip, y: 700, height: 100 };
  await assert.rejects(capture.redactedFrame(page, 'main', { locale: 'hy' }, policy, outside, tracker), hasCode('ARMENIAN'));
  await page.locator('h1').evaluate((el) => { el.textContent = 'Dashboard'; });
  assert.equal((await inspect(page, 'hy')).problem, 'LOCALE');
});

test('rejects a transient overlay mutation even when it disappears before the post-screenshot check', async (t) => {
  const page = await fixture(t, '<h1>Dashboard</h1><p>Search for a fixture entry</p>');
  await capture.assetsReady(page, 1000);
  const clip = await capture.cropFor(page, 'main');
  const screenshot = page.screenshot.bind(page);
  page.screenshot = async (options) => {
    const bytes = await screenshot(options);
    await page.evaluate(() => {
      const overlay = document.createElement('div');
      overlay.className = 'skeleton';
      document.body.append(overlay);
      overlay.remove();
    });
    return bytes;
  };
  await assert.rejects(capture.redactedFrame(page, 'main', { locale: 'en' }, policy, clip, tracker), hasCode('FRAME_CHANGED'));
});

test('opens the actual Add link to /new, never submits a create form', async (t) => {
  const context = await browser.newContext();
  t.after(() => context.close());
  const requests = [];
  await context.route('**/*', async (route) => {
    const request = route.request();
    requests.push({ method: request.method(), path: new URL(request.url()).pathname });
    const create = new URL(request.url()).pathname.endsWith('/new');
    await route.fulfill({ contentType: 'text/html', body: `<html lang="en"><body><main>${create
      ? '<h1>New entry</h1><form><section id="admin-form-general"><h2>General</h2><input name="title"></section><button type="submit">Save</button></form>'
      : '<h1>Dashboard</h1><a href="/en/admin/classes/new">Add</a><div role="status"><p>Nothing here yet</p></div>'}</main></body></html>` });
  });
  const page = await context.newPage();
  await page.goto('http://manual.test/en/admin/classes');
  const result = await capture.openCreate(page, 'http://manual.test', { locale: 'en', route: '/admin/classes' }, policy);
  assert.equal(result, '/admin/classes/new');
  assert.equal(await page.locator('input[name="title"]').inputValue(), '');
  assert.deepEqual(requests, [{ method: 'GET', path: '/en/admin/classes' }, { method: 'GET', path: '/en/admin/classes/new' }]);
});

test('keeps a real empty state when its table is absent or no optional create action exists', async (t) => {
  const page = await fixture(t, '<h1>Dashboard</h1><div role="status"><p>Nothing here yet</p></div>');
  const shot = { locale: 'en', route: '/admin/orders', focus: 'main table' };
  assert.equal(await capture.resolveFocus(page, shot, false, true), '.admin-shell main');
  await assert.rejects(capture.resolveFocus(page, shot, false, false), hasCode('SHOT_FOCUS'));
  assert.equal(await capture.openCreate(page, 'http://manual.test', shot, policy, true), null);
  await assert.rejects(capture.openCreate(page, 'http://manual.test', shot, policy), hasCode('CREATE_ACTION'));
  assert.equal(await capture.resolveFocus(page, { ...shot, focus: '[role="dialog"] form' }, false, true), '.admin-shell main');
  assert.equal((await inspect(page)).empty, true);
});

test('supports a create dialog with an aria-hidden underlying main', async (t) => {
  const page = await fixture(t, '<h1>Dashboard</h1><p>Search</p>');
  await page.evaluate(() => {
    document.querySelector('main').setAttribute('aria-hidden', 'true');
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.style.cssText = 'position:fixed;top:150px;left:450px;width:600px;height:350px;background:white';
    dialog.innerHTML = '<h2>New entry</h2><form><h3>General</h3><label>Title<input></label><button type="submit">Save</button></form>';
    document.body.append(dialog);
  });
  const state = await inspect(page, 'en', '[role="dialog"]');
  assert.equal(state.problem, null);
  assert.equal(state.ready, true);
  await page.locator('[role="dialog"]').evaluate((el) => el.insertAdjacentHTML('beforeend', '<p role="alert">Fixture failure</p>'));
  assert.equal((await inspect(page, 'en', '[role="dialog"]')).problem, 'ERROR_PAGE');
});

test('request guard permits only normal sign-in writes and blocks later writes before transport', async (t) => {
  const context = await browser.newContext();
  t.after(() => context.close());
  const transported = [];
  await context.route('**/*', async (route) => {
    transported.push(route.request().method());
    await route.fulfill({ contentType: 'text/html', body: '<html><body>Offline fixture</body></html>' });
  });
  const guard = await capture.installGuard(context, 'http://manual.test', 'en');
  const page = await context.newPage();
  await page.goto('http://manual.test/en/sign-in');
  assert.equal(await page.evaluate(() => fetch('/en/sign-in', { method: 'POST', body: 'fixture' }).then(() => true)), true);
  guard.authenticated();
  assert.equal(await page.evaluate(() => fetch('/en/admin/classes/new', { method: 'POST', body: 'fixture' }).then(() => true).catch(() => false)), false);
  assert.deepEqual(transported, ['GET', 'POST']);
  assert.throws(() => guard.assert(), hasCode('WRITE_BLOCKED'));
});

async function tempOutput(t) {
  // Harness-approved temporary parent; unrelated manual artifacts are never used.
  const parent = path.join(os.tmpdir(), 'omnirush');
  await fs.mkdir(parent, { recursive: true });
  const out = await fs.mkdtemp(path.join(parent, 'manual-capture-test-'));
  t.after(() => fs.rm(out, { recursive: true, force: true }));
  await capture.safeDirectories(out);
  return out;
}

async function resultFor(shot, color = '#eeeeee') {
  const bytes = await sharp({ create: { width: 1100, height: 400, channels: 3, background: color } }).png().toBuffer();
  return { bytes, entry: {
    locale: shot.locale, id: shot.id, route: shot.route, finalPath: `/${shot.locale}${shot.route}`,
    file: `manual/generated/screenshots/${shot.locale}/${shot.id}.png`, sha256: capture.sha256(bytes),
    width: 1100, height: 400, visibleSkeletons: 0, rowCount: 0, armenianCharacters: shot.locale === 'hy' ? 20 : 0,
    source: 'live-demo', capturedAt: '2026-10-14T00:00:00.000Z', empty: true, prepared: null,
    networkIdleTimedOut: false, redactions: 0, privacy: capture.PRIVACY, specHash: capture.specHash(shot),
  } };
}

test('single-writer lock rejects concurrent captures and can be released', async (t) => {
  const out = await tempOutput(t);
  const release = await capture.acquireLock(out);
  await assert.rejects(capture.acquireLock(out), hasCode('LOCKED'));
  await release();
  await (await capture.acquireLock(out))();
});

test('publishes and merges a subset while preserving verified unselected files', async (t) => {
  const out = await tempOutput(t);
  const content = contentFor([{ id: 'dashboard', route: '/admin' }, { id: 'classes', route: '/admin/classes' }]);
  const full = capture.collectShots(content);
  const initial = await Promise.all(full.selected.map((shot) => resultFor(shot)));
  await capture.publish(out, [], initial);
  const subset = capture.collectShots(content, 'dashboard');
  const retained = await capture.retainedEntries(out, subset);
  assert.equal(retained.length, 2);
  const fresh = await Promise.all(subset.selected.map((shot) => resultFor(shot, '#ffffff')));
  await capture.publish(out, retained, fresh);
  const manifest = JSON.parse(await fs.readFile(path.join(out, 'capture-manifest.json'), 'utf8'));
  assert.equal(manifest.captures.length, 4);
  for (const entry of manifest.captures) {
    const bytes = await fs.readFile(path.join(out, 'screenshots', entry.locale, `${entry.id}.png`));
    assert.equal(capture.sha256(bytes), entry.sha256);
    if (entry.id === 'classes') assert.equal(entry.sha256, initial.find((result) => result.entry.locale === entry.locale && result.entry.id === entry.id).entry.sha256);
  }
  await fs.writeFile(path.join(out, 'screenshots/en/classes.png'), fresh[0].bytes);
  await assert.rejects(capture.retainedEntries(out, subset), hasCode('CAPTURE_INTEGRITY'));
});

test('rejects stale specs and restores old files/manifest after a mid-publication failure', async (t) => {
  const out = await tempOutput(t);
  const content = contentFor([{ id: 'dashboard', route: '/admin' }, { id: 'classes', route: '/admin/classes' }]);
  const full = capture.collectShots(content);
  const initial = await Promise.all(full.selected.map((shot) => resultFor(shot)));
  await capture.publish(out, [], initial);
  const previous = await fs.readFile(path.join(out, 'capture-manifest.json'));
  const changed = contentFor([{ id: 'dashboard', route: '/admin' }, { id: 'classes', route: '/admin/classes', focus: 'main table' }]);
  await assert.rejects(capture.retainedEntries(out, capture.collectShots(changed, 'dashboard')), hasCode('STALE_CAPTURE'));
  const fresh = await Promise.all(full.selected.map((shot) => resultFor(shot, '#ffffff')));
  fresh[1].entry.sha256 = 'f'.repeat(64);
  await assert.rejects(capture.publish(out, [], fresh), hasCode('CAPTURE_INTEGRITY'));
  assert.deepEqual(await fs.readFile(path.join(out, 'capture-manifest.json')), previous);
  for (const result of initial) {
    const file = path.join(out, 'screenshots', result.entry.locale, `${result.entry.id}.png`);
    assert.equal(capture.sha256(await fs.readFile(file)), result.entry.sha256);
  }
});

test('rejects manifest path injection and unexpected fields instead of carrying them into a merge', async () => {
  const result = await resultFor({ locale: 'en', id: 'dashboard', route: '/admin' });
  assert.throws(() => capture.validateEntry({ ...result.entry, file: '../../outside.png' }), hasCode('MANIFEST_SCHEMA'));
  assert.throws(() => capture.validateEntry({ ...result.entry, cookie: 'fixture' }), hasCode('MANIFEST_SCHEMA'));
  assert.throws(() => capture.validateEntry({ ...result.entry, finalPath: '/en/sign-in' }), hasCode('MANIFEST_PATH'));
});
