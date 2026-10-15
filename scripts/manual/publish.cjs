/* eslint-disable @typescript-eslint/no-require-imports */
'use strict';

// Intentionally no auto-loading of environment files and no network at import.
// Explicit invocation (not run by the builder/verifier):
// node --conditions=react-server --env-file-if-exists=.env --env-file-if-exists=.env.local --import tsx scripts/manual/publish.cjs --publish
const fs = require('node:fs/promises');
const path = require('node:path');
const { createHmac, randomUUID } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const { ROOT, DEFAULT_OUT, LOCALES, PDF_NAME, assert, sha256, relative } = require('../build-operations-manuals.cjs');
const { verifiedArtifacts } = require('../../verify-manuals.cjs');

const ALLOWED_KEYS = Object.freeze(LOCALES.map((locale) => `docs/${PDF_NAME(locale)}`));

function assertPublishKey(key) {
  assert(ALLOWED_KEYS.includes(key), `Publication target is not an operations manual: ${key}`);
  return key;
}

function assertPdf(bytes, contentType, label) {
  assert(/^application\/pdf(?:\s*;|$)/i.test(contentType ?? ''), `${label}: expected application/pdf`);
  assert(bytes.length > 5 && bytes.subarray(0, 5).toString('ascii') === '%PDF-', `${label}: response is not a PDF`);
}

function publicUrl(base, key) {
  assertPublishKey(key);
  const url = new URL(base);
  assert(url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash, 'R2 public base must be a credential-free HTTPS URL');
  return `${url.href.replace(/\/$/, '')}/${key}`;
}

// storage.ts exports PUT, but no authenticated GET. This read-only SigV4
// implementation follows its s3/auto canonicalization, using private env only.
// All writes below go through the existing putMediaObject implementation.
function signedRead(config, key, now = new Date()) {
  assertPublishKey(key);
  assert(/^[a-zA-Z0-9-]+$/.test(config.accountId) && /^[a-zA-Z0-9._-]+$/.test(config.bucket), 'Invalid R2 account/bucket');
  const host = `${config.accountId}.r2.cloudflarestorage.com`;
  const uri = `/${config.bucket}/${key.split('/').map(encodeURIComponent).join('/')}`;
  const amzDate = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const day = amzDate.slice(0, 8);
  const payloadHash = sha256('');
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
  const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const canonicalRequest = ['GET', uri, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const scope = `${day}/auto/s3/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256(canonicalRequest)].join('\n');
  const hmac = (secret, value) => createHmac('sha256', secret).update(value).digest();
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${config.secretAccessKey}`, day), 'auto'), 's3'), 'aws4_request');
  return {
    url: `https://${host}${uri}`,
    headers: {
      host, 'x-amz-content-sha256': payloadHash, 'x-amz-date': amzDate,
      authorization: `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${hmac(signingKey, stringToSign).toString('hex')}`,
    },
  };
}

async function getPdf(url, headers, label, allowMissing = false) {
  const response = await fetch(url, {
    method: 'GET', headers: { ...headers, 'accept-encoding': 'identity', 'cache-control': 'no-cache', pragma: 'no-cache' },
    redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(60_000),
  });
  if (allowMissing && response.status === 404) { await response.body?.cancel(); return null; }
  assert(response.ok, `${label}: GET returned HTTP ${response.status}`);
  const contentType = response.headers.get('content-type');
  const bytes = Buffer.from(await response.arrayBuffer());
  assertPdf(bytes, contentType, label);
  const length = response.headers.get('content-length');
  assert(length === null || Number(length) === bytes.length, `${label}: truncated response`);
  return { bytes, sha256: sha256(bytes), contentType, etag: response.headers.get('etag') };
}

async function readOrigin(config, key, allowMissing = false) {
  const request = signedRead(config, key);
  return getPdf(request.url, request.headers, `${key} (R2 origin)`, allowMissing);
}

function redacted(message, config) {
  let safe = String(message);
  for (const secret of [config?.accessKeyId, config?.secretAccessKey]) if (secret) safe = safe.split(secret).join('[redacted]');
  return safe;
}

async function ignoredBackupDirectory() {
  const base = path.join(DEFAULT_OUT, 'backups');
  const ignored = spawnSync('git', ['check-ignore', '--quiet', '--', 'manual/generated/backups/probe.pdf'], { cwd: ROOT, encoding: 'utf8', windowsHide: true });
  assert(ignored.status === 0, 'manual/generated/backups must be ignored by git before publication');
  await fs.mkdir(base, { recursive: true });
  const realOutput = await fs.realpath(DEFAULT_OUT);
  const realBackup = await fs.realpath(base);
  assert(path.dirname(realBackup) === realOutput, 'Backup directory must reside inside manual/generated');
  const directory = path.join(base, `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID()}`);
  await fs.mkdir(directory);
  return directory;
}

