/* eslint-disable @typescript-eslint/no-require-imports */
'use strict';

/**
 * Live, read-only operations-manual captures. Run from any working directory:
 *   node scripts/manual/capture.cjs --help
 *   node --test scripts/manual/capture.test.cjs   (offline fixtures only)
 *
 * No .env files, historical captures, API login, stored auth, trace, HAR, video,
 * console forwarding, or error screenshots. Credentials come ONLY from the two
 * MANUAL_* environment variables. The caller must first confirm the demo server.
 * Screenshots stay in memory until dynamic text/media have been redacted.
 */
const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');

const ROOT = path.resolve(__dirname, '../..');
const OUTPUT = path.join(ROOT, 'manual/generated');
const LOCALES = ['en', 'hy'];
const VERSION = 1;
const PRIVACY = 'static-ui-only-v1';
const VIEWPORT = { width: 1600, height: 1200 };
const WIDTH = 1100;
const TIMEOUT = 45_000;
const IDLE_TIMEOUT = 8_000;
const STABLE_MS = 1_200;
const MANIFEST = 'capture-manifest.json';
const ID = /^[a-z0-9][a-z0-9_-]{0,79}$/;
const RESERVED = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/;
const SUPPORT_TOOLS = ['database', 'translations', 'sessions', 'tickets', 'features', 'operations', 'terminal', 'access'];
const ADMIN_RESOURCES = ['classes', 'sessions', 'instructors', 'venues', 'rooms', 'products', 'categories', 'variants', 'events', 'competition-categories', 'courses', 'lessons', 'promo-codes', 'gift-cards', 'media', 'blog-posts', 'banners', 'footer-links', 'users', 'cities', 'districts', 'bookings', 'orders'];

const HELP = `Operations manual capture (run ONLY after the demo server/environment is confirmed)

Required environment:
  MANUAL_EMAIL, MANUAL_PASSWORD     Normal UI sign-in; never written or printed.
Optional environment:
  MANUAL_BASE_URL                   Origin only; default http://localhost:3000
  MANUAL_SHOTS                      Comma-separated shot IDs; selects both locales.
                                   Unknown/empty IDs fail. Omit for a complete run.

Usage:
  node scripts/manual/capture.cjs
  node scripts/manual/capture.cjs --help
  node --test scripts/manual/capture.test.cjs

Input: docs/operations-manual/content.cjs exports { en: manual, hy: manual }.
  manual: { title, subtitle, notice, sections: [
    { id, title, route, lead, steps: [[heading, body]], notes: [string], shots: [
      { id, route, focus?: CSS-selector, prepare?: 'create' }
    ] }
  ] }
Only sections[].shots is consumed. Repeated locale/ID pairs must have identical
route/focus/prepare. IDs: lowercase letters/digits/_/-, at most 80 characters.
Routes: /admin, /admin/resource, /admin/resource/new, or /admin/support/tool
(tool: database, translations, sessions, tickets, features, operations, terminal, access);
no locale, credentials, record IDs, search text, fragments, or encoded paths.
Optional queries: tab=reviews|instructors|venues, page=positive integer,
status=uppercase enum|true|false, sort=lowercase identifier. No duplicate keys.
focus must resolve to one visible CSS element inside main or a form dialog.
Default: .admin-shell main, otherwise main. prepare:'create' clicks the existing
Add/New/Create link/button and never submits. An empty list with a form/dialog
focus attempts the same flow automatically. If no create action exists (without
explicit prepare), or an empty list has no matching focus, capture its main empty
state instead. Other empty lists are recorded empty.

Output:
  manual/generated/screenshots/{locale}/{id}.png
  manual/generated/capture-manifest.json
Manifest: { version: 1, capturedAt: ISO-UTC, captures: [{
  locale, id, route, finalPath, file, sha256, width, height, visibleSkeletons,
  rowCount, armenianCharacters, source: 'live-demo', capturedAt, empty, prepared,
  networkIdleTimedOut, redactions, privacy: '${PRIVACY}', specHash
}] }
finalPath is the final localized URL path/query (including /new when prepared).
file is a repository-relative POSIX screenshot path. rowCount counts rendered
data rows in the captured focus, not the database total. empty describes the
original list (also true when that empty list is replaced by its create form).
armenianCharacters counts unredacted Armenian letters intersecting the crop.
prepared is 'create' or null. redactions is an opaque-region count.

Fixed Chromium viewport 1600x1200, light UI, reduced motion, Asia/Yerevan timezone,
device scale 1. A bounded working-area crop is normalized to 1100px wide and at
most 1100px high. No full-page capture. Exact UI dictionary strings are retained;
record cells, unknown text, filled inputs, and media are covered, without changing
the live DOM or inventing records. Translation dictionaries are read via tsx.

A single-writer .capture.lock protects the whole run. All selected captures must
pass before publication; subsets preserve hash-verified compatible entries.
PNG replacement precedes atomic manifest replacement, with rollback on errors.
After a process/OS crash, inspect the lock/staging files before removing the lock
and rerunning; a mismatched retained PNG is rejected, never silently trusted.
Browser errors are intentionally reported only as nonsecret stage/error codes.
`;

class CaptureError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}
function fail(code, message) { throw new CaptureError(code, message); }
function check(condition, code, message) { if (!condition) fail(code, message); }
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const normalize = (text) => text.replace(/\s+/gu, ' ').trim();
const keyOf = (shot) => `${shot.locale}/${shot.id}`;
const fileOf = (shot) => `manual/generated/screenshots/${shot.locale}/${shot.id}.png`;
const specHash = (shot) => sha256(JSON.stringify([shot.route, shot.focus ?? null, shot.prepare ?? null, PRIVACY]));

function validateId(id) {
  check(typeof id === 'string' && ID.test(id) && !RESERVED.test(id), 'SHOT_ID', 'Use a nonreserved lowercase shot ID.');
}

