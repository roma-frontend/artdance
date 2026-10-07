try {
  const fs = require('fs');
  const p = 'node_modules/@noble/ciphers/package.json';
  let j = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (!j.exports['./utils']) {
    j.exports['./utils'] = './utils.js';
    fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n', 'utf8');
  }
} catch (e) {
  console.log('patch-noble skipped', e.message);
}
try {
  const fs2 = require('fs');
  const p2 = 'node_modules/next/dist/server/lib/trace/tracer.js';
  let c = fs2.readFileSync(p2, 'utf8');
  if (c.includes("require('@opentelemetry/api')") && !c.includes('PATCHED_OTEL')) {
    c = c.replace(
      "if (process.env.NEXT_RUNTIME === 'edge') {\n    api = require('@opentelemetry/api');\n} else {\n    try {\n        api = require('@opentelemetry/api');\n    } catch (err) {\n        api = require('next/dist/compiled/@opentelemetry/api');\n    }\n}",
      "api = require('next/dist/compiled/@opentelemetry/api'); // PATCHED_OTEL"
    );
    fs2.writeFileSync(p2, c, 'utf8');
    console.log('patched next tracer -> compiled otel');
  }
} catch (e) {
  console.log('patch-tracer skipped', e.message);
}
