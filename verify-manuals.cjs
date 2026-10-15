/* eslint-disable @typescript-eslint/no-require-imports */
'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { createRequire } = require('node:module');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const {
  ROOT, DEFAULT_OUT, LOCALES, MANIFEST_NAME, REPORT_NAME, PDF_NAME, HTML_NAME,
  assert, sha256, relative, fileRecord, loadInputs, parseArgs, normalizeText,
  createPlan, inspectHtml, measureToc,
} = require('./scripts/build-operations-manuals.cjs');

const PYTHON_INSPECT = String.raw`
import sys, json, hashlib, pymupdf as fitz
sys.stdout.reconfigure(encoding='utf-8')
result = []
for filename in json.loads(sys.stdin.read()):
    with open(filename, 'rb') as source: pdf_bytes = source.read()
    doc = fitz.open(stream=pdf_bytes, filetype='pdf')
    if doc.is_encrypted: raise RuntimeError('Encrypted PDF')
    fonts = {}
    pages = []
    for page in doc:
        spans = []
        for block in page.get_text('dict', flags=fitz.TEXTFLAGS_DICT & ~fitz.TEXT_PRESERVE_IMAGES)['blocks']:
            for line in block.get('lines', []):
                for span in line['spans']:
                    spans.append({'text': span['text'], 'bbox': list(span['bbox']), 'font': span['font']})
        missing = []
        for trace in page.get_texttrace():
            for char in trace['chars']:
                if char[1] == 0 and (0x0530 <= char[0] <= 0x058f or 0xfb13 <= char[0] <= 0xfb17):
                    missing.append(chr(char[0]))
        for font in page.get_fonts(full=True):
            xref = font[0]
            if str(xref) not in fonts:
                name, ext, kind, data = doc.extract_font(xref)
                fonts[str(xref)] = {'name': name, 'embedded': bool(data), 'bytes': len(data), 'kind': kind}
        images = []
        for image in page.get_image_info(hashes=True, xrefs=True):
            if not image['xref']: raise RuntimeError('Unsupported inline image; cannot prove capture identity')
            pix = fitz.Pixmap(doc, image['xref'])
            if pix.alpha: pix = fitz.Pixmap(pix, 0)
            if pix.colorspace != fitz.csRGB: pix = fitz.Pixmap(fitz.csRGB, pix)
            images.append({'width': pix.width, 'height': pix.height, 'pixelSha256': hashlib.sha256(pix.samples).hexdigest(), 'bbox': list(image['bbox'])})
        pages.append({'number': page.number + 1, 'width': page.rect.width, 'height': page.rect.height,
            'text': page.get_text('text', sort=False), 'spans': spans, 'missingGlyphs': missing, 'images': images,
            'links': [{'page': link.get('page', -1) + 1} for link in page.get_links() if link['kind'] in (fitz.LINK_GOTO, fitz.LINK_NAMED) and link.get('page', -1) >= 0]})
    language = doc.xref_get_key(doc.pdf_catalog(), 'Lang')
    result.append({'path': filename, 'sha256': hashlib.sha256(pdf_bytes).hexdigest(), 'title': doc.metadata.get('title'), 'language': language[1] if language[0] == 'string' else None,
        'pages': pages, 'fonts': list(fonts.values())})
print(json.dumps(result, ensure_ascii=False))
`;

function pythonRun(candidate, code, input = '') {
  return spawnSync(candidate.command, [...candidate.args, '-X', 'utf8', '-c', code], {
    input, encoding: 'utf8', windowsHide: true, timeout: 180_000, maxBuffer: 128 * 1024 * 1024,
    env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
  });
}