async function publish() {
  let config;
  let journal;
  let journalPath;
  try {
    const verified = await verifiedArtifacts();
    assert(verified.inputs.source.content.path === 'docs/operations-manual/content.cjs' && verified.inputs.source.screenshots === 'manual/generated/screenshots', 'Only the canonical manuals and live captures can be published');
    // Imported only after verification succeeds, using the installed tsx loader
    // and react-server condition specified in the explicit CLI command above.
    const storage = await import(pathToFileURL(path.join(ROOT, 'src/lib/media/storage.ts')).href);
    const { getServerEnv } = await import(pathToFileURL(path.join(ROOT, 'src/config/env.ts')).href);
    const env = getServerEnv();
    assert(storage.storageDriver() === 'r2', 'Publication requires the R2 driver');
    config = {
      accountId: env.R2_ACCOUNT_ID, bucket: env.resolvedR2Bucket ?? env.R2_BUCKET,
      accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      publicBase: env.resolvedR2PublicBaseUrl ?? env.R2_PUBLIC_BASE_URL,
    };
    assert(Object.values(config).every((value) => typeof value === 'string' && value.length > 0), 'Incomplete private R2 configuration/public base');
    verified.files.forEach((file) => publicUrl(config.publicBase, file.key));
    const directory = await ignoredBackupDirectory();
    journalPath = path.join(directory, 'publication-report.json');
    journal = {
      schemaVersion: 1, status: 'backing-up', startedAt: new Date().toISOString(),
      buildId: verified.manifest.buildId, verificationReportSha256: verified.reportSha256,
      targets: verified.files.map((file) => ({ key: file.key, sha256: file.sha256, bytes: file.bytes.length, state: 'pending' })),
      backups: [],
    };
    const save = () => fs.writeFile(journalPath, JSON.stringify(journal, null, 2) + '\n', 'utf8');
    await save();
    // Back up BOTH origin objects before either object can be replaced. Never
    // trust a possibly stale CDN response as the sole copy of the previous PDF.
    for (const file of verified.files) {
      const previous = await readOrigin(config, file.key, true);
      if (previous) {
        const backupPath = path.join(directory, PDF_NAME(file.locale));
        await fs.writeFile(backupPath, previous.bytes, { flag: 'wx' });
        assert(sha256(await fs.readFile(backupPath)) === previous.sha256, `Backup read-back failed: ${file.key}`);
        journal.backups.push({ key: file.key, path: relative(backupPath), sha256: previous.sha256, bytes: previous.bytes.length, contentType: previous.contentType, etag: previous.etag });
      } else journal.backups.push({ key: file.key, absent: true });
      await save();
    }
    journal.status = 'publishing';
    await save();
    for (const file of verified.files) {
      assertPublishKey(file.key);
      const target = journal.targets.find((entry) => entry.key === file.key);
      const backup = journal.backups.find((entry) => entry.key === file.key);
      const previous = await readOrigin(config, file.key, true);
      assert(backup.absent ? previous === null : previous?.sha256 === backup.sha256 && previous?.etag === backup.etag, `Remote PDF changed after backup: ${file.key}; aborting before PUT`);
      // Re-run the complete hash-bound gate immediately BEFORE EACH PUT.
      const current = await verifiedArtifacts();
      assert(current.reportSha256 === verified.reportSha256 && current.manifestSha256 === verified.manifestSha256, 'Verification changed during publication');
      assert(sha256(file.bytes) === current.files.find((entry) => entry.key === file.key)?.sha256, `PUT bytes are not the verified artifact: ${file.key}`);
      assertPdf(file.bytes, 'application/pdf', file.key);
      target.state = 'put-started';
      await save();
      const stored = await storage.putMediaObject(file.key, file.bytes, 'application/pdf');
      assert(stored.key === file.key && stored.bytes === file.bytes.length, `Unexpected storage result: ${file.key}`);
      target.state = 'put-complete';
      await save();
      const origin = await readOrigin(config, file.key);
      assert(origin.sha256 === file.sha256 && origin.bytes.length === file.bytes.length, `Origin read-back differs from verified PDF: ${file.key}`);
      const url = publicUrl(config.publicBase, file.key);
      // Verify the actual stable public URL, not a cache-busting substitute.
      // storage.ts uses immutable caching; a stale CDN must fail this check.
      let publicCopy;
      for (let attempt = 0; attempt < 4; attempt++) {
        publicCopy = await getPdf(url, {}, `${file.key} (public)`);
        if (publicCopy.sha256 === file.sha256) break;
        if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
      }
      assert(publicCopy.sha256 === file.sha256 && publicCopy.bytes.length === file.bytes.length, `Public URL still serves different bytes: ${file.key}. Backup and partial-publication details: ${relative(directory)}`);
      target.state = 'verified';
      target.originSha256 = origin.sha256;
      target.publicSha256 = publicCopy.sha256;
      target.contentType = publicCopy.contentType;
      target.url = url;
      await save();
      console.log(`Published and fetched ${file.key}; SHA-256 ${file.sha256}`);
    }
    journal.status = 'passed';
    journal.completedAt = new Date().toISOString();
    await save();
    console.log(`Backups and publication report: ${relative(directory)}`);
    return journal;
  } catch (error) {
    const message = redacted(error.message, config);
    if (journal && journalPath) {
      journal.status = 'failed';
      journal.error = message;
      journal.completedAt = new Date().toISOString();
      await fs.writeFile(journalPath, JSON.stringify(journal, null, 2) + '\n', 'utf8');
    }
    throw new Error(message);
  }
}

module.exports = { ALLOWED_KEYS, assertPublishKey, assertPdf, publicUrl, signedRead, redacted };

if (require.main === module) {
  Promise.resolve().then(() => {
    const args = process.argv.slice(2);
    assert(args.length === 1 && args[0] === '--publish', 'Explicit --publish is required. Run the builder and verifier first. See the invocation comment in scripts/manual/publish.cjs.');
    return publish();
  }).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
