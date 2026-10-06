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