async function probeParser() {
  const attempts = [];
  const candidates = [
    ...(process.env.MANUAL_PDF_PYTHON ? [{ command: process.env.MANUAL_PDF_PYTHON, args: [] }] : []),
    { command: 'python', args: [] }, { command: 'python3', args: [] }, { command: 'py', args: ['-3'] },
    { command: 'py', args: ['-V:Astral/CPython3.11.15'] }, { command: 'py', args: ['-V:Astral/CPython3.14.3'] },
  ];
  for (const candidate of candidates) {
     const result = pythonRun(candidate, 'import pymupdf; print(pymupdf.VersionBind)');
    const available = result.status === 0;
    attempts.push({ name: [candidate.command, ...candidate.args].join(' ') + ' + PyMuPDF', available });
    if (available) return { kind: 'pymupdf', version: result.stdout.trim(), candidate, attempts };
  }
  const modules = [];
  if (process.env.MANUAL_PDFJS_MODULE) modules.push(pathToFileURL(path.resolve(process.env.MANUAL_PDFJS_MODULE)).href);
  for (const name of ['pdfjs-dist/legacy/build/pdf.mjs', 'pdfjs-dist/build/pdf.mjs', 'pdfjs-dist/legacy/build/pdf.js']) {
    try { modules.push(pathToFileURL(require.resolve(name)).href); } catch { /* Not installed. */ }
    try { modules.push(pathToFileURL(createRequire(require.resolve('pdf-parse')).resolve(name)).href); } catch { /* Also check pdf-parse's existing parser. */ }
  }
  for (const url of [...new Set(modules)]) {
    try {
      const imported = await import(url);
      const pdfjs = imported.getDocument ? imported : imported.default;
      assert(typeof pdfjs?.getDocument === 'function', 'Not a PDF.js parser');
      return { kind: 'pdfjs', version: pdfjs.version, pdfjs, attempts: [...attempts, { name: url, available: true }] };
    } catch (error) { attempts.push({ name: url, available: false, reason: error.message }); }
  }
  attempts.push({ name: 'installed pdfjs-dist / pdf-parse PDF.js', available: false });
  return { kind: null, attempts };
}

function multiply(a, b) {
  return [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
}

function imagePixels(image) {
  const pixels = image.width * image.height;
  assert(image.data && pixels > 0, 'PDF.js did not expose decoded image pixels');
  const rgb = Buffer.alloc(pixels * 3);
  if (image.data.length === pixels * 3) return Buffer.from(image.data);
  if (image.data.length === pixels * 4) {
    for (let i = 0; i < pixels; i++) {
      assert(image.data[i * 4 + 3] === 255, 'Unexpected transparent PDF screenshot');
      rgb.set(image.data.subarray(i * 4, i * 4 + 3), i * 3);
    }
    return rgb;
  }
  throw new Error('Unsupported PDF image encoding; cannot prove RGB capture identity');
}

async function pdfObject(objects, name) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`PDF object did not decode: ${name}`)), 30_000);
    objects.get(name, (object) => { clearTimeout(timeout); resolve(object); });
  });
}

async function inspectWithPdfjs(pdfjs, file) {
  const bytes = await fs.readFile(file);
  const task = pdfjs.getDocument({ data: new Uint8Array(bytes), useSystemFonts: false, disableFontFace: true, fontExtraProperties: true, isEvalSupported: false });
  const doc = await task.promise;
  try {
    const metadata = await doc.getMetadata();
    const fonts = new Map();
    const pages = [];
    const OPS = pdfjs.OPS;
    for (let number = 1; number <= doc.numPages; number++) {
      const page = await doc.getPage(number);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const operators = await page.getOperatorList();
      const spans = [];
      for (const item of content.items.filter((item) => typeof item.str === 'string')) {
        const [x, baseline] = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
        const ascent = content.styles[item.fontName]?.ascent ?? 0.9;
        spans.push({ text: item.str, bbox: [x, baseline - item.height * ascent, x + item.width, baseline + item.height * (1 - ascent)], font: item.fontName });
        if (!fonts.has(item.fontName)) {
          const font = await pdfObject(page.commonObjs, item.fontName);
          fonts.set(item.fontName, { name: font.name, embedded: !font.missingFile && Boolean(font.data?.length), bytes: font.data?.length ?? 0 });
        }
      }
      const images = [];
      const missingGlyphs = [];
      let matrix = [1, 0, 0, 1, 0, 0];
      const stack = [];
      for (let i = 0; i < operators.fnArray.length; i++) {
        const op = operators.fnArray[i];
        const args = operators.argsArray[i];
        if (op === OPS.save) stack.push([...matrix]);
        if (op === OPS.restore) { assert(stack.length, 'Unbalanced PDF graphics stack'); matrix = stack.pop(); }
        if (op === OPS.transform) matrix = multiply(matrix, args);
        if ([OPS.paintImageXObjectRepeat, OPS.paintImageMaskXObject, OPS.paintImageMaskXObjectRepeat, OPS.paintInlineImageXObjectGroup].includes(op)) throw new Error('Unexpected repeated/masked PDF image');
        if (op === OPS.paintImageXObject || op === OPS.paintInlineImageXObject) {
          const image = op === OPS.paintInlineImageXObject ? args[0] : await pdfObject(args[0].startsWith('g_') ? page.commonObjs : page.objs, args[0]);
          const points = [[0, 0], [0, 1], [1, 0], [1, 1]].map(([x, y]) => viewport.convertToViewportPoint(matrix[0] * x + matrix[2] * y + matrix[4], matrix[1] * x + matrix[3] * y + matrix[5]));
          images.push({ width: image.width, height: image.height, pixelSha256: sha256(imagePixels(image)), bbox: [Math.min(...points.map((p) => p[0])), Math.min(...points.map((p) => p[1])), Math.max(...points.map((p) => p[0])), Math.max(...points.map((p) => p[1]))] });
        }
        if (op === OPS.showText) {
          for (const glyph of args[0]) if (glyph && /\p{Script=Armenian}/u.test(glyph.unicode ?? '') && glyph.isInFont === false) missingGlyphs.push(glyph.unicode);
        }
      }
      const links = [];
      for (const annotation of await page.getAnnotations()) {
        let destination = annotation.dest;
        if (typeof destination === 'string') destination = await doc.getDestination(destination);
        if (Array.isArray(destination)) links.push({ page: typeof destination[0] === 'number' ? destination[0] + 1 : await doc.getPageIndex(destination[0]) + 1 });
      }
      pages.push({ number, width: viewport.width, height: viewport.height, text: content.items.map((item) => item.str ?? '').join(' '), spans, missingGlyphs, images, links });
      page.cleanup();
    }
    return { path: file, sha256: sha256(bytes), title: metadata.info.Title, language: metadata.info.Language ?? null, pages, fonts: [...fonts.values()] };
  } finally { await doc.destroy(); }
}