function validateRoute(route) {
  check(typeof route === 'string' && (/^\/admin(?:\/[a-z][a-z0-9-]*)*(?:\?[^#]+)?$/.test(route)
    || route === '/studio/availability'), 'SHOT_ROUTE', 'Use a locale-free, static application route.');
  const url = new URL(route, 'http://manual.invalid');
  if (url.pathname === '/studio/availability') {
    check(!url.search && !url.hash, 'SHOT_ROUTE', 'Availability capture does not accept query parameters.');
    return route;
  }
  const segments = url.pathname.split('/').slice(2);
  check(segments.length <= 1 || (segments.length === 2 && ((segments[1] === 'new' && ADMIN_RESOURCES.includes(segments[0]))
    || (segments[0] === 'support' && SUPPORT_TOOLS.includes(segments[1]))
    || (ADMIN_RESOURCES.includes(segments[0]) && /^manual-[a-z0-9_-]{1,70}$/.test(segments[1])))),
  'SHOT_ROUTE', `Unsupported static capture route: ${route}`);
  const keys = new Set();
  for (const [key, value] of url.searchParams) {
    const valid = (key === 'tab' && /^(reviews|instructors|venues|products|classes|events|banners)$/.test(value))
      || (key === 'page' && /^[1-9][0-9]{0,5}$/.test(value))
      || (key === 'status' && /^(?:[A-Z][A-Z_]{0,39}|true|false)$/.test(value))
      || (key === 'sort' && /^[a-z][a-z_-]{0,39}$/.test(value));
    check(valid && !keys.has(key), 'SHOT_QUERY', 'Only nonsecret, enumerated list filters are supported.');
    keys.add(key);
  }
  check(!/[%+\\\s]/.test(route), 'SHOT_ROUTE', 'Encoded or noncanonical routes are not supported.');
  return route;
}

function collectShots(content, selection) {
  const shots = new Map();
  for (const locale of LOCALES) {
    check(Array.isArray(content?.[locale]?.sections), 'CONTENT_SCHEMA', 'Both locale manuals must export sections arrays.');
    for (const section of content[locale].sections) {
      check(Array.isArray(section.shots), 'CONTENT_SCHEMA', 'Each section must provide a shots array (possibly empty).');
      for (const item of section.shots) {
        check(item && typeof item === 'object', 'CONTENT_SCHEMA', 'Each shot must be an object.');
        validateId(item.id);
        validateRoute(item.route);
        check(item.focus === undefined || (typeof item.focus === 'string' && item.focus.trim() && item.focus.length <= 500),
          'SHOT_FOCUS', 'focus must be a nonempty CSS selector.');
        check(item.prepare === undefined || item.prepare === 'create', 'SHOT_PREPARE', 'Only prepare:create is supported.');
        const shot = { locale, id: item.id, route: item.route, ...(item.focus ? { focus: item.focus } : {}),
          ...(item.prepare ? { prepare: item.prepare } : {}) };
        const key = keyOf(shot);
        check(!shots.has(key) || specHash(shots.get(key)) === specHash(shot), 'SHOT_CONFLICT', 'Repeated shot IDs must describe the same capture.');
        shots.set(key, shot);
      }
    }
    check([...shots.values()].some((shot) => shot.locale === locale), 'CONTENT_SCHEMA', 'Each locale must have at least one shot.');
  }
  const all = [...shots.values()].sort((a, b) => keyOf(a).localeCompare(keyOf(b), 'en'));
  if (selection === undefined) return { all, selected: all, subset: false };
  const ids = selection.split(',').map((id) => id.trim());
  ids.forEach(validateId);
  check(ids.every((id) => all.some((shot) => shot.id === id)), 'SHOT_SELECTION', 'MANUAL_SHOTS contains an unknown ID.');
  return { all, selected: all.filter((shot) => ids.includes(shot.id)), subset: true };
}

function readConfig(env) {
  check(!env.DEBUG && !env.PWDEBUG && !env.NODE_DEBUG && !env.PW_TEST_TRACE, 'DEBUG_DISABLED', 'Disable debug/protocol tracing before supplying credentials.');
  check(typeof env.MANUAL_EMAIL === 'string' && env.MANUAL_EMAIL.trim()
    && typeof env.MANUAL_PASSWORD === 'string' && env.MANUAL_PASSWORD, 'CREDENTIALS', 'Set MANUAL_EMAIL and MANUAL_PASSWORD in the environment.');
  let base;
  try { base = new URL(env.MANUAL_BASE_URL || 'http://localhost:3000'); }
  catch { fail('BASE_URL', 'MANUAL_BASE_URL must be an HTTP(S) origin.'); }
  check(['http:', 'https:'].includes(base.protocol) && !base.username && !base.password
    && base.pathname === '/' && !base.search && !base.hash, 'BASE_URL', 'MANUAL_BASE_URL must contain only an HTTP(S) origin.');
  return { origin: base.origin, email: env.MANUAL_EMAIL, password: env.MANUAL_PASSWORD };
}

function strings(value) {
  if (typeof value === 'string') return [normalize(value)];
  return value && typeof value === 'object' ? Object.values(value).flatMap(strings) : [];
}

function loadPolicy(locale) {
  // Static, trusted UI copy only. Never import app/server modules or environment files.
  const messages = require('tsx/cjs/api').require(path.join(ROOT, `src/i18n/messages/${locale}.ts`), __filename).default;
  const ui = [...new Set([messages.admin, messages.common, messages.enums, messages.errors, messages.validation, messages.studio]
    .flatMap(strings).filter((text) => text && !/[{}<>@]/.test(text)))];
  return {
    ui,
    errors: [...Object.values(messages.errors).map((item) => normalize(item.title)),
      ...strings(messages.admin.dashboard.noAccess), ...strings(messages.admin.errors.capabilityMissing)],
    empty: strings(messages.admin).filter((text) => /nothing|no .*yet|no .*found|no pending|is empty|դատարկ|չկան|չկա|չեն գտնվել/i.test(text)),
    create: [messages.admin.actions.newRecord, 'Add', 'New', 'Create', 'Ավելացնել', 'Ստեղծել', 'Նոր'],
  };
}

function expectedPath(locale, route) { return `/${locale}${route}`; }
function verifyUrl(raw, origin, locale, route) {
  const url = new URL(raw);
  check(url.origin === origin && url.pathname === new URL(expectedPath(locale, route), origin).pathname
    && url.search === new URL(route, origin).search && !url.hash, 'REDIRECT', 'Unexpected route, sign-in redirect, or locale redirect.');
  return url.pathname + url.search;
}

/** Runs in the browser. Returns only counters/booleans/nonreversible fingerprints. */
function inspectDOM({ selector, locale, policy, clip }) {
  const rendered = (el) => {
    if (!(el instanceof Element) || el.getClientRects().length === 0) return false;
    const style = getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0;
  };
  const visible = (el) => rendered(el) && !el.closest('[hidden], [aria-hidden="true"], .sr-only, #__next-route-announcer__');
  const normalized = (text) => text.replace(/\s+/gu, ' ').trim();
  const roots = [...document.querySelectorAll(selector)].filter(visible);
  if (roots.length !== 1) return { problem: 'FOCUS' };
  const root = roots[0];
  if (!root.closest('main, [role="dialog"]') || root.matches('body, html')) return { problem: 'FOCUS' };
  const main = document.querySelector('.admin-shell main') || document.querySelector('main');
  if (!main) return { problem: 'CONTENT' };
  const surfaces = new Set([main, root]);
  const errorText = [...surfaces].flatMap((surface) => [...surface.querySelectorAll('h1, h2, [role="status"] p, [role="alert"]')])
    .filter(visible).map((el) => normalized(el.innerText));
  const knownError = errorText.some((text) => policy.errors.includes(text)
    || /^(404|500|Application error|Internal Server Error|This page could not be found|Runtime Error|Build Error|Access denied)/i.test(text));
  const errorOverlay = [...document.querySelectorAll('nextjs-portal')].some((el) => el.shadowRoot
    ?.querySelector('[data-nextjs-dialog], [data-nextjs-error-overlay]'));
  if (knownError || errorOverlay || [...surfaces].some((surface) => [...surface.querySelectorAll('[role="alert"]')].some(visible))) return { problem: 'ERROR_PAGE' };
  if (document.querySelector('input[type="password"]') || /\/(sign-in|sign-up|login)(\/|$)/.test(location.pathname)) return { problem: 'SIGN_IN' };
  if (document.documentElement.lang.toLowerCase().split('-')[0] !== locale) return { problem: 'LOCALE' };
  const heading = root.closest('[role="dialog"]')
    ? [...root.querySelectorAll('h1, h2')].find(visible)
    : [...main.querySelectorAll('h1')].find(visible);
  const dynamicRecordHeading = /\/(?:new|manual-[a-z0-9_-]+)$/.test(location.pathname);
  if (!heading || (!policy.ui.includes(normalized(heading.innerText)) && !dynamicRecordHeading)) return { problem: 'HEADING' };
  if (locale === 'hy' && !/\p{Script=Armenian}/u.test(heading.innerText) && !dynamicRecordHeading) return { problem: 'LOCALE' };

  const elements = [root, ...root.querySelectorAll('*')].filter(visible);
  const text = normalized(root.innerText);
  const visibleSkeletons = [...document.querySelectorAll('[data-slot="skeleton"], .skeleton')].filter(rendered).length;
  const busy = [...document.querySelectorAll('[aria-busy="true"]')].filter(rendered).length;
  const rows = [...root.querySelectorAll('tbody tr, [role="row"]')].filter((row) => visible(row)
    && row.querySelector('td, [role="cell"]') && !row.querySelector('td[colspan]'));
  const empty = rows.length === 0 && ([...root.querySelectorAll('[role="status"]')]
    .some((el) => visible(el) && policy.empty.some((copy) => normalized(el.innerText).includes(copy)))
    || [...root.querySelectorAll('table')].some(visible));
  const intersects = (rect) => !clip || (rect.right > clip.x && rect.left < clip.x + clip.width
    && rect.bottom > clip.y && rect.top < clip.y + clip.height);
  const images = [...document.images].filter((img) => visible(img) && intersects(img.getBoundingClientRect())
    && img.getBoundingClientRect().bottom > 0 && img.getBoundingClientRect().top < innerHeight);
  const fontsReady = document.fonts.status === 'loaded' && [...document.fonts].every((font) => font.status !== 'error');
  const imagesReady = images.every((img) => img.complete && img.naturalWidth > 0);
  const rect = root.getBoundingClientRect();
  if (globalThis.__manualWatch?.root !== root) {
    globalThis.__manualWatch?.observer.disconnect();
    const state = { root, changes: 0 };
    state.observer = new MutationObserver(() => { state.changes += 1; });
    // Include overlays/siblings: a skeleton that appears over main and disappears
    // during a screenshot must not evade the before/after readiness checks.
    state.observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true });
    globalThis.__manualWatch = state;
  }
  // The hash never leaves this process via logs or the manifest.
  let fingerprint = 2166136261;
  const signature = text + JSON.stringify(elements.map((el) => {
    const box = el.getBoundingClientRect();
    return [el.tagName, el.value ?? '', el.checked ?? '', ...['x', 'y', 'width', 'height'].map((key) => Math.round(box[key] * 10))];
  }));
  for (let i = 0; i < signature.length; i += 1) fingerprint = Math.imul(fingerprint ^ signature.charCodeAt(i), 16777619);
  return {
    problem: null, ready: document.readyState === 'complete' && fontsReady && imagesReady && !visibleSkeletons && !busy
      && text.length >= 20 && elements.length >= 3 && rect.width >= 250 && rect.height >= 60,
    visibleSkeletons, busy, rowCount: rows.length, empty, fontsReady, imagesReady,
    fingerprint: `${fingerprint >>> 0}/${globalThis.__manualWatch.changes}`,
  };
}

