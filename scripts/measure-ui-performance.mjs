/** Production scroll smoke: real content, hydrated effects, full/lite, CPU ×4.
 * PERF_BASE_URL, PERF_BROWSER_CHANNEL, PERF_DEVICE=mobile, PERF_RUNS, PERF_CPU customize
 * the run without machine-specific paths. Measurements are lab diagnostics,
 * not a guarantee of device FPS or a substitute for field Web Vitals.
 */
import { chromium, devices } from '@playwright/test';

const baseURL = process.env.PERF_BASE_URL ?? 'http://127.0.0.1:3100';
const runs = Number(process.env.PERF_RUNS ?? 3);
const cpuThrottle = Number(process.env.PERF_CPU ?? 4);
const mobile = process.env.PERF_DEVICE === 'mobile';
const browser = await chromium.launch({ channel: process.env.PERF_BROWSER_CHANNEL });

try {
  for (const lite of [false, true]) {
    for (let run = 1; run <= runs; run++) {
      const context = await browser.newContext(mobile
        ? devices['Pixel 7']
        : { viewport: { width: 1440, height: 900 } });
      try {
        await context.addInitScript((value) => {
          localStorage.setItem('ARTDANCE_LITE_MODE', String(value));
          // Exercise the real Lenis path, which otherwise disables itself in E2E.
          Object.defineProperty(navigator, 'webdriver', { get: () => false });
        }, lite);
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', (error) => errors.push(error.message));
        page.on('response', (response) => {
          if (response.status() >= 400 && /\.(js|css)(\?|$)/.test(response.url())) {
            errors.push(`Application asset HTTP ${response.status()}`);
          }
        });
        const response = await page.goto(`${baseURL}/en`, { waitUntil: 'load' });
        if (!response?.ok()) throw new Error('Homepage did not load successfully');
        await page.locator('h1').waitFor({ state: 'visible' });
        if (!lite) await page.waitForFunction(() => document.querySelector('[data-scroll-driver]'));
        await page.evaluate(() => document.fonts.ready);
        if (await page.locator('[data-reveal-mask]').count() === 0) {
          throw new Error('Outdated preview: homepage motion markup is missing');
        }

        // Warm deferred sections/media once; measure scroll, not cold network IO.
        await page.evaluate(async () => {
          const height = document.documentElement.scrollHeight;
          if (height < innerHeight * 3) throw new Error('Page is empty or not scrollable');
          for (let y = 0; y < height; y += innerHeight) {
            window.scrollTo({ top: y, behavior: 'instant' });
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
          window.scrollTo({ top: 0, behavior: 'instant' });
        });
        await page.waitForTimeout(1000);
        const session = await context.newCDPSession(page);
        await session.send('Emulation.setCPUThrottlingRate', { rate: cpuThrottle });
        await session.send('Performance.enable');
        const before = await session.send('Performance.getMetrics');
        const sample = await page.evaluate(async () => {
          let mutations = 0;
          const observer = new MutationObserver((records) => { mutations += records.length; });
          const targets = document.querySelectorAll('[data-aperture] > *, [data-parallax], [data-slot="section-seal"], [data-slot="scroll-seal"], [data-stack-cards] > *, [data-journey-progress]');
          for (const target of targets) observer.observe(target, { attributes: true, attributeFilter: ['style'] });
          const longTasks = [];
          const tasks = new PerformanceObserver((list) => longTasks.push(...list.getEntries().map((entry) => entry.duration)));
          tasks.observe({ type: 'longtask' });
          const intervals = [];
          const start = performance.now();
          let previous;
          await new Promise((resolve) => {
            const tick = (time) => {
              if (previous !== undefined) intervals.push(time - previous);
              previous = time;
              const progress = Math.min(1, (time - start) / 6000);
              window.scrollTo({ top: progress * (document.documentElement.scrollHeight - innerHeight), behavior: 'instant' });
              if (progress < 1) requestAnimationFrame(tick);
              else resolve();
            };
            requestAnimationFrame(tick);
          });
          await new Promise(requestAnimationFrame);
          observer.disconnect();
          longTasks.push(...tasks.takeRecords().map((entry) => entry.duration));
          tasks.disconnect();
          intervals.sort((a, b) => a - b);
          const progressBar = document.querySelector('[data-slot="scroll-progress"]');
          return {
            effectStyleMutations: mutations,
            frames: intervals.length,
            frameP95Ms: +intervals[Math.floor(intervals.length * 0.95)].toFixed(1),
            worstFrameMs: +intervals.at(-1).toFixed(1),
            longTasks: longTasks.length,
            blockingMs: +longTasks.reduce((sum, duration) => sum + Math.max(0, duration - 50), 0).toFixed(1),
            scrollY: Math.round(scrollY),
            scrollProgress: progressBar ? new DOMMatrixReadOnly(getComputedStyle(progressBar).transform).a : null,
            overflow: document.documentElement.scrollWidth > innerWidth,
          };
        });
        const after = await session.send('Performance.getMetrics');
        const delta = (name) => +((after.metrics.find((m) => m.name === name).value - before.metrics.find((m) => m.name === name).value) * 1000).toFixed(1);
        if (errors.length) throw new Error(`Preview errors: ${errors.join('; ')}`);
        if (sample.scrollY < 2000 || (!lite && (sample.scrollProgress === null || sample.scrollProgress < 0.95)) || sample.overflow) {
          throw new Error(`Scroll smoke failed: ${JSON.stringify(sample)}`);
        }
        console.log(JSON.stringify({ mode: lite ? 'lite' : 'full', device: mobile ? 'mobile' : 'desktop', run, cpuThrottle, ...sample, scriptMs: delta('ScriptDuration'), layoutMs: delta('LayoutDuration'), styleMs: delta('RecalcStyleDuration') }));
      } finally {
        await context.close();
      }
    }
  }
} finally {
  await browser.close();
}