async function parsePdfs(parser, files) {
  if (parser.kind === 'pymupdf') {
    const result = pythonRun(parser.candidate, PYTHON_INSPECT, JSON.stringify(files));
    assert(result.status === 0, `PyMuPDF failed: ${result.error?.message ?? result.stderr}`);
    return JSON.parse(result.stdout);
  }
  assert(parser.kind === 'pdfjs', 'No actual PDF parser is available');
  const results = [];
  for (const file of files) results.push(await inspectWithPdfjs(parser.pdfjs, file));
  return results;
}

const REQUIRED_CHECKS = ['inputHashes', 'captureMetadata', 'localeParity', 'htmlLayout', 'pdfText', 'pdfImages', 'pdfFonts', 'pdfPageNumbers', 'pdfGeometry', 'contentsLinks', 'pdfMetadata'];

async function checkRecord(record, file) {
  const actual = await fileRecord(file);
  assert(record && record.path === actual.path && record.sha256 === actual.sha256 && record.bytes === actual.bytes, `Missing/stale artifact hash: ${relative(file)}`);
  return actual;
}

async function currentArtifacts(options = {}) {
  const output = path.resolve(options.output ?? DEFAULT_OUT);
  const manifestPath = path.join(output, MANIFEST_NAME);
  const manifestBytes = await fs.readFile(manifestPath);
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  assert(manifest.schemaVersion === 1 && manifest.kind === 'artdance-operations-manuals' && typeof manifest.buildId === 'string', 'Unsupported manual manifest; rebuild using scripts/build-operations-manuals.cjs');
  const inputs = await loadInputs({
    ...options, output,
    content: options.content ?? path.resolve(ROOT, manifest.source.content.path),
    captureManifest: options.captureManifest ?? path.resolve(ROOT, manifest.source.captures.path),
    screenshots: options.screenshots ?? path.resolve(ROOT, manifest.source.screenshots),
  });
  assert(JSON.stringify(inputs.source) === JSON.stringify(manifest.source), 'Manifest source binding mismatch');
  assert(manifest.fonts.length === inputs.fonts.length && manifest.tools.length === 2, 'Font/tool provenance missing');
  for (const record of [...manifest.fonts, ...manifest.tools]) await checkRecord(record, path.resolve(ROOT, record.path));
  assert(manifest.fonts.every((font, i) => font.path === inputs.fonts[i].path && font.sha256 === inputs.fonts[i].sha256), 'Embedded font source mismatch');
  assert(manifest.tools.map((tool) => tool.path).join('|') === 'scripts/build-operations-manuals.cjs|verify-manuals.cjs', 'Unexpected build/verification tool provenance');
  const captures = [...inputs.captures.values()].map(({ bytes, ...capture }) => ({ ...capture, bytes: bytes.length }));
  assert(JSON.stringify(captures) === JSON.stringify(manifest.captures), 'Capture metadata/pixel fingerprint mismatch');
  assert(Array.isArray(manifest.tocGroups) && manifest.tocGroups.flat().every((index, i) => index === i) && manifest.tocGroups.flat().length === inputs.content.en.sections.length, 'Invalid TOC partition');
  const artifacts = {};
  for (const locale of LOCALES) {
    const entry = manifest.locales[locale];
    const plan = createPlan(inputs, locale, manifest.tocGroups);
    assert(entry && entry.sectionCount === inputs.content[locale].sections.length && entry.pageCount === plan.length && JSON.stringify(entry.plan) === JSON.stringify(plan), `${locale}: stale page/section plan`);
    artifacts[locale] = {
      pdf: await checkRecord(entry.pdf, path.join(output, PDF_NAME(locale))),
      html: await checkRecord(entry.html, path.join(output, HTML_NAME(locale))),
    };
    const pdf = await fs.readFile(path.join(output, PDF_NAME(locale)));
    assert(pdf.subarray(0, 5).toString('ascii') === '%PDF-', `${locale}: invalid PDF signature`);
  }
  assert(manifest.locales.en.pageCount === manifest.locales.hy.pageCount, 'EN/HY pagination parity mismatch');
  await checkRecord(manifest.contactSheet, path.join(output, 'screenshot-contact-sheet.html'));
  return { output, manifest, manifestSha256: sha256(manifestBytes), inputs, artifacts };
}