async function defaultFocus(page) {
  const selector = await page.locator('.admin-shell main').count() ? '.admin-shell main' : 'main';
  await page.locator(selector).waitFor({ state: 'visible', timeout: TIMEOUT });
  return selector;
}

async function waitStable(page, selector, locale, policy, tracker, timeout = TIMEOUT) {
  const deadline = Date.now() + timeout;
  let last;
  let since = Date.now();
  let state;
  while (Date.now() < deadline) {
    tracker.assert();
    state = await page.evaluate(inspectDOM, { selector, locale, policy });
    if (['ERROR_PAGE', 'SIGN_IN', 'LOCALE'].includes(state.problem)) fail(state.problem, 'The live page failed content/locale validation.');
    const signature = JSON.stringify(state);
    if (!state.ready || tracker.pending() || signature !== last) since = Date.now();
    if (state.ready && !tracker.pending() && Date.now() - since >= STABLE_MS) return state;
    last = signature;
    await pause(150);
  }
  fail(state?.visibleSkeletons ? 'SKELETONS' : 'READINESS', 'Content, assets, hydration, or DOM stability did not become ready within the deadline.');
}

function trackPage(page, origin) {
  const pending = new Set();
  let failed = false;
  const failures = [];
  const relevant = (request) => ['document', 'script', 'stylesheet', 'font', 'fetch', 'xhr'].includes(request.resourceType())
    && new URL(request.url()).origin === origin;
  page.on('request', (request) => { if (relevant(request)) pending.add(request); });
  page.on('requestfinished', (request) => pending.delete(request));
  page.on('requestfailed', (request) => {
    pending.delete(request);
    const errorText = request.failure()?.errorText ?? '';
    const devInspectorProbe = new URL(request.url()).pathname === '/__nextjs_original-stack-frames'
      && errorText.includes('ERR_BLOCKED_BY_CLIENT');
    if (relevant(request) && !errorText.includes('ERR_ABORTED') && !devInspectorProbe) {
      failed = true;
      failures.push(`requestfailed:${request.resourceType()}:${new URL(request.url()).pathname}:${errorText || 'unknown'}`);
    }
  });
  page.on('response', (response) => {
    const pathname = new URL(response.url()).pathname;
    const devInspector = pathname === '/__nextjs_original-stack-frames';
    if (relevant(response.request()) && response.status() >= 400 && !devInspector) {
      failed = true;
      failures.push(`${response.status()}:${response.request().resourceType()}:${pathname}`);
    }
  });
  page.on('pageerror', (error) => { failed = true; failures.push(`pageerror:${error.name}`); });
  return {
    pending: () => pending.size,
    assert: () => check(!failed, 'PAGE_FAILURE', `The page reported a script, data, or resource failure (${failures.join(',')}).`),
  };
}

