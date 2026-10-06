import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { createHiggsfieldClient, type V2Response } from '@higgsfield/client/v2';

loadEnv({ path: '.env.local', quiet: true });
const credentials = process.env.HF_CREDENTIALS;
if (!credentials) throw new Error('HF_CREDENTIALS is required.');
const directory = resolve('manual/generated-style-videos');
const endpoint = 'bytedance/seedance-2.0/text-to-video';
const negative = 'No watermark, logo, text, subtitles, extra fingers or limbs, deformed hands, distorted face, duplicate body, cropped head or feet, cartoon, anime, CGI, plastic skin, fisheye, bright background, daylight, outdoor or crowd.';
const camera = 'Single continuous portrait shot, locked-off tripod, 85mm lens, zero camera movement, zero shake, zero zoom or pan. Full adult dancer centred, head and feet visible, occupying 68% of frame height. Cinema-black background #0A0908, subtle volumetric haze and dust bokeh, soft falloff to black at the bottom. Slow subject motion only, micro-breathing, controlled natural anatomy. Complete a gentle movement cycle and return to the initial pose; identical opening and closing pose for looping. 24fps photorealistic cinematic footage.';
const jobs = [
  { key: 'contemporary', duration: 6, aspect_ratio: '9:16', prompt: `Adult female contemporary dancer in flowing beige silk costume, empty black theatre, soft diffused side light, bare feet. Slow fluid spiral floorwork and a gentle back arch, elegant melancholic expression, delicate fabric ripples. No fast cuts, no rapid movement, no ballet tutu, classical ballet or high heels. ${camera} ${negative}` },
  { key: 'heels', duration: 6, aspect_ratio: '9:16', prompt: `Adult female professional heels dancer in a black glossy dance bodysuit and black stiletto heels. Reflective black studio floor with a subtle natural mirror reflection, low rim light, controlled body wave and gentle hair sweep, confident poised gaze, elegant fashion editorial rather than explicit imagery. Static low camera angle 30cm from floor, full body visible with margin. No flat shoes, sneakers, tutu, streetwear or male dancer. ${camera} ${negative}` },
  { key: 'warp', duration: 4, aspect_ratio: '16:9', prompt: `First-person forward dolly flying through a dark velvet tunnel made of dissolving black silk and sparse golden light particles. Velvet curtains slowly part, a soft warm glow at the end, deep cinema-black shadows, photorealistic volumetric light and bokeh dust. Abstract transition, no dancer, no people, no faces, no silhouettes of humans. One continuous forward camera move, speed ramp peaking near the middle, elegant motion blur, no cuts, no looping, no white flash or overexposed endpoint. 24fps. No text, logo, watermark, cartoon or CGI look.` },
] as const;

async function checkpoint(key: string): Promise<V2Response | null> {
  try { return JSON.parse(await readFile(resolve(directory, `${key}.job.json`), 'utf8')) as V2Response; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
}
async function main() {
  await mkdir(directory, { recursive: true });
  const submit = process.argv.includes('--submit');
  const poll = process.argv.includes('--poll');
  if (!submit && !poll) throw new Error('Use --submit for authorized one-time jobs or --poll to resume existing jobs.');
  const client = createHiggsfieldClient({ credentials, maxRetries: 0, timeout: 120000 });
  for (const job of jobs) {
    let saved = await checkpoint(job.key);
    if (!saved && submit) {
      const input = { prompt: job.prompt, duration: job.duration, resolution: '4k', aspect_ratio: job.aspect_ratio, generate_audio: false };
      await writeFile(resolve(directory, `${job.key}.input.json`), JSON.stringify({ endpoint, input }, null, 2));
      // An intent survives a timeout: never blindly retry a potentially billed POST.
      const intent = resolve(directory, `${job.key}.submitted`);
      await writeFile(intent, new Date().toISOString(), { flag: 'wx' });
      saved = await client.subscribe(endpoint, { input, withPolling: false });
      await writeFile(resolve(directory, `${job.key}.job.json`), JSON.stringify(saved, null, 2));
      console.log(`${job.key}: ${saved.status}, request ${saved.request_id}`);
    }
    if (!saved) throw new Error(`No saved job for ${job.key}; no paid request submitted.`);
  }
  if (!poll) return;
  const deadline = Date.now() + 45 * 60 * 1000;
  const complete = new Set<string>();
  const failures: string[] = [];
  while (complete.size < jobs.length && Date.now() < deadline) {
    for (const job of jobs) {
      if (complete.has(job.key)) continue;
      const saved = (await checkpoint(job.key))!;
      const response = await fetch(`https://api.higgsfield.ai/requests/${saved.request_id}/status`, { headers: { Authorization: `Key ${credentials}` }, signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error(`Status ${job.key}: HTTP ${response.status}`);
      const status = await response.json() as V2Response;
      await writeFile(resolve(directory, `${job.key}.job.json`), JSON.stringify(status, null, 2));
      console.log(`${job.key}: ${status.status}`);
      if (status.status === 'failed' || status.status === 'nsfw') {
        failures.push(`${job.key}: ${status.status}`);
        complete.add(job.key);
        console.error(`${job.key} ${status.status}; no automatic paid retry. Continuing other jobs.`);
        continue;
      }
      if (status.status === 'completed') {
        if (!status.video?.url) throw new Error(`${job.key}: completed without a video URL.`);
        const video = await fetch(status.video.url, { signal: AbortSignal.timeout(120000) });
        if (!video.ok) throw new Error(`Download ${job.key}: HTTP ${video.status}`);
        await writeFile(resolve(directory, `${job.key}-4k-master.mp4`), Buffer.from(await video.arrayBuffer()));
        complete.add(job.key);
        console.log(`${job.key}: master saved`);
      }
    }
    if (complete.size < jobs.length) await new Promise((done) => setTimeout(done, 15000));
  }
  if (complete.size !== jobs.length) throw new Error('Generation still running; resume --poll, never resubmit.');
  if (failures.length) throw new Error(`Incomplete generation: ${failures.join(', ')}. Successful masters have been saved.`);
}
main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