function verifyPdf(pdf, plan, layout, inputs, locale, usedImages) {
  assert(pdf.pages.length === plan.length, `${locale}: actual PDF page count ${pdf.pages.length}, expected ${plan.length}`);
  assert(normalizeText(pdf.title ?? '') === normalizeText(inputs.content[locale].title), `${locale}: PDF title metadata mismatch`);
  if (pdf.language) assert(pdf.language.toLowerCase().split('-')[0] === locale, `${locale}: PDF language metadata mismatch`);
  assert(pdf.fonts.length > 0 && pdf.fonts.every((font) => font.embedded), `${locale}: PDF has missing/unembedded fonts`);
  const armenianFonts = pdf.fonts.filter((font) => /NotoSansArmenian/i.test(font.name.replace(/[^a-z]/gi, '')));
  assert(armenianFonts.some((font) => /bold/i.test(font.name)) && armenianFonts.some((font) => !/bold/i.test(font.name)), `${locale}: embedded Noto Sans Armenian regular AND bold required`);
  const pages = [];
  for (let i = 0; i < plan.length; i++) {
    const page = pdf.pages[i];
    const expected = plan[i];
    const html = layout.pages[i];
    const label = `${locale} PDF page ${i + 1}`;
    const normalized = normalizeText(page.text);
    assert(normalized.length > 0, `${label}: blank page`);
    assert(!/[\ufffd\u0000]/u.test(page.text) && page.missingGlyphs.length === 0, `${label}: broken/missing glyphs`);
    assert(Math.abs(page.width - expected.widthMm * 72 / 25.4) < 1.5 && Math.abs(page.height - expected.heightMm * 72 / 25.4) < 1.5, `${label}: wrong paper size`);
    const fragments = new Map();
    for (const fragment of [...expected.expectedText, expected.footer]) {
      const value = normalizeText(fragment);
      fragments.set(value, (fragments.get(value) ?? 0) + 1);
    }
    for (const [fragment, count] of fragments) assert(normalized.split(fragment).length - 1 >= count, `${label}: missing actual PDF text (${count} occurrence(s)): ${fragment.slice(0, 100)}`);
    const expectedArmenian = [...normalizeText(expected.expectedText.join(''))].filter((char) => /\p{Script=Armenian}/u.test(char)).length;
    const armenianCharacters = [...normalized].filter((char) => /\p{Script=Armenian}/u.test(char)).length;
    assert(armenianCharacters >= expectedArmenian, `${label}: incomplete Armenian text extraction`);
    const footerTop = html.footer.y * 0.75;
    const contentBottom = (html.content.y + html.content.height) * 0.75;
    const footerSpans = [];
    for (const span of page.spans.filter((span) => span.text.trim())) {
      const [x0, y0, x1, y1] = span.bbox;
      assert([x0, y0, x1, y1].every(Number.isFinite) && x0 >= -1 && y0 >= -1 && x1 <= page.width + 1 && y1 <= page.height + 1, `${label}: PDF text outside page`);
      assert(!(y0 < footerTop - 1 && y1 > contentBottom + 1), `${label}: PDF content/footer collision`);
      if (y0 >= footerTop - 1) footerSpans.push(span.text);
    }
    assert(normalizeText(footerSpans.join(' ')).includes(normalizeText(expected.footer)), `${label}: page number is not in footer`);
    const expectedImage = expected.type === 'illustration' ? inputs.captures.get(`${locale}/${expected.shotId}`) : null;
    assert(page.images.length === (expectedImage ? 1 : 0), `${label}: unexpected/missing/reused PDF image`);
    for (const image of page.images) {
      assert(image.width === expectedImage.width && image.height === expectedImage.height && image.pixelSha256 === expectedImage.pixelSha256, `${label}: PDF image pixels do not match ${expected.shotId}`);
      assert(!usedImages.has(image.pixelSha256), `${label}: PDF image reused from ${usedImages.get(image.pixelSha256)}`);
      usedImages.set(image.pixelSha256, `${locale}/${expected.shotId}`);
      const rect = html.images[0].rect;
      const expectedBox = [rect.x, rect.y, rect.x + rect.width, rect.y + rect.height].map((value) => value * 0.75);
      assert(image.bbox.every((value, index) => Number.isFinite(value) && Math.abs(value - expectedBox[index]) < 1.5), `${label}: PDF image placement/crop mismatch`);
      assert(image.bbox[3] < footerTop - 1, `${label}: PDF image/footer collision`);
    }
    if (expected.type === 'toc') {
      const destinations = new Set(page.links.map((link) => link.page));
      for (const entry of expected.entries) assert(destinations.has(entry.page), `${label}: TOC link for ${entry.id} does not target page ${entry.page}`);
      assert([...destinations].every((number) => expected.entries.some((entry) => entry.page === number)), `${label}: unexpected TOC destination`);
    }
    pages.push({ number: i + 1, type: expected.type, sectionId: expected.sectionId, shotId: expected.shotId, textCharacters: page.text.length, armenianCharacters, textSha256: sha256(Buffer.from(page.text, 'utf8')), images: page.images });
  }
  return { pageCount: pages.length, sectionCount: inputs.content[locale].sections.length, title: pdf.title, language: pdf.language, fonts: pdf.fonts, pages };
}

