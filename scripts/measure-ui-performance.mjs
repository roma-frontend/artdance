import { chromium } from '@playwright/test';

const baseURL = process.env.PERF_BASE_URL ?? 'http://127.0.0.1:3100';
const browser = await chromium.launch();
try {
  for (const lite of [false, true]) {
    for (let run = 1; run <= 3; run++) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      await context.addInitScript((value) => localStorage.setItem('ARTDANCE_LITE_MODE', String(value)), lite);
      const page = await context.newPage();
      const session = await context.newCDPSession(page);
      await session.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      await session.send('Performance.enable');
      await page.goto(`${baseURL}/en`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);
      const stack = await page.evaluate(() => {
        const items = [...document.querySelectorAll('[data-stack-cards] > li')];
        const cover = (top, height, nextTop) => Math.min(1, Math.max(0, (height - (nextTop - top)) / height));
        const original = items.map((item) => item.style.getPropertyValue('--stack-cover'));
        const measure = (batched) => {
          for (const item of items) item.style.removeProperty('--stack-cover');
          const start = performance.now();
          for (let round = 0; round < 100; round++) {
            const geometry = batched ? items.map((item) => ({ top: item.getBoundingClientRect().top, height: item.offsetHeight })) : null;
            items.forEach((item, index) => {
              const next = items[index + 1];
              const value = (next ? batched
                ? cover(geometry[index].top, geometry[index].height, geometry[index + 1].top)
                : cover(item.getBoundingClientRect().top, item.offsetHeight, next.getBoundingClientRect().top) : 0).toFixed(3);
              if (!batched || item.style.getPropertyValue('--stack-cover') !== value) item.style.setProperty('--stack-cover', value);
            });
          }
          return { ms: +(performance.now() - start).toFixed(1), values: items.map((item) => item.style.getPropertyValue('--stack-cover')) };
        };
        const old = measure(false);
        const optimized = measure(true);
        items.forEach((item, index) => original[index] ? item.style.setProperty('--stack-cover', original[index]) : item.style.removeProperty('--stack-cover'));
        if (JSON.stringify(old.values) !== JSON.stringify(optimized.values)) throw new Error('Stack geometry differs');
        return { cards: items.length, iterations: 100, oldMs: old.ms, optimizedMs: optimized.ms };
      });
      const before = await session.send('Performance.getMetrics');
      const sample = await page.evaluate(async () => {
        let mutations = 0;
        const observer = new MutationObserver((records) => { mutations += records.length; });
        const targets = document.querySelectorAll('[data-aperture] > *, [data-parallax], [data-slot="section-seal"], [data-slot="scroll-seal"], [data-stack-cards] > *');
        for (const target of targets) observer.observe(target, { attributes: true, attributeFilter: ['style'] });
        const intervals = [];
        const start = performance.now();
        let previous = start;
        await new Promise((resolve) => {
          const tick = (time) => {
            intervals.push(time - previous);
            previous = time;
            const progress = Math.min(1, (time - start) / 4000);
            window.scrollTo(0, progress * (document.documentElement.scrollHeight - innerHeight));
            if (progress < 1) requestAnimationFrame(tick);
            else resolve();
          };
          requestAnimationFrame(tick);
        });
        observer.disconnect();
        intervals.sort((a, b) => a - b);
        return { effectStyleMutations: mutations, frames: intervals.length, frameP95Ms: +intervals[Math.floor(intervals.length * 0.95)].toFixed(1) };
      });
      const after = await session.send('Performance.getMetrics');
      const delta = (name) => +((after.metrics.find((m) => m.name === name).value - before.metrics.find((m) => m.name === name).value) * 1000).toFixed(1);
      console.log(JSON.stringify({ mode: lite ? 'lite' : 'full', run, cpuThrottle: 4, ...sample, stack, scriptMs: delta('ScriptDuration'), layoutMs: delta('LayoutDuration'), styleMs: delta('RecalcStyleDuration') }));
      await context.close();
    }
  }
} finally {
  await browser.close();
}
