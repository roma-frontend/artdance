// Конвертер HTML → PDF через headless Chromium (Playwright).
// Использование: node scripts/html-to-pdf.mjs <input.html> <output.pdf>
import { chromium } from 'playwright';
import { resolve } from 'node:path';

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error('Использование: node scripts/html-to-pdf.mjs <input.html> <output.pdf>');
  process.exit(1);
}

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('file:///' + resolve(input).replace(/\\/g, '/'));
await page.waitForLoadState('networkidle');
await page.pdf({
  path: output,
  format: 'A4',
  margin: { top: '16mm', bottom: '16mm', left: '14mm', right: '14mm' },
  printBackground: true,
});
await browser.close();
console.log('PDF:', output);