async function writeReport(output, report) {
  await fs.mkdir(output, { recursive: true });
  const file = path.join(output, REPORT_NAME);
  const temporary = `${file}.${process.pid}.tmp`;
  const bytes = Buffer.from(JSON.stringify(report, null, 2) + '\n', 'utf8');
  await fs.writeFile(temporary, bytes);
  await fs.rename(temporary, file);
  return sha256(bytes);
}

async function verify(options = {}) {
  const output = path.resolve(options.output ?? DEFAULT_OUT);
  const report = { schemaVersion: 1, kind: 'artdance-manual-verification', status: 'failed', startedAt: new Date().toISOString(), checks: Object.fromEntries(REQUIRED_CHECKS.map((check) => [check, false])), errors: [] };
  await writeReport(output, { ...report, status: 'in-progress' });
  let browser;
  try {
    const state = await currentArtifacts(options);
    report.buildId = state.manifest.buildId;
    report.manifestSha256 = state.manifestSha256;
    report.artifacts = state.artifacts;
    report.checks.inputHashes = report.checks.captureMetadata = report.checks.localeParity = true;
    browser = await chromium.launch({ headless: true });
    const tocGroups = await measureToc(browser, state.inputs);
    assert(JSON.stringify(tocGroups) === JSON.stringify(state.manifest.tocGroups), 'TOC layout changed; rebuild with the current browser/fonts');
    const layouts = {};
    for (const locale of LOCALES) {
      const html = await fs.readFile(path.join(output, HTML_NAME(locale)), 'utf8');
      assert(sha256(Buffer.from(html, 'utf8')) === state.artifacts[locale].html.sha256, `${locale}: HTML changed before layout verification`);
      layouts[locale] = await inspectHtml(browser, html, state.manifest.locales[locale].plan, state.inputs);
    }
    report.checks.htmlLayout = true;
    const parser = await probeParser();
    report.parser = { kind: parser.kind, version: parser.version, attempts: parser.attempts };
    assert(parser.kind, 'No installed PDF parser found. Use an existing PyMuPDF interpreter via MANUAL_PDF_PYTHON, or an existing PDF.js module via MANUAL_PDFJS_MODULE. No dependencies were installed; publication is blocked.');
    const parsed = await parsePdfs(parser, LOCALES.map((locale) => path.join(output, PDF_NAME(locale))));
    const usedImages = new Map();
    report.locales = {};
    LOCALES.forEach((locale, index) => {
      assert(parsed[index].sha256 === state.artifacts[locale].pdf.sha256, `${locale}: parsed PDF bytes differ from the artifact hash`);
      report.locales[locale] = verifyPdf(parsed[index], state.manifest.locales[locale].plan, layouts[locale], state.inputs, locale, usedImages);
    });
    // Re-hash after all expensive checks; a concurrently changed artifact cannot pass.
    const after = await currentArtifacts(options);
    assert(after.manifestSha256 === state.manifestSha256 && JSON.stringify(after.artifacts) === JSON.stringify(state.artifacts), 'Artifacts changed during verification');
    report.checks = Object.fromEntries(REQUIRED_CHECKS.map((check) => [check, true]));
    report.status = 'passed';
    report.completedAt = new Date().toISOString();
    const reportHash = await writeReport(output, report);
    for (const locale of LOCALES) console.log(`PASS ${PDF_NAME(locale)}: ${report.locales[locale].pageCount} pages; SHA-256 ${report.artifacts[locale].pdf.sha256}`);
    console.log(`PASS ${REPORT_NAME}: SHA-256 ${reportHash}`);
    return report;
  } catch (error) {
    report.errors.push(error.message);
    report.completedAt = new Date().toISOString();
    await writeReport(output, report);
    throw error;
  } finally { if (browser) await browser.close(); }
}

