import { execFileSync } from 'node:child_process';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const inputDirectory = resolve('manual/generated-style-videos');
const keys = process.argv.slice(2);
if (!keys.length || keys.some((key) => !['contemporary', 'heels', 'warp'].includes(key))) throw new Error('Specify contemporary, heels and/or warp.');
const run = (args: string[]) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-threads', '2', ...args], { stdio: 'inherit' });
const probe = (path: string) => JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name,codec_type,width,height,r_frame_rate,nb_frames:format=duration,size', '-of', 'json', path], { encoding: 'utf8' })) as { streams: Array<{ codec_type: string; width: number; height: number; r_frame_rate: string }>; format: { duration: string; size: string } };
const report: Record<string, unknown> = {};
for (const key of keys) {
  const warp = key === 'warp';
  const master = resolve(inputDirectory, `${key}-4k-master.mp4`);
  const metadata = probe(master);
  const stream = metadata.streams.find((item) => item.codec_type === 'video');
  if (!stream || stream.width !== (warp ? 3840 : 2160) || stream.height !== (warp ? 2160 : 3840)) throw new Error(`${key}: requested 4K master dimensions not delivered.`);
  const frameCount = warp ? 53 : 84;
  const directory = resolve(warp ? 'public/media/warp/abstract' : `public/media/style-tiles/${key}`);
  await mkdir(directory, { recursive: true });
  const prepared = resolve(inputDirectory, `${key}-prepared.mp4`);
  if (warp) {
    run(['-i', master, '-vf', 'fps=24,scale=1920:1080:flags=lanczos,setsar=1', '-frames:v', String(frameCount), '-an', '-c:v', 'libx264', '-preset', 'fast', '-crf', '16', prepared]);
  } else {
    // Tail->head seam followed by the middle. 4.5s input minus 1s overlap = 3.5s.
    const filters = '[0:v]fps=24,scale=1080:1920:flags=lanczos,setsar=1,format=yuv420p,split=3[h][m][t];[h]trim=0:1,setpts=PTS-STARTPTS[head];[t]trim=3.5:4.5,setpts=PTS-STARTPTS[tail];[m]trim=1:3.5,setpts=PTS-STARTPTS[mid];[tail][head]xfade=transition=fade:duration=1:offset=0[seamed];[seamed][mid]concat=n=2:v=1[out]';
    run(['-filter_complex_threads', '1', '-i', master, '-filter_complex', filters, '-map', '[out]', '-frames:v', String(frameCount), '-an', '-c:v', 'libx264', '-preset', 'fast', '-crf', '16', prepared]);
  }
  const outputs: Record<string, unknown> = {};
  for (const size of [1280, 1920]) {
    const width = warp ? size : size === 1280 ? 720 : 1080;
    const height = warp ? size === 1280 ? 720 : 1080 : size;
    for (const format of ['h264', 'vp9', 'av1']) {
      const output = resolve(directory, `${key}-${size}-${format}.${format === 'h264' ? 'mp4' : 'webm'}`);
      const codec = format === 'h264' ? ['-c:v', 'libx264', '-preset', 'slow', '-crf', '22', '-movflags', '+faststart'] : format === 'vp9' ? ['-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '30', '-row-mt', '1', '-cpu-used', '4'] : ['-c:v', 'libsvtav1', '-crf', '32', '-preset', '8', '-svtav1-params', 'lp=2'];
      run(['-i', prepared, '-vf', `scale=${width}:${height}:flags=lanczos,setsar=1`, '-frames:v', String(frameCount), '-an', '-pix_fmt', 'yuv420p', ...codec, output]);
      const bytes = (await stat(output)).size;
      const actual = probe(output);
      const video = actual.streams.find((item) => item.codec_type === 'video');
      if (bytes > 7 * 1024 * 1024 || video?.width !== width || video.height !== height || video.r_frame_rate !== '24/1' || actual.streams.some((item) => item.codec_type === 'audio') || Math.abs(Number(actual.format.duration) - frameCount / 24) > 0.05) throw new Error(`${output}: output verification failed.`);
      outputs[`${size}-${format}`] = { bytes, ...actual };
    }
  }
  for (const format of ['jpg', 'webp']) run(['-i', prepared, '-frames:v', '1', '-q:v', format === 'jpg' ? '2' : '85', resolve(directory, `${key}-poster.${format}`)]);
  report[key] = { master: metadata, outputs };
  console.log(`${key}: verified renditions and posters saved to ${directory}`);
}
await writeFile(resolve(inputDirectory, 'encoding-report.json'), JSON.stringify(report, null, 2));