async function networkIdle(page, timeout = IDLE_TIMEOUT) {
  try { await page.waitForLoadState('networkidle', { timeout }); return false; }
  catch (error) {
    if (error.name !== 'TimeoutError') throw error;
    // This is provisional: callers MUST still pass hydration, assets, pending
    // same-origin requests, content, and DOM/pixel stability before publishing.
    return true;
  }
}

async function assetsReady(page, timeout = TIMEOUT) {
  const ready = await page.evaluate(async (limit) => {
    let timer;
    try {
      return await Promise.race([
        (async () => {
          await document.fonts.ready;
          const images = [...document.images].filter((img) => {
            const box = img.getBoundingClientRect();
            return box.width && box.height && box.bottom > 0 && box.top < innerHeight && img.checkVisibility();
          });
          await Promise.all(images.map((img) => img.decode()));
          return [...document.fonts].every((font) => font.status !== 'error');
        })().catch(() => false),
        new Promise((resolve) => { timer = setTimeout(() => resolve(false), limit); }),
      ]);
    } finally { clearTimeout(timer); }
  }, timeout);
  check(ready, 'ASSETS', 'Fonts or visible images did not load and decode successfully.');
}

async function proveHydration(page) {
  // This real client component exposes its state only after useIsHydrated().
  // A click plus an observed state change proves handlers work, without writes.
  const toggle = page.locator('[data-slot="theme-toggle"]:visible').first();
  await toggle.waitFor({ state: 'visible', timeout: TIMEOUT });
  for (let i = 0; i < 4; i += 1) {
    const before = await toggle.getAttribute('data-theme-choice');
    if (i > 0 && before === 'light') return;
    check(['system', 'light', 'dark'].includes(before), 'HYDRATION', 'The admin theme control has an unexpected state.');
    const after = { system: 'light', light: 'dark', dark: 'system' }[before];
    await toggle.click();
    await page.waitForFunction((choice) => [...document.querySelectorAll('[data-slot="theme-toggle"]')]
      .some((el) => el.getAttribute('data-theme-choice') === choice), after, { timeout: TIMEOUT });
  }
  fail('HYDRATION', 'Could not establish the hydrated light-theme state.');
}