// Publication uses this read-only gate, and uploads the exact buffered bytes it
// returns. A report alone, old filenames, or a prior successful build are insufficient.
async function verifiedArtifacts(options = {}) {
  const output = path.resolve(options.output ?? DEFAULT_OUT);
  const reportBytes = await fs.readFile(path.join(output, REPORT_NAME));
  const report = JSON.parse(reportBytes.toString('utf8'));
  assert(report.schemaVersion === 1 && report.kind === 'artdance-manual-verification' && report.status === 'passed', 'Publication requires a successful verification report');
  assert(REQUIRED_CHECKS.every((check) => report.checks?.[check] === true) && report.errors?.length === 0 && ['pymupdf', 'pdfjs'].includes(report.parser?.kind), 'Verification proof is incomplete');
  const state = await currentArtifacts(options);
  assert(report.buildId === state.manifest.buildId && report.manifestSha256 === state.manifestSha256 && JSON.stringify(report.artifacts) === JSON.stringify(state.artifacts), 'Successful report does not match current artifacts');
  const files = [];
  for (const locale of LOCALES) {
    assert(report.locales?.[locale]?.pageCount === state.manifest.locales[locale].pageCount, `${locale}: incomplete PDF verification`);
    const bytes = await fs.readFile(path.join(output, PDF_NAME(locale)));
    assert(sha256(bytes) === report.artifacts[locale].pdf.sha256, `${locale}: artifact changed since verification`);
    files.push({ locale, key: `docs/${PDF_NAME(locale)}`, sha256: sha256(bytes), bytes });
  }
  return { ...state, report, reportSha256: sha256(reportBytes), files };
}

module.exports = { REQUIRED_CHECKS, probeParser, parsePdfs, verifyPdf, currentArtifacts, verifiedArtifacts, verify, multiply, imagePixels };

if (require.main === module) {
  Promise.resolve().then(async () => {
    if (process.argv.slice(2).join(' ') === '--probe') {
      const parser = await probeParser();
      console.log(JSON.stringify({ available: Boolean(parser.kind), kind: parser.kind, version: parser.version, attempts: parser.attempts }, null, 2));
      if (!parser.kind) process.exitCode = 1;
      return;
    }
    const options = parseArgs(process.argv.slice(2));
    if (options.help) return console.log('Usage: node verify-manuals.cjs [--output DIR] [--content FILE] [--screenshots DIR] [--capture-manifest FILE]\n       node verify-manuals.cjs --probe\nParses actual PDF pages, Unicode text, embedded fonts, image pixels and geometry; rechecks capture hashes and HTML overflow. Writes verification-report.json (including on failure).');
    await verify(options);
  }).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