async function navigate(page, origin, locale, route) {
  const response = await page.goto(origin + expectedPath(locale, route), { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
  check(response && response.status() < 400, 'HTTP_STATUS', 'The requested page did not return a successful response.');
  await page.waitForLoadState('load', { timeout: TIMEOUT });
  verifyUrl(page.url(), origin, locale, route);
}

async function signIn(context, config, locale, policy) {
  const page = await context.newPage();
  const tracker = trackPage(page, config.origin);
  let stage = 'open';
  try {
    stage = 'navigate';
    const response = await page.goto(`${config.origin}/${locale}/sign-in?redirectTo=%2Fadmin`, { waitUntil: 'load', timeout: TIMEOUT });
    check(response && response.status() < 400 && new URL(page.url()).origin === config.origin
      && new URL(page.url()).pathname === `/${locale}/sign-in`, 'SIGN_IN', 'The normal sign-in page is unavailable.');
    stage = 'idle';
    await networkIdle(page);
    stage = 'assets';
    await assetsReady(page);
    // Do not submit until the client action is hydrated. Otherwise Chromium can
    // perform a native form navigation and place credentials in the query string.
    stage = 'hydrate';
    await proveHydration(page);
    stage = 'submit';
    const form = page.locator('form').filter({ has: page.locator('input[name="password"][type="password"]') });
    await form.locator('input[name="email"][type="email"]').fill(config.email);
    await form.locator('input[name="password"]').fill(config.password);
    // Exactly one normal submission; no retries that could lock the account.
    await form.locator('button[type="submit"]').click();
    stage = 'redirect';
    await page.waitForURL((url) => url.origin === config.origin && url.pathname === `/${locale}/admin`, { timeout: TIMEOUT });
    stage = 'dashboard-hydrate';
    await page.waitForLoadState('load', { timeout: TIMEOUT });
    await proveHydration(page);
    stage = 'dashboard-assets';
    await assetsReady(page);
    stage = 'dashboard-stable';
    await waitStable(page, await defaultFocus(page), locale, policy, tracker);
  } catch (error) {
    if (error instanceof CaptureError) throw error;
    fail('SIGN_IN', `Normal UI sign-in failed during ${stage} (${error?.name ?? 'browser error'}).`);
  } finally { await page.close(); }
}

function focusSupportsCreate(focus) {
  return typeof focus === 'string' && /(?:\bform\b|dialog|admin-form-general)/i.test(focus);
}

async function openCreate(page, origin, shot, policy, optional = false) {
  const main = page.locator(await defaultFocus(page));
  const actions = main.locator('a, button').filter({ visible: true });
  const candidates = [];
  for (let i = 0; i < await actions.count(); i += 1) {
    const action = actions.nth(i);
    const label = normalize(await action.innerText());
    if (!policy.create.some((copy) => normalize(copy) === label)) continue;
    const href = await action.getAttribute('href');
    if (href !== null) {
      const url = new URL(href, origin);
      const wanted = `/${shot.locale}${new URL(shot.route, origin).pathname}/new`;
      if (url.origin !== origin || url.pathname !== wanted || url.search || url.hash) continue;
    } else if (await action.getAttribute('type') !== 'button') continue;
    if (await action.isEnabled()) candidates.push(action);
  }
  if (optional && candidates.length === 0) return null;
  check(candidates.length === 1, 'CREATE_ACTION', 'Expected exactly one supported Add/New/Create action.');
  await candidates[0].click();
  await page.waitForFunction(() => !!document.querySelector('[role="dialog"] form, main form #admin-form-general'), null, { timeout: TIMEOUT });
  const url = new URL(page.url());
  const source = new URL(shot.route, origin);
  const onCreatePage = url.pathname === `/${shot.locale}${source.pathname}/new` && !url.search;
  const onDialog = url.pathname === `/${shot.locale}${source.pathname}` && url.search === source.search;
  check(url.origin === origin && (onCreatePage || onDialog) && !url.hash, 'CREATE_REDIRECT', 'Create action navigated to an unexpected destination.');
  return onCreatePage ? `${source.pathname}/new` : shot.route;
}

async function resolveFocus(page, shot, prepared, empty = false) {
  if (empty && !prepared && focusSupportsCreate(shot.focus)) return defaultFocus(page);
  const selector = shot.focus || (prepared && await page.locator('[role="dialog"]:visible').count() ? '[role="dialog"]' : await defaultFocus(page));
  // querySelectorAll enforces CSS syntax, rather than Playwright selector engines.
  const count = await page.evaluate((css) => [...document.querySelectorAll(css)].filter((el) => el.checkVisibility()
    && el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0).length, selector);
  if (count === 0 && empty && !prepared) return defaultFocus(page);
  check(count === 1, 'SHOT_FOCUS', 'focus must select exactly one visible working-area element.');
  return selector;
}

async function cropFor(page, selector) {
  return page.evaluate((css) => {
    const el = [...document.querySelectorAll(css)].find((node) => node.checkVisibility());
    if (!el || !el.closest('main, [role="dialog"]')) return null;
    const before = el.getBoundingClientRect();
    window.scrollTo({ top: Math.max(0, scrollY + before.top - 130), behavior: 'instant' });
    const box = el.getBoundingClientRect();
    const x = Math.ceil(Math.max(0, box.x));
    const y = Math.ceil(Math.max(0, box.y));
    const width = Math.floor(Math.min(box.right, innerWidth) - x);
    const height = Math.floor(Math.min(box.bottom, innerHeight, y + width) - y);
    return width >= 250 && height >= 60 && width >= box.width - 2 ? { x, y, width, height } : null;
  }, selector);
}

/** In-browser, fail-closed text/media redaction plan; no raw DOM text is returned. */
function privacyPlan({ clip, policy, selector }) {
  const allowed = new Set(policy.ui);
  const rectangles = [];
  const armenianText = [];
  const focus = selector ? document.querySelector(selector) : null;
  // A dialog crop is inside its opaque surface. Do not mask the obscured page
  // underneath it on top of the dialog's own labels.
  const scope = focus?.closest('[role="dialog"]') || document.body;
  const add = (box) => {
    // Expand by 2px to cover antialiased glyph edges.
    const x = Math.max(0, Math.floor(box.left - clip.x) - 2);
    const y = Math.max(0, Math.floor(box.top - clip.y) - 2);
    const right = Math.min(clip.width, Math.ceil(box.right - clip.x) + 2);
    const bottom = Math.min(clip.height, Math.ceil(box.bottom - clip.y) + 2);
    if (right > x && bottom > y) rectangles.push({ x, y, width: right - x, height: bottom - y });
  };
  const visible = (el) => el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
    && !el.closest('[hidden], .sr-only, script, style, template');
  const media = 'img, video, canvas, iframe, object, embed, svg:not(.lucide), [data-private], [data-pii]';
  for (const el of [scope, ...scope.querySelectorAll('*')]) {
    if (!visible(el)) continue;
    const style = getComputedStyle(el);
    if (el.matches(media) || el.shadowRoot || /url\(/i.test(style.backgroundImage)
      || (el.matches('input, textarea') && !el.matches('[type="checkbox"], [type="radio"], [type="hidden"]')
        && (el.value || (el.placeholder && !allowed.has(el.placeholder))))
      || (el.matches('select') && !allowed.has(el.selectedOptions[0]?.textContent.trim()))) add(el.getBoundingClientRect());
    for (const pseudo of ['::before', '::after', '::marker']) {
      const generated = getComputedStyle(el, pseudo);
      const content = generated.content;
      if ((content && !['none', 'normal', '""', "''"].includes(content)) || /url\(/i.test(generated.backgroundImage)) add(el.getBoundingClientRect());
    }
  }
  const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const parent = node.parentElement;
    const text = node.textContent.replace(/\s+/gu, ' ').trim();
    if (!text || !parent || !visible(parent) || parent.closest('option, svg, textarea')) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    const boxes = [...range.getClientRects()];
    const inCrop = boxes.some((box) => box.right > clip.x && box.left < clip.x + clip.width
      && box.bottom > clip.y && box.top < clip.y + clip.height);
    if (!inCrop) continue;
    // All record cells are private, even when a name happens to equal UI copy.
    const privateCell = parent.closest('td, [role="cell"], pre, code, [data-private], [data-pii]');
    if (privateCell || !allowed.has(text)) boxes.forEach(add);
    else armenianText.push({ boxes, count: (text.match(/\p{Script=Armenian}/gu) || []).length });
  }
  const armenianCharacters = armenianText.reduce((total, item) => total + (item.boxes.some((box) => {
    const x = (box.left + box.right) / 2 - clip.x;
    const y = (box.top + box.bottom) / 2 - clip.y;
    return x >= 0 && y >= 0 && x < clip.width && y < clip.height
      && !rectangles.some((rect) => x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height);
  }) ? item.count : 0), 0);
  return { rectangles, armenianCharacters };
}

function pngSize(bytes) {
  check(bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    && bytes.toString('ascii', 12, 16) === 'IHDR', 'PNG', 'Expected a PNG image.');
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

async function redactedFrame(page, selector, shot, policy, clip, tracker) {
  tracker.assert();
  const before = await page.evaluate(inspectDOM, { selector, locale: shot.locale, policy, clip });
  check(before.ready && !tracker.pending(), 'FRAME_READINESS', 'The capture became unready before the screenshot.');
  const plan = await page.evaluate(privacyPlan, { clip, policy, selector });
  check(shot.locale !== 'hy' || plan.armenianCharacters >= 10, 'ARMENIAN', 'The crop must contain at least ten visible Armenian UI letters.');
  const raw = await page.screenshot({ type: 'png', fullPage: false, clip, animations: 'disabled', caret: 'initial',
    // Do not inject a temporary stylesheet: the DOM observer must still see
    // real overlays and streamed-data mutations.
    scale: 'css', timeout: TIMEOUT });
  const after = await page.evaluate(inspectDOM, { selector, locale: shot.locale, policy, clip });
  const afterPlan = await page.evaluate(privacyPlan, { clip, policy, selector });
  tracker.assert();
  check(after.ready && !tracker.pending() && before.fingerprint === after.fingerprint
    && JSON.stringify(plan) === JSON.stringify(afterPlan), 'FRAME_CHANGED', `The page changed during capture (${before.fingerprint}->${after.fingerprint}); no screenshot was published.`);
  const sharp = require('sharp');
  const size = pngSize(raw);
  check(size.width === clip.width && size.height === clip.height, 'CROP', 'Unexpected screenshot scale or crop dimensions.');
  const overlay = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size.width}" height="${size.height}">${plan.rectangles
    .map((rect) => `<rect x="${rect.x}" y="${rect.y}" width="${rect.width}" height="${rect.height}" fill="#d6d8dc"/>`).join('')}</svg>`);
  const covered = await sharp(raw).composite([{ input: overlay }]).png().toBuffer();
  const bytes = await sharp(covered).resize({ width: WIDTH }).png({ compressionLevel: 9 }).toBuffer();
  return { bytes, state: after, redactions: plan.rectangles.length, armenianCharacters: plan.armenianCharacters };
}

async function captureShot(context, config, shot, policy, guard) {
  const page = await context.newPage();
  const tracker = trackPage(page, config.origin);
  try {
    await navigate(page, config.origin, shot.locale, shot.route);
    let idleTimedOut = await networkIdle(page);
    await proveHydration(page);
    await assetsReady(page);
    const initial = await waitStable(page, await defaultFocus(page), shot.locale, policy, tracker);
    let finalRoute = shot.route;
    let prepared = false;
    if (shot.prepare === 'create' || (initial.empty && focusSupportsCreate(shot.focus))) {
      const createRoute = await openCreate(page, config.origin, shot, policy, shot.prepare !== 'create');
      if (createRoute !== null) {
        prepared = true;
        finalRoute = createRoute;
        idleTimedOut = await networkIdle(page) || idleTimedOut;
        await proveHydration(page);
      }
    }
    const selector = await resolveFocus(page, shot, prepared, initial.empty);
    const clip = await cropFor(page, selector);
    check(clip, 'CROP', 'The working area cannot be cropped safely within the fixed viewport.');
    await assetsReady(page);
    await waitStable(page, selector, shot.locale, policy, tracker);
    const first = await redactedFrame(page, selector, shot, policy, clip, tracker);
    await pause(350);
    const second = await redactedFrame(page, selector, shot, policy, clip, tracker);
    check(first.state.fingerprint === second.state.fingerprint && sha256(first.bytes) === sha256(second.bytes),
      'PIXEL_STABILITY', 'The working-area content or pixels are still changing.');
    guard.assert();
    const finalPath = verifyUrl(page.url(), config.origin, shot.locale, finalRoute);
    return { bytes: second.bytes, entry: {
      locale: shot.locale, id: shot.id, route: shot.route, finalPath, file: fileOf(shot), sha256: sha256(second.bytes),
      ...pngSize(second.bytes), visibleSkeletons: second.state.visibleSkeletons, rowCount: second.state.rowCount,
      armenianCharacters: second.armenianCharacters, source: 'live-demo', capturedAt: new Date().toISOString(),
      empty: initial.empty, prepared: prepared ? 'create' : null, networkIdleTimedOut: idleTimedOut,
      redactions: second.redactions, privacy: PRIVACY, specHash: specHash(shot),
    } };
  } finally { await page.close(); }
}

async function installGuard(context, origin, locale) {
  let authenticating = true;
  let blocked = false;
  let blockedPath = '';
  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const read = ['GET', 'HEAD', 'OPTIONS'].includes(request.method());
    // A Next Server Action uses an internal same-origin POST; allow it only
    // during the one normal UI sign-in submission, before the session exists.
    const login = authenticating && request.method() === 'POST' && url.origin === origin
      && (url.pathname === `/${locale}/sign-in` || url.pathname.startsWith('/_next/'));
    const devInspector = url.pathname === '/__nextjs_original-stack-frames'
      && request.method() === 'POST';
    // CAPTCHA requests are allowed only during normal UI sign-in.
    const captcha = authenticating && url.origin === 'https://challenges.cloudflare.com';
    if (!read && !login && !captcha && !devInspector) { blocked = true; blockedPath = `${request.method()} ${url.pathname}`; await route.abort('blockedbyclient'); }
    else await route.fallback();
  });
  return {
    authenticated: () => { authenticating = false; },
    assert: () => check(!blocked, 'WRITE_BLOCKED', `An unexpected write request was blocked; capture aborted (${blockedPath}).`),
  };
}

async function safeDirectories(out) {
  // Reject symlinks/junctions before mkdir, including existing parent components.
  for (const directory of [out, path.join(out, 'screenshots/en'), path.join(out, 'screenshots/hy')]) {
    const absolute = path.resolve(directory);
    const parts = absolute.slice(path.parse(absolute).root.length).split(path.sep);
    let current = path.parse(absolute).root;
    for (const part of parts) {
      current = path.join(current, part);
      const stat = await fs.lstat(current).catch((error) => { if (error.code !== 'ENOENT') throw error; return null; });
      check(!stat || (stat.isDirectory() && !stat.isSymbolicLink()), 'OUTPUT_PATH', 'Output directories must be real directories, not links.');
    }
    await fs.mkdir(absolute, { recursive: true });
  }
}

async function acquireLock(out) {
  const directory = path.join(out, '.capture.lock');
  try { await fs.mkdir(directory); }
  catch (error) { if (error.code === 'EEXIST') fail('LOCKED', 'Another capture or an interrupted run owns .capture.lock.'); throw error; }
  return () => fs.rmdir(directory);
}

function validateEntry(entry) {
  const fields = ['locale', 'id', 'route', 'finalPath', 'file', 'sha256', 'width', 'height', 'visibleSkeletons', 'rowCount',
    'armenianCharacters', 'source', 'capturedAt', 'empty', 'prepared', 'networkIdleTimedOut', 'redactions', 'privacy', 'specHash'];
  check(entry && Object.keys(entry).length === fields.length && fields.every((key) => Object.hasOwn(entry, key)), 'MANIFEST_SCHEMA', 'Unrecognized manifest entry schema.');
  validateId(entry.id);
  validateRoute(entry.route);
  check(LOCALES.includes(entry.locale) && entry.file === fileOf(entry) && entry.source === 'live-demo' && entry.privacy === PRIVACY
    && /^[a-f0-9]{64}$/.test(entry.sha256) && /^[a-f0-9]{64}$/.test(entry.specHash)
    && entry.width === WIDTH && Number.isInteger(entry.height) && entry.height >= 1 && entry.height <= WIDTH
    && entry.visibleSkeletons === 0 && ['rowCount', 'armenianCharacters', 'redactions'].every((key) => Number.isInteger(entry[key]) && entry[key] >= 0)
    && (entry.locale !== 'hy' || entry.armenianCharacters >= 10)
    && typeof entry.empty === 'boolean' && typeof entry.networkIdleTimedOut === 'boolean'
    && [null, 'create'].includes(entry.prepared) && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(entry.capturedAt),
  'MANIFEST_SCHEMA', 'Invalid capture evidence in the manifest.');
  const original = expectedPath(entry.locale, entry.route);
  const create = `${new URL(original, 'http://manual.invalid').pathname}/new`;
  check(entry.finalPath === original || (entry.prepared === 'create' && entry.finalPath === create), 'MANIFEST_PATH', 'Invalid final navigation path in the manifest.');
}

async function regularFile(file) {
  const stat = await fs.lstat(file).catch((error) => { if (error.code !== 'ENOENT') throw error; return null; });
  check(!stat || (stat.isFile() && !stat.isSymbolicLink()), 'OUTPUT_PATH', 'Output files must be regular files, not links.');
  return stat;
}

async function retainedEntries(out, plan) {
  const manifestFile = path.join(out, MANIFEST);
  if (!await regularFile(manifestFile)) return [];
  let manifest;
  try { manifest = JSON.parse(await fs.readFile(manifestFile, 'utf8')); }
  catch { fail('MANIFEST_JSON', 'Existing manifest is not valid JSON.'); }
  check(manifest.version === VERSION && Array.isArray(manifest.captures)
    && Object.keys(manifest).sort().join(',') === 'capturedAt,captures,version', 'MANIFEST_SCHEMA', 'Existing manifest is not a compatible capture manifest.');
  const seen = new Set();
  const retained = [];
  for (const entry of manifest.captures) {
    validateEntry(entry);
    check(!seen.has(keyOf(entry)), 'MANIFEST_DUPLICATE', 'Existing manifest contains duplicate locale/ID pairs.');
    seen.add(keyOf(entry));
    if (!plan.subset || plan.selected.some((shot) => keyOf(shot) === keyOf(entry))) continue;
    const shot = plan.all.find((item) => keyOf(item) === keyOf(entry));
    check(shot && specHash(shot) === entry.specHash, 'STALE_CAPTURE', 'An unselected capture changed or was removed; run a complete capture.');
    const file = path.join(out, 'screenshots', entry.locale, `${entry.id}.png`);
    check(await regularFile(file), 'MISSING_CAPTURE', 'A retained screenshot is missing.');
    const bytes = await fs.readFile(file);
    const size = pngSize(bytes);
    check(sha256(bytes) === entry.sha256 && size.width === entry.width && size.height === entry.height,
      'CAPTURE_INTEGRITY', 'A retained screenshot does not match its manifest.');
    retained.push(entry);
  }
  return retained;
}

async function publish(out, retained, results) {
  const entries = [...retained, ...results.map((result) => result.entry)].sort((a, b) => keyOf(a).localeCompare(keyOf(b), 'en'));
  entries.forEach(validateEntry);
  check(new Set(entries.map(keyOf)).size === entries.length, 'MANIFEST_DUPLICATE', 'Publication would create duplicate captures.');
  const stage = await fs.mkdtemp(path.join(out, '.capture-stage-'));
  const changed = [];
  let committed = false;
  let rollbackFailed = false;
  try {
    for (const result of results) {
      const { entry, bytes } = result;
      check(sha256(bytes) === entry.sha256 && JSON.stringify(pngSize(bytes)) === JSON.stringify({ width: entry.width, height: entry.height }),
        'CAPTURE_INTEGRITY', 'Capture bytes do not match the manifest entry.');
      const destination = path.join(out, 'screenshots', entry.locale, `${entry.id}.png`);
      const backup = await regularFile(destination) ? path.join(stage, `${entry.locale}-${entry.id}.backup`) : null;
      if (backup) await fs.copyFile(destination, backup);
      const temporary = path.join(stage, `${entry.locale}-${entry.id}.png`);
      await fs.writeFile(temporary, bytes, { flag: 'wx' });
      await fs.rename(temporary, destination);
      changed.push({ destination, backup });
    }
    const temporaryManifest = path.join(stage, MANIFEST);
    await fs.writeFile(temporaryManifest, `${JSON.stringify({ version: VERSION, capturedAt: new Date().toISOString(), captures: entries }, null, 2)}\n`, { flag: 'wx' });
    await regularFile(path.join(out, MANIFEST));
    await fs.rename(temporaryManifest, path.join(out, MANIFEST));
    committed = true;
  } finally {
    if (!committed) {
      for (const { destination, backup } of changed.reverse()) {
        try { if (backup) await fs.rename(backup, destination); else await fs.unlink(destination); }
        catch { rollbackFailed = true; }
      }
    }
    if (rollbackFailed) fail('ROLLBACK', 'Publication rollback needs recovery; inspect .capture-stage-* before rerunning.');
    await fs.rm(stage, { recursive: true, force: true });
  }
}

async function main() {
  if (process.argv.length === 3 && process.argv[2] === '--help') { console.log(HELP); return; }
  check(process.argv.length === 2, 'ARGUMENTS', 'Only --help is supported; use environment variables for capture settings.');
  const config = readConfig(process.env);
  let content;
  try { content = require(path.join(ROOT, 'docs/operations-manual/content.cjs')); }
  catch { fail('CONTENT_LOAD', 'Could not load docs/operations-manual/content.cjs.'); }
  const plan = collectShots(content, process.env.MANUAL_SHOTS);
  const policies = Object.fromEntries(LOCALES.map((locale) => [locale, loadPolicy(locale)]));
  await safeDirectories(OUTPUT);
  const release = await acquireLock(OUTPUT);
  let browser;
  let keepLock = false;
  try {
    const retained = await retainedEntries(OUTPUT, plan);
    const { chromium } = require('playwright');
    // Do not propagate manual credentials into the browser subprocess environment.
    const browserEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/PASSWORD|SECRET|TOKEN|COOKIE|API_KEY|MANUAL_EMAIL/i.test(key)));
    browser = await chromium.launch({ headless: true, env: browserEnv });
    const results = [];
    for (const locale of LOCALES) {
      const shots = plan.selected.filter((shot) => shot.locale === locale);
      if (!shots.length) continue;
      const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1, locale: locale === 'hy' ? 'hy-AM' : 'en-US',
        timezoneId: 'Asia/Yerevan', colorScheme: 'light', reducedMotion: 'reduce', serviceWorkers: 'block', acceptDownloads: false });
      context.setDefaultTimeout(TIMEOUT);
      try {
        const guard = await installGuard(context, config.origin, locale);
        console.log(`[manual] ${locale}: normal UI sign-in`);
        await signIn(context, config, locale, policies[locale]);
        guard.authenticated();
        guard.assert();
        for (let index = 0; index < shots.length; index += 1) {
          console.log(`[manual] ${locale}: checking capture ${index + 1}/${shots.length}`);
          results.push(await captureShot(context, config, shots[index], policies[locale], guard));
        }
      } finally { await context.close(); }
    }
    await publish(OUTPUT, retained, results);
    console.log(`[manual] Published ${results.length} checked captures; manifest has ${retained.length + results.length} entries.`);
  } catch (error) {
    keepLock = error instanceof CaptureError && error.code === 'ROLLBACK';
    throw error;
  } finally {
    try { if (browser) await browser.close(); }
    finally { if (!keepLock) await release(); }
  }
}

module.exports = { CaptureError, collectShots, readConfig, loadPolicy, verifyUrl, inspectDOM, privacyPlan, waitStable,
  networkIdle, assetsReady, proveHydration, openCreate, resolveFocus, cropFor, redactedFrame, installGuard, pngSize,
  safeDirectories, acquireLock, retainedEntries, publish, validateEntry, specHash, sha256, PRIVACY, WIDTH };

if (require.main === module) {
  main().catch((error) => {
    // Playwright errors can include input values, URLs and DOM text. Never print
    // their message, stack, cause, response bodies, or a browser console event.
    const safe = error instanceof CaptureError ? `${error.code}: ${error.message}` : `CAPTURE_FAILED: ${error?.name ?? 'UnknownError'} (details suppressed).`;
    console.error(`[manual] ${safe}`);
    process.exitCode = 1;
  });
}
